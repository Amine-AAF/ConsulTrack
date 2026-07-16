package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/** Sous-total de pré-facture pour un consultant (lignes = ses BC consommés sur le mois). */
@Data
public class FacturationConsultantDTO {
    private Long consultantId;
    private String consultantNom;
    private Double totalJH = 0.0;
    private Double totalMontant = 0.0;
    private List<FacturationLigneDTO> lignes = new ArrayList<>();
}
