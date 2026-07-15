package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.model.Cabinet;
import ma.cdgcapital.consulttrack.model.Consultant;
import ma.cdgcapital.consulttrack.model.Role;
import ma.cdgcapital.consulttrack.model.StatutPointage;
import ma.cdgcapital.consulttrack.repository.AbsenceRepository;
import ma.cdgcapital.consulttrack.repository.RapportActiviteRepository;
import ma.cdgcapital.consulttrack.repository.TacheRealiseeRepository;
import ma.cdgcapital.consulttrack.security.AccessGuard;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Compteurs « à valider » pour les badges de la sidebar (ADMIN + RESPONSABLE).
 * Un RESPONSABLE ne voit que les consultants de ses cabinets gérés.
 */
@RestController
@RequestMapping("/api/admin/validation")
public class ValidationController {

    @Autowired private TacheRealiseeRepository tacheRepository;
    @Autowired private AbsenceRepository absenceRepository;
    @Autowired private RapportActiviteRepository rapportRepository;
    @Autowired private AccessGuard accessGuard;

    @GetMapping("/pending-counts")
    public Map<String, Long> getPendingCounts(Authentication auth) {
        Consultant viewer = accessGuard.currentUser(auth);
        Set<Long> scope = cabinetScope(viewer); // null = tout voir (ADMIN)

        // Pointages : nombre de couples consultant×mois en attente (pas de lignes brutes)
        long pointages = tacheRepository.findByStatut(StatutPointage.EN_ATTENTE).stream()
                .filter(t -> t.getConsultant() != null && inScope(t.getConsultant(), scope))
                .map(t -> t.getConsultant().getId() + "-" + t.getAnnee() + "-" + t.getMois())
                .distinct().count();

        // Absences : nombre de demandes (groupées par demandeId, sinon par ligne)
        long absences = absenceRepository.findByStatut(StatutPointage.EN_ATTENTE).stream()
                .filter(a -> a.getConsultant() != null && inScope(a.getConsultant(), scope))
                .map(a -> a.getDemandeId() != null ? a.getDemandeId() : "abs-" + a.getId())
                .distinct().count();

        long rapports = rapportRepository.findByStatut(StatutPointage.EN_ATTENTE).stream()
                .filter(r -> r.getConsultant() != null && inScope(r.getConsultant(), scope))
                .count();

        return Map.of("pointages", pointages, "absences", absences, "rapports", rapports,
                "total", pointages + absences + rapports);
    }

    /** null = pas de restriction (ADMIN) ; sinon ids des cabinets gérés. */
    private static Set<Long> cabinetScope(Consultant viewer) {
        if (viewer.getRole() != Role.RESPONSABLE) return null;
        return viewer.getCabinetsGeres() == null ? Set.of()
                : viewer.getCabinetsGeres().stream().map(Cabinet::getId).collect(Collectors.toSet());
    }

    private static boolean inScope(Consultant c, Set<Long> scope) {
        if (scope == null) return true;
        return c.getCabinet() != null && scope.contains(c.getCabinet().getId());
    }
}
