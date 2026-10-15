package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.dto.*;
import ma.cdgcapital.consulttrack.model.*;
import ma.cdgcapital.consulttrack.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.AccessDeniedException;

import java.text.Normalizer;
import java.util.HexFormat;
import java.security.MessageDigest;
import java.util.List;
import java.util.Locale;

@Service
public class BudgetManagementService {
    private final BudgetAnnuelRepository budgetRepository;
    private final DemandeApprovisionnementRepository demandeRepository;
    private final BonDeCommandeRepository bcRepository;
    private final ConsultantRepository consultantRepository;
    private final DirectionRepository directionRepository;

    public BudgetManagementService(BudgetAnnuelRepository budgetRepository,
                                   DemandeApprovisionnementRepository demandeRepository,
                                   BonDeCommandeRepository bcRepository,
                                   ConsultantRepository consultantRepository,
                                   DirectionRepository directionRepository) {
        this.budgetRepository = budgetRepository;
        this.demandeRepository = demandeRepository;
        this.bcRepository = bcRepository;
        this.consultantRepository = consultantRepository;
        this.directionRepository = directionRepository;
    }

    @Transactional(readOnly = true)
    public List<BudgetAnnuelDTO> getBudgets(Integer annee, Authentication auth) {
        Consultant viewer = current(auth);
        List<BudgetAnnuel> budgets = annee == null
                ? budgetRepository.findAll() : budgetRepository.findByAnneeOrderByCodeBudget(annee);
        return budgets.stream().filter(b -> canViewBudget(viewer, b)).map(b -> toDto(b, viewer)).toList();
    }

    @Transactional
    public BudgetAnnuelDTO saveBudget(Long id, BudgetAnnuelRequest request, Authentication auth) {
        Consultant viewer = auth == null ? null : current(auth);
        validateBudget(request);
        BudgetAnnuel budget;
        if (viewer != null && viewer.getRole() == Role.RESPONSABLE) {
            request.setScope("DIRECTION");
            if (viewer.getDirection() == null) throw badRequest("Aucune direction n'est affectée à votre compte.");
            request.setDirectionId(viewer.getDirection().getId());
        }
        if (id == null) {
            budget = budgetRepository.findAll().stream().filter(b -> sameIdentity(b, request, viewer))
                    .findFirst().orElseGet(BudgetAnnuel::new);
        } else {
            budget = budgetRepository.findById(id).orElseThrow(() -> notFound("Budget introuvable."));
        }
        if (viewer != null) assertCanEditBudget(viewer, budget, request);
        applyBudget(budget, request);
        return toDto(budgetRepository.save(budget), viewer);
    }

    @Transactional(readOnly = true)
    public List<DemandeApprovisionnementDTO> getDemandes(Long budgetId, Authentication auth) {
        Consultant viewer = current(auth);
        BudgetAnnuel budget = requireBudget(budgetId);
        assertCanViewBudget(viewer, budget);
        return demandeRepository.findByBudget_IdOrderByIdDesc(budgetId).stream()
                .filter(d -> owns(viewer, d)).map(this::toDto).toList();
    }

    @Transactional
    public DemandeApprovisionnementDTO saveDemande(Long id, DemandeApprovisionnementRequest request, Authentication auth) {
        Consultant viewer = current(auth);
        BudgetAnnuel budget = requireBudget(request.getBudgetId());
        assertCanViewBudget(viewer, budget);
        DemandeApprovisionnement demande = id == null ? new DemandeApprovisionnement()
                : demandeRepository.findById(id).orElseThrow(() -> notFound("DA introuvable."));
        if (id != null && !owns(viewer, demande)) throw new AccessDeniedException("DA hors de votre périmètre.");
        if (id != null && demande.getBonDeCommande() != null)
            throw badRequest("Cette DA a été transformée en BC et ne peut plus être modifiée.");
        Consultant consultant = request.getConsultantId() == null ? null : consultantRepository.findById(request.getConsultantId())
                .orElseThrow(() -> notFound("Consultant introuvable."));
        if (viewer.getRole() == Role.RESPONSABLE && consultant != null
                && (consultant.getManager() == null || !viewer.getId().equals(consultant.getManager().getId())))
            throw new AccessDeniedException("Consultant hors de votre périmètre.");
        demande.setManager(viewer.getRole() == Role.RESPONSABLE ? viewer : demande.getManager());
        applyDemande(demande, budget, request);
        return toDto(demandeRepository.save(demande));
    }

