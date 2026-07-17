# Reliquat BC inter-années + masquage consultants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le Pilotage Global ne montre que les BC de l'année sélectionnée + les reliquats reportés depuis N−1 (décision admin/responsable via un toggle sur le BC).

**Architecture:** Un booléen `reportReliquat` sur `BonDeCommande` (le montant du reliquat est toujours calculé, jamais stocké). `getGlobalReport` filtre par `anneeBudgetaire` et ajoute des lignes « reliquat » pour les BC N−1 reportés. Frontend : toggle dans l'AdminPanel, badge dans le Dashboard, filtre du sélecteur de BC dans le Timesheet.

**Tech Stack:** Spring Boot 3 (JPA/PostgreSQL, `ddl-auto=update`), React 18 + Vite + Tailwind, axios.

## Global Constraints

- **Pas de suite de tests dans ce projet** (ni backend ni frontend). Vérification = compilation (`mvn -q -DskipTests compile` dans `ConsultTrack/`), build (`npm run build` dans `ConsultTrackFront/`) et tests manuels listés en Task 7. C'est une déviation assumée du TDD, cohérente avec tout l'historique du repo.
- Verbe HTTP du nouvel endpoint : **PUT** (pas PATCH — `WebConfig.allowedMethods` ne liste pas PATCH, le préflight CORS échouerait).
- Sécurité routes : `/api/admin/**` est déjà `hasAnyRole("ADMIN", "RESPONSABLE")` — rien à changer dans `SecurityConfig`. Le scoping RESPONSABLE se fait applicativement (pattern `cabinetScope`/`inScope` existant de `DashboardService`).
- BC avec `anneeBudgetaire == null` : visible toutes les années (compat, comportement actuel).
- Messages UI et commits en français, style des commits existants (`feat:`, `fix:`).

---

### Task 1: Backend — champ `reportReliquat` (entité + DTO + mapper)

**Files:**
- Modify: `ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/model/BonDeCommande.java`
- Modify: `ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/dto/BonDeCommandeDTO.java`
- Modify: `ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/service/mapper/EntityMapper.java:39-53`

**Interfaces:**
- Produces: `BonDeCommande.getReportReliquat(): Boolean` (Lombok `@Data`), champ JSON `reportReliquat: boolean` dans `BonDeCommandeDTO` — consommés par les Tasks 2, 3, 4, 6.

- [ ] **Step 1: Ajouter le champ à l'entité**

Dans `BonDeCommande.java`, après le champ `anneeBudgetaire` :

```java
    /** Reliquat consommable sur l'année budgétaire suivante (décision admin/responsable). */
    @Column(name = "report_reliquat")
    private Boolean reportReliquat = false;
```

- [ ] **Step 2: Ajouter le champ au DTO**

Dans `BonDeCommandeDTO.java`, après `private Integer anneeBudgetaire;` :

```java
    /** Reliquat consommable l'année suivante (null traité comme false). */
    private Boolean reportReliquat;
```

⚠ Le DTO utilise `@AllArgsConstructor` : l'ordre des champs définit l'ordre du constructeur. Le nouveau champ est en position 11 (après `anneeBudgetaire`, avant `consultantId`).

- [ ] **Step 3: Mettre à jour le mapper**

Dans `EntityMapper.toDto(BonDeCommande bc)`, insérer l'argument entre `bc.getAnneeBudgetaire()` et le consultant :

```java
        return new BonDeCommandeDTO(
                bc.getId(), bc.getReference(), bc.getCodeBudget(),
                bc.getDesignation(), bc.getTjm(), bc.getJoursMax(),
                bc.getJoursConsommes(), engages, max - engages,
                bc.getMontantConsomme(),
                bc.getStatut() != null ? bc.getStatut().name() : null,
                bc.getNature() != null ? bc.getNature().name() : null,
                bc.getAnneeBudgetaire(),
                Boolean.TRUE.equals(bc.getReportReliquat()),
                bc.getConsultant() != null ? bc.getConsultant().getId() : null,
                toRef(bc.getConsultant()));
```

