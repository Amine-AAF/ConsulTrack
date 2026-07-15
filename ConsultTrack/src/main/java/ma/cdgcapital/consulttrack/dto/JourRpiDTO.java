package ma.cdgcapital.consulttrack.dto;

import lombok.Data;
import java.time.LocalDate;

/**
 * Une case (un jour) de la grille RPI mensuelle.
 * Le champ {@code type} pilote directement le rendu (couleur) côté frontend / PDF.
 */
@Data
public class JourRpiDTO {
    private LocalDate date;
    private int numeroJour;      // 1..31
    private String jourSemaine;  // LUN, MAR, ..., DIM

    /** PRESENCE | ABSENCE | FERIE | AUTRE_BC | WEEKEND | VIDE */
    private String type;

    private Double valeur;            // JH du jour (0.5, 1.0...)
    private String typePrestation;   // RUN / PROJET (pour une présence sur ce BC)
    private String referenceBcSaisi; // référence du BC saisi ce jour (cas AUTRE_BC)
}
