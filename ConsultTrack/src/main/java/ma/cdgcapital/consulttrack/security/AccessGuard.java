package ma.cdgcapital.consulttrack.security;

import ma.cdgcapital.consulttrack.model.Consultant;
import ma.cdgcapital.consulttrack.repository.ConsultantRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Contrôle d'accès applicatif (anti-IDOR).
 *
 * Le principal JWT ne porte que l'email + le rôle : pour vérifier qu'un consultant
 * n'accède qu'à SES propres ressources, on résout le consultant courant par email
 * et on compare son id à celui demandé. Les ADMIN sont autorisés sur n'importe quel
 * consultant (saisie déléguée).
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
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (isAdmin) {
            return;
        }
        Consultant me = consultantRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new AccessDeniedException("Utilisateur courant introuvable"));
        if (consultantId == null || !consultantId.equals(me.getId())) {
            throw new AccessDeniedException("Accès refusé : ressource d'un autre consultant.");
        }
    }
}
