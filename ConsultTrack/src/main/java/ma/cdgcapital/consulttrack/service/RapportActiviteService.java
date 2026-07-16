package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.dto.RaBdcUtiliseDTO;
import ma.cdgcapital.consulttrack.dto.RapportActiviteDTO;
import ma.cdgcapital.consulttrack.dto.RapportActiviteRequest;
import ma.cdgcapital.consulttrack.exception.BusinessException;
import ma.cdgcapital.consulttrack.model.AffectationBC;
import ma.cdgcapital.consulttrack.model.Consultant;
import ma.cdgcapital.consulttrack.model.RapportActivite;
import ma.cdgcapital.consulttrack.model.StatutPointage;
import ma.cdgcapital.consulttrack.model.TacheRealisee;
import ma.cdgcapital.consulttrack.repository.AffectationRepository;
import ma.cdgcapital.consulttrack.repository.ConsultantRepository;
import ma.cdgcapital.consulttrack.repository.RapportActiviteRepository;
import ma.cdgcapital.consulttrack.repository.TacheRealiseeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class RapportActiviteService {

    private static final Locale FR = Locale.FRENCH;
    private static final int MAX_SUGGESTIONS = 20;

    @Autowired private RapportActiviteRepository rapportRepository;
    @Autowired private TacheRealiseeRepository tacheRepository;
    @Autowired private ConsultantRepository consultantRepository;
    @Autowired private AffectationRepository affectationRepository;

    // ==========================================================
    // Rapport d'Activité d'un consultant pour un mois donné
    // ==========================================================
    public RapportActiviteDTO getRapport(Long consultantId, int annee, int mois) {
        Consultant consultant = consultantRepository.findById(consultantId).orElse(null);

        Optional<RapportActivite> existant =
                rapportRepository.findByConsultantIdAndAnneeAndMois(consultantId, annee, mois);

        YearMonth ym = YearMonth.of(annee, mois);

        // Saisies de présence VALIDÉES sur BC pour l'ANNÉE (pour lister aussi
        // les BC consommés dans l'année mais à 0 jour sur le mois demandé)
        List<TacheRealisee> saisiesAnnee = tacheRepository.findByConsultantId(consultantId).stream()
                .filter(t -> t.getStatut() == StatutPointage.VALIDE)
                .filter(t -> "BC".equals(t.getModeSaisie()))
                .filter(t -> t.getBonDeCommande() != null)
                .filter(t -> t.getDate() != null && t.getDate().getYear() == annee)
                .filter(t -> t.getDuree() != null)
                .toList();

        // BDC utilisés : tout BC ayant une consommation validée dans l'année,
        // avec la somme du mois demandé (éventuellement 0.0)
        Map<String, Double> joursParBc = new LinkedHashMap<>();
        Map<String, ma.cdgcapital.consulttrack.model.BonDeCommande> bcParReference = new LinkedHashMap<>();
        double totalJH = 0.0;
        Set<String> suggestions = new LinkedHashSet<>();

        for (TacheRealisee t : saisiesAnnee) {
            String reference = t.getBonDeCommande().getReference();
            if (reference == null || reference.isBlank()) {
                reference = "BC #" + t.getBonDeCommande().getId();
            }
            bcParReference.putIfAbsent(reference, t.getBonDeCommande());
            boolean duMois = YearMonth.from(t.getDate()).equals(ym);
            joursParBc.merge(reference, duMois ? t.getDuree() : 0.0, Double::sum);

            if (duMois) {
                totalJH += t.getDuree();
                String description = t.getDescriptionTache();
                if (description != null && !description.isBlank() && suggestions.size() < MAX_SUGGESTIONS) {
                    suggestions.add(description.trim());
                }
            }
        }

        List<RaBdcUtiliseDTO> bdcUtilises = new ArrayList<>();
        for (Map.Entry<String, Double> entry : joursParBc.entrySet()) {
            RaBdcUtiliseDTO bdc = new RaBdcUtiliseDTO();
            bdc.setReference(entry.getKey());
            bdc.setJours(entry.getValue());
            ma.cdgcapital.consulttrack.model.BonDeCommande b = bcParReference.get(entry.getKey());
            if (b != null) {
                bdc.setDesignation(b.getDesignation());
                // Nature du BC ; à défaut, déduite de la désignation (run/maintenance/support → RUN)
                if (b.getNature() != null) {
                    bdc.setNature(b.getNature().name());
                } else {
                    String d = (b.getDesignation() != null ? b.getDesignation() : "").toLowerCase();
                    bdc.setNature(d.contains("run") || d.contains("maintenance") || d.contains("support")
                            ? "RUN" : "PROJET");
                }
            }
            bdcUtilises.add(bdc);
        }

        RapportActiviteDTO dto = new RapportActiviteDTO();
        dto.setConsultantId(consultantId);
        if (consultant != null) {
            dto.setConsultantNom(consultant.getNom() + " " + consultant.getPrenom());
            if (consultant.getCabinet() != null) {
                dto.setCabinetNom(consultant.getCabinet().getNom());
                dto.setLogoCabinet(consultant.getCabinet().getLogoImage());
            }
        }
        dto.setFonction(resolveFonction(consultantId));
        dto.setMois(mois);
        dto.setAnnee(annee);
        dto.setMoisLabel(capitalize(ym.getMonth().getDisplayName(TextStyle.FULL, FR)) + " " + annee);
        dto.setTotalJH(totalJH);
        dto.setBdcUtilises(bdcUtilises);
        dto.setTachesSuggerees(new ArrayList<>(suggestions));
        if (existant.isPresent()) {
            RapportActivite ra = existant.get();
            dto.setId(ra.getId());
            dto.setTachesRealisees(ra.getTachesRealisees());
            dto.setMotifRejet(ra.getMotifRejet());
            dto.setStatut(ra.getStatut() != null ? ra.getStatut().name() : "NOUVEAU");

            // « Validé » = double signature : consultant + responsable validateur
            if (ra.getStatut() == StatutPointage.VALIDE) {
                if (consultant != null) {
                    dto.setSignatureConsultant(consultant.getSignatureImage());
                }
                if (ra.getValidePar() != null) {
                    dto.setSignatureResponsable(ra.getValidePar().getSignatureImage());
                }
            }
        } else {
            dto.setStatut("NOUVEAU");
        }

        return dto;
    }

    // ==========================================================
    // Sauvegarde (upsert) d'un Rapport d'Activité
    // ==========================================================
    public RapportActiviteDTO saveRapport(RapportActiviteRequest req) {
        RapportActivite ra = rapportRepository
                .findByConsultantIdAndAnneeAndMois(req.getConsultantId(), req.getAnnee(), req.getMois())
                .orElseGet(RapportActivite::new);

        if (ra.getId() != null && ra.getStatut() == StatutPointage.VALIDE) {
            throw new BusinessException("Ce rapport d'activité est déjà validé et ne peut plus être modifié.");
        }

        if (ra.getId() == null) {
            Consultant consultant = consultantRepository.findById(req.getConsultantId())
                    .orElseThrow(() -> new BusinessException("Consultant introuvable : " + req.getConsultantId()));
            ra.setConsultant(consultant);
        }

        ra.setMois(req.getMois());
        ra.setAnnee(req.getAnnee());
        ra.setTachesRealisees(req.getTachesRealisees());
        ra.setStatut("SOUMIS".equalsIgnoreCase(req.getStatut())
                ? StatutPointage.EN_ATTENTE
                : StatutPointage.BROUILLON);
        ra.setMotifRejet(null);
        ra.setDateModification(LocalDate.now());

        rapportRepository.save(ra);

        return getRapport(req.getConsultantId(), req.getAnnee(), req.getMois());
    }

    // ==========================================================
    // Rapports en attente de validation
    // ==========================================================
    public List<RapportActiviteDTO> getPending() {
        return rapportRepository.findByStatut(StatutPointage.EN_ATTENTE).stream()
                .filter(ra -> ra.getConsultant() != null)
                .map(ra -> getRapport(ra.getConsultant().getId(), ra.getAnnee(), ra.getMois()))
                .toList();
    }

    // ==========================================================
    // Validation / Rejet
    // ==========================================================
    public void valider(Long id, String validatorEmail) {
        RapportActivite ra = rapportRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Rapport d'activité introuvable : " + id));
        ra.setStatut(StatutPointage.VALIDE);
        ra.setMotifRejet(null);
        ra.setValidePar(validatorEmail != null
                ? consultantRepository.findByEmail(validatorEmail).orElse(null)
                : null);
        rapportRepository.save(ra);
    }

    public void rejeter(Long id, String motif) {
        RapportActivite ra = rapportRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Rapport d'activité introuvable : " + id));
        ra.setStatut(StatutPointage.REJETE);
        ra.setMotifRejet(motif);
        rapportRepository.save(ra);
    }

    // ==========================================================
    // Helpers
    // ==========================================================
    private String resolveFonction(Long consultantId) {
        return affectationRepository.findByConsultantId(consultantId).stream()
                .map(AffectationBC::getDesignationMission)
                .filter(d -> d != null && !d.isBlank())
                .findFirst()
                .orElse(null);
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
