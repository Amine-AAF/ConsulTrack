package ma.cdgcapital.consulttrack.dto;
import lombok.Data;
import java.util.Map;

@Data
public class SemaineDTO {
    private String periode;
    private Map<String, Double> jours; // Pour stocker Lundi: 1.0, Mardi: 0.5, etc. [cite: 19]
    private Double totalSemaine;
    private Double totalMtd;
    private Double totalStd;
}