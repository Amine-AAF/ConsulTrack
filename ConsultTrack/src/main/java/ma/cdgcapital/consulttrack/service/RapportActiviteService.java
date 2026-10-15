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
import ma.cdgcapital.consulttrack.repository.BudgetAnnuelRepository;
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
    @Autowired private BudgetAnnuelRepository budgetRepository;
    @Autowired private ma.cdgcapital.consulttrack.security.AccessGuard accessGuard;

    // ==========================================================
    // Rapport d'Activité d'un consultant pour un mois donné
    // ==========================================================
    public RapportActiviteDTO getRapport(Long consultantId, int annee, int mois) {
        Consultant consultant = consultantRepository.findById(consultantId).orElse(null);

        Optional<RapportActivite> existant =
                rapportRepository.findByConsultantIdAndAnneeAndMois(consultantId, annee, mois);

        YearMonth ym = YearMonth.of(annee, mois);

        // Présences validées sur BC pour le mois demandé. Le détail du RA est
        // mensuel : ne pas afficher les BC consommés dans un autre mois à 0 JH.
        List<TacheRealisee> saisiesAnnee = tacheRepository.findByConsultantId(consultantId).stream()
                .filter(t -> t.getStatut() == StatutPointage.VALIDE)
                .filter(t -> "BC".equals(t.getModeSaisie()))
                .filter(t -> t.getBonDeCommande() != null)
                .filter(t -> t.getDate() != null && YearMonth.from(t.getDate()).equals(ym))
                .filter(t -> t.getDuree() != null)
                .toList();

        // Une entrée par ligne BC (id), même si plusieurs lignes partagent la référence.
        Map<Long, Double> joursParBc = new LinkedHashMap<>();
        Map<Long, ma.cdgcapital.consulttrack.model.BonDeCommande> bcParId = new LinkedHashMap<>();
        Map<Long, Set<String>> suggestionsParBc = new LinkedHashMap<>();
        double totalJH = 0.0;
        Set<String> suggestions = new LinkedHashSet<>();

        for (TacheRealisee t : saisiesAnnee) {
            var bc = t.getBonDeCommande();
            Long bcId = bc.getId();
            bcParId.putIfAbsent(bcId, bc);
            joursParBc.merge(bcId, t.getDuree(), Double::sum);
            totalJH += t.getDuree();
            String description = t.getDescriptionTache();
            if (description != null && !description.isBlank()) {
                String suggestion = description.trim();
                suggestionsParBc.computeIfAbsent(bcId, ignored -> new LinkedHashSet<>()).add(suggestion);
                if (suggestions.size() < MAX_SUGGESTIONS) suggestions.add(suggestion);
            }
        }

        List<RaBdcUtiliseDTO> bdcUtilises = new ArrayList<>();
        for (Map.Entry<Long, Double> entry : joursParBc.entrySet()) {
            RaBdcUtiliseDTO bdc = new RaBdcUtiliseDTO();
            bdc.setBcId(entry.getKey());
            ma.cdgcapital.consulttrack.model.BonDeCommande b = bcParId.get(entry.getKey());
            String reference = b == null ? null : b.getReference();
            bdc.setReference(reference == null || reference.isBlank() ? "BC #" + entry.getKey() : reference);
            bdc.setJours(entry.getValue());
            if (b != null) {
                bdc.setDesignation(b.getDesignation());
                bdc.setTachesSuggerees(new ArrayList<>(suggestionsParBc.getOrDefault(entry.getKey(), Set.of())));
                // Nature du BC ; à défaut, déduite de la désignation (run/maintenance/support → RUN)
                if (b.getNature() != null) {
                    bdc.setNature(b.getNature().name());
                } else {
                    ma.cdgcapital.consulttrack.model.BudgetAnnuel budget = b.getAnneeBudgetaire() == null
                            || b.getCodeBudget() == null ? null
                            : budgetRepository.findByAnneeAndCodeBudget(b.getAnneeBudgetaire(), b.getCodeBudget()).orElse(null);
                    String type = budget == null ? null : budget.getTypeBudget();
                    if ("OPEX".equalsIgnoreCase(type)) bdc.setNature("RUN");
                    else if ("CAPEX".equalsIgnoreCase(type)) bdc.setNature("PROJET");
                    else {
                        String d = (b.getDesignation() != null ? b.getDesignation() : "").toLowerCase();
                        bdc.setNature(d.contains("run") || d.contains("maintenance") || d.contains("support")
                                ? "RUN" : "PROJET");
                    }
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
    /** RESPONSABLE : uniquement les rapports des consultants de ses cabinets gérés. */
    public List<RapportActiviteDTO> getPending(Consultant viewer) {
        java.util.Set<Long> scope = accessGuard.cabinetScope(viewer);
        return rapportRepository.findByStatut(StatutPointage.EN_ATTENTE).stream()
                .filter(ra -> ra.getConsultant() != null)
                .filter(ra -> accessGuard.inScope(ra.getConsultant(), scope))
                .map(ra -> getRapport(ra.getConsultant().getId(), ra.getAnnee(), ra.getMois()))
                .toList();
    }

    // ==========================================================
    // Validation / Rejet
    // ==========================================================
    public void valider(Long id, String validatorEmail, Consultant viewer) {
        RapportActivite ra = rapportRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Rapport d'activité introuvable : " + id));
        accessGuard.assertConsultantDansPerimetre(viewer, ra.getConsultant());
        assertEnAttenteValidation(ra);
        ra.setStatut(StatutPointage.VALIDE);
        ra.setMotifRejet(null);
        ra.setValidePar(validatorEmail != null
                ? consultantRepository.findByEmail(validatorEmail).orElse(null)
                : null);
        rapportRepository.save(ra);
    }

    public void rejeter(Long id, String motif, Consultant viewer) {
        RapportActivite ra = rapportRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Rapport d'activité introuvable : " + id));
        accessGuard.assertConsultantDansPerimetre(viewer, ra.getConsultant());
        assertEnAttenteValidation(ra);
        ra.setStatut(StatutPointage.REJETE);
        ra.setMotifRejet(motif);
        rapportRepository.save(ra);
    }

    private void assertEnAttenteValidation(RapportActivite ra) {
        if (ra.getStatut() != StatutPointage.EN_ATTENTE) {
            throw new BusinessException("Seul un rapport soumis peut être validé ou rejeté.");
        }
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
