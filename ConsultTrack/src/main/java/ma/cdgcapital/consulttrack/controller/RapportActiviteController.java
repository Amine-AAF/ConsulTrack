package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.dto.RapportActiviteDTO;
import ma.cdgcapital.consulttrack.dto.RapportActiviteRequest;
import ma.cdgcapital.consulttrack.security.AccessGuard;
import ma.cdgcapital.consulttrack.service.RapportActiviteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class RapportActiviteController {

    @Autowired
    private RapportActiviteService rapportActiviteService;

    @Autowired
    private AccessGuard accessGuard;

    @GetMapping("/rapports/activite")
    public RapportActiviteDTO getRapport(
            @RequestParam Long consultantId,
            @RequestParam int annee,
            @RequestParam int mois,
            Authentication auth) {
        accessGuard.assertOwnership(auth, consultantId);
        return rapportActiviteService.getRapport(consultantId, annee, mois);
    }

    @PostMapping("/rapports/activite")
    public RapportActiviteDTO saveRapport(@RequestBody RapportActiviteRequest req, Authentication auth) {
        accessGuard.assertOwnership(auth, req.getConsultantId());
        return rapportActiviteService.saveRapport(req);
    }

    @PreAuthorize("hasAnyRole('ADMIN','RESPONSABLE')")
    @GetMapping("/admin/rapports/pending")
    public List<RapportActiviteDTO> getPending(Authentication auth) {
        // RESPONSABLE : uniquement les rapports de ses cabinets gérés
        return rapportActiviteService.getPending(accessGuard.currentUser(auth));
    }

    @PreAuthorize("hasAnyRole('ADMIN','RESPONSABLE')")
    @PutMapping("/admin/rapports/{id}/valider")
    public ResponseEntity<Void> valider(@PathVariable Long id, Authentication auth) {
        rapportActiviteService.valider(id, auth != null ? auth.getName() : null,
                accessGuard.currentUser(auth));
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("hasAnyRole('ADMIN','RESPONSABLE')")
    @PutMapping("/admin/rapports/{id}/rejeter")
    public ResponseEntity<Void> rejeter(@PathVariable Long id, @RequestParam String motif,
                                        Authentication auth) {
        rapportActiviteService.rejeter(id, motif, accessGuard.currentUser(auth));
        return ResponseEntity.ok().build();
    }
}
