package ma.cdgcapital.consulttrack.dto;

import lombok.Data;
import java.util.List;

/**
 * Relevé de Prestation Individuel (RPI) d'un consultant, pour un mois et un Bon de Commande donnés.
 * Construit exclusivement à partir des saisies VALIDÉES (cf. ReportService).
 */
@Data
public class RpiMoisDTO {
    private Long consultantId;
    private String consultantNom;

    private Long bcId;
    private String referenceBC;
    private String designationBC;

    private int mois;         // 1..12
    private int annee;
    private String moisLabel; // ex: "Septembre 2025"

    private Double jhBudgetBC;   // budget total du BC (joursMax)
    private Double jhAvantMois;  // cumul consommé sur ce BC avant le mois
    private Double consommeMois; // consommé ce mois-ci sur ce BC
    private Double jhApresMois;  // cumul après le mois (avantMois + consommeMois)
    private Double jhRestant;    // budget - jhApresMois

    private List<SemaineDTO> semaines;
}
