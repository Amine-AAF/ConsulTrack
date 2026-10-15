package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

@Data
public class DemandeApprovisionnementDTO {
    private Long id;
    private Long budgetId;
    private Integer annee;
    private String budgetCode;
    private String referenceExterne;
    private String responsable;
    private String nomConsultant;
    private Long consultantId;
    private String projet;
    private Double tjm;
    private Double jours;
    private Double montant;
    private String statutExterne;
    private Long bcId;
    private String bcReference;
}
