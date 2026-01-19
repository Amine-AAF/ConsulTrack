package ma.cdgcapital.consulttrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TacheRealiseeDTO {
    private Long consultantId;
    private Long bcId;          // AJOUTER CE CHAMP
    private String date;        // Format "YYYY-MM-DD"
    private Double chargeJH;    // Correspond à la durée
    private String libelleTache;
    private String projet;
    private String ticketJira;
    private Integer mois;
    private Integer annee;
    private String type;
    private String typePrestation; // PROJET, RUN, AUTRE
}