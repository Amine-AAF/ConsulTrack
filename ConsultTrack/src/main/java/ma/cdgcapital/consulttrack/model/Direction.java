package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "direction")
@Data
public class Direction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String nom;
}
