package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

/**
 * Un RPI générable : un couple (BC, mois) pour lequel le consultant a de la présence validée.
 * Sert à peupler la liste de sélection de l'écran RPI.
 */
@Data
public class RpiDisponibleDTO {
    private Long bcId;
    private String referenceBC;
    private int mois;
    private String moisLabel;
    private Double consommeMois;
}
