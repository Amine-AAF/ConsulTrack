package ma.cdgcapital.consulttrack.dto;

public class BonDeCommandeSummaryDTO {
    private Long id;
    private String reference;      // ex: "CT2025"
    private Double joursMax;       // "Budget Initial"
    private Double joursConsommes; // Pour calculer le "Reliquat"

    // Getters & Setters
}