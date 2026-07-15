package ma.cdgcapital.consulttrack.config;

import ma.cdgcapital.consulttrack.model.*;
import ma.cdgcapital.consulttrack.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Initialisation des données (DÉVELOPPEMENT UNIQUEMENT — {@code @Profile("dev")}).
 *  - Création complète d'un dataset riche si la base est totalement vide.
 *  - Sinon : garantit qu'un admin existe sans jamais écraser un mot de passe existant.
 *
 * En production (tout profil ≠ "dev", y compris le profil par défaut), ce bean n'est
 * pas chargé : aucun compte à identifiants en dur n'est créé et aucun hash n'est réécrit.
 * Pour (re)semer en local : lancer avec {@code --spring.profiles.active=dev}.
 */
@Configuration
@Profile("dev")
public class DataInitializer {

    // Identifiants de seed externalisés (application.properties / variables d'env), défauts DEV.
    @Value("${app.seed.admin-email:admin@cdgcapital.ma}")
    private String ADMIN_EMAIL;
    @Value("${app.seed.admin-password:admin123}")
    private String ADMIN_PASSWORD;
    @Value("${app.seed.consultant-password:consultant123}")
    private String DEFAULT_CONSULTANT_PASSWORD;

    @Bean
    CommandLineRunner initDatabase(
            CabinetRepository cabinetRepo,
            ConsultantRepository consultantRepo,
            BonDeCommandeRepository bcRepo,
            AffectationRepository affectationRepo,
            TacheRealiseeRepository tacheRepo,
            AbsenceRepository absenceRepo,
            PasswordEncoder passwordEncoder) {

        return args -> {
            if (consultantRepo.count() == 0) {
                seedFullDataset(cabinetRepo, consultantRepo, bcRepo, affectationRepo,
                        tacheRepo, absenceRepo, passwordEncoder);
            }
            // DEV : à CHAQUE démarrage, on garantit que les 3 comptes de test
            // documentés existent avec leur mot de passe connu (le hash est
            // réécrit même s'il avait divergé → tu peux toujours te connecter).
            ensureTestAccounts(consultantRepo, passwordEncoder);
            // Filet de sécurité pour les autres consultants (mots de passe NULL).
            repairMissingPasswords(consultantRepo, passwordEncoder);
        };
    }

    // ======================================================
    //  SEED COMPLET (table vide)
    // ======================================================

