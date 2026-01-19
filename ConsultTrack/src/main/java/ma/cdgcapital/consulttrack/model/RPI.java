package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDate;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RPI {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "consultant_id")
    private Consultant consultant;

    @ManyToOne
    @JoinColumn(name = "bc_id")
    private BonDeCommande bc;

    private Integer mois; // 1 à 12
    private Integer annee;

    private Double totalJH; // Le "Total JH (mtd)" du document (ex: 16.0)
    private Double totalCumuleSTD; // Le "Total JH (std)" (ex: 90.0)

    private LocalDate dateGeneration;
    private String statut; // EX: GENERE, VALIDE, FACTURE

    @Column(length = 1000)
    private String commentaireActivite; // Résumé du rapport d'activité
}