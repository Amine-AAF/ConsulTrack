package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "budget_annuel")
@Data
public class BudgetAnnuel {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Integer annee;

    /** POLE budgets are shared; DIRECTION budgets belong to one direction. */
    @Column(nullable = false, columnDefinition = "varchar(30) default 'POLE'")
    private String scope = "POLE";

    @ManyToOne
    @JoinColumn(name = "direction_id")
    private Direction direction;

    @Column(name = "code_budget", nullable = false)
    private String codeBudget;

    private String typeBudget;
    @Column(columnDefinition = "TEXT")
    private String description;
    private Double budgetTotal;
    private Double reporteAnterieur;
    private Double engageActif;
    private Double realise;
    private Double disponible;
    private Double consomme;
    @Column(name = "reste_2025", columnDefinition = "TEXT")
    private String reste2025;
    private String sectionAnalytique;
    @Column(columnDefinition = "TEXT")
    private String notes;
    private LocalDateTime dateMiseAJour;

    @PrePersist
    @PreUpdate
    void horodaterModification() { dateMiseAJour = LocalDateTime.now(); }
}
