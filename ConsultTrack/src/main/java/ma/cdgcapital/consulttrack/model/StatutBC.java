package ma.cdgcapital.consulttrack.model;

/**
 * Définit l'état administratif d'un Bon de Commande.
 */
public enum StatutBC {
    ACTIF,    // Le BC est en cours d'utilisation
    EPUISE,   // Le solde de JH est arrivé à 0 (cas du BC CT/220/DSI/19/156 en Septembre)
    CLOTURE   // Le BC est fermé administrativement
}