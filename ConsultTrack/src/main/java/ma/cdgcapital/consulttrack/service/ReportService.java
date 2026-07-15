package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.dto.RpiBcLigneDTO;
import ma.cdgcapital.consulttrack.dto.RpiDisponibleDTO;
import ma.cdgcapital.consulttrack.dto.RpiHistoriqueLigneDTO;
import ma.cdgcapital.consulttrack.dto.RpiJourDTO;
import ma.cdgcapital.consulttrack.dto.RpiMensuelDTO;
import ma.cdgcapital.consulttrack.dto.RpiSemaineDTO;
import ma.cdgcapital.consulttrack.model.AffectationBC;
import ma.cdgcapital.consulttrack.model.BonDeCommande;
import ma.cdgcapital.consulttrack.model.Consultant;
import ma.cdgcapital.consulttrack.model.JourFerie;
import ma.cdgcapital.consulttrack.model.StatutPointage;
import ma.cdgcapital.consulttrack.model.TacheRealisee;
import ma.cdgcapital.consulttrack.repository.AffectationRepository;
import ma.cdgcapital.consulttrack.repository.BonDeCommandeRepository;
import ma.cdgcapital.consulttrack.repository.ConsultantRepository;
import ma.cdgcapital.consulttrack.repository.JourFerieRepository;
import ma.cdgcapital.consulttrack.repository.TacheRealiseeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Génération du "Relevé Périodique d'Intervention" (RPI) :
 * UN RPI = un consultant × un mois, couvrant TOUS ses Bons de Commande.
 * Seules les saisies VALIDÉES alimentent le document (relevé officiel).
 */
@Service
public class ReportService {

    private static final Locale FR = Locale.FRENCH;

    @Autowired private TacheRealiseeRepository tacheRepository;
    @Autowired private BonDeCommandeRepository bcRepository;
    @Autowired private ConsultantRepository consultantRepository;
    @Autowired private AffectationRepository affectationRepository;
    @Autowired private JourFerieRepository jourFerieRepository;

    // ==========================================================
    // RPI mensuel (consultant × mois, tous BC confondus)
    // ==========================================================
    public RpiMensuelDTO genererRpiMensuel(Long consultantId, int annee, int mois) {
        YearMonth ym = YearMonth.of(annee, mois);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        Consultant consultant = consultantRepository.findById(consultantId).orElse(null);

        RpiMensuelDTO rpi = new RpiMensuelDTO();
        rpi.setConsultantId(consultantId);
        if (consultant != null) {
            rpi.setConsultantNom(consultant.getNom() + " " + consultant.getPrenom());
            if (consultant.getCabinet() != null) {
                rpi.setCabinetNom(consultant.getCabinet().getNom());
            }
        }
        rpi.setMois(mois);
        rpi.setAnnee(annee);
        rpi.setMoisLabel(moisLabel(ym));
        rpi.setPeriodeDu(start.toString());
        rpi.setPeriodeAu(end.toString());

        List<BonDeCommande> bcsConsultant = bcRepository.findByConsultant_Id(consultantId);
        rpi.setMission(resoudreMission(consultantId, bcsConsultant));

        // Toutes les saisies (datées) du consultant
        List<TacheRealisee> toutes = tacheRepository.findByConsultantId(consultantId).stream()
                .filter(t -> t.getDate() != null)
                .toList();

        // Saisies VALIDÉES (seules à alimenter le RPI)
        List<TacheRealisee> validees = toutes.stream()
                .filter(t -> t.getStatut() == StatutPointage.VALIDE)
                .toList();

        // Présences validées (mode BC, rattachées à un BC)
        List<TacheRealisee> presencesValidees = validees.stream()
                .filter(ReportService::estPresenceBC)
                .toList();

        // --- Totaux MTD / STD (tous BC) ---
        double totalMtd = presencesValidees.stream()
                .filter(t -> !t.getDate().isBefore(start) && !t.getDate().isAfter(end))
                .mapToDouble(ReportService::dureeDe)
                .sum();
        double totalStd = presencesValidees.stream()
                .filter(t -> !t.getDate().isAfter(end))
                .mapToDouble(ReportService::dureeDe)
                .sum();
        rpi.setTotalMtd(totalMtd);
        rpi.setTotalStd(totalStd);

        // --- Statut agrégé du mois (toutes saisies du mois, tous statuts) ---
        List<TacheRealisee> saisiesDuMois = toutes.stream()
                .filter(t -> !t.getDate().isBefore(start) && !t.getDate().isAfter(end))
                .toList();
        rpi.setStatutMois(statutAgrege(saisiesDuMois));

        // --- Lignes BC (reliquats) ---
        rpi.setBcs(construireLignesBc(bcsConsultant, presencesValidees, start, end));

        // --- Grille des semaines (LUN → DIM, jours hors mois inclus) ---
        rpi.setSemaines(construireSemaines(validees, start, end));

        // --- Historique annuel ---
        List<RpiHistoriqueLigneDTO> historique =
                construireHistoriqueAnnuel(bcsConsultant, presencesValidees, annee);
        rpi.setHistoriqueAnnuel(historique);
        rpi.setTotauxAnnuels(totauxHistorique(historique));

        // « Validé » = double signature : consultant + responsable du cabinet.
        // (La présence n'a pas de validateur unique tracé → on prend le premier
        // RESPONSABLE dont le périmètre couvre le cabinet du consultant.)
        if ("VALIDE".equals(rpi.getStatutMois()) && consultant != null) {
            rpi.setSignatureConsultant(consultant.getSignatureImage());
            if (consultant.getCabinet() != null) {
                Long cabinetId = consultant.getCabinet().getId();
                consultantRepository.findAll().stream()
                        .filter(c -> c.getRole() == ma.cdgcapital.consulttrack.model.Role.RESPONSABLE)
                        .filter(c -> c.getCabinetsGeres() != null && c.getCabinetsGeres().stream()
                                .anyMatch(cab -> cab.getId().equals(cabinetId)))
                        .map(Consultant::getSignatureImage)
                        .filter(s -> s != null && !s.isBlank())
                        .findFirst()
                        .ifPresent(rpi::setSignatureResponsable);
            }
        }

        return rpi;
    }

