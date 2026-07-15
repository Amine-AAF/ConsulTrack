package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.exception.BusinessException;
import ma.cdgcapital.consulttrack.model.Consultant;
import ma.cdgcapital.consulttrack.repository.ConsultantRepository;
import ma.cdgcapital.consulttrack.security.AccessGuard;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Profil de l'utilisateur connecté — notamment sa signature manuscrite (image),
 * embarquée dans les PDF RPI/RA une fois le document validé.
 */
@RestController
@RequestMapping("/api/me")
public class ProfileController {

    /** ~500 Ko max en base64 : une signature scannée reste petite. */
    private static final int MAX_SIGNATURE_LENGTH = 700_000;

    @Autowired private ConsultantRepository consultantRepository;
    @Autowired private AccessGuard accessGuard;

    @GetMapping
    public Map<String, Object> me(Authentication auth) {
        Consultant me = accessGuard.currentUser(auth);
        Map<String, Object> out = new HashMap<>();
        out.put("id", me.getId());
        out.put("nom", me.getNom());
        out.put("prenom", me.getPrenom());
        out.put("email", me.getEmail());
        out.put("role", me.getRole() != null ? me.getRole().name() : null);
        out.put("cabinet", me.getCabinet() != null ? me.getCabinet().getNom() : null);
        out.put("hasSignature", me.getSignatureImage() != null && !me.getSignatureImage().isBlank());
        out.put("signatureImage", me.getSignatureImage());
        return out;
    }

    /** Enregistre l'image de signature (data-URL base64 : "data:image/png;base64,..."). */
    @PutMapping("/signature")
    public ResponseEntity<Void> updateSignature(@RequestBody Map<String, String> body,
                                                Authentication auth) {
        Consultant me = accessGuard.currentUser(auth);
        String image = body.get("signatureImage");
        if (image != null && !image.isBlank()) {
            if (!image.startsWith("data:image/")) {
                throw new BusinessException("Format attendu : data-URL d'image (data:image/...).");
            }
            if (image.length() > MAX_SIGNATURE_LENGTH) {
                throw new BusinessException("Image de signature trop volumineuse (max ~500 Ko).");
            }
        }
        me.setSignatureImage(image); // null/vide = suppression
        consultantRepository.save(me);
        return ResponseEntity.ok().build();
    }
}
