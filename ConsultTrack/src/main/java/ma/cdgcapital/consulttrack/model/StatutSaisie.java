package ma.cdgcapital.consulttrack.model;

/**
 * Définit l'état d'une ligne de saisie dans la feuille de temps.
 */
public enum StatutSaisie {
    BROUILLON, // Le consultant a enregistré mais n'a pas encore envoyé
    SOUMIS,    // Envoyé pour validation (utilisé dans votre TimesheetService)
    VALIDE,    // Approuvé par le superviseur (prêt pour le RPI)
    REJETE     // Refusé pour correction
}