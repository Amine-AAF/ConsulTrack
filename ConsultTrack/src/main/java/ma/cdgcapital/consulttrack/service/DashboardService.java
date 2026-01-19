package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.dto.*;
import ma.cdgcapital.consulttrack.model.*;
import ma.cdgcapital.consulttrack.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    @Autowired private ConsultantRepository consultantRepository;
    @Autowired private TacheRealiseeRepository tacheRepository;
    @Autowired private BonDeCommandeRepository bcRepository;
    @Autowired private AbsenceRepository absenceRepository;
    @Autowired private CabinetRepository cabinetRepository;

    // ==========================================
    // 1. DASHBOARD & TIMESHEET
    // ==========================================

    public List<ConsultantDashboardDTO> getGlobalReport(Long cabinetId, int annee) {
        List<BonDeCommande> bcs = bcRepository.findAll();
        List<ConsultantDashboardDTO> report = new ArrayList<>();

        for (BonDeCommande bc : bcs) {
            // Sécurité : Ignorer les BC orphelins
            if (bc.getConsultant() == null) continue;

            // Filtre optionnel sur le cabinet
            if (cabinetId != null) {
                if (bc.getConsultant().getCabinet() == null || !bc.getConsultant().getCabinet().getId().equals(cabinetId)) {
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

            List<TacheRealisee> taches = tacheRepository.findAll().stream()
                    .filter(t -> t.getConsultant() != null
                            && t.getConsultant().getId().equals(cons.getId())
                            && t.getBonDeCommande() != null
                            && t.getBonDeCommande().getId().equals(bc.getId())
                            && t.getDate().getYear() == annee)
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

    // --- SÉQUENTIALITÉ ---
    public boolean isMoisPrecedentValide(Long consultantId, int annee, int mois) {
        int moisPrev = mois - 1;
        int anneePrev = annee;
        if (moisPrev == 0) {
            moisPrev = 12;
            anneePrev = annee - 1;
        }

        List<TacheRealisee> historique = tacheRepository.findByConsultantIdAndAnneeAndMois(consultantId, anneePrev, moisPrev);

        if (historique.isEmpty()) {
            return true;
        }

        return historique.stream()
                .allMatch(t -> t.getStatut().equals(StatutPointage.VALIDE));
    }

    // --- SAUVEGARDE DES TEMPS ---
    @Transactional
    public void sauvegarderPointagesMensuels(Long consultantId, int annee, int mois, List<PointageRequest> requests) {
        Consultant consultant = consultantRepository.findById(consultantId)
                .orElseThrow(() -> new RuntimeException("Consultant introuvable"));

        for (PointageRequest req : requests) {
            LocalDate date = LocalDate.parse(req.getDate());

            // 1. Récupération de l'existant (pour éviter les doublons et vérifier le statut)
            TacheRealisee tache = tacheRepository
                    .findByConsultantIdAndDate(consultantId, date)
                    .orElse(new TacheRealisee());

            // 2. PROTECTION CRITIQUE : Si la ligne est déjà VALIDÉE (Absence ou Timesheet), ON NE TOUCHE PAS.
            // Cela permet de remplir les jours vides autour d'une absence validée.
            if (tache.getId() != null && tache.getStatut() == StatutPointage.VALIDE) {
                continue;
            }

            // 3. Mise à jour ou Création
            tache.setConsultant(consultant);
            tache.setDate(date);
            tache.setAnnee(annee);
            tache.setMois(mois);
            tache.setDuree(req.getDuree());
            tache.setModeSaisie(req.getMode());

            // On remet en attente si on modifie (sauf si logique spécifique contraire)
            try {
                tache.setStatut(StatutPointage.EN_ATTENTE);
            } catch (Exception e) {
                tache.setStatut(StatutPointage.EN_ATTENTE);
            }

            if ("BC".equals(req.getMode()) && req.getBcId() != null) {
                BonDeCommande bc = bcRepository.findById(req.getBcId())
                        .orElseThrow(() -> new RuntimeException("BC introuvable"));
                tache.setBonDeCommande(bc);
            } else {
                tache.setBonDeCommande(null);
            }

            tache.setDescriptionTache(req.getDescriptionTache());
            tache.setTicketJira(req.getTicketJira());
            tache.setTypePrestation(req.getTypePrestation());

            tacheRepository.save(tache);
        }

        actualiserCompteursBC(consultantId);
    }

    public List<TacheRealisee> getPointagesMensuels(Long consultantId, int annee, int mois) {
        return tacheRepository.findAll().stream()
                .filter(t -> t.getConsultant().getId().equals(consultantId)
                        && t.getDate().getYear() == annee
                        && t.getDate().getMonthValue() == mois)
                .collect(Collectors.toList());
    }

    // --- RECALCUL DES SOLDES BC ---
    private void actualiserCompteursBC(Long consultantId) {
        List<BonDeCommande> bcs = bcRepository.findByConsultantId(consultantId);
        for (BonDeCommande bc : bcs) {
            Double total = tacheRepository.findAll().stream()
                    .filter(t -> t.getBonDeCommande() != null && t.getBonDeCommande().getId().equals(bc.getId()))
                    .mapToDouble(TacheRealisee::getDuree)
                    .sum();

            bc.setJoursConsommes(total);
            if (bc.getTjm() != null) {
                bc.setMontantConsomme(total * bc.getTjm());
            }
            bcRepository.save(bc);
        }
    }

    // ==========================================
    // 2. GESTION ADMINISTRATIVE (CRUD)
    // ==========================================

    public List<Cabinet> getAllCabinets() { return cabinetRepository.findAll(); }
    public Cabinet saveCabinet(Cabinet cabinet) { return cabinetRepository.save(cabinet); }

    public List<Consultant> getAllConsultants() { return consultantRepository.findAll(); }
    public Consultant saveConsultant(Consultant consultant) { return consultantRepository.save(consultant); }

    public List<BonDeCommande> getAllBCs() { return bcRepository.findAll(); }
    public BonDeCommande saveBC(BonDeCommande bc) {
        if (bc.getConsultantId() != null) {
            Consultant c = consultantRepository.findById(bc.getConsultantId())
                    .orElseThrow(() -> new RuntimeException("Consultant introuvable avec l'ID : " + bc.getConsultantId()));
            bc.setConsultant(c);
        }
        if (bc.getJoursConsommes() == null) bc.setJoursConsommes(0.0);
        if (bc.getMontantConsomme() == null) bc.setMontantConsomme(0.0);

        return bcRepository.save(bc);
    }

    public List<TacheRealisee> getPendingSaisies() {
        return tacheRepository.findAll().stream()
                .filter(t -> t.getStatut() == StatutPointage.EN_ATTENTE)
                .collect(Collectors.toList());
    }

    @Transactional
    public void validerSaisie(Long id) {
        TacheRealisee t = tacheRepository.findById(id).orElseThrow();
        t.setStatut(StatutPointage.VALIDE);
        tacheRepository.save(t);
    }

    @Transactional
    public void rejeterSaisie(Long id, String motif) {
        TacheRealisee t = tacheRepository.findById(id).orElseThrow();
        t.setStatut(StatutPointage.REJETE);
        t.setDescriptionTache(t.getDescriptionTache() + " [REJET: " + motif + "]");
        tacheRepository.save(t);
    }

    // ==========================================
    // 3. GESTION DES ABSENCES
    // ==========================================

    public List<Absence> getAbsencesMensuelles(Long consultantId, int annee, int mois) {
        return absenceRepository.findByConsultantId(consultantId).stream()
                .filter(a -> a.getDate().getYear() == annee
                        && a.getDate().getMonthValue() == mois
                        && a.getStatut() == StatutPointage.VALIDE)
                .collect(Collectors.toList());
    }

    public List<Absence> getPendingAbsences() {
        return absenceRepository.findAll().stream()
                .filter(a -> a.getStatut() == StatutPointage.EN_ATTENTE)
                .collect(Collectors.toList());
    }

    @Transactional
    public void updateAbsenceStatus(Long id, StatutPointage statut) {
        Absence abs = absenceRepository.findById(id).orElseThrow(() -> new RuntimeException("Absence non trouvée"));
        abs.setStatut(statut);
        absenceRepository.save(abs);

        if (statut == StatutPointage.VALIDE) {
            // Création ou Mise à jour de la TacheRealisee correspondante
            TacheRealisee tache = tacheRepository
                    .findByConsultantIdAndDate(abs.getConsultant().getId(), abs.getDate())
                    .orElse(new TacheRealisee());

            tache.setConsultant(abs.getConsultant());
            tache.setDate(abs.getDate());
            tache.setAnnee(abs.getDate().getYear());
            tache.setMois(abs.getDate().getMonthValue());

            tache.setModeSaisie("ABSENCE");
            tache.setDuree(1.0);
            tache.setStatut(StatutPointage.VALIDE); // Important : Statut VALIDE pour verrouiller
            tache.setDescriptionTache("Absence validée : " + abs.getMotif());

            tache.setBonDeCommande(null);
            tache.setTypePrestation(null);
            tache.setTicketJira(null);

            tacheRepository.save(tache);
            actualiserCompteursBC(abs.getConsultant().getId());
        }
    }

    @Transactional
    public Absence demanderAbsence(Long consultantId, LocalDate date, String motif) {
        Absence abs = new Absence();
        abs.setConsultant(consultantRepository.findById(consultantId).orElseThrow());
        abs.setDate(date);
        abs.setMotif(motif);
        abs.setStatut(StatutPointage.EN_ATTENTE);
        return absenceRepository.save(abs);
    }

// ==========================================
    // 4. HISTORIQUE & RECHERCHE
    // ==========================================

    public List<TacheRealisee> rechercherActivites(int annee, Integer mois, Long consultantId) {
        return tacheRepository.findAll().stream()
                .filter(t -> t.getDate().getYear() == annee)
                // Filtre mois optionnel
                .filter(t -> mois == null || t.getDate().getMonthValue() == mois)
                // Filtre consultant optionnel
                .filter(t -> consultantId == null || t.getConsultant().getId().equals(consultantId))
                // CORRECTION ICI : On ne garde que les vraies activités (Mode BC), pas les absences
                .filter(t -> "BC".equals(t.getModeSaisie()))
                .sorted((t1, t2) -> t2.getDate().compareTo(t1.getDate()))
                .collect(Collectors.toList());
    }

    public List<TacheRealisee> getValidatedSaisies() {
        return tacheRepository.findAll().stream()
                .filter(t -> t.getStatut() == StatutPointage.VALIDE)
                .sorted((t1, t2) -> t2.getDate().compareTo(t1.getDate()))
                .collect(Collectors.toList());
    }

    public List<Absence> getHistoriqueAbsences() {
        return absenceRepository.findAll().stream()
                .filter(a -> a.getStatut() == StatutPointage.VALIDE || a.getStatut() == StatutPointage.REJETE)
                .sorted((a1, a2) -> a2.getDate().compareTo(a1.getDate())) // Plus récent en premier
                .collect(Collectors.toList());
    }
}