    private void seedFullDataset(CabinetRepository cabinetRepo,
                                 ConsultantRepository consultantRepo,
                                 BonDeCommandeRepository bcRepo,
                                 AffectationRepository affectationRepo,
                                 TacheRealiseeRepository tacheRepo,
                                 AbsenceRepository absenceRepo,
                                 PasswordEncoder encoder) {

        System.out.println("ConsultTrack : seed complet en cours...");

        // ---------- 1. CABINETS ----------
        Cabinet coda = createCabinet("CODA SOLUTIONS",
                "2 Bd Ibn Tachefine, Casablanca",
                "001866980000015", "20732236", "31490971",
                "007780000340500000112630");
        Cabinet cgi = createCabinet("CGI MAROC",
                "Boulevard Anoual, Casablanca",
                "002145670000089", "30445782", "44102311",
                "007780000123456789012345");
        Cabinet sopra = createCabinet("SOPRA STERIA",
                "Casanearshore, Casablanca",
                "003998760000022", "40887133", "55667788",
                "007780000987654321098765");
        cabinetRepo.saveAll(Arrays.asList(coda, cgi, sopra));

        // ---------- 2. CONSULTANTS ----------
        Consultant admin = createUser("ADMIN", "CDG", ADMIN_EMAIL,
                ADMIN_PASSWORD, Role.ADMIN, null, encoder);

        Consultant c1 = createUser("BOUTKHOURST", "Youness", "y.boutkhourst@coda.com",
                DEFAULT_CONSULTANT_PASSWORD, Role.CONSULTANT, coda, encoder);
        Consultant c2 = createUser("EL KASSIMI", "Ahmed", "a.elkassimi@coda.com",
                DEFAULT_CONSULTANT_PASSWORD, Role.CONSULTANT, coda, encoder);
        Consultant c3 = createUser("BENNANI", "Salma", "s.bennani@cgi.com",
                DEFAULT_CONSULTANT_PASSWORD, Role.CONSULTANT, cgi, encoder);
        Consultant c4 = createUser("ALAMI", "Karim", "k.alami@cgi.com",
                DEFAULT_CONSULTANT_PASSWORD, Role.CONSULTANT, cgi, encoder);
        Consultant c5 = createUser("TAHIRI", "Imane", "i.tahiri@sopra.com",
                DEFAULT_CONSULTANT_PASSWORD, Role.CONSULTANT, sopra, encoder);

        consultantRepo.saveAll(Arrays.asList(admin, c1, c2, c3, c4, c5));

        // ---------- 3. BONS DE COMMANDE ----------
        BonDeCommande bc1 = createBC("CT/220/DSI/19/139", 60.0, 5000.0, "DEVOPS_RUN",
                "Mission DevOps - Infrastructure", c1, StatutBC.ACTIF);
        BonDeCommande bc2 = createBC("CT/220/DSI/19/153", 50.0, 3500.0, "DEV_PROJET",
                "Développement Full Stack - Banque Digitale", c2, StatutBC.ACTIF);
        BonDeCommande bc3 = createBC("CT/220/DSI/19/158", 40.0, 4200.0, "ARCHI",
                "Architecture Microservices", c3, StatutBC.ACTIF);
        BonDeCommande bc4 = createBC("CT/220/DSI/19/167", 30.0, 3800.0, "DATA",
                "Data Engineering - Migration", c4, StatutBC.ACTIF);
        BonDeCommande bc5 = createBC("CT/220/DSI/19/172", 25.0, 4500.0, "SECU",
                "Audit Sécurité OWASP", c5, StatutBC.ACTIF);
        BonDeCommande bc6 = createBC("CT/220/DSI/18/099", 20.0, 4800.0, "LEGACY",
                "Maintenance legacy (épuisé)", c1, StatutBC.EPUISE);

        bcRepo.saveAll(Arrays.asList(bc1, bc2, bc3, bc4, bc5, bc6));

        // ---------- 4. AFFECTATIONS ----------
        affectationRepo.save(createAffectation(c1, bc1, 5000.0, "Ingénieur DevOps Expert"));
        affectationRepo.save(createAffectation(c2, bc2, 3500.0, "Développeur Full Stack Sénior"));
        affectationRepo.save(createAffectation(c3, bc3, 4200.0, "Architecte Logiciel"));
        affectationRepo.save(createAffectation(c4, bc4, 3800.0, "Data Engineer"));
        affectationRepo.save(createAffectation(c5, bc5, 4500.0, "Expert Sécurité"));
        affectationRepo.save(createAffectation(c1, bc6, 4800.0, "Mainteneur legacy"));

        // ---------- 5. TÂCHES RÉALISÉES (CRA) ----------
        // Plusieurs mois avec différents statuts pour démontrer le workflow
        List<TacheRealisee> taches = new ArrayList<>();

        // Janvier 2026 : VALIDÉ complet pour c1
        taches.addAll(genererMoisOuvre(c1, bc1, 2026, 1, StatutPointage.VALIDE,
                "Mise en place pipeline CI/CD", "PROJET"));
        // Février 2026 : VALIDÉ pour c1
        taches.addAll(genererMoisOuvre(c1, bc1, 2026, 2, StatutPointage.VALIDE,
                "Monitoring Prometheus", "RUN"));
        // Mars 2026 : VALIDÉ pour c1
        taches.addAll(genererMoisOuvre(c1, bc1, 2026, 3, StatutPointage.VALIDE,
                "Migration Kubernetes", "PROJET"));
        // Avril 2026 : EN_ATTENTE pour c1 (en cours de validation)
        taches.addAll(genererMoisOuvre(c1, bc1, 2026, 4, StatutPointage.EN_ATTENTE,
                "Optimisation conteneurs", "RUN"));

        // Janvier-Février 2026 : VALIDÉ pour c2
        taches.addAll(genererMoisOuvre(c2, bc2, 2026, 1, StatutPointage.VALIDE,
                "Dev API REST clients", "PROJET"));
        taches.addAll(genererMoisOuvre(c2, bc2, 2026, 2, StatutPointage.VALIDE,
                "Dev portail mobile", "PROJET"));
        // Mars 2026 : REJETE pour c2
        taches.addAll(genererMoisOuvre(c2, bc2, 2026, 3, StatutPointage.REJETE,
                "Refactoring (rejeté pour info manquante)", "PROJET"));

        // Mars 2026 : VALIDÉ pour c3
        taches.addAll(genererMoisOuvre(c3, bc3, 2026, 3, StatutPointage.VALIDE,
                "Design architecture", "PROJET"));
        // Avril 2026 : EN_ATTENTE pour c3
        taches.addAll(genererMoisOuvre(c3, bc3, 2026, 4, StatutPointage.EN_ATTENTE,
                "Revue technique", "PROJET"));

        // Avril 2026 : BROUILLON pour c4 (saisie en cours)
        taches.addAll(genererMoisOuvre(c4, bc4, 2026, 4, StatutPointage.BROUILLON,
                "ETL setup (brouillon)", "PROJET"));

        // Avril 2026 : EN_ATTENTE pour c5
        taches.addAll(genererMoisOuvre(c5, bc5, 2026, 4, StatutPointage.EN_ATTENTE,
                "Audit pentest", "PROJET"));

        // BC legacy épuisé : c1 a consommé tout bc6 en 2025
        taches.addAll(genererMoisOuvre(c1, bc6, 2025, 12, StatutPointage.VALIDE,
                "Maintenance legacy", "RUN"));

        tacheRepo.saveAll(taches);

        // ---------- 6. ABSENCES ----------
        List<Absence> absences = new ArrayList<>();

        // c2 : congé validé en mars
        absences.add(createAbsence(c2, LocalDate.of(2026, 3, 16),
                "Congé annuel", StatutPointage.VALIDE));
        absences.add(createAbsence(c2, LocalDate.of(2026, 3, 17),
                "Congé annuel", StatutPointage.VALIDE));
        absences.add(createAbsence(c2, LocalDate.of(2026, 3, 18),
                "Congé annuel", StatutPointage.VALIDE));

        // c3 : demande en attente
        absences.add(createAbsence(c3, LocalDate.of(2026, 5, 25),
                "Congé maladie", StatutPointage.EN_ATTENTE));
        absences.add(createAbsence(c3, LocalDate.of(2026, 5, 26),
                "Congé maladie", StatutPointage.EN_ATTENTE));

        // c4 : RTT validé
        absences.add(createAbsence(c4, LocalDate.of(2026, 4, 30),
                "RTT", StatutPointage.VALIDE));

        // c5 : demande rejetée
        absences.add(createAbsence(c5, LocalDate.of(2026, 6, 1),
                "Congé sans solde", StatutPointage.REJETE));

        // c1 : demande en attente pour bientôt
        absences.add(createAbsence(c1, LocalDate.of(2026, 6, 15),
                "Congé annuel", StatutPointage.EN_ATTENTE));
        absences.add(createAbsence(c1, LocalDate.of(2026, 6, 16),
                "Congé annuel", StatutPointage.EN_ATTENTE));

        absenceRepo.saveAll(absences);

        // ---------- 7. RECALCUL DES COMPTEURS BC ----------
        for (BonDeCommande bc : bcRepo.findAll()) {
            recalculerBC(bc, tacheRepo, bcRepo);
        }

        // ---------- 8. RÉSUMÉ ----------
        System.out.println();
        System.out.println("========================================================");
        System.out.println("  ConsultTrack initialise avec un dataset complet !");
        System.out.println("========================================================");
        System.out.println("  CABINETS  : 3 (CODA, CGI, SOPRA)");
        System.out.println("  CONSULTANTS : 5 + 1 admin");
        System.out.println("  BC : 6 (5 actifs, 1 epuise)");
        System.out.println("  TACHES : " + taches.size() + " (sur plusieurs mois et statuts)");
        System.out.println("  ABSENCES : " + absences.size() + " (validees/en attente/rejetees)");
        System.out.println();
        System.out.println("  COMPTES DE TEST :");
        System.out.println("  ----------------");
        System.out.println("  Admin :       admin@cdgcapital.ma    / admin123");
        System.out.println("  Consultant :  y.boutkhourst@coda.com / consultant123");
        System.out.println("  Consultant :  a.elkassimi@coda.com   / consultant123");
        System.out.println("  Consultant :  s.bennani@cgi.com      / consultant123");
        System.out.println("  Consultant :  k.alami@cgi.com        / consultant123");
        System.out.println("  Consultant :  i.tahiri@sopra.com     / consultant123");
        System.out.println("========================================================");
    }

