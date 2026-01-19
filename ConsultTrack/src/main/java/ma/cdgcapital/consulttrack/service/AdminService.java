package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.model.*;
import ma.cdgcapital.consulttrack.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class AdminService {

    @Autowired
    private CabinetRepository cabinetRepository;

    @Autowired
    private ConsultantRepository consultantRepository;

    @Autowired
    private BonDeCommandeRepository bcRepository;

    @Autowired
    private JourTravailleRepository jourRepository;

    @Autowired
    private AffectationRepository affectationRepository;

    // --- GESTION DES CABINETS (ESN) ---

    public List<Cabinet> listerTousLesCabinets() {
        return cabinetRepository.findAll();
    }

    public Cabinet sauvegarderCabinet(Cabinet cabinet) {
        return cabinetRepository.save(cabinet);
    }

    // --- GESTION DES CONSULTANTS ---

    public List<Consultant> listerTousLesConsultants() {
        return consultantRepository.findAll();
    }

    public Consultant sauvegarderConsultant(Consultant consultant) {
        return consultantRepository.save(consultant);
    }

    // --- GESTION DES BONS DE COMMANDE (BC) ---

    public List<BonDeCommande> listerTousLesBCs() {
        return bcRepository.findAll();
    }

    public BonDeCommande sauvegarderBC(BonDeCommande bc) {
        // Initialisation des compteurs si vides
        if (bc.getJoursConsommes() == null) bc.setJoursConsommes(0.0);
        if (bc.getMontantConsomme() == null) bc.setMontantConsomme(0.0);

        // PERSISTANCE DU LIEN : On transforme l'ID reçu en objet Consultant
        if (bc.getConsultantId() != null) {
            consultantRepository.findById(bc.getConsultantId()).ifPresent(consultant -> {
                bc.setConsultant(consultant);
            });
        }

        return bcRepository.save(bc);
    }

    // --- GESTION DES AFFECTATIONS ---

    public AffectationBC creerAffectation(AffectationBC affectation) {
        return affectationRepository.save(affectation);
    }

    // --- MÉTHODE DE CALCUL FINANCIER ---

    public Double calculerCoutPrestation(Long consultantId, Long bcId, Double totalJH) {
        Double tjm = affectationRepository.findTjmByConsultantAndBC(consultantId, bcId);
        if (tjm == null) {
            throw new RuntimeException("Aucun TJM défini pour cette affectation.");
        }
        return totalJH * tjm;
    }

    // --- GESTION DES SAISIES (VALIDATION & FLUX MÉTIER) ---

    public List<JourTravaille> listerSaisiesAValider() {
        return jourRepository.findByStatut(StatutSaisie.SOUMIS);
    }

    /**
     * Valide une saisie : met à jour le statut, incrémente les JH du BC et calcule le coût MAD
     */
    public void validerSaisie(Long jourId) {
        JourTravaille jour = jourRepository.findById(jourId)
                .orElseThrow(() -> new RuntimeException("Saisie non trouvée"));

        BonDeCommande bc = jour.getBonDeCommande();

        // On ne traite les compteurs que si la saisie est en attente (SOUMIS)
        if (jour.getStatut() == StatutSaisie.SOUMIS && bc != null && !jour.isEstAbsence()) {

            // 1. Contrôle de dépassement de budget BC
            if (bc.getJoursConsommes() + jour.getDuree() > bc.getJoursMax()) {
                throw new RuntimeException("Dépassement de budget sur le BC : " + bc.getReference());
            }

            // 2. Mise à jour de la consommation en JH
            bc.setJoursConsommes(bc.getJoursConsommes() + jour.getDuree());

            // 3. Mise à jour financière (MAD) via le TJM de l'affectation
            Double tjm = affectationRepository.findTjmByConsultantAndBC(jour.getConsultant().getId(), bc.getId());
            if (tjm != null) {
                double coutJour = jour.getDuree() * tjm;
                bc.setMontantConsomme((bc.getMontantConsomme() != null ? bc.getMontantConsomme() : 0.0) + coutJour);
            }

            bcRepository.save(bc);
        }

        jour.setStatut(StatutSaisie.VALIDE);
        jourRepository.save(jour);
    }

    /**
     * Rejette une saisie : recrédite les JH et le montant financier si la saisie était déjà validée
     */
    public void rejeterSaisie(Long jourId, String motif) {
        JourTravaille jour = jourRepository.findById(jourId)
                .orElseThrow(() -> new RuntimeException("Saisie non trouvée"));

        // Si on rejette une saisie déjà VALIDÉE, il faut recréditer les compteurs du BC
        if (jour.getStatut() == StatutSaisie.VALIDE && !jour.isEstAbsence() && jour.getBonDeCommande() != null) {
            BonDeCommande bc = jour.getBonDeCommande();

            // Recrédit JH
            bc.setJoursConsommes(Math.max(0, bc.getJoursConsommes() - jour.getDuree()));

            // Recrédit Financier
            Double tjm = affectationRepository.findTjmByConsultantAndBC(jour.getConsultant().getId(), bc.getId());
            if (tjm != null && bc.getMontantConsomme() != null) {
                bc.setMontantConsomme(Math.max(0, bc.getMontantConsomme() - (jour.getDuree() * tjm)));
            }
            bcRepository.save(bc);
        }

        jour.setStatut(StatutSaisie.REJETE);
        // Ajout du motif de rejet pour information au consultant
        String currentDesc = jour.getDescriptionTache() != null ? jour.getDescriptionTache() : "";
        jour.setDescriptionTache(currentDesc + " [REJET : " + motif + "]");
        jourRepository.save(jour);
    }

}