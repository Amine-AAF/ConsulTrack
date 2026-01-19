package ma.cdgcapital.consulttrack.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())

                // --- MODIFICATION POUR LE DÉVELOPPEMENT ---
                // On autorise tout temporairement pour éviter l'erreur 401 Unauthorized
                // tant que le frontend n'envoie pas de jeton JWT valide.
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()
                )

                // On laisse la configuration du Resource Server,
                // mais elle ne bloquera pas les requêtes grâce au permitAll() ci-dessus.
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                )

                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        return http.build();
    }

    /**
     * Définition du JwtDecoder.
     * Assurez-vous que Keycloak est bien lancé sur le port 8080.
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        String jwkSetUri = "http://localhost:8080/realms/consulttrack-realm/protocol/openid-connect/certs";
        return NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
    }

    /**
     * Convertit les rôles Keycloak en autorités Spring Security (ROLE_ADMIN, ROLE_CONSULTANT)
     */
    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        final String REALM_ACCESS = "realm_access";
        final String ROLES = "roles";

        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(jwt -> {
            Map<String, Collection<String>> realmAccess = jwt.getClaim(REALM_ACCESS);
            if (realmAccess == null || !realmAccess.containsKey(ROLES)) {
                return List.of();
            }
            Collection<String> roles = realmAccess.get(ROLES);
            return roles.stream()
                    .map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
                    .collect(Collectors.toList());
        });
        return jwtConverter;
    }
}