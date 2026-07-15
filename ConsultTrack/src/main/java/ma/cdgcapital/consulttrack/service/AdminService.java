package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.model.*;
import ma.cdgcapital.consulttrack.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class AdminService {

    @Autowired
    private CabinetRepository cabinetRepository;

    @Autowired
    private ConsultantRepository consultantRepository;

    @Autowired
    private BonDeCommandeRepository bcRepository;

    @Autowired
    private AffectationRepository affectationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // --- GESTION DES CABINETS (ESN) ---

    public List<Cabinet> listerTousLesCabinets() {
        return cabinetRepository.findAll();
    }

    public Cabinet sauvegarderCabinet(Cabinet cabinet) {
        return cabinetRepository.save(cabinet);
    }

    // --- GESTION DES CONSULTANTS ---

    public List<Consultant> listerTousLesConsultants() {
        return consultantRepository.findAll();
    }

    public Consultant sauvegarderConsultant(Consultant consultant) {
        if (consultant.getPassword() != null && !consultant.getPassword().isBlank()
                && !consultant.getPassword().startsWith("$2a$")
                && !consultant.getPassword().startsWith("$2b$")
                && !consultant.getPassword().startsWith("$2y$")) {
            consultant.setPassword(passwordEncoder.encode(consultant.getPassword()));
        }
        return consultantRepository.save(consultant);
    }

    // --- GESTION DES BONS DE COMMANDE (BC) ---

    public List<BonDeCommande> listerTousLesBCs() {
        return bcRepository.findAll();
    }

    public BonDeCommande sauvegarderBC(BonDeCommande bc) {
        if (bc.getJoursConsommes() == null) bc.setJoursConsommes(0.0);
        if (bc.getJoursEngages() == null) bc.setJoursEngages(0.0);
        if (bc.getMontantConsomme() == null) bc.setMontantConsomme(0.0);

        if (bc.getConsultantId() != null) {
            consultantRepository.findById(bc.getConsultantId()).ifPresent(bc::setConsultant);
        }

        return bcRepository.save(bc);
    }

    // --- GESTION DES AFFECTATIONS ---

    public AffectationBC creerAffectation(AffectationBC affectation) {
        return affectationRepository.save(affectation);
    }

    // --- CALCUL FINANCIER ---

    public Double calculerCoutPrestation(Long consultantId, Long bcId, Double totalJH) {
        Double tjm = affectationRepository.findTjmByConsultantAndBC(consultantId, bcId);
        if (tjm == null) {
            throw new RuntimeException("Aucun TJM défini pour cette affectation.");
        }
        return totalJH * tjm;
    }
}
