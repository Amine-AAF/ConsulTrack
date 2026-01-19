package ma.cdgcapital.consulttrack.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LigneFacture {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String designation; // Ex: CT/220/DSI/19/156 - Mohammed ADDOUMI [cite: 546]
    private Double quantite;    // Nombre de JH (ex: 18.0) [cite: 546]
    private Double prixUnitaire; // TJM (ex: 3000.0) [cite: 546]
    private Double totalHT;     // Qté * PU [cite: 546]
}