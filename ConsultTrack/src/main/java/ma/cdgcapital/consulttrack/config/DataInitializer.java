package ma.cdgcapital.consulttrack.config;

import ma.cdgcapital.consulttrack.model.Consultant;
import ma.cdgcapital.consulttrack.model.Role;
import ma.cdgcapital.consulttrack.repository.ConsultantRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Initialisation DEV minimale : garantit uniquement l'accès Superadmin.
 * Les données métier proviennent des imports réels et ne sont pas remplacées
 * par un jeu synthétique au démarrage.
 */
@Configuration
@Profile("dev")
public class DataInitializer {

    @Value("${app.seed.admin-email:admin@cdgcapital.ma}")
    private String adminEmail;

    @Value("${app.seed.admin-password:admin123}")
    private String adminPassword;

    @Bean
    CommandLineRunner initDatabase(ConsultantRepository consultantRepository,
                                   PasswordEncoder passwordEncoder) {
        return args -> consultantRepository.findByEmail(adminEmail).orElseGet(() -> {
            Consultant admin = new Consultant();
            admin.setNom("CDG");
            admin.setPrenom("ADMIN");
            admin.setEmail(adminEmail);
            admin.setPassword(passwordEncoder.encode(adminPassword));
            admin.setRole(Role.ADMIN);
            admin.setActif(true);
            Consultant saved = consultantRepository.save(admin);
            System.out.println("[DEV] Compte Superadmin initial créé : " + adminEmail);
            return saved;
        });
    }
}
