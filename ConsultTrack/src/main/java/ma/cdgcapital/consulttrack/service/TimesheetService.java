package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.model.*;
import ma.cdgcapital.consulttrack.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class TimesheetService {

    @Autowired
    private JourTravailleRepository jourRepository;

    @Autowired
    private BonDeCommandeRepository bcRepository;

    @Autowired
    private ConsultantRepository consultantRepository;

    /**
     * Enregistre un jour (travail ou absence)
     */
    public JourTravaille saisirJour(Long consultantId, Long bcId, JourTravaille jour) {
        Consultant consultant = consultantRepository.findById(consultantId)
                .orElseThrow(() -> new RuntimeException("Consultant non trouvé"));

        jour.setConsultant(consultant);
        jour.setStatut(StatutSaisie.SOUMIS);

        // CAS 1 : C'est un jour travaillé (Production)
        if (!jour.isEstAbsence()) {
            BonDeCommande bc = bcRepository.findById(bcId)
                    .orElseThrow(() -> new RuntimeException("Bon de Commande requis pour du travail productif"));

            // Vérification du budget restant sur le BC
            if (bc.getJoursConsommes() + jour.getDuree() > bc.getJoursMax()) {
                throw new RuntimeException("Budget du Bon de Commande insuffisant !");
            }

            // Mise à jour de la consommation du BC
            bc.setJoursConsommes(bc.getJoursConsommes() + jour.getDuree());
            bcRepository.save(bc);

            jour.setBonDeCommande(bc);
            jour.setTypeAbsence(null); // Sécurité
        }
        // CAS 2 : C'est une absence (Congé, Maladie, etc.)
        else {
            if (jour.getTypeAbsence() == null) {
                throw new RuntimeException("Le type d'absence est obligatoire");
            }
            jour.setBonDeCommande(null); // Une absence n'est pas liée à un BC
        }

        return jourRepository.save(jour);
    }

    /**
     * Transfert de jours entre BC (utile pour la régularisation des BC provisoires)
     */
    public void transfererJoursEntreBC(Long oldBcId, Long newBcId, Long consultantId) {
        BonDeCommande oldBc = bcRepository.findById(oldBcId)
                .orElseThrow(() -> new RuntimeException("Ancien BC non trouvé"));
        BonDeCommande newBc = bcRepository.findById(newBcId)
                .orElseThrow(() -> new RuntimeException("Nouveau BC non trouvé"));

        // On ne filtre que les jours travaillés (non absences) liés à l'ancien BC
        List<JourTravaille> jours = jourRepository.findByConsultantId(consultantId)
                .stream()
                .filter(j -> j.getBonDeCommande() != null && j.getBonDeCommande().getId().equals(oldBcId))
                .toList();

        for (JourTravaille j : jours) {
            j.setBonDeCommande(newBc);
            newBc.setJoursConsommes(newBc.getJoursConsommes() + j.getDuree());
            oldBc.setJoursConsommes(oldBc.getJoursConsommes() - j.getDuree());
        }

        jourRepository.saveAll(jours);
        bcRepository.save(oldBc);
        bcRepository.save(newBc);
    }

    public List<JourTravaille> getHistoriqueConsultant(Long consultantId) {
        return jourRepository.findByConsultantId(consultantId);
    }
}