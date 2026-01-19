package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.dto.*;
import ma.cdgcapital.consulttrack.model.*;
import ma.cdgcapital.consulttrack.service.DashboardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173")
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    // ==========================================
    // 1. DASHBOARD & TIMESHEET (Lecture)
    // ==========================================

    @GetMapping("/dashboard/report")
    public ResponseEntity<List<ConsultantDashboardDTO>> getReport(
            @RequestParam(required = false) Long cabinetId,
            @RequestParam int annee) {
        return ResponseEntity.ok(dashboardService.getGlobalReport(cabinetId, annee));
    }

    @GetMapping("/dashboard/timesheet/{consultantId}")
    public ResponseEntity<List<TacheRealisee>> getTimesheet(
            @PathVariable Long consultantId,
            @RequestParam int annee,
            @RequestParam int mois) {
        return ResponseEntity.ok(dashboardService.getPointagesMensuels(consultantId, annee, mois));
    }

    // ==========================================
    // 2. SAISIE DES TEMPS (Écriture)
    // ==========================================

    @PostMapping("/dashboard/timesheet/bulk")
    public ResponseEntity<String> saveBulkTimesheet(@RequestBody List<PointageRequest> requests) {
        if (requests.isEmpty()) return ResponseEntity.badRequest().body("Liste vide");

        Long consultantId = requests.get(0).getConsultantId();
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
    public ResponseEntity<List<Cabinet>> getAllCabinets() {
        return ResponseEntity.ok(dashboardService.getAllCabinets());
    }

    @PostMapping("/admin/cabinets")
    public ResponseEntity<Cabinet> createCabinet(@RequestBody Cabinet cabinet) {
        return ResponseEntity.ok(dashboardService.saveCabinet(cabinet));
    }

    // --- CONSULTANTS ---
    @GetMapping("/admin/consultants")
    public ResponseEntity<List<Consultant>> getAllConsultants() {
        return ResponseEntity.ok(dashboardService.getAllConsultants());
    }

    @PostMapping("/admin/consultants")
    public ResponseEntity<Consultant> createConsultant(@RequestBody Consultant consultant) {
        return ResponseEntity.ok(dashboardService.saveConsultant(consultant));
    }

    // --- BONS DE COMMANDE (BC) ---
    @GetMapping("/admin/bcs")
    public ResponseEntity<List<BonDeCommande>> getAllBCs() {
        return ResponseEntity.ok(dashboardService.getAllBCs());
    }

    @PostMapping("/admin/bcs")
    public ResponseEntity<BonDeCommande> createBC(@RequestBody BonDeCommande bc) {
        return ResponseEntity.ok(dashboardService.saveBC(bc));
    }

    // --- VALIDATION DES SAISIES (Admin) ---
    @GetMapping("/admin/saisies/en-attente")
    public ResponseEntity<List<TacheRealisee>> getPendingSaisies() {
        return ResponseEntity.ok(dashboardService.getPendingSaisies());
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

    // ==========================================
    // 4. GESTION DES ABSENCES (CONGÉS)
    // ==========================================

    @GetMapping("/dashboard/absences/{consultantId}")
    public ResponseEntity<List<Absence>> getAbsences(
            @PathVariable Long consultantId,
            @RequestParam int annee,
            @RequestParam int mois) {
        return ResponseEntity.ok(dashboardService.getAbsencesMensuelles(consultantId, annee, mois));
    }

    @PostMapping("/dashboard/absences/demande")
    public ResponseEntity<Absence> soumettreDemande(@RequestBody Map<String, Object> payload) {
        Long consultantId = Long.valueOf(payload.get("consultantId").toString());
        LocalDate date = LocalDate.parse(payload.get("date").toString());
        String motif = payload.get("motif").toString();

        return ResponseEntity.ok(dashboardService.demanderAbsence(consultantId, date, motif));
    }

    @GetMapping("/admin/absences/pending")
    public ResponseEntity<List<Absence>> getPendingAbsences() {
        return ResponseEntity.ok(dashboardService.getPendingAbsences());
    }

    @PutMapping("/admin/absences/{id}/status")
    public ResponseEntity<Void> updateAbsenceStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload) {
        StatutPointage statut = StatutPointage.valueOf(payload.get("statut"));
        dashboardService.updateAbsenceStatus(id, statut);
        return ResponseEntity.ok().build();
    }

    // --- SECTION HISTORIQUE & ACTIVITÉS ---

    @GetMapping("/admin/activities/search")
    public ResponseEntity<List<TacheRealisee>> searchActivities(
            @RequestParam int annee,
            @RequestParam(required = false) Integer mois,
            @RequestParam(required = false) Long consultantId) {
        return ResponseEntity.ok(dashboardService.rechercherActivites(annee, mois, consultantId));
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
    public ResponseEntity<List<TacheRealisee>> getValidatedSaisies() {
        return ResponseEntity.ok(dashboardService.getValidatedSaisies());
    }

    @GetMapping("/admin/absences/history")
    public ResponseEntity<List<Absence>> getAbsenceHistory() {
        return ResponseEntity.ok(dashboardService.getHistoriqueAbsences());
    }
}