package ma.cdgcapital.consulttrack.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AuthUserDTO {
    private Long id;
    private String nom;
    private String prenom;
    private String email;
    private String role;
}
