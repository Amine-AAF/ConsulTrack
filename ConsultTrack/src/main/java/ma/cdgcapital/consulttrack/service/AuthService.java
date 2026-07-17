package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.dto.auth.AuthUserDTO;
import ma.cdgcapital.consulttrack.dto.auth.LoginRequest;
import ma.cdgcapital.consulttrack.dto.auth.LoginResponse;
import ma.cdgcapital.consulttrack.exception.BusinessException;
import ma.cdgcapital.consulttrack.model.Consultant;
import ma.cdgcapital.consulttrack.repository.ConsultantRepository;
import ma.cdgcapital.consulttrack.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final ConsultantRepository consultantRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(ConsultantRepository consultantRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.consultantRepository = consultantRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public LoginResponse login(LoginRequest req) {
        if (req == null || req.getEmail() == null || req.getPassword() == null) {
            throw new BusinessException("Email et mot de passe requis");
        }

        Consultant c = consultantRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new BadCredentialsException("Identifiants invalides"));

        if (c.getPassword() == null || !passwordEncoder.matches(req.getPassword(), c.getPassword())) {
            throw new BadCredentialsException("Identifiants invalides");
        }

        // Compte désactivé (fin de mission) : connexion refusée après vérification des identifiants
        if (Boolean.FALSE.equals(c.getActif())) {
            throw new BusinessException("Compte désactivé : mission terminée.");
        }

        String token = jwtService.generateToken(c);
        AuthUserDTO user = new AuthUserDTO(
                c.getId(), c.getNom(), c.getPrenom(), c.getEmail(),
                c.getRole() != null ? c.getRole().name() : "CONSULTANT");
        return new LoginResponse(token, user);
    }
}
