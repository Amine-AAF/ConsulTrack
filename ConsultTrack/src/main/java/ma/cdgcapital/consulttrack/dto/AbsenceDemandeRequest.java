package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class AbsenceDemandeRequest {
    private Long consultantId;
    /** Compat : demande d'un seul jour. Ignoré si dateDebut/dateFin fournis. */
    private LocalDate date;
    /** Demande multi-jours : plage [dateDebut..dateFin], week-ends et fériés exclus. */
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private String motif;
}
