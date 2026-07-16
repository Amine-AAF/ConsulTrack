package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Pré-facture mensuelle d'un cabinet : agrégat des saisies VALIDÉES (mode BC)
 * du mois, à rapprocher de la facture réellement émise par le cabinet.
 */
@Data
public class FacturationCabinetDTO {
    private Long cabinetId;
    private String cabinetNom;
    private Double totalJH = 0.0;
    private Double totalMontant = 0.0;
    private List<FacturationConsultantDTO> consultants = new ArrayList<>();
}
