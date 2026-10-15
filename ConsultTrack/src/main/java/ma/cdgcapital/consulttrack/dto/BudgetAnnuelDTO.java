package ma.cdgcapital.consulttrack.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class BudgetAnnuelDTO {
    private Long id;
    private Integer annee;
    private String scope;
    private Long directionId;
    private String directionNom;
    private boolean canEdit;
    private String codeBudget;
    private String typeBudget;
    private String description;
    private Double budgetTotal;
    private Double reporteAnterieur;
    private Double engageActif;
    private Double realise;
    private Double disponible;
    private Double consomme;
    private String reste2025;
    private String sectionAnalytique;
    private String notes;
    private long nombreDemandes;
    private long nombreBC;
    private LocalDateTime dateMiseAJour;
}
