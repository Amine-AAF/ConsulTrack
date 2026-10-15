package ma.cdgcapital.consulttrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO d'un Bon de Commande.
 * Expose à la fois {@code consultantId} (plat) et {@code consultant: { id, nom, prenom }}
 * (imbriqué) car le frontend lit les deux formes selon les écrans
 * ({@code bc.consultantId} dans TimesheetForm, {@code bc.consultant?.nom} dans AdminPanel).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BonDeCommandeDTO {
    private Long id;
    private String reference;
    private String codeBudget;
    private String designation;
    private Double tjm;
    private Double joursMax;
    private Double joursConsommes;
    private Double joursEngages;
    private Double joursRestants;
    private Double montantConsomme;
    private String statut;
    private String nature; // RUN | PROJET, dérivée du type de budget OPEX | CAPEX
    private Integer anneeBudgetaire; // exercice de suivi, distinct de l'année dans la référence du BC
    /** Reliquat consommable l'année suivante (null traité comme false). */
    private Boolean reportReliquat;
    private Long consultantId;
    private ConsultantRefDTO consultant;
}