    @Transactional
    public int importWorkbook(BudgetImportRequest request) {
        if (request.getBudgets() == null || request.getBudgets().isEmpty()) {
            throw badRequest("Aucun budget à importer.");
        }
        for (BudgetAnnuelRequest row : request.getBudgets()) {
            validateBudget(row);
            BudgetAnnuel budget = budgetRepository
                    .findByAnneeAndCodeBudget(row.getAnnee(), clean(row.getCodeBudget()))
                    .orElseGet(BudgetAnnuel::new);
            applyBudget(budget, row);
            budgetRepository.save(budget);
        }
        int imported = 0;
        if (request.getDemandes() != null) {
            for (DemandeImportRequest row : request.getDemandes()) {
                if (row.getAnnee() == null || blank(row.getBudgetCode())) continue;
                BudgetAnnuel budget = budgetRepository
                        .findByAnneeAndCodeBudget(row.getAnnee(), clean(row.getBudgetCode()))
                        .orElseThrow(() -> badRequest("Budget absent pour la DA " + row.getReferenceExterne()
                                + " : " + row.getBudgetCode() + " / " + row.getAnnee()));
                String sourceKey = sourceKey(row, budget);
                DemandeApprovisionnement demande = demandeRepository.findBySourceKey(sourceKey)
                        .orElseGet(DemandeApprovisionnement::new);
                demande.setSourceKey(sourceKey);
                applyDemande(demande, budget, row);
                demandeRepository.save(demande);
                imported++;
            }
        }
        return imported;
    }

    @Transactional
    public DemandeApprovisionnementDTO createBc(Long demandeId, CreationBcRequest request, Authentication auth) {
        Consultant viewer = current(auth);
        DemandeApprovisionnement demande = demandeRepository.findById(demandeId)
                .orElseThrow(() -> notFound("DA introuvable."));
        if (demande.getBonDeCommande() != null) throw badRequest("Un BC est déjà associé à cette DA.");
        assertCanViewBudget(viewer, demande.getBudget());
        if (!owns(viewer, demande)) throw new AccessDeniedException("DA hors de votre périmètre.");
        if (blank(request.getReference())) throw badRequest("La référence du BC est obligatoire.");
        Long consultantId = request.getConsultantId() != null ? request.getConsultantId()
                : demande.getConsultant() == null ? null : demande.getConsultant().getId();
        if (consultantId == null) throw badRequest("Associez un consultant avant de créer son BC.");
        Consultant consultant = consultantRepository.findById(consultantId)
                .orElseThrow(() -> notFound("Consultant introuvable."));
        if (viewer.getRole() == Role.RESPONSABLE && (consultant.getManager() == null
                || !viewer.getId().equals(consultant.getManager().getId())))
            throw new AccessDeniedException("Consultant hors de votre périmètre.");

        BonDeCommande bc = new BonDeCommande();
        bc.setReference(clean(request.getReference()));
        bc.setCodeBudget(demande.getBudget().getCodeBudget());
        String typeBudget = demande.getBudget().getTypeBudget();
        if ("OPEX".equalsIgnoreCase(typeBudget)) bc.setNature(NatureActivite.RUN);
        else if ("CAPEX".equalsIgnoreCase(typeBudget)) bc.setNature(NatureActivite.PROJET);
        bc.setAnneeBudgetaire(demande.getBudget().getAnnee());
        bc.setDesignation(demande.getProjet());
        bc.setTjm(demande.getTjm());
        bc.setJoursMax(demande.getJours());
        bc.setJoursConsommes(0.0);
        bc.setJoursEngages(0.0);
        bc.setMontantConsomme(0.0);
        bc.setStatut(StatutBC.ACTIF);
        bc.setConsultant(consultant);
        BonDeCommande saved = bcRepository.save(bc);
        demande.setConsultant(consultant);
        demande.setNomConsultant(consultant.getPrenom() + " " + consultant.getNom());
        demande.setBonDeCommande(saved);
        return toDto(demandeRepository.save(demande));
    }

    private void applyBudget(BudgetAnnuel target, BudgetAnnuelRequest source) {
        target.setAnnee(source.getAnnee());
        if (source.getScope() != null) target.setScope(source.getScope().trim().toUpperCase(Locale.ROOT));
        if (source.getDirectionId() != null) target.setDirection(directionRepository.findById(source.getDirectionId())
                .orElseThrow(() -> notFound("Direction introuvable.")));
        else if ("POLE".equalsIgnoreCase(source.getScope())) target.setDirection(null);
        target.setCodeBudget(clean(source.getCodeBudget()));
        target.setTypeBudget(clean(source.getTypeBudget()));
        target.setDescription(clean(source.getDescription()));
        target.setBudgetTotal(source.getBudgetTotal());
        target.setReporteAnterieur(source.getReporteAnterieur());
        target.setEngageActif(source.getEngageActif());
        target.setRealise(source.getRealise());
        target.setDisponible(source.getDisponible());
        target.setConsomme(source.getConsomme());
        target.setReste2025(clean(source.getReste2025()));
        target.setSectionAnalytique(clean(source.getSectionAnalytique()));
        target.setNotes(clean(source.getNotes()));
    }

