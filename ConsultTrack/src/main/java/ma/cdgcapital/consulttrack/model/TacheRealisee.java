package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDate;

@Entity
@Table(name = "tache_realisee", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"consultant_id", "date"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TacheRealisee {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String libelleTache;
    private String projet;
    private String ticketJira;
    private String descriptionTache; // Champ requis pour le Timesheet

    @Enumerated(EnumType.STRING)
    private TypeActivite type;

    @Enumerated(EnumType.STRING)
    private StatutPointage statut; // Requis pour le cycle de validation

    @ManyToOne
    @JoinColumn(name = "consultant_id")
    private Consultant consultant;

    @ManyToOne
    @JoinColumn(name = "bc_id")
    private BonDeCommande bonDeCommande; // Nommé pour correspondre au getter getBonDeCommande()

    private LocalDate date; // Centralise le mois et l'année pour les calculs temporels
    private Double duree;   // Champ "duree" attendu par le service

    // Champs de secours pour compatibilité avec l'ancien code
    private Integer mois;
    private Integer annee;

    // --- NOUVEAUX CHAMPS KPI ---
    private String typePrestation; // "RUN" ou "PROJET"
    private String sousType;       // "MCO", "DEV", etc.

    // --- AJOUT OBLIGATOIRE ---
    private String modeSaisie;

    // Motif de rejet (au lieu de polluer descriptionTache)
    private String motifRejet;
}