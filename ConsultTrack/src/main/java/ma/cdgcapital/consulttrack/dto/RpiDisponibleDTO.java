package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

/**
 * Un mois de l'année pour lequel un RPI mensuel est générable
 * (au moins une présence validée sur la période).
 */
@Data
public class RpiDisponibleDTO {
    private int mois;          // 1..12
    private String moisLabel;  // ex: "Janvier 2025"
    private Double totalJH;    // présence validée du mois (tous BC)
    private int nbBcs;         // nombre de BC distincts pointés ce mois
    private String statutMois; // VIDE | BROUILLON | EN_ATTENTE | VALIDE | MIXTE
}
