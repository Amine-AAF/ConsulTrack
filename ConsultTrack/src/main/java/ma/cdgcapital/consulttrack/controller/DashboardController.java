package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.dto.*;
import ma.cdgcapital.consulttrack.model.*;
import ma.cdgcapital.consulttrack.security.AccessGuard;
import ma.cdgcapital.consulttrack.service.DashboardService;
import ma.cdgcapital.consulttrack.service.mapper.EntityMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private AccessGuard accessGuard;

    // ==========================================
    // 1. DASHBOARD & TIMESHEET (Lecture)
    // ==========================================

    @GetMapping("/dashboard/report")
    public ResponseEntity<List<ConsultantDashboardDTO>> getReport(
            @RequestParam(required = false) Long cabinetId,
            @RequestParam int annee,
            Authentication auth) {
        // RESPONSABLE : lignes limitées aux consultants de ses cabinets gérés
        return ResponseEntity.ok(dashboardService.getGlobalReport(
                cabinetId, annee, accessGuard.currentUser(auth)));
    }

    @GetMapping("/dashboard/timesheet/{consultantId}")
    public ResponseEntity<List<TacheRealiseeDTO>> getTimesheet(
            @PathVariable Long consultantId,
            @RequestParam int annee,
            @RequestParam int mois) {
        return ResponseEntity.ok(dashboardService.getPointagesMensuels(consultantId, annee, mois)
                .stream().map(EntityMapper::toDto).toList());
    }

    // ==========================================
    // 2. SAISIE DES TEMPS (Écriture)
    // ==========================================

    @PostMapping("/dashboard/timesheet/bulk")
    public ResponseEntity<String> saveBulkTimesheet(@RequestBody List<PointageRequest> requests,
                                                    Authentication auth) {
        if (requests.isEmpty()) return ResponseEntity.badRequest().body("Liste vide");

        Long consultantId = requests.get(0).getConsultantId();
        // Anti-IDOR : un consultant ne saisit que pour lui-même (ADMIN/RESPONSABLE délégués)
        accessGuard.assertOwnership(auth, consultantId);
        LocalDate firstDate = LocalDate.parse(requests.get(0).getDate());
        int annee = firstDate.getYear();
        int mois = firstDate.getMonthValue();

        dashboardService.sauvegarderPointagesMensuels(consultantId, annee, mois, requests);
        return ResponseEntity.ok("Pointages enregistrés avec succès");
    }

    // ==========================================
    // 3. GESTION ADMINISTRATIVE (CRUD)
    // ==========================================

    // --- CABINETS ---
    @GetMapping("/admin/cabinets")
    public ResponseEntity<List<CabinetDTO>> getAllCabinets(Authentication auth) {
        // RESPONSABLE : uniquement ses cabinets gérés
        return ResponseEntity.ok(dashboardService.getAllCabinets(accessGuard.currentUser(auth))
                .stream().map(EntityMapper::toDto).toList());
    }

    @PostMapping("/admin/cabinets")
    public ResponseEntity<CabinetDTO> createCabinet(@RequestBody Cabinet cabinet) {
        return ResponseEntity.ok(EntityMapper.toDto(dashboardService.saveCabinet(cabinet)));
    }

    @PutMapping("/admin/cabinets/{id}")
    public ResponseEntity<CabinetDTO> updateCabinet(@PathVariable Long id, @RequestBody Cabinet cabinet) {
        return ResponseEntity.ok(EntityMapper.toDto(dashboardService.updateCabinet(id, cabinet)));
    }

    @DeleteMapping("/admin/cabinets/{id}")
    public ResponseEntity<Void> deleteCabinet(@PathVariable Long id) {
        dashboardService.deleteCabinet(id);
        return ResponseEntity.ok().build();
    }

    /** Logo du cabinet (data-URL base64) — imprimé sur les RPI / RA. */
    @GetMapping("/admin/cabinets/{id}/logo")
    public ResponseEntity<Map<String, String>> getCabinetLogo(@PathVariable Long id) {
        return ResponseEntity.ok(
                java.util.Collections.singletonMap("logoImage", dashboardService.getCabinetLogo(id)));
    }

    @PutMapping("/admin/cabinets/{id}/logo")
    public ResponseEntity<Void> updateCabinetLogo(@PathVariable Long id,
                                                  @RequestBody Map<String, String> body) {
        dashboardService.updateCabinetLogo(id, body.get("logoImage"));
        return ResponseEntity.ok().build();
    }

    @PutMapping("/admin/consultants/{id}")
    public ResponseEntity<ConsultantDTO> updateConsultant(@PathVariable Long id,
                                                          @RequestBody Consultant consultant,
                                                          Authentication auth) {
        // RESPONSABLE : cible CONSULTANT de son périmètre, rôle/cabinet verrouillés
        return ResponseEntity.ok(EntityMapper.toDto(
                dashboardService.updateConsultant(id, consultant, accessGuard.currentUser(auth))));
    }

    @DeleteMapping("/admin/consultants/{id}")
    public ResponseEntity<Void> deleteConsultant(@PathVariable Long id, Authentication auth) {
        // RESPONSABLE : cible CONSULTANT de son périmètre uniquement
        dashboardService.deleteConsultant(id, accessGuard.currentUser(auth));
        return ResponseEntity.ok().build();
    }

    // --- CONSULTANTS ---
    @GetMapping("/admin/consultants")
    public ResponseEntity<List<ConsultantDTO>> getAllConsultants(Authentication auth) {
        // RESPONSABLE : consultants de ses cabinets gérés (+ lui-même)
        return ResponseEntity.ok(dashboardService.getAllConsultants(accessGuard.currentUser(auth))
                .stream().map(EntityMapper::toDto).toList());
    }

    @PostMapping("/admin/consultants")
    public ResponseEntity<ConsultantDTO> createConsultant(@RequestBody Consultant consultant,
                                                          Authentication auth) {
        // RESPONSABLE : rôle forcé CONSULTANT, cabinet dans son périmètre
        return ResponseEntity.ok(EntityMapper.toDto(
                dashboardService.saveConsultant(consultant, accessGuard.currentUser(auth))));
    }

    // --- BONS DE COMMANDE (BC) ---
    @GetMapping("/admin/bcs")
    public ResponseEntity<List<BonDeCommandeDTO>> getAllBCs(Authentication auth) {
        // RESPONSABLE : uniquement les BC des consultants de son périmètre
        return ResponseEntity.ok(dashboardService.getAllBCs(accessGuard.currentUser(auth))
                .stream().map(EntityMapper::toDto).toList());
    }

    @PostMapping("/admin/bcs")
    public ResponseEntity<BonDeCommandeDTO> createBC(@RequestBody BonDeCommande bc) {
        return ResponseEntity.ok(EntityMapper.toDto(dashboardService.saveBC(bc)));
    }

    // --- VALIDATION DES SAISIES (Admin) ---
    @GetMapping("/admin/saisies/en-attente")
    public ResponseEntity<List<TacheRealiseeDTO>> getPendingSaisies() {
        return ResponseEntity.ok(dashboardService.getPendingSaisies()
                .stream().map(EntityMapper::toDto).toList());
    }

    @PutMapping("/admin/saisies/{id}/valider")
    public ResponseEntity<Void> validerSaisie(@PathVariable Long id) {
        dashboardService.validerSaisie(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/admin/saisies/{id}/rejeter")
    public ResponseEntity<Void> rejeterSaisie(@PathVariable Long id, @RequestParam String motif) {
        dashboardService.rejeterSaisie(id, motif);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/admin/saisies/valider-mois")
    public ResponseEntity<Map<String, Object>> validerMois(
            @RequestParam Long consultantId,
            @RequestParam int annee,
            @RequestParam int mois) {
        int n = dashboardService.validerMois(consultantId, annee, mois);
        return ResponseEntity.ok(Map.of(
                "validated", n,
                "consultantId", consultantId,
                "annee", annee,
                "mois", mois));
    }

    // ==========================================
    // 4. GESTION DES ABSENCES (CONGÉS)
    // ==========================================

    @GetMapping("/dashboard/absences/{consultantId}")
    public ResponseEntity<List<AbsenceDTO>> getAbsences(
            @PathVariable Long consultantId,
            @RequestParam int annee,
            @RequestParam int mois) {
        return ResponseEntity.ok(dashboardService.getAbsencesMensuelles(consultantId, annee, mois)
                .stream().map(EntityMapper::toDto).toList());
    }

    /**
     * Demande d'absence : un jour (compat champ {@code date}) ou une plage
     * {@code dateDebut..dateFin} → N lignes liées par un demandeId commun.
     */
    @PostMapping("/dashboard/absences/demande")
    public ResponseEntity<List<AbsenceDTO>> soumettreDemande(@RequestBody AbsenceDemandeRequest req,
                                                             Authentication auth) {
        accessGuard.assertOwnership(auth, req.getConsultantId());
        LocalDate debut = req.getDateDebut() != null ? req.getDateDebut() : req.getDate();
        LocalDate fin = req.getDateFin() != null ? req.getDateFin() : debut;
        return ResponseEntity.ok(
                dashboardService.demanderAbsence(req.getConsultantId(), debut, fin, req.getMotif())
                        .stream().map(EntityMapper::toDto).toList());
    }

    /** Validation/rejet groupé d'une demande d'absence multi-jours. */
    @PutMapping("/admin/absences/demande/{demandeId}/status")
    public ResponseEntity<Map<String, Object>> updateDemandeStatus(
            @PathVariable String demandeId,
            @RequestBody AbsenceStatusRequest req) {
        StatutPointage statut = StatutPointage.valueOf(req.getStatut());
        int n = dashboardService.updateAbsenceStatusByDemande(demandeId, statut);
        return ResponseEntity.ok(Map.of("updated", n, "demandeId", demandeId));
    }

    @GetMapping("/admin/absences/pending")
    public ResponseEntity<List<AbsenceDTO>> getPendingAbsences() {
        return ResponseEntity.ok(dashboardService.getPendingAbsences()
                .stream().map(EntityMapper::toDto).toList());
    }

    @PutMapping("/admin/absences/{id}/status")
    public ResponseEntity<Void> updateAbsenceStatus(
            @PathVariable Long id,
            @RequestBody AbsenceStatusRequest req) {
        StatutPointage statut = StatutPointage.valueOf(req.getStatut());
        dashboardService.updateAbsenceStatus(id, statut);
        return ResponseEntity.ok().build();
    }

    // --- SECTION HISTORIQUE & ACTIVITÉS ---

    @GetMapping("/admin/activities/search")
    public ResponseEntity<List<TacheRealiseeDTO>> searchActivities(
            @RequestParam int annee,
            @RequestParam(required = false) Integer mois,
            @RequestParam(required = false) Long consultantId) {
        return ResponseEntity.ok(dashboardService.rechercherActivites(annee, mois, consultantId)
                .stream().map(EntityMapper::toDto).toList());
    }

    @GetMapping("/timesheet/status")
    public ResponseEntity<Boolean> checkStatusMoisPrecedent(
            @RequestParam Long consultantId,
            @RequestParam int annee,
            @RequestParam int mois) {
        boolean estValide = dashboardService.isMoisPrecedentValide(consultantId, annee, mois);
        return ResponseEntity.ok(estValide);
    }

    // --- CORRECTION ICI : Ajout du préfixe /admin pour matcher le Frontend ---
    @GetMapping("/admin/saisies/validees")
    public ResponseEntity<List<TacheRealiseeDTO>> getValidatedSaisies() {
        return ResponseEntity.ok(dashboardService.getValidatedSaisies()
                .stream().map(EntityMapper::toDto).toList());
    }

    @GetMapping("/admin/absences/history")
    public ResponseEntity<List<AbsenceDTO>> getAbsenceHistory() {
        return ResponseEntity.ok(dashboardService.getHistoriqueAbsences()
                .stream().map(EntityMapper::toDto).toList());
    }
}