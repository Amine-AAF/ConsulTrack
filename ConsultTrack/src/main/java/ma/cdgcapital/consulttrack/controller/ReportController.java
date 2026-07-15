package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.dto.RpiDisponibleDTO;
import ma.cdgcapital.consulttrack.dto.RpiMoisDTO;
import ma.cdgcapital.consulttrack.security.AccessGuard;
import ma.cdgcapital.consulttrack.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    @Autowired
    private ReportService reportService;

    @Autowired
    private AccessGuard accessGuard;

    /**
     * Récupère les données formatées pour le RPI d'un mois précis
     * Exemple : GET /api/reports/rpi?consultantId=1&bcId=5&annee=2025&mois=9
     */
    @GetMapping("/rpi")
    public RpiMoisDTO getRpiData(
            @RequestParam Long consultantId,
            @RequestParam Long bcId,
            @RequestParam int annee,
            @RequestParam int mois,
            Authentication auth) {
        accessGuard.assertOwnership(auth, consultantId);
        return reportService.genererDonneesRPI(consultantId, bcId, annee, mois);
    }

    /**
     * Liste les RPI générables (couples BC × mois avec présence validée) pour un consultant.
     * Exemple : GET /api/reports/rpi/disponibles?consultantId=1&annee=2025
     */
    @GetMapping("/rpi/disponibles")
    public List<RpiDisponibleDTO> getRpiDisponibles(
            @RequestParam Long consultantId,
            @RequestParam int annee,
            Authentication auth) {
        accessGuard.assertOwnership(auth, consultantId);
        return reportService.getRpiDisponibles(consultantId, annee);
    }
}