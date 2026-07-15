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

    private static boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream().anyMatch(a -> role.equals(a.getAuthority()));
    }
}
