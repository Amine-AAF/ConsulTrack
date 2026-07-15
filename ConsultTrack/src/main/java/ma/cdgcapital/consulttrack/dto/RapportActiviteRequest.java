package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

@Data
public class RapportActiviteRequest {
    private Long consultantId;
    private Long bcId;
    private int annee;
    private int mois;
    private String syntheseMois;
    private String faitsMarquants;
    private String perspectives;
    private String statut;
}
