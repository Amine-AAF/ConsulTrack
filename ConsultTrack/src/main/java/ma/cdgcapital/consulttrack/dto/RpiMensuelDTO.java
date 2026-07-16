package ma.cdgcapital.consulttrack.dto;

import lombok.Data;
import java.util.List;

/**
 * Relevé Périodique d'Intervention (RPI) mensuel :
 * UN RPI = un consultant × un mois, couvrant TOUS ses Bons de Commande.
 * Construit exclusivement à partir des saisies VALIDÉES (document officiel).
 */
@Data
public class RpiMensuelDTO {
    private Long consultantId;
    private String consultantNom;
    private String cabinetNom;
    private String mission;

    private int mois;          // 1..12
    private int annee;
    private String moisLabel;  // ex: "Janvier 2025"
    private String periodeDu;  // ISO : 1er jour du mois
    private String periodeAu;  // ISO : dernier jour du mois

    private Double totalMtd;   // présence validée du mois (tous BC)
    private Double totalStd;   // présence validée cumulée depuis le début (tous BC, ≤ fin du mois)

    /** VIDE | BROUILLON | EN_ATTENTE | VALIDE | MIXTE (agrégat des statuts des saisies du mois) */
    private String statutMois;

    private List<RpiBcLigneDTO> bcs;
    private List<RpiSemaineDTO> semaines;
    private List<RpiHistoriqueLigneDTO> historiqueAnnuel;
    private RpiHistoriqueLigneDTO totauxAnnuels; // reference = "Totaux"

    private String signatureConsultant;  // base64 ou null (câblage ultérieur)
    private String signatureResponsable; // null pour l'instant

    /** Logo du cabinet (data-URL base64) imprimé en tête du document, ou null. */
    private String logoCabinet;
}
