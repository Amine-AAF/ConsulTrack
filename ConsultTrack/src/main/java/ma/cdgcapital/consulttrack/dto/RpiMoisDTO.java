package ma.cdgcapital.consulttrack.dto;
import lombok.Data;
import java.util.List;

@Data
public class RpiMoisDTO {
    private String mois;
    private String referenceBC;
    private Double jhBudgetBC;
    private Double jhAvantMois;
    private Double consommeMois;
    private Double jhApresMois;
    private List<SemaineDTO> semaines;
}