package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;

@Entity
@Table(name = "rapport_activite", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"consultant_id", "mois", "annee"})
})
@Data
public class RapportActivite {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "consultant_id")
    private Consultant consultant;

    private Integer mois;
    private Integer annee;

    /**
     * Tâches réalisées du mois : lignes (puces) séparées par '\n'.
     */
    @Column(length = 8000)
    private String tachesRealisees;

    @Enumerated(EnumType.STRING)
    private StatutPointage statut;

    private String motifRejet;

    private LocalDate dateModification;

    /**
     * Responsable ayant validé le rapport (null tant que non validé).
     */
    @ManyToOne
    @JoinColumn(name = "valide_par_id")
    private Consultant validePar;
}
