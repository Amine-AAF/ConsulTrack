package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.dto.*;
import ma.cdgcapital.consulttrack.exception.BusinessException;
import ma.cdgcapital.consulttrack.model.*;
import ma.cdgcapital.consulttrack.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    @Autowired private ConsultantRepository consultantRepository;
    @Autowired private TacheRealiseeRepository tacheRepository;
    @Autowired private BonDeCommandeRepository bcRepository;
    @Autowired private AbsenceRepository absenceRepository;
    @Autowired private CabinetRepository cabinetRepository;
    @Autowired private JourFerieRepository jourFerieRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    // ==========================================
    // 1. DASHBOARD & TIMESHEET (Lecture)
    // ==========================================

    public List<ConsultantDashboardDTO> getGlobalReport(Long cabinetId, int annee) {
        List<BonDeCommande> bcs = bcRepository.findAll();
        List<ConsultantDashboardDTO> report = new ArrayList<>();

        for (BonDeCommande bc : bcs) {
            if (bc.getConsultant() == null) continue;

            if (cabinetId != null) {
                if (bc.getConsultant().getCabinet() == null
                        || !bc.getConsultant().getCabinet().getId().equals(cabinetId)) {
                    continue;
                }
            }

            ConsultantDashboardDTO dto = new ConsultantDashboardDTO();
            Consultant cons = bc.getConsultant();

            dto.setNomConsultant(cons.getNom() + " " + cons.getPrenom());
            dto.setNomCabinet(cons.getCabinet() != null ? cons.getCabinet().getNom() : "Sans Cabinet");
            dto.setReferenceBC(bc.getReference());
            dto.setBcId(bc.getId());
            dto.setTotalJoursBC(bc.getJoursMax());
            dto.setTjm(bc.getTjm());
            dto.setDescriptionCodeBudgetaire(bc.getCodeBudget());

            List<TacheRealisee> taches = tacheRepository.findByConsultantId(cons.getId()).stream()
                    .filter(t -> t.getBonDeCommande() != null
                            && t.getBonDeCommande().getId().equals(bc.getId())
                            && t.getDate() != null
                            && t.getDate().getYear() == annee
                            && t.getStatut() == StatutPointage.VALIDE)
                    .collect(Collectors.toList());

            Double totalYTD = 0.0;
            Double[] mensuel = new Double[12];
            for (int i = 0; i < 12; i++) mensuel[i] = 0.0;

            for (TacheRealisee t : taches) {
                if (t.getDuree() == null) continue;
                int monthIdx = t.getDate().getMonthValue() - 1;
                mensuel[monthIdx] += t.getDuree();
                totalYTD += t.getDuree();
            }

            dto.setMensuel(mensuel);
            dto.setJoursConsommesYTD(totalYTD);

            double max = bc.getJoursMax() != null ? bc.getJoursMax() : 0.0;
            dto.setJoursRestants(max - totalYTD);

            double tjm = bc.getTjm() != null ? bc.getTjm() : 0.0;
            dto.setMontantConsommeYTD(totalYTD * tjm);
            dto.setBudgetConsommeHT(dto.getMontantConsommeYTD());

            report.add(dto);
        }
        return report;
    }

    public boolean isMoisPrecedentValide(Long consultantId, int annee, int mois) {
        int moisPrev = mois - 1;
        int anneePrev = annee;
        if (moisPrev == 0) {
            moisPrev = 12;
            anneePrev = annee - 1;
        }

        List<TacheRealisee> historique = tacheRepository
                .findByConsultantIdAndAnneeAndMois(consultantId, anneePrev, moisPrev);

        if (historique.isEmpty()) return true;
        return historique.stream().allMatch(t -> t.getStatut() == StatutPointage.VALIDE);
    }

    // ==========================================
    // 2. SAUVEGARDE DES POINTAGES
    // ==========================================

    @Transactional
    public void sauvegarderPointagesMensuels(Long consultantId, int annee, int mois,
                                             List<PointageRequest> requests) {
        Consultant consultant = consultantRepository.findById(consultantId)
                .orElseThrow(() -> new BusinessException("Consultant introuvable"));

        // Une soumission = au moins une ligne qui n'est pas un simple brouillon (→ EN_ATTENTE).
        boolean estSoumission = requests.stream()
                .anyMatch(r -> !"BROUILLON".equalsIgnoreCase(r.getStatut()));

        // Verrou séquentiel : on ne soumet pas le mois N tant que le mois N-1 n'est pas validé.
        if (estSoumission && !isMoisPrecedentValide(consultantId, annee, mois)) {
            throw new BusinessException(
                    "Le mois précédent n'est pas encore validé : impossible de soumettre "
                    + mois + "/" + annee + " tant que le mois précédent est en cours de validation.");
        }

        Set<Long> bcsImpactes = new HashSet<>();

        for (PointageRequest req : requests) {
            LocalDate date = LocalDate.parse(req.getDate());

            // RÈGLE CLÉ : une absence VALIDÉE verrouille le jour — présence interdite (rejet explicite).
            if ("BC".equalsIgnoreCase(req.getMode())
                    && absenceRepository.existsByConsultantIdAndDateAndStatut(
                            consultantId, date, StatutPointage.VALIDE)) {
                throw new BusinessException("Jour " + date + " verrouillé : une absence validée "
                        + "existe. Impossible d'y pointer une présence.");
            }
            // Jour férié global : non pointable en présence.
            if ("BC".equalsIgnoreCase(req.getMode()) && jourFerieRepository.existsByDate(date)) {
                throw new BusinessException("Jour " + date + " est férié : présence impossible.");
            }

            TacheRealisee tache = tacheRepository
                    .findByConsultantIdAndDate(consultantId, date)
                    .orElse(new TacheRealisee());

            // Verrou : ligne validée ou en attente → on ne modifie pas
            if (tache.getId() != null && tache.getStatut() == StatutPointage.VALIDE) {
                continue;
            }
            if (tache.getId() != null && tache.getStatut() == StatutPointage.EN_ATTENTE) {
                throw new BusinessException("La saisie du " + date
                        + " est déjà en cours de validation. Attendez le rejet pour la modifier.");
            }

            tache.setConsultant(consultant);
            tache.setDate(date);
            tache.setAnnee(annee);
            tache.setMois(mois);
            tache.setDuree(req.getDuree());
            tache.setModeSaisie(req.getMode());
            tache.setDescriptionTache(req.getDescriptionTache());
            tache.setTicketJira(req.getTicketJira());
            tache.setTypePrestation(req.getTypePrestation());

            // Statut cible
            StatutPointage statutCible = "BROUILLON".equalsIgnoreCase(req.getStatut())
                    ? StatutPointage.BROUILLON
                    : StatutPointage.EN_ATTENTE;
            tache.setStatut(statutCible);

            // Effacer l'éventuel motif de rejet précédent (nouvelle saisie)
            tache.setMotifRejet(null);

            if ("BC".equals(req.getMode()) && req.getBcId() != null) {
                BonDeCommande bc = bcRepository.findById(req.getBcId())
                        .orElseThrow(() -> new BusinessException("BC introuvable: " + req.getBcId()));

                // Vérif dépassement budget (seulement si la saisie sera engagée : EN_ATTENTE ou VALIDE)
                if (statutCible == StatutPointage.EN_ATTENTE) {
                    // Calcule l'engagement actuel SANS cette tâche en cours
                    Double engagementActuel = tacheRepository.sumDureeByBcAndStatutIn(
                            bc.getId(),
                            Arrays.asList(StatutPointage.EN_ATTENTE, StatutPointage.VALIDE));
                    double ancienDelta = 0.0;
                    if (tache.getId() != null && tache.getBonDeCommande() != null
                            && tache.getBonDeCommande().getId().equals(bc.getId())
                            && (tache.getStatut() == StatutPointage.EN_ATTENTE
                                || tache.getStatut() == StatutPointage.VALIDE)) {
                        ancienDelta = tache.getDuree() != null ? tache.getDuree() : 0.0;
                    }
                    double nouvelEngagement = engagementActuel - ancienDelta + req.getDuree();
                    if (bc.getJoursMax() != null && nouvelEngagement > bc.getJoursMax()) {
                        throw new BusinessException("Dépassement du budget du BC "
                                + bc.getReference() + " (" + nouvelEngagement + "/" + bc.getJoursMax() + ")");
                    }
                }

                tache.setBonDeCommande(bc);
                bcsImpactes.add(bc.getId());
            } else {
                if (tache.getBonDeCommande() != null) {
                    bcsImpactes.add(tache.getBonDeCommande().getId());
                }
                tache.setBonDeCommande(null);
            }

            tacheRepository.save(tache);
        }

        // Recalcul des compteurs des BC touchés
        for (Long bcId : bcsImpactes) {
            recalculerCompteursBC(bcId);
        }

        // Contrôle de cohérence : à la soumission, chaque jour ouvré doit être renseigné.
        if (estSoumission) {
            verifierCouvertureJoursOuvres(consultantId, annee, mois);
        }
    }

    /**
     * Vérifie que tous les jours ouvrés (hors week-ends) du mois sont couverts par une saisie
     * (présence, absence ou férié) au statut EN_ATTENTE ou VALIDE — via {@link TacheRealisee}
     * ou via une demande d'{@link Absence}. Lève une exception listant les jours manquants.
     */
    private void verifierCouvertureJoursOuvres(Long consultantId, int annee, int mois) {
        YearMonth ym = YearMonth.of(annee, mois);

        Set<LocalDate> couverts = new HashSet<>();
        tacheRepository.findByConsultantIdAndAnneeAndMois(consultantId, annee, mois).stream()
                .filter(t -> t.getStatut() == StatutPointage.EN_ATTENTE
                        || t.getStatut() == StatutPointage.VALIDE)
                .map(TacheRealisee::getDate)
                .filter(Objects::nonNull)
                .forEach(couverts::add);

        absenceRepository.findByConsultantId(consultantId).stream()
                .filter(a -> a.getDate() != null
                        && a.getDate().getYear() == annee
                        && a.getDate().getMonthValue() == mois)
                .filter(a -> a.getStatut() == StatutPointage.EN_ATTENTE
                        || a.getStatut() == StatutPointage.VALIDE)
                .forEach(a -> couverts.add(a.getDate()));

        // Jours fériés globaux : exemptés de saisie (couverts d'office).
        jourFerieRepository.findByDateBetweenOrderByDate(ym.atDay(1), ym.atEndOfMonth())
                .forEach(jf -> couverts.add(jf.getDate()));

        List<String> manquants = new ArrayList<>();
        for (LocalDate d = ym.atDay(1); !d.isAfter(ym.atEndOfMonth()); d = d.plusDays(1)) {
            DayOfWeek dow = d.getDayOfWeek();
            if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) continue;
            if (!couverts.contains(d)) manquants.add(String.valueOf(d.getDayOfMonth()));
        }

        if (!manquants.isEmpty()) {
            throw new BusinessException(
                    "Saisie incomplète : chaque jour ouvré doit être renseigné (présence, absence ou férié). "
                    + "Jours manquants : " + String.join(", ", manquants) + ".");
        }
    }

    public List<TacheRealisee> getPointagesMensuels(Long consultantId, int annee, int mois) {
        return tacheRepository.findByConsultantIdAndAnneeAndMois(consultantId, annee, mois);
    }

    // ==========================================
    // 3. RECALCUL BC (Option D — double compteur)
    // ==========================================

    /**
     * Recalcule joursConsommes (statut=VALIDE) et joursEngages (statut IN (EN_ATTENTE, VALIDE)).
     * À appeler après chaque création/modification/validation/rejet d'une tâche.
     */
    @Transactional
    public void recalculerCompteursBC(Long bcId) {
        BonDeCommande bc = bcRepository.findById(bcId)
                .orElseThrow(() -> new BusinessException("BC introuvable: " + bcId));

        Double consommes = tacheRepository.sumDureeByBcAndStatut(bcId, StatutPointage.VALIDE);
        Double engages = tacheRepository.sumDureeByBcAndStatutIn(
                bcId, Arrays.asList(StatutPointage.EN_ATTENTE, StatutPointage.VALIDE));

        bc.setJoursConsommes(consommes != null ? consommes : 0.0);
        bc.setJoursEngages(engages != null ? engages : 0.0);

        if (bc.getTjm() != null) {
            bc.setMontantConsomme(bc.getJoursConsommes() * bc.getTjm());
        }
        bcRepository.save(bc);
    }

    // ==========================================
    // 4. CRUD ADMINISTRATIF
    // ==========================================

    public List<Cabinet> getAllCabinets() { return cabinetRepository.findAll(); }
    public Cabinet saveCabinet(Cabinet cabinet) { return cabinetRepository.save(cabinet); }

    @Transactional
    public Cabinet updateCabinet(Long id, Cabinet maj) {
        Cabinet c = cabinetRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Cabinet introuvable: " + id));
        if (maj.getNom() != null) c.setNom(maj.getNom());
        c.setAdresse(maj.getAdresse());
        c.setIce(maj.getIce());
        c.setIdentifiantFiscal(maj.getIdentifiantFiscal());
        c.setPatente(maj.getPatente());
        c.setRib(maj.getRib());
        return cabinetRepository.save(c);
    }

    @Transactional
    public void deleteCabinet(Long id) {
        boolean utilise = consultantRepository.findAll().stream()
                .anyMatch(c -> c.getCabinet() != null && c.getCabinet().getId().equals(id));
        if (utilise) {
            throw new BusinessException("Impossible de supprimer : des consultants sont rattachés à ce cabinet.");
        }
        cabinetRepository.deleteById(id);
    }

    @Transactional
    public Consultant updateConsultant(Long id, Consultant maj) {
        Consultant c = consultantRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Consultant introuvable: " + id));
        if (maj.getNom() != null) c.setNom(maj.getNom());
        if (maj.getPrenom() != null) c.setPrenom(maj.getPrenom());
        if (maj.getEmail() != null && !maj.getEmail().isBlank()) c.setEmail(maj.getEmail());
        if (maj.getRole() != null) c.setRole(maj.getRole());
        if (maj.getCabinet() != null && maj.getCabinet().getId() != null) {
            c.setCabinet(cabinetRepository.findById(maj.getCabinet().getId())
                    .orElseThrow(() -> new BusinessException("Cabinet introuvable")));
        }
        if (maj.getPassword() != null && !maj.getPassword().isBlank()) {
            c.setPassword(passwordEncoder.encode(maj.getPassword()));
        }
        if (maj.getCabinetsGeresIds() != null) {
            java.util.Set<Cabinet> cabinets = new HashSet<>();
            for (Long cid : maj.getCabinetsGeresIds()) {
                cabinets.add(cabinetRepository.findById(cid)
                        .orElseThrow(() -> new BusinessException("Cabinet introuvable: " + cid)));
            }
            c.setCabinetsGeres(cabinets);
        }
        return consultantRepository.save(c);
    }

    @Transactional
    public void deleteConsultant(Long id) {
        boolean aDesDonnees = !tacheRepository.findByConsultantId(id).isEmpty()
                || !absenceRepository.findByConsultantId(id).isEmpty()
                || bcRepository.findAll().stream()
                    .anyMatch(b -> b.getConsultant() != null && b.getConsultant().getId().equals(id));
        if (aDesDonnees) {
            throw new BusinessException("Impossible de supprimer : ce consultant a des pointages, "
                    + "absences ou BC. Supprimez/réaffectez d'abord ses données.");
        }
        consultantRepository.deleteById(id);
    }

    public List<Consultant> getAllConsultants() { return consultantRepository.findAll(); }

    public Consultant saveConsultant(Consultant consultant) {
        // Rôle par défaut : CONSULTANT (l'endpoint de création est réservé à l'ADMIN)
        if (consultant.getRole() == null) {
            consultant.setRole(Role.CONSULTANT);
        }
        // Un compte doit pouvoir se connecter : mot de passe requis à la création
        if (consultant.getId() == null
                && (consultant.getPassword() == null || consultant.getPassword().isBlank())) {
            throw new BusinessException("Le mot de passe initial est obligatoire.");
        }
        // Encoder le mot de passe si non BCrypt
        if (consultant.getPassword() != null && !consultant.getPassword().isBlank()
                && !consultant.getPassword().startsWith("$2a$")
                && !consultant.getPassword().startsWith("$2b$")
                && !consultant.getPassword().startsWith("$2y$")) {
            consultant.setPassword(passwordEncoder.encode(consultant.getPassword()));
        }
        // Périmètre d'un RESPONSABLE : cabinets gérés (ids transmis par le JSON)
        if (consultant.getCabinetsGeresIds() != null) {
            java.util.Set<Cabinet> cabinets = new HashSet<>();
            for (Long cid : consultant.getCabinetsGeresIds()) {
                cabinets.add(cabinetRepository.findById(cid)
                        .orElseThrow(() -> new BusinessException("Cabinet introuvable: " + cid)));
            }
            consultant.setCabinetsGeres(cabinets);
        }
        return consultantRepository.save(consultant);
    }

    public List<BonDeCommande> getAllBCs() { return bcRepository.findAll(); }

    public BonDeCommande saveBC(BonDeCommande bc) {
        if (bc.getConsultantId() != null) {
            Consultant c = consultantRepository.findById(bc.getConsultantId())
                    .orElseThrow(() -> new BusinessException(
                            "Consultant introuvable: " + bc.getConsultantId()));
            bc.setConsultant(c);
        }
        // Nature déduite du code budgétaire : R… = RUN, P… = PROJET
        if (bc.getCodeBudget() != null && !bc.getCodeBudget().isBlank()) {
            char c = Character.toUpperCase(bc.getCodeBudget().trim().charAt(0));
            if (c == 'R') bc.setNature(NatureActivite.RUN);
            else if (c == 'P') bc.setNature(NatureActivite.PROJET);
        }
        if (bc.getJoursConsommes() == null) bc.setJoursConsommes(0.0);
        if (bc.getJoursEngages() == null) bc.setJoursEngages(0.0);
        if (bc.getMontantConsomme() == null) bc.setMontantConsomme(0.0);
        return bcRepository.save(bc);
    }

    // ==========================================
    // 5. VALIDATION / REJET (UNITAIRE)
    // ==========================================

    public List<TacheRealisee> getPendingSaisies() {
        return tacheRepository.findByStatut(StatutPointage.EN_ATTENTE);
    }

    @Transactional
    public void validerSaisie(Long id) {
        TacheRealisee t = tacheRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Saisie introuvable: " + id));
        t.setStatut(StatutPointage.VALIDE);
        t.setMotifRejet(null);
        tacheRepository.save(t);

        if (t.getBonDeCommande() != null) {
            recalculerCompteursBC(t.getBonDeCommande().getId());
        }
    }

    @Transactional
    public void rejeterSaisie(Long id, String motif) {
        TacheRealisee t = tacheRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Saisie introuvable: " + id));
        t.setStatut(StatutPointage.REJETE);
        t.setMotifRejet(motif);
        tacheRepository.save(t);

        if (t.getBonDeCommande() != null) {
            recalculerCompteursBC(t.getBonDeCommande().getId());
        }
    }

    // ==========================================
    // 6. VALIDATION DE MASSE (mois entier) — P3
    // ==========================================

    @Transactional
    public int validerMois(Long consultantId, int annee, int mois) {
        List<TacheRealisee> taches = tacheRepository.findByConsultantStatutAndPeriode(
                consultantId, StatutPointage.EN_ATTENTE, annee, mois);

        Set<Long> bcsImpactes = new HashSet<>();
        for (TacheRealisee t : taches) {
            t.setStatut(StatutPointage.VALIDE);
            t.setMotifRejet(null);
            if (t.getBonDeCommande() != null) {
                bcsImpactes.add(t.getBonDeCommande().getId());
            }
        }
        tacheRepository.saveAll(taches);

        for (Long bcId : bcsImpactes) recalculerCompteursBC(bcId);

        return taches.size();
    }

    // ==========================================
    // 7. ABSENCES
    // ==========================================

    /**
     * Absences du mois : VALIDÉES (jours verrouillés) + EN_ATTENTE (signalées à la grille).
     * Le frontend distingue par le champ statut du DTO.
     */
    public List<Absence> getAbsencesMensuelles(Long consultantId, int annee, int mois) {
        java.time.YearMonth ym = java.time.YearMonth.of(annee, mois);
        return absenceRepository.findByConsultantIdAndDateBetween(
                        consultantId, ym.atDay(1), ym.atEndOfMonth()).stream()
                .filter(a -> a.getStatut() == StatutPointage.VALIDE
                        || a.getStatut() == StatutPointage.EN_ATTENTE)
                .collect(Collectors.toList());
    }

    public List<Absence> getPendingAbsences() {
        return absenceRepository.findByStatut(StatutPointage.EN_ATTENTE);
    }

    @Transactional
    public void updateAbsenceStatus(Long id, StatutPointage statut) {
        Absence abs = absenceRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Absence non trouvée"));
        abs.setStatut(statut);
        absenceRepository.save(abs);

        if (statut == StatutPointage.VALIDE) {
            TacheRealisee tache = tacheRepository
                    .findByConsultantIdAndDate(abs.getConsultant().getId(), abs.getDate())
                    .orElse(new TacheRealisee());

            // Intégrité compteur : si le jour portait une présence sur un BC,
            // le BC doit être recrédité après l'écrasement par l'absence.
            Long ancienBcId = (tache.getId() != null && tache.getBonDeCommande() != null)
                    ? tache.getBonDeCommande().getId() : null;

            tache.setConsultant(abs.getConsultant());
            tache.setDate(abs.getDate());
            tache.setAnnee(abs.getDate().getYear());
            tache.setMois(abs.getDate().getMonthValue());
            tache.setModeSaisie("ABSENCE");
            tache.setDuree(1.0);
            tache.setStatut(StatutPointage.VALIDE);
            tache.setDescriptionTache("Absence validée : " + abs.getMotif());
            tache.setBonDeCommande(null);
            tache.setTypePrestation(null);
            tache.setTicketJira(null);
            tache.setMotifRejet(null);
            tacheRepository.save(tache);

            if (ancienBcId != null) {
                recalculerCompteursBC(ancienBcId);
            }
        }
    }

    /** Valide/rejette d'un coup toutes les lignes d'une demande groupée. */
    @Transactional
    public int updateAbsenceStatusByDemande(String demandeId, StatutPointage statut) {
        List<Absence> lignes = absenceRepository.findByDemandeId(demandeId);
        if (lignes.isEmpty()) throw new BusinessException("Demande introuvable: " + demandeId);
        for (Absence a : lignes) {
            updateAbsenceStatus(a.getId(), statut);
        }
        return lignes.size();
    }

    /**
     * Demande d'absence multi-jours : crée une ligne par jour ouvré de la plage
     * (week-ends et jours fériés exclus), toutes liées par un demandeId commun.
     */
    @Transactional
    public List<Absence> demanderAbsence(Long consultantId, LocalDate dateDebut,
                                         LocalDate dateFin, String motif) {
        Consultant consultant = consultantRepository.findById(consultantId)
                .orElseThrow(() -> new BusinessException("Consultant introuvable"));
        if (dateDebut == null) throw new BusinessException("Date de début obligatoire");
        LocalDate fin = (dateFin != null && !dateFin.isBefore(dateDebut)) ? dateFin : dateDebut;

        String demandeId = java.util.UUID.randomUUID().toString();
        List<Absence> creees = new ArrayList<>();
        for (LocalDate d = dateDebut; !d.isAfter(fin); d = d.plusDays(1)) {
            DayOfWeek dow = d.getDayOfWeek();
            if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) continue;
            if (jourFerieRepository.existsByDate(d)) continue;

            Absence abs = new Absence();
            abs.setConsultant(consultant);
            abs.setDate(d);
            abs.setMotif(motif);
            abs.setStatut(StatutPointage.EN_ATTENTE);
            abs.setDemandeId(demandeId);
            creees.add(absenceRepository.save(abs));
        }
        if (creees.isEmpty()) {
            throw new BusinessException("Aucun jour ouvré dans la plage demandée.");
        }
        return creees;
    }

    /** Compat : demande d'un seul jour. */
    @Transactional
    public Absence demanderAbsence(Long consultantId, LocalDate date, String motif) {
        return demanderAbsence(consultantId, date, date, motif).get(0);
    }

    // ==========================================
    // 8. HISTORIQUE & RECHERCHE
    // ==========================================

    public List<TacheRealisee> rechercherActivites(int annee, Integer mois, Long consultantId) {
        return tacheRepository.rechercherActivitesBC(annee, mois, consultantId);
    }

    public List<TacheRealisee> getValidatedSaisies() {
        return tacheRepository.findByStatut(StatutPointage.VALIDE).stream()
                .sorted((t1, t2) -> t2.getDate().compareTo(t1.getDate()))
                .collect(Collectors.toList());
    }

    public List<Absence> getHistoriqueAbsences() {
        return absenceRepository
                .findByStatutIn(Arrays.asList(StatutPointage.VALIDE, StatutPointage.REJETE))
                .stream()
                .sorted((a1, a2) -> a2.getDate().compareTo(a1.getDate()))
                .collect(Collectors.toList());
    }
}
