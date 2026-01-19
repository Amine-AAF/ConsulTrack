package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Data
public class JourTravaille {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate dateJour;
    private Double duree; // 1.0 ou 0.5 [cite: 16, 22]

    @Enumerated(EnumType.STRING)
    private StatutSaisie statut;

    // --- AJOUTS POUR LES ABSENCES ---
    private boolean estAbsence = false;

    @Enumerated(EnumType.STRING)
    private TypeAbsence typeAbsence; // Null si estAbsence est false

    @ManyToOne
    @JoinColumn(name = "consultant_id")
    private Consultant consultant; // [cite: 10]

    @ManyToOne
    @JoinColumn(name = "bc_id")
    private BonDeCommande bonDeCommande; // [cite: 6, 13]

    private String descriptionTache; // [cite: 12]
}