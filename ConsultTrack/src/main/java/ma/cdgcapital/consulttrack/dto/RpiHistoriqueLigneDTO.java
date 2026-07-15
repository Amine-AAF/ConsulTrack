package ma.cdgcapital.consulttrack.dto;

import lombok.Data;
import java.util.List;

/**
 * Ligne de l'historique annuel du RPI : un Bon de Commande du consultant,
 * avec sa consommation validée mois par mois sur l'année.
 * La ligne "Totaux" (reference = "Totaux") somme toutes les lignes.
 */
@Data
public class RpiHistoriqueLigneDTO {
    private Long bcId;
    private String reference;
    private Double joursBdc;       // budget (joursMax)
    private Double totalConsomme;  // présence validée sur l'année
    private Double joursRestants;  // joursBdc − totalConsomme
    private List<Double> parMois;  // 12 valeurs (janvier → décembre)
}
