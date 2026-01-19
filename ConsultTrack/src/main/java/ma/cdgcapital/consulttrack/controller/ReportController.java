package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.dto.RpiMoisDTO;
import ma.cdgcapital.consulttrack.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
@CrossOrigin(origins = "*")
public class ReportController {

    @Autowired
    private ReportService reportService;

    /**
     * Récupère les données formatées pour le RPI d'un mois précis
     * Exemple : GET /api/reports/rpi?consultantId=1&bcId=5&annee=2025&mois=9
     */
    @GetMapping("/rpi")
    public RpiMoisDTO getRpiData(
            @RequestParam Long consultantId,
            @RequestParam Long bcId,
            @RequestParam int annee,
            @RequestParam int mois) {
        return reportService.genererDonneesRPI(consultantId, bcId, annee, mois);
    }
}