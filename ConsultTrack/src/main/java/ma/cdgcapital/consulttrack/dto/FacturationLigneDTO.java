package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

/** Ligne de pré-facture : consommation validée d'un consultant sur UN Bon de Commande. */
@Data
public class FacturationLigneDTO {
    private String bcReference;
    private String codeBudget;
    private String nature;   // RUN | PROJET | null
    private Double jh;       // jours validés du mois sur ce BC
    private Double tjm;      // TJM du BC (0 si non renseigné)
    private Double montant;  // jh × tjm
}
