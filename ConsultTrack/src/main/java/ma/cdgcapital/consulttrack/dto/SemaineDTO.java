package ma.cdgcapital.consulttrack.dto;

import lombok.Data;
import java.util.List;

/**
 * Une semaine de la grille RPI. Les cumuls sont calculés du point de vue du BC courant :
 * - totalSemaine : présence saisie sur CE BC durant la semaine
 * - totalMtd     : cumul présence sur CE BC depuis le 1er du mois (Month To Date)
 * - totalStd     : cumul présence sur CE BC depuis le début du BC (jhAvantMois + totalMtd)
 */
@Data
public class SemaineDTO {
    private String periode;          // ex: "01–05 sept."
    private List<JourRpiDTO> jours;  // 7 jours (LUN → DIM)
    private Double totalSemaine;
    private Double totalMtd;
    private Double totalStd;
}
