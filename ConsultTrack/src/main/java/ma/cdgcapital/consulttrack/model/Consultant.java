package ma.cdgcapital.consulttrack.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Data
public class Consultant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nom;
    private String prenom;

    @Column(unique = true)
    private String email;

    /** Hash BCrypt — jamais exposé en sortie via DTO. */
    @JsonIgnore
    private String password;

    @Enumerated(EnumType.STRING)
    private Role role;

    @ManyToOne
    @JoinColumn(name = "cabinet_id")
    private Cabinet cabinet;

    /**
     * Cabinets gérés par un RESPONSABLE (périmètre de validation / dashboard).
     * Vide pour les autres rôles.
     */
    @JsonIgnore
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "responsable_cabinet",
            joinColumns = @JoinColumn(name = "responsable_id"),
            inverseJoinColumns = @JoinColumn(name = "cabinet_id"))
    private Set<Cabinet> cabinetsGeres = new HashSet<>();

    /** Compte actif (false = mission terminée, connexion bloquée). null → considéré actif. */
    private Boolean actif = true;

    /** Date de fin de mission (renseignée quand actif = false). */
    private java.time.LocalDate dateFinMission;

    /** Image de signature (data-URL base64) embarquée dans les PDF validés. */
    @JsonIgnore
    @Column(columnDefinition = "TEXT")
    private String signatureImage;

    /** Champ technique JSON (création admin) : ids des cabinets gérés. */
    @Transient
    private List<Long> cabinetsGeresIds;
}
