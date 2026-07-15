package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.dto.JourRpiDTO;
import ma.cdgcapital.consulttrack.dto.RpiDisponibleDTO;
import ma.cdgcapital.consulttrack.dto.RpiMoisDTO;
import ma.cdgcapital.consulttrack.dto.SemaineDTO;
import ma.cdgcapital.consulttrack.model.BonDeCommande;
import ma.cdgcapital.consulttrack.model.Consultant;
import ma.cdgcapital.consulttrack.model.StatutPointage;
import ma.cdgcapital.consulttrack.model.TacheRealisee;
import ma.cdgcapital.consulttrack.repository.BonDeCommandeRepository;
import ma.cdgcapital.consulttrack.repository.ConsultantRepository;
import ma.cdgcapital.consulttrack.repository.TacheRealiseeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ReportService {

    private static final Locale FR = Locale.FRENCH;

    @Autowired private TacheRealiseeRepository tacheRepository;
    @Autowired private BonDeCommandeRepository bcRepository;
    @Autowired private ConsultantRepository consultantRepository;

    // ==========================================================
    // Génération du RPI d'un mois pour un BC donné
    // (uniquement à partir des saisies VALIDÉES — contrôle de cohérence)
    // ==========================================================
    public RpiMoisDTO genererDonneesRPI(Long consultantId, Long bcId, int annee, int mois) {
        YearMonth ym = YearMonth.of(annee, mois);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        Consultant consultant = consultantRepository.findById(consultantId).orElse(null);
        BonDeCommande bc = bcRepository.findById(bcId).orElse(null);

        RpiMoisDTO rpi = new RpiMoisDTO();
        rpi.setConsultantId(consultantId);
        if (consultant != null) {
            rpi.setConsultantNom(consultant.getNom() + " " + consultant.getPrenom());
        }
        rpi.setBcId(bcId);
        rpi.setMois(mois);
        rpi.setAnnee(annee);
        rpi.setMoisLabel(capitalize(ym.getMonth().getDisplayName(TextStyle.FULL, FR)) + " " + annee);
        if (bc != null) {
            rpi.setReferenceBC(bc.getReference());
            rpi.setDesignationBC(bc.getDesignation());
            rpi.setJhBudgetBC(bc.getJoursMax());
        }

        // Toutes les saisies VALIDÉES du consultant (pour le cumul BC historique + le mois)
        List<TacheRealisee> validees = tacheRepository.findByConsultantId(consultantId).stream()
                .filter(t -> t.getStatut() == StatutPointage.VALIDE)
                .filter(t -> t.getDate() != null)
                .toList();

        // Cumul consommé sur CE BC avant le 1er du mois
        double jhAvantMois = validees.stream()
                .filter(t -> t.getBonDeCommande() != null && t.getBonDeCommande().getId().equals(bcId))
                .filter(t -> t.getDate().isBefore(start))
                .mapToDouble(t -> t.getDuree() != null ? t.getDuree() : 0.0)
                .sum();

        // Index date -> saisie du mois (une saisie par jour : contrainte unique consultant_id+date)
        Map<LocalDate, TacheRealisee> parJour = new LinkedHashMap<>();
        validees.stream()
                .filter(t -> !t.getDate().isBefore(start) && !t.getDate().isAfter(end))
                .forEach(t -> parJour.putIfAbsent(t.getDate(), t));

        List<SemaineDTO> semaines = new ArrayList<>();
        double consommeMois = 0.0;

        // On démarre le lundi de la semaine contenant le 1er du mois
        LocalDate cursor = start.with(DayOfWeek.MONDAY);
        while (!cursor.isAfter(end)) {
            SemaineDTO sem = new SemaineDTO();
            List<JourRpiDTO> jours = new ArrayList<>();
            double totalSemaine = 0.0;

            LocalDate d = cursor;
            for (int i = 0; i < 7; i++) {
                JourRpiDTO jr = new JourRpiDTO();
                jr.setDate(d);
                jr.setNumeroJour(d.getDayOfMonth());
                jr.setJourSemaine(jourAbrege(d.getDayOfWeek()));
                jr.setValeur(0.0);

                boolean horsMois = d.isBefore(start) || d.isAfter(end);
                boolean weekend = d.getDayOfWeek() == DayOfWeek.SATURDAY
                        || d.getDayOfWeek() == DayOfWeek.SUNDAY;

                if (horsMois) {
                    jr.setType("VIDE");
                } else if (weekend) {
                    jr.setType("WEEKEND");
                } else {
                    TacheRealisee t = parJour.get(d);
                    if (t == null) {
                        jr.setType("VIDE");
                    } else {
                        String mode = t.getModeSaisie();
                        double v = t.getDuree() != null ? t.getDuree() : 0.0;
                        if ("ABSENCE".equalsIgnoreCase(mode)) {
                            jr.setType("ABSENCE");
                            jr.setValeur(v);
                        } else if ("FERIE".equalsIgnoreCase(mode)) {
                            jr.setType("FERIE");
                            jr.setValeur(v);
                        } else if (t.getBonDeCommande() != null
                                && t.getBonDeCommande().getId().equals(bcId)) {
                            jr.setType("PRESENCE");
                            jr.setValeur(v);
                            jr.setTypePrestation(t.getTypePrestation());
                            totalSemaine += v;
                        } else if (t.getBonDeCommande() != null) {
                            jr.setType("AUTRE_BC");
                            jr.setValeur(v);
                            jr.setReferenceBcSaisi(t.getBonDeCommande().getReference());
                        } else {
                            jr.setType("VIDE");
                        }
                    }
                }
                jours.add(jr);
                d = d.plusDays(1);
            }

            consommeMois += totalSemaine;
            sem.setPeriode(periodeSemaine(cursor, cursor.plusDays(6), start, end));
            sem.setJours(jours);
            sem.setTotalSemaine(totalSemaine);
            sem.setTotalMtd(consommeMois);
            sem.setTotalStd(jhAvantMois + consommeMois);
            semaines.add(sem);

            cursor = cursor.plusWeeks(1);
        }

        rpi.setJhAvantMois(jhAvantMois);
        rpi.setConsommeMois(consommeMois);
        rpi.setJhApresMois(jhAvantMois + consommeMois);
        if (bc != null && bc.getJoursMax() != null) {
            rpi.setJhRestant(bc.getJoursMax() - (jhAvantMois + consommeMois));
        }
        rpi.setSemaines(semaines);
        return rpi;
    }

    // ==========================================================
    // Liste des RPI générables (BC × mois avec présence validée)
    // ==========================================================
    public List<RpiDisponibleDTO> getRpiDisponibles(Long consultantId, int annee) {
        List<TacheRealisee> presencesValidees = tacheRepository.findByConsultantId(consultantId).stream()
                .filter(t -> t.getStatut() == StatutPointage.VALIDE)
                .filter(t -> t.getDate() != null && t.getDate().getYear() == annee)
                .filter(t -> t.getBonDeCommande() != null)
                .filter(t -> t.getDuree() != null && t.getDuree() > 0)
                .toList();

        // Agrégation par (bcId, mois)
        Map<String, RpiDisponibleDTO> agregat = new LinkedHashMap<>();
        for (TacheRealisee t : presencesValidees) {
            int m = t.getDate().getMonthValue();
            Long bcId = t.getBonDeCommande().getId();
            String cle = bcId + "-" + m;
            RpiDisponibleDTO dto = agregat.computeIfAbsent(cle, k -> {
                RpiDisponibleDTO d = new RpiDisponibleDTO();
                d.setBcId(bcId);
                d.setReferenceBC(t.getBonDeCommande().getReference());
                d.setMois(m);
                d.setMoisLabel(capitalize(YearMonth.of(annee, m).getMonth()
                        .getDisplayName(TextStyle.FULL, FR)));
                d.setConsommeMois(0.0);
                return d;
            });
            dto.setConsommeMois(dto.getConsommeMois() + t.getDuree());
        }

        return agregat.values().stream()
                .sorted(Comparator.comparingInt(RpiDisponibleDTO::getMois)
                        .thenComparing(RpiDisponibleDTO::getReferenceBC))
                .toList();
    }

    // ==========================================================
    // Helpers
    // ==========================================================
    private static String jourAbrege(DayOfWeek dow) {
        switch (dow) {
            case MONDAY: return "LUN";
            case TUESDAY: return "MAR";
            case WEDNESDAY: return "MER";
            case THURSDAY: return "JEU";
            case FRIDAY: return "VEN";
            case SATURDAY: return "SAM";
            default: return "DIM";
        }
    }

    private static String periodeSemaine(LocalDate weekStart, LocalDate weekEnd,
                                         LocalDate monthStart, LocalDate monthEnd) {
        LocalDate from = weekStart.isBefore(monthStart) ? monthStart : weekStart;
        LocalDate to = weekEnd.isAfter(monthEnd) ? monthEnd : weekEnd;
        String moisAbr = to.getMonth().getDisplayName(TextStyle.SHORT, FR);
        return String.format("%02d–%02d %s", from.getDayOfMonth(), to.getDayOfMonth(), moisAbr);
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
