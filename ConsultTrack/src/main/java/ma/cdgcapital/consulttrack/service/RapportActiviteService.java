package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.dto.RaGroupeDTO;
import ma.cdgcapital.consulttrack.dto.RaLigneDTO;
import ma.cdgcapital.consulttrack.dto.RapportActiviteDTO;
import ma.cdgcapital.consulttrack.dto.RapportActiviteRequest;
import ma.cdgcapital.consulttrack.exception.BusinessException;
import ma.cdgcapital.consulttrack.model.BonDeCommande;
import ma.cdgcapital.consulttrack.model.Consultant;
import ma.cdgcapital.consulttrack.model.RapportActivite;
import ma.cdgcapital.consulttrack.model.StatutPointage;
import ma.cdgcapital.consulttrack.model.TacheRealisee;
import ma.cdgcapital.consulttrack.repository.BonDeCommandeRepository;
import ma.cdgcapital.consulttrack.repository.ConsultantRepository;
import ma.cdgcapital.consulttrack.repository.RapportActiviteRepository;
import ma.cdgcapital.consulttrack.repository.TacheRealiseeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
public class RapportActiviteService {

    private static final Locale FR = Locale.FRENCH;

    @Autowired private RapportActiviteRepository rapportRepository;
    @Autowired private TacheRealiseeRepository tacheRepository;
    @Autowired private ConsultantRepository consultantRepository;
    @Autowired private BonDeCommandeRepository bcRepository;