    private void applyDemande(DemandeApprovisionnement target, BudgetAnnuel budget,
                              DemandeApprovisionnementRequest source) {
        target.setBudget(budget);
        target.setReferenceExterne(clean(source.getReferenceExterne()));
        target.setResponsable(clean(source.getResponsable()));
        target.setNomConsultant(clean(source.getNomConsultant()));
        target.setProjet(clean(source.getProjet()));
        target.setTjm(source.getTjm());
        target.setJours(source.getJours());
        target.setMontant(source.getMontant() != null ? source.getMontant()
                : source.getTjm() != null && source.getJours() != null ? source.getTjm() * source.getJours() : null);
        target.setStatutExterne(blank(source.getStatutExterne()) ? "Validée en externe" : clean(source.getStatutExterne()));
        if (source.getConsultantId() != null) {
            Consultant consultant = consultantRepository.findById(source.getConsultantId())
                    .orElseThrow(() -> notFound("Consultant introuvable."));
            target.setConsultant(consultant);
            if (target.getManager() == null && consultant.getManager() != null) target.setManager(consultant.getManager());
        } else if (target.getConsultant() == null && !blank(source.getNomConsultant())) {
            String wanted = normalize(source.getNomConsultant());
            target.setConsultant(consultantRepository.findAll().stream().filter(c ->
                    normalize(c.getPrenom() + " " + c.getNom()).equals(wanted)
                            || normalize(c.getNom() + " " + c.getPrenom()).equals(wanted)).findFirst().orElse(null));
        }
        if (target.getManager() == null && target.getConsultant() != null && target.getConsultant().getManager() != null)
            target.setManager(target.getConsultant().getManager());
    }

    private BudgetAnnuelDTO toDto(BudgetAnnuel budget, Consultant viewer) {
        BudgetAnnuelDTO dto = new BudgetAnnuelDTO();
        dto.setId(budget.getId()); dto.setAnnee(budget.getAnnee()); dto.setCodeBudget(budget.getCodeBudget());
        dto.setTypeBudget(budget.getTypeBudget()); dto.setDescription(budget.getDescription());
        dto.setBudgetTotal(budget.getBudgetTotal()); dto.setReporteAnterieur(budget.getReporteAnterieur());
        dto.setEngageActif(budget.getEngageActif()); dto.setRealise(budget.getRealise());
        dto.setDisponible(budget.getDisponible()); dto.setSectionAnalytique(budget.getSectionAnalytique());
        dto.setConsomme(budget.getConsomme()); dto.setReste2025(budget.getReste2025());
        dto.setDateMiseAJour(budget.getDateMiseAJour());
        dto.setNotes(budget.getNotes());
        dto.setScope(budget.getScope() == null ? "POLE" : budget.getScope());
        dto.setDirectionId(budget.getDirection() == null ? null : budget.getDirection().getId());
        dto.setDirectionNom(budget.getDirection() == null ? null : budget.getDirection().getNom());
        dto.setCanEdit(viewer == null || viewer.getRole() == Role.ADMIN
                || (viewer.getRole() == Role.RESPONSABLE && "DIRECTION".equals(budget.getScope())
                && viewer.getDirection() != null && budget.getDirection() != null
                && viewer.getDirection().getId().equals(budget.getDirection().getId())));
        List<DemandeApprovisionnement> demandes = demandeRepository.findByBudget_IdOrderByIdDesc(budget.getId());
        if (viewer != null && viewer.getRole() == Role.RESPONSABLE) demandes = demandes.stream().filter(d -> owns(viewer, d)).toList();
        dto.setNombreDemandes(demandes.stream().filter(d -> d.getBonDeCommande() == null).count());
        dto.setNombreBC(demandes.stream().filter(d -> d.getBonDeCommande() != null).count());
        return dto;
    }

    private DemandeApprovisionnementDTO toDto(DemandeApprovisionnement demande) {
        DemandeApprovisionnementDTO dto = new DemandeApprovisionnementDTO();
        dto.setId(demande.getId()); dto.setBudgetId(demande.getBudget().getId());
        dto.setAnnee(demande.getBudget().getAnnee()); dto.setBudgetCode(demande.getBudget().getCodeBudget());
        dto.setReferenceExterne(demande.getReferenceExterne()); dto.setResponsable(demande.getResponsable());
        dto.setNomConsultant(demande.getNomConsultant()); dto.setConsultantId(
                demande.getConsultant() == null ? null : demande.getConsultant().getId());
        dto.setProjet(demande.getProjet()); dto.setTjm(demande.getTjm()); dto.setJours(demande.getJours());
        dto.setMontant(demande.getMontant()); dto.setStatutExterne(demande.getStatutExterne());
        if (demande.getBonDeCommande() != null) {
            dto.setBcId(demande.getBonDeCommande().getId()); dto.setBcReference(demande.getBonDeCommande().getReference());
        }
        return dto;
    }

