package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.model.Direction;
import ma.cdgcapital.consulttrack.repository.DirectionRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/directions")
@PreAuthorize("hasRole('ADMIN')")
public class DirectionController {
    private final DirectionRepository repository;
    public DirectionController(DirectionRepository repository) { this.repository = repository; }
    @GetMapping public List<Direction> list() { return repository.findAll(); }
    @PostMapping public Direction create(@RequestBody Direction direction) {
        if (direction.getNom() == null || direction.getNom().isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Le nom est obligatoire.");
        direction.setId(null);
        direction.setNom(direction.getNom().trim());
        return repository.save(direction);
    }
    @PutMapping("/{id}") public Direction update(@PathVariable Long id, @RequestBody Direction direction) {
        Direction target = repository.findById(id).orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND));
        if (direction.getNom() == null || direction.getNom().isBlank()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Le nom est obligatoire.");
        target.setNom(direction.getNom().trim());
        return repository.save(target);
    }
}