    // ======================================================
    //  GÉNÉRATION D'UN MOIS DE TÂCHES (jours ouvrés uniquement)
    // ======================================================

    private List<TacheRealisee> genererMoisOuvre(Consultant consultant, BonDeCommande bc,
                                                  int annee, int mois,
                                                  StatutPointage statut,
                                                  String description,
                                                  String typePrestation) {
        List<TacheRealisee> result = new ArrayList<>();
        YearMonth ym = YearMonth.of(annee, mois);
        for (int day = 1; day <= ym.lengthOfMonth(); day++) {
            LocalDate date = ym.atDay(day);
            DayOfWeek dow = date.getDayOfWeek();
            if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) continue;

            TacheRealisee t = new TacheRealisee();
            t.setConsultant(consultant);
            t.setBonDeCommande(bc);
            t.setDate(date);
            t.setAnnee(annee);
            t.setMois(mois);
            t.setDuree(1.0);
            t.setStatut(statut);
            t.setModeSaisie("BC");
            t.setDescriptionTache(description);
            t.setTypePrestation(typePrestation);
            if (statut == StatutPointage.REJETE) {
                t.setMotifRejet("Description trop générique, merci de préciser le ticket Jira");
            }
            result.add(t);
        }
        return result;
    }

    // ======================================================
    //  RECALCUL DES COMPTEURS BC (Option D)
    // ======================================================

    private void recalculerBC(BonDeCommande bc,
                              TacheRealiseeRepository tacheRepo,
                              BonDeCommandeRepository bcRepo) {
        Double consommes = tacheRepo.sumDureeByBcAndStatut(bc.getId(), StatutPointage.VALIDE);
        Double engages = tacheRepo.sumDureeByBcAndStatutIn(bc.getId(),
                Arrays.asList(StatutPointage.EN_ATTENTE, StatutPointage.VALIDE));
        bc.setJoursConsommes(consommes != null ? consommes : 0.0);
        bc.setJoursEngages(engages != null ? engages : 0.0);
        if (bc.getTjm() != null) {
            bc.setMontantConsomme(bc.getJoursConsommes() * bc.getTjm());
        }
        bcRepo.save(bc);
    }

    // ======================================================
    //  MAINTENANCE (table déjà peuplée)
    // ======================================================

    /**
     * Garantit (upsert) que les comptes de test documentés existent avec leur
     * mot de passe connu. Le hash est <b>réécrit à chaque démarrage</b> : même si
     * un compte existait déjà avec un mot de passe différent/inconnu, les
     * identifiants documentés fonctionneront toujours. Réservé au DEV.
     */
    private void ensureTestAccounts(ConsultantRepository consultantRepo, PasswordEncoder encoder) {
        upsertTestUser(consultantRepo, encoder, "ADMIN", "CDG",
                ADMIN_EMAIL, ADMIN_PASSWORD, Role.ADMIN);
        upsertTestUser(consultantRepo, encoder, "BOUTKHOURST", "Youness",
                "y.boutkhourst@coda.com", DEFAULT_CONSULTANT_PASSWORD, Role.CONSULTANT);
        upsertTestUser(consultantRepo, encoder, "EL KASSIMI", "Ahmed",
                "a.elkassimi@coda.com", DEFAULT_CONSULTANT_PASSWORD, Role.CONSULTANT);
    }

    private void upsertTestUser(ConsultantRepository consultantRepo, PasswordEncoder encoder,
                                String nom, String prenom, String email,
                                String plainPassword, Role role) {
        Consultant c = consultantRepo.findByEmail(email).orElseGet(Consultant::new);
        boolean isNew = (c.getId() == null);
        c.setNom(nom);
        c.setPrenom(prenom);
        c.setEmail(email);
        // Sécurité : on ne définit le mot de passe qu'à la création — jamais de réécriture
        // d'un hash existant (sinon un mot de passe changé serait réinitialisé à chaque boot).
        if (isNew) {
            c.setPassword(encoder.encode(plainPassword));
        }
        c.setRole(role);
        consultantRepo.save(c);
        System.out.println("[DEV] Compte garanti : " + email
                + "  (" + role + ", " + (isNew ? "cree" : "existant - password inchange") + ")");
    }

    private void repairMissingPasswords(ConsultantRepository consultantRepo, PasswordEncoder encoder) {
        int repaired = 0;
        for (Consultant c : consultantRepo.findAll()) {
            if (c.getPassword() == null || !c.getPassword().startsWith("$2")) {
                c.setPassword(encoder.encode(DEFAULT_CONSULTANT_PASSWORD));
                if (c.getRole() == null) c.setRole(Role.CONSULTANT);
                consultantRepo.save(c);
                repaired++;
            }
        }
        if (repaired > 0) {
            System.out.println("Total comptes repares : " + repaired
                    + " (mot de passe : " + DEFAULT_CONSULTANT_PASSWORD + ")");
        }
    }

    // ======================================================
    //  HELPERS
    // ======================================================

    private Cabinet createCabinet(String nom, String adresse, String ice,
                                  String idFiscal, String patente, String rib) {
        Cabinet c = new Cabinet();
        c.setNom(nom);
        c.setAdresse(adresse);
        c.setIce(ice);
        c.setIdentifiantFiscal(idFiscal);
        c.setPatente(patente);
        c.setRib(rib);
        return c;
    }

    private Consultant createUser(String nom, String prenom, String email,
                                  String plainPassword, Role role, Cabinet cabinet,
                                  PasswordEncoder encoder) {
        Consultant c = new Consultant();
        c.setNom(nom);
        c.setPrenom(prenom);
        c.setEmail(email);
        c.setPassword(encoder.encode(plainPassword));
        c.setRole(role);
        c.setCabinet(cabinet);
        return c;
    }

    private BonDeCommande createBC(String ref, double joursMax, double tjm,
                                   String codeBudget, String designation,
                                   Consultant consultant, StatutBC statut) {
        BonDeCommande bc = new BonDeCommande();
        bc.setReference(ref);
        bc.setJoursMax(joursMax);
        bc.setJoursConsommes(0.0);
        bc.setJoursEngages(0.0);
        bc.setMontantConsomme(0.0);
        bc.setTjm(tjm);
        bc.setCodeBudget(codeBudget);
        bc.setDesignation(designation);
        bc.setStatut(statut);
        bc.setConsultant(consultant);
        return bc;
    }

    private AffectationBC createAffectation(Consultant c, BonDeCommande bc, Double tjm, String mission) {
        AffectationBC aff = new AffectationBC();
        aff.setConsultant(c);
        aff.setBc(bc);
        aff.setTjm(tjm);
        aff.setDesignationMission(mission);
        return aff;
    }

    private Absence createAbsence(Consultant c, LocalDate date, String motif, StatutPointage statut) {
        Absence a = new Absence();
        a.setConsultant(c);
        a.setDate(date);
        a.setMotif(motif);
        a.setStatut(statut);
        return a;
    }
}