    private BudgetAnnuel requireBudget(Long id) {
        if (id == null) throw badRequest("Le budget est obligatoire.");
        return budgetRepository.findById(id).orElseThrow(() -> notFound("Budget introuvable."));
    }
    private Consultant current(Authentication auth) {
        if (auth == null) throw new AccessDeniedException("Non authentifié.");
        return consultantRepository.findByEmail(auth.getName()).orElseThrow(() -> new AccessDeniedException("Utilisateur introuvable."));
    }
    private boolean canViewBudget(Consultant viewer, BudgetAnnuel b) {
        return viewer.getRole() == Role.ADMIN || b.getScope() == null || "POLE".equals(b.getScope())
                || (viewer.getDirection() != null && b.getDirection() != null
                && viewer.getDirection().getId().equals(b.getDirection().getId()));
    }
    private void assertCanViewBudget(Consultant viewer, BudgetAnnuel b) {
        if (!canViewBudget(viewer, b)) throw new AccessDeniedException("Budget hors de votre périmètre.");
    }
    private void assertCanEditBudget(Consultant viewer, BudgetAnnuel b, BudgetAnnuelRequest r) {
        String scope = r.getScope() == null ? b.getScope() : r.getScope().trim().toUpperCase(Locale.ROOT);
        if (viewer.getRole() == Role.ADMIN) return;
        if (!"DIRECTION".equals(scope) || (b.getId() != null && !"DIRECTION".equals(b.getScope()))
                || viewer.getDirection() == null
                || (r.getDirectionId() != null && !viewer.getDirection().getId().equals(r.getDirectionId()))
                || (b.getDirection() != null && !viewer.getDirection().getId().equals(b.getDirection().getId())))
            throw new AccessDeniedException("Vous pouvez modifier uniquement les budgets de votre direction.");
        r.setDirectionId(viewer.getDirection().getId());
        r.setScope("DIRECTION");
    }
    private boolean owns(Consultant viewer, DemandeApprovisionnement d) {
        return viewer.getRole() == Role.ADMIN || (d.getManager() != null && viewer.getId().equals(d.getManager().getId()));
    }
    private boolean sameIdentity(BudgetAnnuel b, BudgetAnnuelRequest r, Consultant viewer) {
        if (!java.util.Objects.equals(b.getAnnee(), r.getAnnee()) || !java.util.Objects.equals(b.getCodeBudget(), clean(r.getCodeBudget()))) return false;
        String scope = r.getScope() == null ? (viewer != null && viewer.getRole() == Role.RESPONSABLE ? "DIRECTION" : "POLE") : r.getScope();
        if (!scope.equalsIgnoreCase(b.getScope())) return false;
        Long dirId = r.getDirectionId() != null ? r.getDirectionId() : viewer != null && viewer.getRole() == Role.RESPONSABLE && viewer.getDirection()!=null ? viewer.getDirection().getId() : null;
        return java.util.Objects.equals(dirId, b.getDirection() == null ? null : b.getDirection().getId());
    }
    private static void validateBudget(BudgetAnnuelRequest r) {
        if (r.getAnnee() == null || r.getAnnee() < 2000 || r.getAnnee() > 2200) throw badRequest("Année budgétaire invalide.");
        if (blank(r.getCodeBudget())) throw badRequest("Le code budgétaire est obligatoire.");
    }
    private static String sourceKey(DemandeImportRequest r, BudgetAnnuel b) {
        String raw = String.join("|", String.valueOf(b.getAnnee()), b.getCodeBudget(), value(r.getReferenceExterne()),
                value(r.getNomConsultant()), value(r.getProjet()), value(r.getTjm()), value(r.getJours()),
                value(r.getRowNumber()));
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    private static String normalize(String s) {
        return Normalizer.normalize(s == null ? "" : s.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
    private static String value(Object o) { return o == null ? "" : String.valueOf(o).trim(); }
    private static String clean(String s) { return blank(s) ? null : s.trim(); }
    private static boolean blank(String s) { return s == null || s.isBlank(); }
    private static ResponseStatusException badRequest(String m) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, m); }
    private static ResponseStatusException notFound(String m) { return new ResponseStatusException(HttpStatus.NOT_FOUND, m); }
}
