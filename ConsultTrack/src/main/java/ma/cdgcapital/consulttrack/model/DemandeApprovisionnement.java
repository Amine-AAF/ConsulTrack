package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "demande_approvisionnement")
@Data
public class DemandeApprovisionnement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Clé stable utilisée lors des imports répétés pour éviter les doublons. */
    @Column(unique = true)
    private String sourceKey;

    @ManyToOne(optional = false)
    @JoinColumn(name = "budget_id", nullable = false)
    private BudgetAnnuel budget;

    @ManyToOne
    @JoinColumn(name = "consultant_id")
    private Consultant consultant;

    private String referenceExterne;
    private String responsable;
    private String nomConsultant;
    private String projet;
    private Double tjm;
    private Double jours;
    private Double montant;
    /** Statut constaté dans le processus externe (aucune validation interne). */
    private String statutExterne;

    /** Manager owning this DA; explicit so imported/unmatched DAs remain scoped. */
    @ManyToOne
    @JoinColumn(name = "manager_id")
    private Consultant manager;

    @OneToOne
    @JoinColumn(name = "bon_de_commande_id", unique = true)
    private BonDeCommande bonDeCommande;
}
