package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

@Data
public class RaBdcUtiliseDTO {
    private String reference;
    private Double jours;
    private String nature;      // RUN | PROJET (nature du BC)
    private String designation; // désignation du BC (titre de section du RA)
}
