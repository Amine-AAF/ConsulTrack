package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.dto.FacturationCabinetDTO;
import ma.cdgcapital.consulttrack.dto.FacturationConsultantDTO;
import ma.cdgcapital.consulttrack.dto.FacturationLigneDTO;
import ma.cdgcapital.consulttrack.model.BonDeCommande;
import ma.cdgcapital.consulttrack.model.BudgetAnnuel;
import ma.cdgcapital.consulttrack.model.Cabinet;
import ma.cdgcapital.consulttrack.model.Consultant;
import ma.cdgcapital.consulttrack.model.StatutPointage;
import ma.cdgcapital.consulttrack.model.RPI;
import ma.cdgcapital.consulttrack.model.TacheRealisee;
import ma.cdgcapital.consulttrack.repository.TacheRealiseeRepository;
import ma.cdgcapital.consulttrack.repository.BudgetAnnuelRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Pré-factures mensuelles pour réconciliation : agrège, par cabinet puis par
 * consultant puis par Bon de Commande, les saisies VALIDÉES (mode BC) du mois.
 * Montant = JH × TJM du BC (TJM manquant traité comme 0).
 *
 * Document de contrôle interne — ne remplace pas {@link FacturationService}.
 */
@Service
public class FacturationPrefactureService {

    @Autowired private TacheRealiseeRepository tacheRepository;
    @Autowired private BudgetAnnuelRepository budgetRepository;
    @Autowired private ma.cdgcapital.consulttrack.repository.RpiRepository rpiRepository;

