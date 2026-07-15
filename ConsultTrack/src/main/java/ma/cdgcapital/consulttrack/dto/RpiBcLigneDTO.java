package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

/**
 * Ligne de synthèse d'un Bon de Commande dans le RPI mensuel.
 * reliquatAvant = joursMax − présence validée sur ce BC strictement AVANT le mois.
 * jhRestant     = reliquatAvant − consommeMois.
 */
@Data
public class RpiBcLigneDTO {
    private Long bcId;
    private String reference;
    private Double jhBudget;      // joursMax du BC
    private Double reliquatAvant; // reliquat au 1er du mois
    private Double consommeMois;  // présence validée du mois sur ce BC
    private Double jhRestant;     // reliquat en fin de mois
}
