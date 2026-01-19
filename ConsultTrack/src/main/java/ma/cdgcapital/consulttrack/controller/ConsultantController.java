package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.model.JourTravaille;
import ma.cdgcapital.consulttrack.service.TimesheetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/consultant")
@CrossOrigin(origins = "*")
public class ConsultantController {

    @Autowired
    private TimesheetService timesheetService;

    /**
     * Endpoint pour saisir une journée de travail
     * Exemple de JSON : { "dateJour": "2025-09-01", "duree": 1.0, "descriptionTache": "Dev Backend" }
     */
    @PostMapping("/saisir-jour")
    public JourTravaille saisirJour(
            @RequestParam Long consultantId,
            @RequestParam Long bcId,
            @RequestBody JourTravaille jour) {
        return timesheetService.saisirJour(consultantId, bcId, jour);
    }

    /**
     * Récupérer l'historique des saisies d'un consultant
     */
    @GetMapping("/{consultantId}/historique")
    public List<JourTravaille> getHistorique(@PathVariable Long consultantId) {
        return timesheetService.getHistoriqueConsultant(consultantId);
    }
}