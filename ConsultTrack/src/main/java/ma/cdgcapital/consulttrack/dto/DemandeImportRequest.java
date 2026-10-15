package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

@Data
public class DemandeImportRequest extends DemandeApprovisionnementRequest {
    private Integer annee;
    private String budgetCode;
    private Integer rowNumber;
}
