package ma.cdgcapital.consulttrack.dto;

import lombok.Data;
import java.util.List;

/**
 * Une semaine de la grille RPI (LUNDI → DIMANCHE, jours hors mois inclus).
 * totalSemaine = présence JH de la semaine ET du mois (les jours hors mois comptent 0).
 * totalMtd     = cumul des totalSemaine du mois jusqu'à cette semaine (Month To Date).
 */
@Data
public class RpiSemaineDTO {
    private String du;             // ISO : lundi de la semaine
    private String au;             // ISO : dimanche de la semaine
    private List<RpiJourDTO> jours; // 7 jours
    private Double totalSemaine;
    private Double totalMtd;
}
