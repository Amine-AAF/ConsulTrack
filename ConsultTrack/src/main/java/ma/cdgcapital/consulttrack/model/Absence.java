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
public class Absence {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "consultant_id")
    private Consultant consultant;

    private LocalDate date;

    @Enumerated(EnumType.STRING)
    private StatutPointage statut; // EN_ATTENTE, VALIDE, REJETE

    private String motif; // Ex: Congé annuel, Maladie

    /**
     * Identifiant de demande groupée : une demande multi-jours crée N lignes
     * (une par jour ouvré) partageant le même demandeId → validation en un clic.
     */
    private String demandeId;
}