    // ==========================================================
    // Mois de l'année pour lesquels un RPI est générable
    // ==========================================================
    public List<RpiDisponibleDTO> getRpiDisponibles(Long consultantId, int annee) {
        List<TacheRealisee> toutes = tacheRepository.findByConsultantId(consultantId).stream()
                .filter(t -> t.getDate() != null && t.getDate().getYear() == annee)
                .toList();

        // Présences validées de l'année, groupées par mois
        Map<Integer, List<TacheRealisee>> presencesParMois = toutes.stream()
                .filter(t -> t.getStatut() == StatutPointage.VALIDE)
                .filter(ReportService::estPresenceBC)
                .filter(t -> dureeDe(t) > 0)
                .collect(Collectors.groupingBy(t -> t.getDate().getMonthValue(), TreeMap::new,
                        Collectors.toList()));

        List<RpiDisponibleDTO> resultat = new ArrayList<>();
        for (Map.Entry<Integer, List<TacheRealisee>> e : presencesParMois.entrySet()) {
            int m = e.getKey();
            RpiDisponibleDTO dto = new RpiDisponibleDTO();
            dto.setMois(m);
            dto.setMoisLabel(moisLabel(YearMonth.of(annee, m)));
            dto.setTotalJH(e.getValue().stream().mapToDouble(ReportService::dureeDe).sum());
            dto.setNbBcs((int) e.getValue().stream()
                    .map(t -> t.getBonDeCommande().getId())
                    .distinct().count());
            dto.setStatutMois(statutAgrege(toutes.stream()
                    .filter(t -> t.getDate().getMonthValue() == m)
                    .toList()));
            resultat.add(dto);
        }
        return resultat;
    }

    // ==========================================================
    // Construction : lignes BC
    // ==========================================================
    private List<RpiBcLigneDTO> construireLignesBc(List<BonDeCommande> bcs,
                                                   List<TacheRealisee> presencesValidees,
                                                   LocalDate start, LocalDate end) {
        List<RpiBcLigneDTO> lignes = new ArrayList<>();
        for (BonDeCommande bc : bcs) {
            double avantMois = presencesValidees.stream()
                    .filter(t -> bc.getId().equals(t.getBonDeCommande().getId()))
                    .filter(t -> t.getDate().isBefore(start))
                    .mapToDouble(ReportService::dureeDe)
                    .sum();
            double consommeMois = presencesValidees.stream()
                    .filter(t -> bc.getId().equals(t.getBonDeCommande().getId()))
                    .filter(t -> !t.getDate().isBefore(start) && !t.getDate().isAfter(end))
                    .mapToDouble(ReportService::dureeDe)
                    .sum();
            double budget = bc.getJoursMax() != null ? bc.getJoursMax() : 0.0;
            double reliquatAvant = budget - avantMois;

            RpiBcLigneDTO ligne = new RpiBcLigneDTO();
            ligne.setBcId(bc.getId());
            ligne.setReference(bc.getReference());
            ligne.setJhBudget(bc.getJoursMax());
            ligne.setReliquatAvant(reliquatAvant);
            ligne.setConsommeMois(consommeMois);
            ligne.setJhRestant(reliquatAvant - consommeMois);
            lignes.add(ligne);
        }
        lignes.sort(Comparator.comparing(RpiBcLigneDTO::getReference,
                Comparator.nullsLast(Comparator.naturalOrder())));
        return lignes;
    }

