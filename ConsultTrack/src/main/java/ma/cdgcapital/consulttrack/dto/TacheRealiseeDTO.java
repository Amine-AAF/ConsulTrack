package ma.cdgcapital.consulttrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO d'une tâche réalisée (pointage / saisie CRA).
 * Conserve volontairement les noms de champs lus par le frontend :
 *  - {@code duree} (et non chargeJH),
 *  - {@code id} (clé React + endpoints /saisies/{id}/valider),
 *  - {@code consultant: { id, nom, prenom }} et {@code bonDeCommande: { id, reference }} imbriqués,
 *  - {@code bcId} plat en complément (fallback {@code p.bonDeCommande?.id || p.bcId}).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TacheRealiseeDTO {
    private Long id;
    private String date;        // Format "YYYY-MM-DD"
    private Double duree;
    private String libelleTache;
    private String projet;
    private String ticketJira;
    private Integer mois;
    private Integer annee;
    private String type;
    private String typePrestation; // PROJET, RUN, AUTRE
    private String statut;
    private String motifRejet;
    private String modeSaisie;
    private String descriptionTache;
    private Long bcId;
    private ConsultantRefDTO consultant;
    private BcRefDTO bonDeCommande;
}
