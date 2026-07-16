package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.dto.FacturationCabinetDTO;
import ma.cdgcapital.consulttrack.model.Cabinet;
import ma.cdgcapital.consulttrack.model.Consultant;
import ma.cdgcapital.consulttrack.model.Role;
import ma.cdgcapital.consulttrack.security.AccessGuard;
import ma.cdgcapital.consulttrack.service.FacturationPrefactureService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Pré-factures mensuelles (contrôle interne, à rapprocher des factures cabinets).
 * URL sous /api/admin ⇒ ADMIN + RESPONSABLE (SecurityConfig) ;
 * un RESPONSABLE est en plus restreint à ses cabinets gérés.
 */
@RestController
@RequestMapping("/api/admin/facturation")
public class FacturationController {

    @Autowired private FacturationPrefactureService facturationPrefactureService;
    @Autowired private AccessGuard accessGuard;

    @GetMapping
    public ResponseEntity<List<FacturationCabinetDTO>> getFacturationMensuelle(
            @RequestParam int annee,
            @RequestParam int mois,
            Authentication auth) {
        Consultant viewer = accessGuard.currentUser(auth);
        Set<Long> scope = null; // null = tout voir (ADMIN)
        if (viewer.getRole() == Role.RESPONSABLE) {
            scope = viewer.getCabinetsGeres() == null ? Set.of()
                    : viewer.getCabinetsGeres().stream().map(Cabinet::getId).collect(Collectors.toSet());
        }
        return ResponseEntity.ok(facturationPrefactureService.getFacturationMensuelle(annee, mois, scope));
    }
}
