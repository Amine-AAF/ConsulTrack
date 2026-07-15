package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

import java.util.List;

@Data
public class RapportActiviteDTO {
    private Long id;
    private Long consultantId;
    private String consultantNom;
    private String cabinetNom;
    private String fonction;
    private int mois;
    private int annee;
    private String moisLabel;
    private Double totalJH;
    private List<RaBdcUtiliseDTO> bdcUtilises;
    private String tachesRealisees;
    private List<String> tachesSuggerees;
    private String statut;
    private String motifRejet;
    private String signatureConsultant;
    private String signatureResponsable;
}
