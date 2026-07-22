package ma.cdgcapital.consulttrack.security;

import ma.cdgcapital.consulttrack.model.Cabinet;
import ma.cdgcapital.consulttrack.model.Consultant;
import ma.cdgcapital.consulttrack.repository.ConsultantRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Contrôle d'accès applicatif (anti-IDOR).
 *
 * Le principal JWT ne porte que l'email + le rôle :
 * - ADMIN : accès à tout.
 * - RESPONSABLE : accès aux consultants dont le cabinet fait partie de ses
 *   {@code cabinetsGeres} (périmètre assigné par l'Admin).
 * - CONSULTANT : uniquement ses propres ressources.
 */
@Component
public class AccessGuard {

    private final ConsultantRepository consultantRepository;

    public AccessGuard(ConsultantRepository consultantRepository) {
        this.consultantRepository = consultantRepository;
    }

    /** Lève AccessDeniedException (→ 403 via GlobalExceptionHandler) si l'accès n'est pas permis. */
    public void assertOwnership(Authentication auth, Long consultantId) {
        if (auth == null) {
            throw new AccessDeniedException("Non authentifié");
        }
        if (hasRole(auth, "ROLE_ADMIN")) {
            return;
        }
        Consultant me = consultantRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new AccessDeniedException("Utilisateur courant introuvable"));

        if (hasRole(auth, "ROLE_RESPONSABLE")) {
            if (consultantId == null) {
                throw new AccessDeniedException("Consultant cible manquant");
            }
            if (consultantId.equals(me.getId())) {
                return; // ses propres ressources (profil, etc.)
            }
            Consultant cible = consultantRepository.findById(consultantId)
                    .orElseThrow(() -> new AccessDeniedException("Consultant cible introuvable"));
            Cabinet cabinetCible = cible.getCabinet();
            boolean dansPerimetre = cabinetCible != null
                    && me.getCabinetsGeres() != null
                    && me.getCabinetsGeres().stream()
                        .anyMatch(c -> c.getId().equals(cabinetCible.getId()));
            if (!dansPerimetre) {
                throw new AccessDeniedException(
                        "Accès refusé : consultant hors de votre périmètre de cabinets.");
            }
            return;
        }

        // CONSULTANT : soi-même uniquement
        if (consultantId == null || !consultantId.equals(me.getId())) {
            throw new AccessDeniedException("Accès refusé : ressource d'un autre consultant.");
        }
    }

    /** Le consultant courant (résolu par email du JWT). */
    public Consultant currentUser(Authentication auth) {
        if (auth == null) throw new AccessDeniedException("Non authentifié");
        return consultantRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new AccessDeniedException("Utilisateur courant introuvable"));
    }

    // ==========================================================
    // Périmètre RESPONSABLE (cabinets gérés)
    // ==========================================================

    /** null = pas de restriction (ADMIN/CONSULTANT) ; sinon ids des cabinets gérés du RESPONSABLE. */
    public java.util.Set<Long> cabinetScope(Consultant viewer) {
        if (viewer == null || viewer.getRole() != ma.cdgcapital.consulttrack.model.Role.RESPONSABLE) {
            return null;
        }
        return viewer.getCabinetsGeres() == null ? java.util.Set.of()
                : viewer.getCabinetsGeres().stream().map(Cabinet::getId)
                        .collect(java.util.stream.Collectors.toSet());
    }

    /** true si le consultant (via son cabinet) est dans le périmètre (scope null = tout permis). */
    public boolean inScope(Consultant c, java.util.Set<Long> scope) {
        if (scope == null) return true;
        return c != null && c.getCabinet() != null && scope.contains(c.getCabinet().getId());
    }

    /** RESPONSABLE : le consultant cible doit appartenir à un cabinet géré. ADMIN : pas de restriction. */
    public void assertConsultantDansPerimetre(Consultant viewer, Consultant cible) {
        if (!inScope(cible, cabinetScope(viewer))) {
            throw new AccessDeniedException(
                    "Accès refusé : consultant hors de votre périmètre de cabinets.");
        }
    }

    /** RESPONSABLE : le cabinet visé doit être géré. ADMIN : pas de restriction. */
    public void assertCabinetDansPerimetre(Consultant viewer, Long cabinetId) {
        java.util.Set<Long> scope = cabinetScope(viewer);
        if (scope == null) return;
        if (cabinetId == null || !scope.contains(cabinetId)) {
            throw new AccessDeniedException(
                    "Accès refusé : cabinet hors de votre périmètre de cabinets.");
        }
    }

    /** Réserve une action à l'ADMIN (RESPONSABLE refusé). */
    public void assertAdmin(Consultant viewer) {
        if (cabinetScope(viewer) != null) {
            throw new AccessDeniedException("Accès refusé : action réservée à l'administrateur.");
        }
    }

    private static boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream().anyMatch(a -> role.equals(a.getAuthority()));
    }
}
