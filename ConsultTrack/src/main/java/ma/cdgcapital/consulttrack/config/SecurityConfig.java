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
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

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

    /**
     * Session absente, token invalide ou expiré → 401 (et non 403).
     * C'est ce code que l'intercepteur axios attend pour purger la session et
     * renvoyer l'utilisateur vers la page de connexion. Un utilisateur bien
     * authentifié mais sans le rôle requis continue de recevoir un 403.
     */
    @Bean
    public AuthenticationEntryPoint unauthorizedEntryPoint() {
        return (request, response, ex) -> {
            response.setStatus(401);
            response.setContentType("application/json");
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write(
                    "{\"timestamp\":\"" + Instant.now() + "\",\"status\":401,"
                            + "\"message\":\"Session expirée : veuillez vous reconnecter.\"}");
        };
    }

    /** Authentifié mais rôle insuffisant → 403 (distinct de l'expiration de session). */
    @Bean
    public org.springframework.security.web.access.AccessDeniedHandler forbiddenHandler() {
        return (request, response, ex) -> {
            response.setStatus(403);
            response.setContentType("application/json");
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write(
                    "{\"timestamp\":\"" + Instant.now() + "\",\"status\":403,"
                            + "\"message\":\"Accès refusé : droits insuffisants.\"}");
        };
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
                        // Gestion d'utilisateurs : ADMIN + RESPONSABLE (périmètre + anti-escalade
                        // appliqués au niveau service : un RESPONSABLE ne gère que des CONSULTANT
                        // de ses cabinets gérés)
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/admin/consultants").hasAnyRole("ADMIN", "RESPONSABLE")
                        .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/admin/consultants/**").hasAnyRole("ADMIN", "RESPONSABLE")
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/admin/consultants/**").hasAnyRole("ADMIN", "RESPONSABLE")
                        // Gestion des jours fériés : ADMIN uniquement
                        .requestMatchers("/api/admin/jours-feries/**").hasRole("ADMIN")
                        // Le reste de l'admin (validation, référentiel) : ADMIN + RESPONSABLE
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "RESPONSABLE")
                        // Le reste authentifié
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(unauthorizedEntryPoint())
                        .accessDeniedHandler(forbiddenHandler()))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