    /**
     * @param cabinetsAutorises null = tous les cabinets (ADMIN) ;
     *                          sinon ids des cabinets gérés (RESPONSABLE).
     */
    public List<FacturationCabinetDTO> getFacturationMensuelle(int annee, int mois, Consultant viewer) {
        List<RPI> rpisValides = rpiRepository.findByAnneeAndMoisAndStatutIgnoreCase(annee, mois, "VALIDE").stream()
                .filter(r -> r.getConsultant() != null && r.getBc() != null)
                .filter(r -> r.getTotalJH() != null && r.getTotalJH() > 0)
                .filter(r -> visibleTo(r.getConsultant(), viewer))
                .toList();
        Set<String> bcsAvecRpiValide = rpisValides.stream()
                .map(r -> cleConsultantBc(r.getConsultant().getId(), r.getBc().getId()))
                .collect(java.util.stream.Collectors.toSet());

        List<TacheRealisee> taches = tacheRepository.findByStatut(StatutPointage.VALIDE).stream()
                .filter(t -> "BC".equalsIgnoreCase(t.getModeSaisie()))
                .filter(t -> t.getBonDeCommande() != null && t.getConsultant() != null)
                .filter(t -> t.getDate() != null && t.getDate().getYear() == annee && t.getDate().getMonthValue() == mois)
                .filter(t -> t.getDuree() != null && t.getDuree() > 0)
                .filter(t -> !bcsAvecRpiValide.contains(cleConsultantBc(t.getConsultant().getId(), t.getBonDeCommande().getId())))
                .toList();
        Map<Long, FacturationCabinetDTO> parCabinet = new LinkedHashMap<>();
        // cabinetId -> consultantId -> DTO consultant
        Map<Long, Map<Long, FacturationConsultantDTO>> consultantsParCabinet = new LinkedHashMap<>();
        // cabinetId -> consultantId -> bcId -> ligne
        Map<Long, Map<Long, Map<Long, FacturationLigneDTO>>> lignesParConsultant = new LinkedHashMap<>();

        for (TacheRealisee t : taches) {
            Consultant consultant = t.getConsultant();
            Cabinet cabinet = consultant.getCabinet();
            Long cabinetId = cabinet != null ? cabinet.getId() : null;

            // Le manager ne voit que les consultants explicitement rattachés à son compte.
            if (viewer != null && viewer.getRole() == ma.cdgcapital.consulttrack.model.Role.RESPONSABLE
                    && (consultant.getManager() == null || !viewer.getId().equals(consultant.getManager().getId()))) {
                continue;
            }
            if (viewer != null && viewer.getRole() == ma.cdgcapital.consulttrack.model.Role.CONSULTANT
                    && !viewer.getId().equals(consultant.getId())) continue;

            FacturationCabinetDTO cabDto = parCabinet.computeIfAbsent(cabinetId, id -> {
                FacturationCabinetDTO dto = new FacturationCabinetDTO();
                dto.setCabinetId(id);
                dto.setCabinetNom(cabinet != null ? cabinet.getNom() : "Sans cabinet");
                return dto;
            });

            FacturationConsultantDTO consDto = consultantsParCabinet
                    .computeIfAbsent(cabinetId, k -> new LinkedHashMap<>())
                    .computeIfAbsent(consultant.getId(), id -> {
                        FacturationConsultantDTO dto = new FacturationConsultantDTO();
                        dto.setConsultantId(id);
                        dto.setConsultantNom(nomComplet(consultant));
                        return dto;
                    });

            BonDeCommande bc = t.getBonDeCommande();
            FacturationLigneDTO ligne = lignesParConsultant
                    .computeIfAbsent(cabinetId, k -> new LinkedHashMap<>())
                    .computeIfAbsent(consultant.getId(), k -> new LinkedHashMap<>())
                    .computeIfAbsent(bc.getId(), id -> {
                        FacturationLigneDTO l = new FacturationLigneDTO();
                        l.setBcReference(bc.getReference() != null && !bc.getReference().isBlank()
                                ? bc.getReference() : "BC #" + bc.getId());
                        l.setCodeBudget(bc.getCodeBudget());
                        l.setNature(natureDe(bc));
                        l.setJh(0.0);
                        l.setTjm(bc.getTjm() != null ? bc.getTjm() : 0.0);
                        l.setMontant(0.0);
                        consDto.getLignes().add(l);
                        return l;
                    });

            double jh = t.getDuree();
            double montant = jh * ligne.getTjm();
            ligne.setJh(ligne.getJh() + jh);
            ligne.setMontant(ligne.getMontant() + montant);
            consDto.setTotalJH(consDto.getTotalJH() + jh);
            consDto.setTotalMontant(consDto.getTotalMontant() + montant);
            cabDto.setTotalJH(cabDto.getTotalJH() + jh);
            cabDto.setTotalMontant(cabDto.getTotalMontant() + montant);
        }

        // Les RPI importés remplacent les pointages détaillés du même consultant et du même BC.
        for (RPI rpi : rpisValides) {
            Consultant consultant = rpi.getConsultant();
            BonDeCommande bc = rpi.getBc();
            Cabinet cabinet = consultant.getCabinet();
            Long cabinetId = cabinet != null ? cabinet.getId() : null;

            FacturationCabinetDTO cabDto = parCabinet.computeIfAbsent(cabinetId, id -> {
                FacturationCabinetDTO dto = new FacturationCabinetDTO();
                dto.setCabinetId(id);
                dto.setCabinetNom(cabinet != null ? cabinet.getNom() : "Sans cabinet");
                return dto;
            });
            FacturationConsultantDTO consDto = consultantsParCabinet
                    .computeIfAbsent(cabinetId, k -> new LinkedHashMap<>())
                    .computeIfAbsent(consultant.getId(), id -> {
                        FacturationConsultantDTO dto = new FacturationConsultantDTO();
                        dto.setConsultantId(id);
                        dto.setConsultantNom(nomComplet(consultant));
                        return dto;
                    });
            FacturationLigneDTO ligne = lignesParConsultant
                    .computeIfAbsent(cabinetId, k -> new LinkedHashMap<>())
                    .computeIfAbsent(consultant.getId(), k -> new LinkedHashMap<>())
                    .computeIfAbsent(bc.getId(), id -> {
                        FacturationLigneDTO l = new FacturationLigneDTO();
                        l.setBcReference(bc.getReference() != null && !bc.getReference().isBlank() ? bc.getReference() : "BC #" + bc.getId());
                        l.setCodeBudget(bc.getCodeBudget());
                        l.setNature(natureDe(bc));
                        l.setJh(0.0);
                        l.setTjm(bc.getTjm() != null ? bc.getTjm() : 0.0);
                        l.setMontant(0.0);
                        consDto.getLignes().add(l);
                        return l;
                    });
            double jh = rpi.getTotalJH();
            double montant = jh * ligne.getTjm();
            ligne.setJh(ligne.getJh() + jh);
            ligne.setMontant(ligne.getMontant() + montant);
            consDto.setTotalJH(consDto.getTotalJH() + jh);
            consDto.setTotalMontant(consDto.getTotalMontant() + montant);
            cabDto.setTotalJH(cabDto.getTotalJH() + jh);
            cabDto.setTotalMontant(cabDto.getTotalMontant() + montant);
        }
        // Assemblage + tris stables (cabinet, consultant, référence BC)
        List<FacturationCabinetDTO> resultat = new ArrayList<>(parCabinet.values());
        for (FacturationCabinetDTO cabDto : resultat) {
            List<FacturationConsultantDTO> consultants = new ArrayList<>(
                    consultantsParCabinet.get(cabDto.getCabinetId()).values());
            consultants.sort(Comparator.comparing(FacturationConsultantDTO::getConsultantNom,
                    Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
            for (FacturationConsultantDTO c : consultants) {
                c.getLignes().sort(Comparator.comparing(FacturationLigneDTO::getBcReference,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
            }
            cabDto.setConsultants(consultants);
        }
        resultat.sort(Comparator.comparing(FacturationCabinetDTO::getCabinetNom,
                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
        return resultat;
    }

    private static String cleConsultantBc(Long consultantId, Long bcId) {
        return consultantId + ":" + bcId;
    }

    private static boolean visibleTo(Consultant consultant, Consultant viewer) {
        if (viewer == null || viewer.getRole() == ma.cdgcapital.consulttrack.model.Role.ADMIN) return true;
        if (viewer.getRole() == ma.cdgcapital.consulttrack.model.Role.RESPONSABLE) {
            return consultant.getManager() != null && viewer.getId().equals(consultant.getManager().getId());
        }
        return viewer.getId().equals(consultant.getId());
    }
    private static String nomComplet(Consultant c) {
        String nom = c.getNom() != null ? c.getNom() : "";
        String prenom = c.getPrenom() != null ? c.getPrenom() : "";
        return (nom + " " + prenom).trim();
    }

    /** Nature RA du BC ; au besoin, résolue depuis le type OPEX/CAPEX du budget associé. */
    private String natureDe(BonDeCommande bc) {
        if (bc.getNature() != null) return bc.getNature().name();
        BudgetAnnuel budget = bc.getAnneeBudgetaire() == null || bc.getCodeBudget() == null ? null
                : budgetRepository.findByAnneeAndCodeBudget(bc.getAnneeBudgetaire(), bc.getCodeBudget()).orElse(null);
        if (budget != null && "OPEX".equalsIgnoreCase(budget.getTypeBudget())) return "RUN";
        if (budget != null && "CAPEX".equalsIgnoreCase(budget.getTypeBudget())) return "PROJET";
        return null;
    }
}
