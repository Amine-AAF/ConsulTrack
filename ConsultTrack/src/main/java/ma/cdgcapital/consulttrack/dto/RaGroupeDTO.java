package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

import java.util.List;

@Data
public class RaGroupeDTO {
    private String nature;
    private Double totalJH;
    private List<RaLigneDTO> lignes;
}
