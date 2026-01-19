package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.model.JourTravaille;
import ma.cdgcapital.consulttrack.model.TypeAbsence;
import ma.cdgcapital.consulttrack.service.TimesheetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/consultant/absences")
@CrossOrigin(origins = "*")
public class AbsenceController {

    @Autowired
    private TimesheetService timesheetService;

    /**
     * Soumettre une demande d'absence (Congé, Maladie, etc.)
     * Le paramètre bcId peut être null ici car non utilisé pour une absence
     */
    @PostMapping("/demander")
    public JourTravaille demanderAbsence(
            @RequestParam Long consultantId,
            @RequestBody JourTravaille absence) {
        absence.setEstAbsence(true);
        return timesheetService.saisirJour(consultantId, null, absence);
    }

    /**
     * Liste des types d'absences disponibles pour le frontend
     */
    @GetMapping("/types")
    public List<TypeAbsence> getTypesAbsence() {
        return Arrays.asList(TypeAbsence.values());
    }
}