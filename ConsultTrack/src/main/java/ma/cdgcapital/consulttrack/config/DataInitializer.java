package ma.cdgcapital.consulttrack.config;

import ma.cdgcapital.consulttrack.model.*;
import ma.cdgcapital.consulttrack.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDate;
import java.util.Arrays;
/*
@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner initDatabase(
            CabinetRepository cabinetRepo,
            ConsultantRepository consultantRepo,
            BonDeCommandeRepository bcRepo,
            AffectationRepository affectationRepo,
            RpiRepository rpiRepo,
            TacheRealiseeRepository tacheRepo) {
        return args -> {
            // 1. Création du Cabinet CODA SOLUTIONS
            Cabinet coda = new Cabinet();
            coda.setNom("CODA SOLUTIONS");
            coda.setAdresse("2 Bd Ibn Tachefine rue Zineb Ishak, Casablanca");
            coda.setIce("001866980000015");
            coda.setIdentifiantFiscal("20732236");
            coda.setPatente("31490971");
            coda.setRib("007780000340500000112630");
            cabinetRepo.save(coda);

            // 2. Création des Consultants
            Consultant yb = createConsultant("BOUTKHOURST", "Youness", "y.boutkhourst@coda.com", coda);
            Consultant ma = createConsultant("ADDOUMI", "Mohammed", "m.addoumi@coda.com", coda);
            Consultant ak = createConsultant("EL KASSIMI", "Ahmed", "a.elkassimi@coda.com", coda);
            Consultant yj = createConsultant("JAMOURE", "Youssef", "y.jamoure@coda.com", coda);
            consultantRepo.saveAll(Arrays.asList(yb, ma, ak, yj));

            // 3. Création des BC (Synchronisé avec votre modèle BonDeCommande)
            BonDeCommande bc139 = createBC("CT/220/DSI/19/139", 49.0, 49.0, StatutBC.EPUISE, 245000.0);
            BonDeCommande bc153 = createBC("CT/220/DSI/19/153", 41.0, 29.0, StatutBC.ACTIF, 101500.0);
            BonDeCommande bc158 = createBC("CT/220/DSI/19/158", 40.0, 28.0, StatutBC.ACTIF, 84000.0);
            bcRepo.saveAll(Arrays.asList(bc139, bc153, bc158));

            // 4. Affectations avec TJM (Pour le calcul des coûts)
            affectationRepo.save(createAff(yb, bc139, 5000.0, "Ingénieur DevOps Expert"));
            affectationRepo.save(createAff(ak, bc153, 3500.0, "Développeur Full Stack Expert"));
            affectationRepo.save(createAff(yj, bc158, 3000.0, "Développeur Back End Sénior"));

            // 5. Historique RPI (Pour le Dashboard)
            rpiRepo.save(createRpi(yb, bc139, 1, 2025, 16.0, 16.0, "Initialisation Architecture"));
            rpiRepo.save(createRpi(ak, bc153, 9, 2025, 10.0, 29.0, "Banque Digitale"));

            System.out.println("✅ ConsultTrack initialisé : Cabinets, Consultants, BC et TJM configurés.");
        };
    }

    private Consultant createConsultant(String nom, String prenom, String email, Cabinet c) {
        Consultant con = new Consultant();
        con.setNom(nom); con.setPrenom(prenom); con.setEmail(email); con.setCabinet(c);
        return con;
    }

    private BonDeCommande createBC(String ref, double max, double cons, StatutBC statut, double montant) {
        BonDeCommande bc = new BonDeCommande();
        // Utilisation des noms de méthodes générés par Lombok pour votre modèle
        bc.setReference(ref);
        bc.setJoursMax(max);
        bc.setJoursConsommes(cons);
        bc.setMontantConsomme(montant);
        bc.setStatut(statut);
        return bc;
    }

    private AffectationBC createAff(Consultant c, BonDeCommande bc, Double tjm, String mission) {
        AffectationBC aff = new AffectationBC();
        aff.setConsultant(c); aff.setBc(bc); aff.setTjm(tjm);
        aff.setDesignationMission(mission);
        return aff;
    }

    private RPI createRpi(Consultant c, BonDeCommande bc, int mois, int annee, double jh, double std, String com) {
        RPI rpi = new RPI();
        rpi.setConsultant(c); rpi.setBc(bc); rpi.setMois(mois); rpi.setAnnee(annee);
        rpi.setTotalJH(jh); rpi.setTotalCumuleSTD(std); rpi.setCommentaireActivite(com);
        rpi.setDateGeneration(LocalDate.now()); rpi.setStatut("VALIDE");
        return rpi;
    }
}*/