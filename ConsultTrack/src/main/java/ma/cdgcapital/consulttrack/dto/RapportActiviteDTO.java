package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

import java.util.List;

@Data
public class RapportActiviteDTO {
    private Long id;
    private Long consultantId;
    private String consultantNom;
    private Long bcId;
    private String referenceBC;
    private String designationBC;
    private int mois;
    private int annee;
    private String moisLabel;
    private Double totalJH;
    private List<RaGroupeDTO> groupes;
    private String syntheseMois;
    private String faitsMarquants;
    private String perspectives;
    private String statut;
    private String motifRejet;
}