- [ ] **Step 4: Compiler**

Run: `cd /mnt/c/projets/consultrack/ConsultTrack && mvn -q -DskipTests compile`
Expected: BUILD sans erreur (la colonne `report_reliquat` sera créée au prochain démarrage par `ddl-auto=update`).

- [ ] **Step 5: Commit**

```bash
git add ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/model/BonDeCommande.java \
        ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/dto/BonDeCommandeDTO.java \
        ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/service/mapper/EntityMapper.java
git commit -m "feat(bc): champ reportReliquat (report du reliquat sur l'année suivante)"
```

---

### Task 2: Backend — endpoint PUT /admin/bcs/{id}/report-reliquat

**Files:**
- Create: `ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/dto/ReportReliquatRequest.java`
- Modify: `ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/service/DashboardService.java` (après `saveBC`, ~ligne 591)
- Modify: `ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/controller/DashboardController.java` (section « BONS DE COMMANDE », après `createBC`, ~ligne 179)
- Modify: `docs/superpowers/specs/2026-07-17-reliquat-bc-design.md` (PATCH → PUT)

**Interfaces:**
- Consumes: `BonDeCommande.setReportReliquat(Boolean)` (Task 1), `cabinetScope(Consultant)`/`inScope(Consultant, Set<Long>)` (privés existants de `DashboardService`), `accessGuard.currentUser(auth)` (existant).
- Produces: `PUT /api/admin/bcs/{id}/report-reliquat` body `{"autorise": true|false}` → `BonDeCommandeDTO` — consommé par la Task 4.

- [ ] **Step 1: Créer le DTO de requête**

`ReportReliquatRequest.java` :

```java
package ma.cdgcapital.consulttrack.dto;

import lombok.Data;

/** Corps de PUT /admin/bcs/{id}/report-reliquat. */
@Data
public class ReportReliquatRequest {
    private Boolean autorise;
}
```

- [ ] **Step 2: Méthode service avec scoping RESPONSABLE**

Dans `DashboardService.java`, juste après `saveBC` :

```java
    /**
     * Autorise/révoque la consommation du reliquat de ce BC sur l'année suivante.
     * RESPONSABLE : uniquement les BC des consultants de ses cabinets gérés.
     */
    @Transactional
    public BonDeCommande setReportReliquat(Long bcId, boolean autorise, Consultant viewer) {
        BonDeCommande bc = bcRepository.findById(bcId)
                .orElseThrow(() -> new BusinessException("Bon de commande introuvable: " + bcId));
        Set<Long> scope = cabinetScope(viewer);
        if (scope != null && !inScope(bc.getConsultant(), scope)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Accès refusé : BC hors de votre périmètre de cabinets.");
        }
        bc.setReportReliquat(autorise);
        return bcRepository.save(bc);
    }
```

- [ ] **Step 3: Endpoint contrôleur**

