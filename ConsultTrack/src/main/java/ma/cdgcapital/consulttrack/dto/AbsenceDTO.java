package ma.cdgcapital.consulttrack.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * DTO d'une absence.
 * Le consultant est imbriqué ({@code consultant: { id, nom, prenom }}) pour rester
 * compatible avec le regroupement par {@code a.consultant.id} d'AdminPanel.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AbsenceDTO {
    private Long id;
    private ConsultantRefDTO consultant;
    private LocalDate date;
    private String statut;
    private String motif;
}
