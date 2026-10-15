package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

@Data
public class BudgetAnnuelRequest {
    private Integer annee;
    private String scope;
    private Long directionId;
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
}
