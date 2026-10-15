package ma.cdgcapital.consulttrack.dto;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class BudgetImportRequest {
    private List<BudgetAnnuelRequest> budgets = new ArrayList<>();
    private List<DemandeImportRequest> demandes = new ArrayList<>();
}
