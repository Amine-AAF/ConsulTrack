package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

@Data
public class DemandeApprovisionnementRequest {
    private Long budgetId;
    private String referenceExterne;
    private String responsable;
    private String nomConsultant;
    private Long consultantId;
    private String projet;
    private Double tjm;
    private Double jours;
    private Double montant;
    private String statutExterne;
}
