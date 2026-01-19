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
    private Double joursConsommes = 0.0;

    @Enumerated(EnumType.STRING)
    private StatutBC statut;

    @Column(name = "montant_consomme")
    private Double montantConsomme = 0.0;

    private String codeBudget;
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