package ma.cdgcapital.consulttrack.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
public class Cabinet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nom;
    private String adresse;
    private String telephone;
    private String email;

    // Informations fiscales extraites des factures
    private String ice;
    private String identifiantFiscal;
    private String rc;
    private String patente;
    private String rib;

    // Logo pour les exports PDF
    @Lob
    @Column(columnDefinition = "TEXT")
    private String logoBase64;

    /** Logo du cabinet (data-URL base64) imprimé sur les RPI / Rapports d'Activité. */
    @JsonIgnore
    @Column(columnDefinition = "TEXT")
    private String logoImage;
}