    // ==========================================================
    // Génération du Rapport d'Activité d'un mois pour un BC donné
    // ==========================================================
    public RapportActiviteDTO getRapport(Long consultantId, Long bcId, int annee, int mois) {
        Consultant consultant = consultantRepository.findById(consultantId).orElse(null);
        BonDeCommande bc = bcRepository.findById(bcId).orElse(null);

        Optional<RapportActivite> existant =
                rapportRepository.findByConsultantIdAndBcIdAndAnneeAndMois(consultantId, bcId, annee, mois);

        YearMonth ym = YearMonth.of(annee, mois);

        // Tâches VALIDÉES du consultant sur ce BC pour le mois demandé
        List<TacheRealisee> taches = tacheRepository.findByConsultantId(consultantId).stream()
                .filter(t -> t.getStatut() == StatutPointage.VALIDE)
                .filter(t -> t.getBonDeCommande() != null
                        && t.getBonDeCommande().getId() != null
                        && t.getBonDeCommande().getId().equals(bcId))
                .filter(t -> t.getDate() != null && YearMonth.from(t.getDate()).equals(ym))
                .filter(t -> t.getDuree() != null)
                .toList();

        // Groupement par typePrestation puis agrégation des lignes par descriptionTache
        Map<String, Map<String, RaLigneDTO>> parNature = new LinkedHashMap<>();
        Map<String, Double> totauxNature = new LinkedHashMap<>();
        double totalJH = 0.0;

        for (TacheRealisee t : taches) {
            String nature = t.getTypePrestation();
            if (nature == null || nature.isBlank()) {
                nature = "AUTRE";
            }
            String description = t.getDescriptionTache();
            if (description == null || description.isBlank()) {
                description = "Activité";
            }
            double jh = t.getDuree();

            Map<String, RaLigneDTO> lignesNature =
                    parNature.computeIfAbsent(nature, k -> new LinkedHashMap<>());
            RaLigneDTO ligne = lignesNature.get(description);
            if (ligne == null) {
                ligne = new RaLigneDTO();
                ligne.setDescription(description);
                ligne.setTypePrestation(nature);
                ligne.setTicketJira(null);
                ligne.setJh(0.0);
                lignesNature.put(description, ligne);
            }
            ligne.setJh(ligne.getJh() + jh);
            if ((ligne.getTicketJira() == null || ligne.getTicketJira().isBlank())
                    && t.getTicketJira() != null && !t.getTicketJira().isBlank()) {
                ligne.setTicketJira(t.getTicketJira());
            }

            totauxNature.merge(nature, jh, Double::sum);
            totalJH += jh;
        }

        List<RaGroupeDTO> groupes = new ArrayList<>();
        for (Map.Entry<String, Map<String, RaLigneDTO>> entry : parNature.entrySet()) {
            RaGroupeDTO groupe = new RaGroupeDTO();
            groupe.setNature(entry.getKey());
            groupe.setTotalJH(totauxNature.getOrDefault(entry.getKey(), 0.0));
            List<RaLigneDTO> lignes = new ArrayList<>(entry.getValue().values());
            lignes.sort(Comparator.comparingDouble((RaLigneDTO l) -> l.getJh() != null ? l.getJh() : 0.0).reversed());
            groupe.setLignes(lignes);
            groupes.add(groupe);
        }

        RapportActiviteDTO dto = new RapportActiviteDTO();
        dto.setConsultantId(consultantId);
        if (consultant != null) {
            dto.setConsultantNom(consultant.getNom() + " " + consultant.getPrenom());
        }
        dto.setBcId(bcId);
        if (bc != null) {
            dto.setReferenceBC(bc.getReference());
            dto.setDesignationBC(bc.getDesignation());
        }
        dto.setMois(mois);
        dto.setAnnee(annee);
        dto.setMoisLabel(capitalize(ym.getMonth().getDisplayName(TextStyle.FULL, FR)) + " " + annee);
        dto.setTotalJH(totalJH);
        dto.setGroupes(groupes);

        if (existant.isPresent()) {
            RapportActivite ra = existant.get();
            dto.setId(ra.getId());
            dto.setSyntheseMois(ra.getSyntheseMois());
            dto.setFaitsMarquants(ra.getFaitsMarquants());
            dto.setPerspectives(ra.getPerspectives());
            dto.setMotifRejet(ra.getMotifRejet());
            dto.setStatut(ra.getStatut() != null ? ra.getStatut().name() : "NOUVEAU");
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
                .findByConsultantIdAndBcIdAndAnneeAndMois(req.getConsultantId(), req.getBcId(),
                        req.getAnnee(), req.getMois())
                .orElseGet(RapportActivite::new);

        if (ra.getId() == null) {
            Consultant consultant = consultantRepository.findById(req.getConsultantId())
                    .orElseThrow(() -> new BusinessException("Consultant introuvable : " + req.getConsultantId()));
            BonDeCommande bc = bcRepository.findById(req.getBcId())
                    .orElseThrow(() -> new BusinessException("Bon de commande introuvable : " + req.getBcId()));
            ra.setConsultant(consultant);
            ra.setBc(bc);
        }

        ra.setMois(req.getMois());
        ra.setAnnee(req.getAnnee());
        ra.setSyntheseMois(req.getSyntheseMois());
        ra.setFaitsMarquants(req.getFaitsMarquants());
        ra.setPerspectives(req.getPerspectives());
        ra.setStatut("SOUMIS".equalsIgnoreCase(req.getStatut())
                ? StatutPointage.EN_ATTENTE
                : StatutPointage.BROUILLON);
        ra.setMotifRejet(null);
        ra.setDateModification(LocalDate.now());

        rapportRepository.save(ra);

        return getRapport(req.getConsultantId(), req.getBcId(), req.getAnnee(), req.getMois());
    }

    // ==========================================================
    // Rapports en attente de validation
    // ==========================================================
    public List<RapportActiviteDTO> getPending() {
        return rapportRepository.findByStatut(StatutPointage.EN_ATTENTE).stream()
                .map(ra -> getRapport(
                        ra.getConsultant() != null ? ra.getConsultant().getId() : null,
                        ra.getBc() != null ? ra.getBc().getId() : null,
                        ra.getAnnee(),
                        ra.getMois()))
                .toList();
    }

    // ==========================================================
    // Validation / Rejet
    // ==========================================================
    public void valider(Long id) {
        RapportActivite ra = rapportRepository.findById(id)
                .orElseThrow(() -> new BusinessException("Rapport d'activité introuvable : " + id));
        ra.setStatut(StatutPointage.VALIDE);
        ra.setMotifRejet(null);
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
    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
