package ma.cdgcapital.consulttrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConsultantDashboardDTO {
    private String nomConsultant;
    private String nomCabinet; // Changé pour correspondre au service
    private String mission;
    private String referenceBC;
    private Long bcId; // Requis pour le mapping Frontend
    private Double tjm;

    private Double totalJoursBC;
    private Double joursConsommesYTD;
    private Double joursRestants;

    private Double[] mensuel = new Double[12];

    private Double montantConsommeYTD; // Pour l'analyse financière
    private Double budgetConsommeHT;

    private String descriptionCodeBudgetaire;
}