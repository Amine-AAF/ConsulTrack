package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.dto.*;
import ma.cdgcapital.consulttrack.service.BudgetManagementService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/budgets")
@PreAuthorize("hasAnyRole('ADMIN','RESPONSABLE')")
public class BudgetController {
    private final BudgetManagementService service;

    public BudgetController(BudgetManagementService service) { this.service = service; }

    @GetMapping
    public ResponseEntity<List<BudgetAnnuelDTO>> getBudgets(@RequestParam(required = false) Integer annee,
            org.springframework.security.core.Authentication auth) {
        return ResponseEntity.ok(service.getBudgets(annee, auth));
    }

    @PostMapping
    public ResponseEntity<BudgetAnnuelDTO> createBudget(@RequestBody BudgetAnnuelRequest request,
            org.springframework.security.core.Authentication auth) {
        return ResponseEntity.ok(service.saveBudget(null, request, auth));
    }

    @PutMapping("/{id}")
    public ResponseEntity<BudgetAnnuelDTO> updateBudget(@PathVariable Long id,
                                                         @RequestBody BudgetAnnuelRequest request,
                                                         org.springframework.security.core.Authentication auth) {
        return ResponseEntity.ok(service.saveBudget(id, request, auth));
    }

    @GetMapping("/{budgetId}/demandes")
    public ResponseEntity<List<DemandeApprovisionnementDTO>> getDemandes(@PathVariable Long budgetId,
            org.springframework.security.core.Authentication auth) {
        return ResponseEntity.ok(service.getDemandes(budgetId, auth));
    }

    @PostMapping("/{budgetId}/demandes")
    public ResponseEntity<DemandeApprovisionnementDTO> createDemande(@PathVariable Long budgetId,
                                                                      @RequestBody DemandeApprovisionnementRequest request,
                                                                      org.springframework.security.core.Authentication auth) {
        request.setBudgetId(budgetId);
        return ResponseEntity.ok(service.saveDemande(null, request, auth));
    }

    @PutMapping("/demandes/{id}")
    public ResponseEntity<DemandeApprovisionnementDTO> updateDemande(@PathVariable Long id,
                                                                      @RequestBody DemandeApprovisionnementRequest request,
                                                                      org.springframework.security.core.Authentication auth) {
        return ResponseEntity.ok(service.saveDemande(id, request, auth));
    }

    @PostMapping("/import")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> importWorkbook(@RequestBody BudgetImportRequest request) {
        int imported = service.importWorkbook(request);
        return ResponseEntity.ok(Map.of("budgets", request.getBudgets().size(), "demandes", imported));
    }

    @PostMapping("/demandes/{id}/bc")
    public ResponseEntity<DemandeApprovisionnementDTO> createBc(@PathVariable Long id,
                                                                  @RequestBody CreationBcRequest request,
                                                                  org.springframework.security.core.Authentication auth) {
        return ResponseEntity.ok(service.createBc(id, request, auth));
    }
}
