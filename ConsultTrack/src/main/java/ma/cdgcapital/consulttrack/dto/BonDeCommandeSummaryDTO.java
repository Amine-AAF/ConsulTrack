package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

@Data
public class BonDeCommandeSummaryDTO {
    private Long id;
    private String reference;
    private Double joursMax;        // Budget initial
    private Double joursConsommes;  // Saisies VALIDE
    private Double joursEngages;    // Saisies EN_ATTENTE + VALIDE
    private Double joursRestants;   // = joursMax - joursEngages
    private Double tjm;
    private String statut;
}