Dans `DashboardController.java`, après `createBC` (ajouter l'import `ma.cdgcapital.consulttrack.dto.ReportReliquatRequest` si les DTO ne sont pas importés en `*`) :

```java
    /** Report du reliquat sur l'année suivante — décision ADMIN/RESPONSABLE (scopé). */
    @PutMapping("/admin/bcs/{id}/report-reliquat")
    public ResponseEntity<BonDeCommandeDTO> setReportReliquat(
            @PathVariable Long id,
            @RequestBody ReportReliquatRequest req,
            Authentication auth) {
        return ResponseEntity.ok(EntityMapper.toDto(dashboardService.setReportReliquat(
                id, Boolean.TRUE.equals(req.getAutorise()), accessGuard.currentUser(auth))));
    }
```

- [ ] **Step 4: Amender la spec (PATCH → PUT)**

Dans `docs/superpowers/specs/2026-07-17-reliquat-bc-design.md`, remplacer la ligne
`` `PATCH /api/admin/bcs/{id}/report-reliquat` — body `{ "autorise": true|false }`. ``
par
`` `PUT /api/admin/bcs/{id}/report-reliquat` — body `{ "autorise": true|false }` (PUT et non PATCH : `WebConfig.allowedMethods` n'autorise pas PATCH en CORS). ``

- [ ] **Step 5: Compiler**

Run: `cd /mnt/c/projets/consultrack/ConsultTrack && mvn -q -DskipTests compile`
Expected: BUILD sans erreur.

- [ ] **Step 6: Commit**

```bash
git add ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/dto/ReportReliquatRequest.java \
        ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/service/DashboardService.java \
        ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/controller/DashboardController.java \
        docs/superpowers/specs/2026-07-17-reliquat-bc-design.md
git commit -m "feat(bc): endpoint PUT /admin/bcs/{id}/report-reliquat (ADMIN + RESPONSABLE scopé)"
```

---

### Task 3: Backend — getGlobalReport : filtre année + lignes reliquat

**Files:**
- Modify: `ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/dto/ConsultantDashboardDTO.java`
- Modify: `ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/service/DashboardService.java:67-130` (`getGlobalReport`)

**Interfaces:**
- Consumes: `BonDeCommande.getReportReliquat()` (Task 1).
- Produces: champs JSON `reliquatAnneePrecedente: boolean` et `anneeOrigine: Integer|null` sur chaque ligne de `/dashboard/report` — consommés par la Task 5. Sur une ligne reliquat : `totalJoursBC` = reliquat calculé, `joursConsommesYTD`/`mensuel` = conso de l'année demandée uniquement.

- [ ] **Step 1: Étendre le DTO dashboard**

Dans `ConsultantDashboardDTO.java`, après `private String descriptionCodeBudgetaire;` :

```java
    /** true si cette ligne est le reliquat reporté d'un BC de l'année précédente. */
    private boolean reliquatAnneePrecedente = false;

    /** Année budgétaire d'origine du BC (renseignée sur les lignes reliquat). */
    private Integer anneeOrigine;
```

⚠ Ce DTO a aussi `@AllArgsConstructor`, mais il n'est construit que via `new ConsultantDashboardDTO()` + setters dans `getGlobalReport` — pas d'appel au constructeur complet à corriger.

- [ ] **Step 2: Réécrire la boucle de getGlobalReport**

Remplacer intégralement le corps de la boucle `for (BonDeCommande bc : bcs)` (le squelette des gardes scope/cabinetId est conservé tel quel) :

```java
    public List<ConsultantDashboardDTO> getGlobalReport(Long cabinetId, int annee, Consultant viewer) {
        Set<Long> scope = cabinetScope(viewer);
        List<BonDeCommande> bcs = bcRepository.findAll();
        List<ConsultantDashboardDTO> report = new ArrayList<>();

        for (BonDeCommande bc : bcs) {
            if (bc.getConsultant() == null) continue;
            // RESPONSABLE : uniquement les consultants de ses cabinets gérés
            if (!inScope(bc.getConsultant(), scope)) continue;
            // CONSULTANT : uniquement ses propres lignes (anti-IDOR serveur)
            if (viewer != null && viewer.getRole() == Role.CONSULTANT
                    && !bc.getConsultant().getId().equals(viewer.getId())) continue;

            if (cabinetId != null) {
                if (bc.getConsultant().getCabinet() == null
                        || !bc.getConsultant().getCabinet().getId().equals(cabinetId)) {
                    continue;
                }
            }

            // --- Rattachement à l'année demandée ---
            // BC de l'année (ou sans année : compat, visible partout) → ligne normale.
            // BC de l'année N-1 avec report autorisé → ligne « reliquat ».
            Integer anneeBC = bc.getAnneeBudgetaire();
            boolean ligneAnnee = anneeBC == null || anneeBC == annee;
            boolean ligneReliquat = anneeBC != null && anneeBC == annee - 1
                    && Boolean.TRUE.equals(bc.getReportReliquat());
            if (!ligneAnnee && !ligneReliquat) continue;

            ConsultantDashboardDTO dto = new ConsultantDashboardDTO();
            Consultant cons = bc.getConsultant();

            dto.setNomConsultant(cons.getNom() + " " + cons.getPrenom());
            dto.setNomCabinet(cons.getCabinet() != null ? cons.getCabinet().getNom() : "Sans Cabinet");
            dto.setReferenceBC(bc.getReference());
            dto.setBcId(bc.getId());
            dto.setTjm(bc.getTjm());
            dto.setDescriptionCodeBudgetaire(bc.getCodeBudget());

            // Toutes les tâches VALIDE du BC : conso de l'année demandée (mensuel)
            // + conso des années antérieures (pour le calcul du reliquat).
            List<TacheRealisee> taches = tacheRepository.findByConsultantId(cons.getId()).stream()
                    .filter(t -> t.getBonDeCommande() != null
                            && t.getBonDeCommande().getId().equals(bc.getId())
                            && t.getDate() != null
                            && t.getStatut() == StatutPointage.VALIDE)
                    .collect(Collectors.toList());

            double consoAnnee = 0.0;
            double consoAnterieure = 0.0;
            Double[] mensuel = new Double[12];
            for (int i = 0; i < 12; i++) mensuel[i] = 0.0;

            for (TacheRealisee t : taches) {
                if (t.getDuree() == null) continue;
                int y = t.getDate().getYear();
                if (y == annee) {
                    mensuel[t.getDate().getMonthValue() - 1] += t.getDuree();
                    consoAnnee += t.getDuree();
                } else if (y < annee) {
                    consoAnterieure += t.getDuree();
                }
            }

            double max = bc.getJoursMax() != null ? bc.getJoursMax() : 0.0;
            double enveloppe;
            if (ligneReliquat) {
                enveloppe = max - consoAnterieure; // reliquat calculé, jamais stocké
                if (enveloppe <= 0) continue;      // rien à reporter → pas de ligne
                dto.setReliquatAnneePrecedente(true);
                dto.setAnneeOrigine(anneeBC);
            } else {
                enveloppe = max;
            }

            dto.setTotalJoursBC(enveloppe);
            dto.setMensuel(mensuel);
            dto.setJoursConsommesYTD(consoAnnee);
            dto.setJoursRestants(enveloppe - consoAnnee);

            double tjm = bc.getTjm() != null ? bc.getTjm() : 0.0;
            dto.setMontantConsommeYTD(consoAnnee * tjm);
            dto.setBudgetConsommeHT(dto.getMontantConsommeYTD());

            report.add(dto);
        }
        return report;
    }
```

- [ ] **Step 3: Compiler**

Run: `cd /mnt/c/projets/consultrack/ConsultTrack && mvn -q -DskipTests compile`
Expected: BUILD sans erreur.

- [ ] **Step 4: Commit**

```bash
git add ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/dto/ConsultantDashboardDTO.java \
        ConsultTrack/src/main/java/ma/cdgcapital/consulttrack/service/DashboardService.java
git commit -m "feat(pilotage): rapport filtré par année budgétaire + lignes reliquat N-1 reporté"
```

---

### Task 4: Frontend — toggle « Report reliquat » dans l'AdminPanel

**Files:**
- Modify: `ConsultTrackFront/src/components/AdminPanel.jsx:606-720` (`BCSection`)

**Interfaces:**
- Consumes: `PUT /admin/bcs/{id}/report-reliquat` body `{autorise}` (Task 2) ; champs `bc.reportReliquat`, `bc.anneeBudgetaire`, `bc.joursMax`, `bc.joursConsommes` du `BonDeCommandeDTO` (Task 1).

- [ ] **Step 1: Handler + rendu du toggle**

Dans `BCSection` (qui a déjà `currentYear`), ajouter après la fonction `save` :

```jsx
    // Report du reliquat sur l'année suivante (BC des années passées uniquement)
    const toggleReport = async (bc) => {
        setError('');
        try {
            await api.put(`/admin/bcs/${bc.id}/report-reliquat`, { autorise: !bc.reportReliquat });
            onRefresh();
        } catch (err) { setError(getErr(err)); }
    };
```

Puis dans la carte BC, juste après la ligne `<BudgetGauge label="Consommation" ... />` :

```jsx
                        {bc.anneeBudgetaire != null && bc.anneeBudgetaire < currentYear
                            && ((bc.joursMax ?? 0) - (bc.joursConsommes ?? 0)) > 0 && (
                            <button
                                onClick={() => toggleReport(bc)}
                                className="mt-3 w-full text-xs font-black px-3 py-2 rounded-xl border transition-all"
                                style={bc.reportReliquat
                                    ? { backgroundColor: '#f0fdf4', borderColor: COLORS.green, color: COLORS.green }
                                    : { backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#6b7280' }}>
                                {bc.reportReliquat
                                    ? `✓ Reliquat reporté sur ${bc.anneeBudgetaire + 1} — cliquer pour annuler`
                                    : `Autoriser le report du reliquat sur ${bc.anneeBudgetaire + 1}`}
                            </button>
                        )}
```

- [ ] **Step 2: Build**

Run: `cd /mnt/c/projets/consultrack/ConsultTrackFront && npm run build`
Expected: build Vite sans erreur.

- [ ] **Step 3: Commit**

```bash
git add ConsultTrackFront/src/components/AdminPanel.jsx
git commit -m "feat(admin): toggle report du reliquat sur N+1 dans la liste des BC"
```

---

### Task 5: Frontend — badge « Reliquat N−1 » dans le Dashboard + export Excel

**Files:**
- Modify: `ConsultTrackFront/src/components/Dashboard.jsx`

**Interfaces:**
- Consumes: champs `reliquatAnneePrecedente` / `anneeOrigine` des lignes de `/dashboard/report` (Task 3).

- [ ] **Step 1: Composant badge**

Après le composant `SectionTitle` (~ligne 26) :

```jsx
/** Badge « Reliquat 2025 » sur les lignes issues d'un report d'année précédente. */
const ReliquatBadge = ({ row }) => row.reliquatAnneePrecedente ? (
    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ backgroundColor: '#fdf6e9', color: COLORS.gold }}>
        Reliquat {row.anneeOrigine}
    </span>
) : null;
```

- [ ] **Step 2: Badge dans la vue consultant**

Dans la carte BC de la vue consultant (~ligne 255), remplacer :

```jsx
                                        <div className="font-black text-lg" style={{ color: COLORS.blue }}>{bc.referenceBC}</div>
```

par :

```jsx
                                        <div className="font-black text-lg flex items-center gap-2" style={{ color: COLORS.blue }}>
                                            {bc.referenceBC} <ReliquatBadge row={bc} />
                                        </div>
```

- [ ] **Step 3: Badge dans le tableau « Activité réalisée »**

Dans la ligne du tableau (~ligne 476), remplacer :

```jsx
                                                                        <td className="py-1.5 px-2 font-bold" style={{ color: COLORS.blue }}>{r.referenceBC}</td>
```

par :

```jsx
                                                                        <td className="py-1.5 px-2 font-bold" style={{ color: COLORS.blue }}>
                                                                            <span className="flex items-center gap-1.5">{r.referenceBC} <ReliquatBadge row={r} /></span>
                                                                        </td>
```

- [ ] **Step 4: Badge dans les alertes budgétaires**

Dans la section alertes (~ligne 537), remplacer :

```jsx
                                                    <BudgetGauge label={r.referenceBC} consomme={r.joursConsommesYTD} max={r.totalJoursBC} />
```

par :

```jsx
                                                    <BudgetGauge
                                                        label={r.reliquatAnneePrecedente ? `${r.referenceBC} (Reliquat ${r.anneeOrigine})` : r.referenceBC}
                                                        consomme={r.joursConsommesYTD} max={r.totalJoursBC} />
```

- [ ] **Step 5: Export Excel**

Dans `exportFicheSuiviExcel`, remplacer la ligne :

```jsx
            r.descriptionCodeBudgetaire || '',
```

par :

```jsx
            (r.descriptionCodeBudgetaire || '') + (r.reliquatAnneePrecedente ? ` (Reliquat ${r.anneeOrigine})` : ''),
```

- [ ] **Step 6: Build**

Run: `cd /mnt/c/projets/consultrack/ConsultTrackFront && npm run build`
Expected: build Vite sans erreur.

- [ ] **Step 7: Commit**

```bash
git add ConsultTrackFront/src/components/Dashboard.jsx
git commit -m "feat(pilotage): badge Reliquat N-1 (cartes, tableau, alertes, export Excel)"
```

---

### Task 6: Frontend — sélecteur de BC du Timesheet filtré par année

**Files:**
- Modify: `ConsultTrackFront/src/components/TimesheetForm.jsx:138-141`

**Interfaces:**
- Consumes: champs `anneeBudgetaire`, `reportReliquat`, `joursMax`, `joursConsommes`, `joursEngages` du `BonDeCommandeDTO` (Task 1). Variable d'état existante `annee` (année du mois affiché).

- [ ] **Step 1: Filtrer les BC proposés au pointage**

Remplacer :

```jsx
                const cid = parseInt(consultantId, 10);
                const mesBcs = resBcs.data.filter(
                    (bc) => bc.consultantId === cid || bc.consultant?.id === cid,
                );
```

par :

```jsx
                const cid = parseInt(consultantId, 10);
                // BC pointables pour l'année affichée : année courante (ou sans année, compat)
                // + BC N-1 dont le reliquat est reporté et non épuisé.
                const mesBcs = resBcs.data.filter(
                    (bc) => (bc.consultantId === cid || bc.consultant?.id === cid)
                        && (bc.anneeBudgetaire == null
                            || bc.anneeBudgetaire === annee
                            || (bc.anneeBudgetaire === annee - 1 && bc.reportReliquat
                                && ((bc.joursMax ?? 0) - (bc.joursConsommes ?? 0) - (bc.joursEngages ?? 0)) > 0)),
                );
```

- [ ] **Step 2: Build**

Run: `cd /mnt/c/projets/consultrack/ConsultTrackFront && npm run build`
Expected: build Vite sans erreur.

- [ ] **Step 3: Commit**

```bash
git add ConsultTrackFront/src/components/TimesheetForm.jsx
git commit -m "feat(timesheet): BC pointables limités à l'année affichée + reliquats reportés"
```

---

### Task 7: Vérification manuelle de bout en bout

**Files:** aucun (vérification).

Pré-requis : PostgreSQL démarré, backend `cd ConsultTrack && mvn spring-boot:run` (port 8081), frontend `cd ConsultTrackFront && npm run dev` (port 5173).

- [ ] **Step 1: Masquage** — Pilotage Global en 2026 : un BC `anneeBudgetaire=2025` non reporté n'apparaît pas ; un consultant dont c'était le seul BC n'a plus aucune ligne (ni carte cabinet, ni tableau).
- [ ] **Step 2: Report** — AdminPanel → BC 2025 avec reliquat > 0 → cliquer « Autoriser le report » (badge vert). Pilotage 2026 : ligne avec badge « Reliquat 2025 », enveloppe = joursMax − conso ≤ 2025.
- [ ] **Step 3: Année passée intacte** — Pilotage 2025 : le même BC affiche toujours son enveloppe complète et sa conso 2025, sans badge.
- [ ] **Step 4: Scoping RESPONSABLE** — connecté RESPONSABLE : le toggle fonctionne sur un BC de ses cabinets ; un `PUT /api/admin/bcs/{id}/report-reliquat` sur un BC hors périmètre (via curl avec son JWT) → 403.
- [ ] **Step 5: Timesheet** — consultant, mois de 2026 : le BC 2025 n'apparaît dans le sélecteur que si reporté ; pointer un jour dessus → visible dans Pilotage 2026 colonne du mois, `joursRestants` du reliquat décrémenté.
- [ ] **Step 6: Export Excel** — la ligne reliquat porte « (Reliquat 2025) » dans la colonne Description.
