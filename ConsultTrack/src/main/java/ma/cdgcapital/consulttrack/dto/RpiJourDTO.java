package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

/**
 * Une case (un jour) de la grille RPI mensuelle.
 * Seules les saisies VALIDÉES alimentent le RPI (document officiel).
 */
@Data
public class RpiJourDTO {
    private String date;        // ISO
    private String jourSemaine; // L, M, M, J, V, S, D

    /** PRESENCE | ABSENCE | FERIE | WEEKEND | VIDE | HORS_MOIS */
    private String type;

    private Double valeur;      // JH (présence) ; null sinon
    private String bcReference; // référence du BC pointé (présence)
}