    // ==========================================================
    // Construction : grille des semaines
    // ==========================================================
    private List<RpiSemaineDTO> construireSemaines(List<TacheRealisee> validees,
                                                   LocalDate start, LocalDate end) {
        // Jours fériés officiels de l'année (référentiel)
        Set<LocalDate> feries = jourFerieRepository
                .findByDateBetweenOrderByDate(start.withDayOfYear(1),
                        LocalDate.of(start.getYear(), 12, 31))
                .stream().map(JourFerie::getDate).collect(Collectors.toSet());

        // Index date -> saisie validée du mois (contrainte unique consultant+date)
        Map<LocalDate, TacheRealisee> parJour = new LinkedHashMap<>();
        validees.stream()
                .filter(t -> !t.getDate().isBefore(start) && !t.getDate().isAfter(end))
                .forEach(t -> parJour.putIfAbsent(t.getDate(), t));

        List<RpiSemaineDTO> semaines = new ArrayList<>();
        double cumulMois = 0.0;

        LocalDate cursor = start.with(DayOfWeek.MONDAY); // lundi de la semaine contenant le 1er
        while (!cursor.isAfter(end)) {
            RpiSemaineDTO sem = new RpiSemaineDTO();
            sem.setDu(cursor.toString());
            sem.setAu(cursor.plusDays(6).toString());

            List<RpiJourDTO> jours = new ArrayList<>();
            double totalSemaine = 0.0;

            LocalDate d = cursor;
            for (int i = 0; i < 7; i++) {
                RpiJourDTO jour = new RpiJourDTO();
                jour.setDate(d.toString());
                jour.setJourSemaine(lettreJour(d.getDayOfWeek()));

                boolean horsMois = d.isBefore(start) || d.isAfter(end);
                if (horsMois) {
                    jour.setType("HORS_MOIS");
                    jour.setValeur(null);
                } else {
                    TacheRealisee t = parJour.get(d);
                    boolean weekend = d.getDayOfWeek() == DayOfWeek.SATURDAY
                            || d.getDayOfWeek() == DayOfWeek.SUNDAY;
                    boolean ferie = feries.contains(d)
                            || (t != null && "FERIE".equalsIgnoreCase(t.getModeSaisie()));

                    if (weekend) {
                        jour.setType("WEEKEND");
                    } else if (ferie) {
                        jour.setType("FERIE");
                    } else if (t != null && "ABSENCE".equalsIgnoreCase(t.getModeSaisie())) {
                        jour.setType("ABSENCE");
                    } else if (t != null && "BC".equalsIgnoreCase(t.getModeSaisie())
                            && t.getBonDeCommande() != null) {
                        double v = dureeDe(t);
                        jour.setType("PRESENCE");
                        jour.setValeur(v);
                        jour.setBcReference(t.getBonDeCommande().getReference());
                        totalSemaine += v;
                    } else {
                        jour.setType("VIDE");
                    }
                }
                jours.add(jour);
                d = d.plusDays(1);
            }

            cumulMois += totalSemaine;
            sem.setJours(jours);
            sem.setTotalSemaine(totalSemaine);
            sem.setTotalMtd(cumulMois);
            semaines.add(sem);

            cursor = cursor.plusWeeks(1);
        }
        return semaines;
    }

