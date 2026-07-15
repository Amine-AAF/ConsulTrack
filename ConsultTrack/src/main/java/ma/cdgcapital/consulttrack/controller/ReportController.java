package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.dto.RpiDisponibleDTO;
import ma.cdgcapital.consulttrack.dto.RpiMensuelDTO;
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
     * Relevé Périodique d'Intervention mensuel (un consultant × un mois, tous BC).
     * Exemple : GET /api/reports/rpi-mensuel?consultantId=1&annee=2025&mois=1
     */
    @GetMapping("/rpi-mensuel")
    public RpiMensuelDTO getRpiMensuel(
            @RequestParam Long consultantId,
            @RequestParam int annee,
            @RequestParam int mois,
            Authentication auth) {
        accessGuard.assertOwnership(auth, consultantId);
        return reportService.genererRpiMensuel(consultantId, annee, mois);
    }

    /**
     * Liste des mois de l'année pour lesquels un RPI est générable
     * (au moins une présence validée).
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
