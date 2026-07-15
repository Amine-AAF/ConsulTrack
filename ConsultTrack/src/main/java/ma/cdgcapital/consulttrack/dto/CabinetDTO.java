package ma.cdgcapital.consulttrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CabinetDTO {
    private Long id;
    private String nom;
    private String adresse;
    private String telephone;
    private String email;
    private String ice;
    private String identifiantFiscal;
    private String rc;
    private String patente;
    private String rib;
}
