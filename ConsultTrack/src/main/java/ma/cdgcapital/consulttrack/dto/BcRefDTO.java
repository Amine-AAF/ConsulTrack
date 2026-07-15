package ma.cdgcapital.consulttrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Référence allégée d'un Bon de Commande, imbriquée dans {@link TacheRealiseeDTO}.
 * Conserve la forme {@code bonDeCommande: { id, reference }} lue par le frontend
 * (TimesheetForm, AdminPanel) sans tirer tout le graphe de l'entité.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BcRefDTO {
    private Long id;
    private String reference;
}
