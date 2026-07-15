package ma.cdgcapital.consulttrack.config;

import ma.cdgcapital.consulttrack.security.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Endpoints publics
                        .requestMatchers("/api/auth/**", "/api/public/**").permitAll()
                        // ⚠ ORDRE CRITIQUE : les règles spécifiques DOIVENT précéder /api/admin/**
                        // Création d'utilisateurs : ADMIN uniquement (anti-escalade de privilèges)
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/admin/consultants").hasRole("ADMIN")
                        // Gestion des jours fériés : ADMIN uniquement
                        .requestMatchers("/api/admin/jours-feries/**").hasRole("ADMIN")
                        // Le reste de l'admin (validation, référentiel) : ADMIN + RESPONSABLE
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "RESPONSABLE")
                        // Le reste authentifié
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
