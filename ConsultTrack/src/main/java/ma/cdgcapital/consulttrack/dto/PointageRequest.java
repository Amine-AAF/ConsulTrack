package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

@Data
public class PointageRequest {
    private Long consultantId;
    private Long bcId;
    private String date; // Reçu au format "YYYY-MM-DD"
    private Double duree;
    private String descriptionTache;

    // --- NOUVEAUX CHAMPS A AJOUTER ---
    private String typePrestation;
    private String sousType;
    private String ticketJira;
    private String statut;
    private String mode; // "BC", "ABSENCE", "FERIE" (Pour savoir quoi afficher côté React)
}