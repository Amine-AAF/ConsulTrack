package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.model.*;
import ma.cdgcapital.consulttrack.repository.AffectationRepository;
import ma.cdgcapital.consulttrack.repository.RpiRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Service gérant la génération automatique des factures basée sur les RPI validés.
 * Calcule le montant HT, la TVA (20%) et le TTC conformément aux factures Coda Solutions.
 */
@Service
@Transactional
public class FacturationService {

    @Autowired
    private RpiRepository rpiRepository;

    @Autowired
    private AffectationRepository affectationRepository;

    public Facture generateMonthlyFacture(Long cabinetId, int mois, int annee) {
        // Récupération des RPI validés pour le mois et l'année donnés
        List<RPI> listRpi = rpiRepository.findByCabinetAndMonth(cabinetId, mois, annee);

        double totalHT = 0;
        Facture facture = new Facture();
        facture.setDateFacturation(LocalDate.now());

        for (RPI rpi : listRpi) {
            // Récupération du TJM contractuel (ex: 5000 MAD pour Youness Boutkhourst)
            Double tjm = affectationRepository.findTjmByConsultantAndBC(
                    rpi.getConsultant().getId(),
                    rpi.getBc().getId()
            );

            // Calcul du montant de la ligne (Total JH * TJM)
            double montantLigne = rpi.getTotalJH() * tjm;
            totalHT += montantLigne;

            // Création de la ligne détaillée pour la facture
            LigneFacture ligne = new LigneFacture();
            ligne.setDesignation(rpi.getBc().getReference() + " - " + rpi.getConsultant().getNom());
            ligne.setQuantite(rpi.getTotalJH());
            ligne.setPrixUnitaire(tjm);
            ligne.setTotalHT(montantLigne);

            // Ajout de la ligne à la collection de la facture
            facture.getLignes().add(ligne);
        }

        // Finalisation des totaux financiers
        facture.setTotalHT(totalHT);
        facture.setTva(totalHT * 0.20); // Application du taux de TVA de 20% en vigueur
        facture.setTotalTTC(totalHT + facture.getTva());

        return facture;
    }
}