package ma.cdgcapital.consulttrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO d'un consultant exposé par l'API admin.
 * N'expose jamais le hash {@code password} de l'entité JPA.
 * Le cabinet est imbriqué ({@code cabinet: { id, nom, ... }}) pour rester
 * compatible avec les lectures {@code c.cabinet?.nom} / {@code c.cabinet?.id} du frontend.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConsultantDTO {
    private Long id;
    private String nom;
    private String prenom;
    private String email;
    private String role;
    private CabinetDTO cabinet;
}
