package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;

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

    private String password; // À encoder en BCrypt

    @Enumerated(EnumType.STRING)
    private Role role; // ADMIN ou CONSULTANT

    @ManyToOne
    @JoinColumn(name = "cabinet_id")
    private Cabinet cabinet;
}

// Enumération des rôles
enum Role {
    ADMIN, CONSULTANT
}