    // ==========================================================
    // Construction : historique annuel
    // ==========================================================
    private List<RpiHistoriqueLigneDTO> construireHistoriqueAnnuel(List<BonDeCommande> bcs,
                                                                   List<TacheRealisee> presencesValidees,
                                                                   int annee) {
        List<RpiHistoriqueLigneDTO> lignes = new ArrayList<>();
        for (BonDeCommande bc : bcs) {
            List<Double> parMois = new ArrayList<>(12);
            for (int m = 1; m <= 12; m++) parMois.add(0.0);

            double totalConsomme = 0.0;
            for (TacheRealisee t : presencesValidees) {
                if (!bc.getId().equals(t.getBonDeCommande().getId())) continue;
                if (t.getDate().getYear() != annee) continue;
                int idx = t.getDate().getMonthValue() - 1;
                double v = dureeDe(t);
                parMois.set(idx, parMois.get(idx) + v);
                totalConsomme += v;
            }

            double budget = bc.getJoursMax() != null ? bc.getJoursMax() : 0.0;
            RpiHistoriqueLigneDTO ligne = new RpiHistoriqueLigneDTO();
            ligne.setBcId(bc.getId());
            ligne.setReference(bc.getReference());
            ligne.setJoursBdc(bc.getJoursMax());
            ligne.setTotalConsomme(totalConsomme);
            ligne.setJoursRestants(budget - totalConsomme);
            ligne.setParMois(parMois);
            lignes.add(ligne);
        }
        lignes.sort(Comparator.comparing(RpiHistoriqueLigneDTO::getReference,
                Comparator.nullsLast(Comparator.naturalOrder())));
        return lignes;
    }

    private RpiHistoriqueLigneDTO totauxHistorique(List<RpiHistoriqueLigneDTO> lignes) {
        RpiHistoriqueLigneDTO totaux = new RpiHistoriqueLigneDTO();
        totaux.setReference("Totaux");
        double budget = 0.0, consomme = 0.0, restants = 0.0;
        List<Double> parMois = new ArrayList<>(12);
        for (int m = 0; m < 12; m++) parMois.add(0.0);
        for (RpiHistoriqueLigneDTO l : lignes) {
            budget += l.getJoursBdc() != null ? l.getJoursBdc() : 0.0;
            consomme += l.getTotalConsomme() != null ? l.getTotalConsomme() : 0.0;
            restants += l.getJoursRestants() != null ? l.getJoursRestants() : 0.0;
            for (int m = 0; m < 12; m++) {
                parMois.set(m, parMois.get(m) + l.getParMois().get(m));
            }
        }
        totaux.setJoursBdc(budget);
        totaux.setTotalConsomme(consomme);
        totaux.setJoursRestants(restants);
        totaux.setParMois(parMois);
        return totaux;
    }

    // ==========================================================
    // Helpers
    // ==========================================================
    private String resoudreMission(Long consultantId, List<BonDeCommande> bcs) {
        String mission = affectationRepository.findByConsultantId(consultantId).stream()
                .map(AffectationBC::getDesignationMission)
                .filter(d -> d != null && !d.isBlank())
                .findFirst()
                .orElse(null);
        if (mission != null) return mission;
        return bcs.stream()
                .map(BonDeCommande::getDesignation)
                .filter(d -> d != null && !d.isBlank())
                .findFirst()
                .orElse("");
    }

    /**
     * Agrégat des statuts des saisies d'un mois :
     * VIDE si aucune saisie (ou uniquement des rejets) ;
     * VALIDE / EN_ATTENTE / BROUILLON si toutes les saisies non rejetées partagent ce statut ;
     * MIXTE sinon.
     */
    private static String statutAgrege(List<TacheRealisee> saisies) {
        if (saisies == null || saisies.isEmpty()) return "VIDE";
        Set<StatutPointage> statuts = new HashSet<>();
        for (TacheRealisee t : saisies) {
            if (t.getStatut() != null && t.getStatut() != StatutPointage.REJETE) {
                statuts.add(t.getStatut());
            }
        }
        if (statuts.isEmpty()) return "VIDE";
        if (statuts.size() > 1) return "MIXTE";
        return statuts.iterator().next().name();
    }

    private static boolean estPresenceBC(TacheRealisee t) {
        return "BC".equalsIgnoreCase(t.getModeSaisie()) && t.getBonDeCommande() != null;
    }

    private static double dureeDe(TacheRealisee t) {
        return t.getDuree() != null ? t.getDuree() : 0.0;
    }

    private static String moisLabel(YearMonth ym) {
        return capitalize(ym.getMonth().getDisplayName(TextStyle.FULL, FR)) + " " + ym.getYear();
    }

    private static String lettreJour(DayOfWeek dow) {
        switch (dow) {
            case MONDAY: return "L";
            case TUESDAY: return "M";
            case WEDNESDAY: return "M";
            case THURSDAY: return "J";
            case FRIDAY: return "V";
            case SATURDAY: return "S";
            default: return "D";
        }
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
