package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;

@Entity
@Table(name = "rapport_activite", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"consultant_id", "bc_id", "mois", "annee"})
})
@Data
public class RapportActivite {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "consultant_id")
    private Consultant consultant;

    @ManyToOne
    @JoinColumn(name = "bc_id")
    private BonDeCommande bc;

    private Integer mois;
    private Integer annee;

    @Column(length = 4000)
    private String syntheseMois;

    @Column(length = 4000)
    private String faitsMarquants;

    @Column(length = 4000)
    private String perspectives;

    @Enumerated(EnumType.STRING)
    private StatutPointage statut;

    private String motifRejet;

    private LocalDate dateModification;
}
