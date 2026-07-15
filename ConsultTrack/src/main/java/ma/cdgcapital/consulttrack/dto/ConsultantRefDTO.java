package ma.cdgcapital.consulttrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Référence allégée d'un consultant, imbriquée dans les DTOs (BC, Absence, Tâche).
 * Évite d'exposer l'entité JPA complète (et son champ password) tout en conservant
 * la forme {@code consultant: { id, nom, prenom }} attendue par le frontend.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConsultantRefDTO {
    private Long id;
    private String nom;
    private String prenom;
}
