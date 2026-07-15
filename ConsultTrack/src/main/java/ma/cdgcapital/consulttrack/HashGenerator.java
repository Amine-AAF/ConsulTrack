package ma.cdgcapital.consulttrack;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Petit utilitaire pour générer des hashes BCrypt à insérer manuellement
 * en base si jamais le seed ne tourne pas.
 *
 * Usage :
 *   mvn compile
 *   mvn exec:java -Dexec.mainClass="ma.cdgcapital.consulttrack.HashGenerator"
 */
public class HashGenerator {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String[] passwords = {"admin123", "consultant123"};
        for (String pwd : passwords) {
            String hash = encoder.encode(pwd);
            System.out.println(pwd + " -> " + hash);
            System.out.println("Vérif matches: " + encoder.matches(pwd, hash));
        }
    }
}
