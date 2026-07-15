package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

@Data
public class RapportActiviteRequest {
    private Long consultantId;
    private int annee;
    private int mois;
    private String tachesRealisees;
    private String statut; // "BROUILLON" | "SOUMIS"
}
