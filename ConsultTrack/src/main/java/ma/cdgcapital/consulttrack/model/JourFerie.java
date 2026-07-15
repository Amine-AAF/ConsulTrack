package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDate;

/**
 * Jour férié global, géré par l'ADMIN, applicable à tous les consultants.
 * Les grilles de présence verrouillent automatiquement ces jours (code JF).
 */
@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class JourFerie {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private LocalDate date;

    private String libelle; // Ex: "Aïd al-Fitr", "Fête du Travail"
}
