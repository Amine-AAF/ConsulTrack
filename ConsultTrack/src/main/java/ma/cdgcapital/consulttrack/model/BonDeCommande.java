package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
public class BonDeCommande {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String reference;
    private Double joursMax;

    // Jours dont la saisie est validée définitivement (statut VALIDE)
    private Double joursConsommes = 0.0;

    // Jours engagés = saisies en attente OU validées (statut EN_ATTENTE + VALIDE)
    @Column(name = "jours_engages")
    private Double joursEngages = 0.0;

    @Enumerated(EnumType.STRING)
    private StatutBC statut;

    /** Nature du BC : chaque BC est soit RUN soit PROJET (regroupement des RA). */
    @Enumerated(EnumType.STRING)
    private NatureActivite nature;

    @Column(name = "montant_consomme")
    private Double montantConsomme = 0.0;

    /** Code budgétaire : commence par R (RUN) ou P (PROJET) — la nature en est déduite. */
    private String codeBudget;

    /** Année budgétaire de rattachement du BC. */
    private Integer anneeBudgetaire;
    private String designation;
    private Double tjm;

    // --- RELATIONS ---

    // 1. La vraie relation Base de Données
    @ManyToOne
    @JoinColumn(name = "consultant_id")
    private Consultant consultant;

    // 2. Le champ technique qui reçoit l'ID du JSON (React envoie "consultantId")
    @Transient
    private Long consultantId;
}