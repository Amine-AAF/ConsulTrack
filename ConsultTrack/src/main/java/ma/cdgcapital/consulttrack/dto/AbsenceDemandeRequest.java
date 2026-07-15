package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class AbsenceDemandeRequest {
    private Long consultantId;
    private LocalDate date;
    private String motif;
}
