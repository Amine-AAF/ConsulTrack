package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Facture {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String numeroFacture; // Ex: IN2511-0146
    private LocalDate dateFacturation;

    @ManyToOne
    private Cabinet cabinet;

    @OneToMany(cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    private List<LigneFacture> lignes = new ArrayList<>();

    private Double totalHT;
    private Double tva;      // 20% du HT [cite: 834]
    private Double totalTTC; // HT + TVA [cite: 834]
}