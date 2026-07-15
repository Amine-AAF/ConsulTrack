package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.exception.BusinessException;
import ma.cdgcapital.consulttrack.model.JourFerie;
import ma.cdgcapital.consulttrack.repository.JourFerieRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
public class JourFerieController {

    @Autowired
    private JourFerieRepository jourFerieRepository;

    /** Lecture pour tous les utilisateurs authentifiés (les grilles en ont besoin). */
    @GetMapping("/jours-feries")
    public List<JourFerie> getJoursFeries(@RequestParam int annee) {
        return jourFerieRepository.findByDateBetweenOrderByDate(
                LocalDate.of(annee, 1, 1), LocalDate.of(annee, 12, 31));
    }

    /** Gestion réservée à l'ADMIN (la règle URL /api/admin/** admet aussi RESPONSABLE → garde méthode). */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/jours-feries")
    public ResponseEntity<JourFerie> create(@RequestBody JourFerie jf) {
        if (jf.getDate() == null) throw new BusinessException("La date du jour férié est obligatoire");
        if (jourFerieRepository.existsByDate(jf.getDate())) {
            throw new BusinessException("Un jour férié existe déjà au " + jf.getDate());
        }
        return ResponseEntity.ok(jourFerieRepository.save(jf));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/admin/jours-feries/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        jourFerieRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
