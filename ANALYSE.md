# 📊 Analyse du projet ConsulTrack

> Document d'analyse technique généré le 2026-05-20
> Branche analysée : `fix/CRA-BC`
>
> ⚠️ **Document mis à jour après refactor** : voir section "État après refactor" en bas pour le statut actuel des points d'attention.

---

## 🎯 Vue d'ensemble

**ConsulTrack** est une application interne **CDG Capital** (Maroc) pour la gestion des **CRA** (Comptes Rendus d'Activité) des consultants externes (ESN/cabinets).

### Fonctionnalités principales
- Saisie des temps consultant (calendrier visuel)
- Contrôle budgétaire en temps réel des Bons de Commande
- Workflow de validation admin (CRA + Absences)
- Génération PDF des CRA mensuels
- Tableau de bord admin avec KPIs

---

## 🏗️ Architecture (deux modules)

```
ConsulTrack/
├── ConsultTrack/          ← Backend Spring Boot 3.2 (Java 17)
│   └── port 8081
└── ConsultTrackFront/     ← Frontend React 19 + Vite + Tailwind
    └── port 5173
```

---

## 🔧 Stack technique

| Couche | Technologie |
|---|---|
| **Backend** | Spring Boot 3.2, Spring Data JPA, Spring Security + OAuth2/Keycloak, Lombok, PostgreSQL |
| **Frontend** | React 19, React Router v7, Axios, jsPDF (export CRA), Tailwind CSS, Lucide icons |
| **Auth** | JWT via Keycloak (realm `consulttrack-realm` sur port 8080) |
| **DB** | PostgreSQL — `consult_track_db` |

---

## 🧩 Modèle de domaine (entités JPA)

```
Cabinet (ESN) ──< Consultant ──< BonDeCommande ──< AffectationBC (avec TJM)
                       │                  │
                       └──< Absence       └──< JourTravaille / TacheRealisee
                                                    │
                                                    └─→ statut: EN_ATTENTE/VALIDE/REJETE
```

### Concepts métier clés
- **BC (Bon de Commande)** : enveloppe budgétaire (`joursMax`, `joursConsommes`, `tjm`)
- **TJM** (Taux Jour-Moyen) → calcul `montantConsomme = jours × TJM`
- **Workflow de validation** : saisie consultant → `EN_ATTENTE` → validation/rejet admin

---

## 📂 Organisation backend (package `ma.cdgcapital.consulttrack`)

| Package | Rôle | Fichiers |
|---|---|---|
| `config/` | Security, CORS, DataInitializer | 3 |
| `controller/` | 5 REST controllers (Dashboard, Absence, Consultant, Report, Public) | 5 |
| `dto/` | Data Transfer Objects pour API | 7 |
| `model/` | Entités JPA + énumérations | 15 |
| `repository/` | Spring Data JPA repos | 8 |
| `service/` | Logique métier | 7 |

---

## 🎨 Organisation frontend

| Composant | Lignes | Rôle |
|---|---|---|
| `TimesheetForm.jsx` | **647** | Saisie du CRA (calendrier mensuel) |
| `AdminPanel.jsx` | **628** | Console admin (CRUD complet) |
| `ActivityForm.jsx` | 389 | Détail des activités |
| `Dashboard.jsx` | 331 | Tableau de bord (KPIs, graphiques) |
| `AbsenceForm.jsx` | 304 | Saisie des absences |
| `pdfGenerator.js` | — | Export CRA mensuel en PDF |

---

## ⚠️ Points d'attention identifiés

### 1. Sécurité désactivée en dev (`SecurityConfig.java:36-38`)
```java
.authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
```
Le commentaire indique que c'est temporaire — **à corriger absolument avant la prod**.

### 2. Doublon de modèle
`JourTravaille` et `TacheRealisee` représentent tous deux des "pointages". Le code utilise `TacheRealisee` pour le dashboard moderne et `JourTravaille` pour les anciens services (`TimesheetService`). **Migration incomplète**.

### 3. Performance — `findAll()` en boucle
- `DashboardService.getGlobalReport()` : `findAll()` dans une boucle BC
- `actualiserCompteursBC()` : idem
- `rechercherActivites()` : filtres en mémoire au lieu de SQL

### 4. CORS configuré deux fois
- `WebConfig` → restrictif (`localhost:5173`)
- Controllers → `@CrossOrigin(origins = "*")` (permissif)
→ Incohérent, le `*` l'emporte.

### 5. DataInitializer commenté
Tout le fichier est en `/* ... */` — pas de données de seed automatiques.

### 6. AuthContext non utilisé
`App.jsx` simule le rôle avec `useState('ADMIN')` au lieu d'utiliser `AuthContext` qui existe pourtant.

### 7. Branche actuelle : `fix/CRA-BC`
27 fichiers modifiés non commités — un gros chantier en cours sur la cohérence CRA ↔ Bon de Commande.

---

# 🔍 Validation CRA — Analyse approfondie

## 🎭 Deux univers parallèles (le grand piège du code)

Le projet contient **deux systèmes de validation coexistants** :

| Système | Entité | Service | Statut enum | Utilisé par |
|---|---|---|---|---|
| **"Legacy"** | `JourTravaille` | `TimesheetService` + `AdminService` | `StatutSaisie` (SOUMIS/VALIDE/...) | Anciens endpoints `/api/consultant/...` |
| **"Moderne"** | `TacheRealisee` | `DashboardService` | `StatutPointage` (EN_ATTENTE/VALIDE/...) | Endpoints actifs `/api/dashboard/...` et `/api/admin/saisies/...` |

⚠️ **Le frontend (TimesheetForm, AdminPanel) n'utilise QUE le système moderne**. Le legacy est "code mort actif" — il existe, fonctionne, mais personne ne l'appelle. C'est de la dette technique.

---

## 🔄 Cycle de vie complet d'une saisie

```
                  ┌──────────────────────────────────────────────┐
                  │           CONSULTANT (Frontend)              │
                  └──────────────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
      saveData('DRAFT')                                  saveData('SUBMITTED')
            │                                                     │
            ▼                                                     ▼
      statut=BROUILLON                                  statut=EN_ATTENTE
            │                                                     │
            └─────────► POST /dashboard/timesheet/bulk ◄──────────┘
                                       │
                                       ▼
                       DashboardService.sauvegarderPointagesMensuels()
                                       │
                                       ├── Pour chaque PointageRequest:
                                       │     - findByConsultantIdAndDate (UPSERT)
                                       │     - SI tache.statut == VALIDE → CONTINUE (verrou)
                                       │     - SINON setStatut(EN_ATTENTE)
                                       │
                                       └── actualiserCompteursBC()  ← recalcul global

                  ┌──────────────────────────────────────────────┐
                  │              ADMIN (Frontend)                │
                  └──────────────────────────────────────────────┘
                                       │
                  GET /admin/saisies/en-attente
                                       │
                                       ▼
            ┌────────────────────┴────────────────────┐
            ▼                                          ▼
      PUT /admin/saisies/{id}/valider       PUT /admin/saisies/{id}/rejeter?motif=...
            │                                          │
            ▼                                          ▼
   DashboardService.validerSaisie()       DashboardService.rejeterSaisie()
            │                                          │
            └── setStatut(VALIDE)                      └── setStatut(REJETE)
                                                          + description += "[REJET: ...]"
```

---

## 🔐 Les mécanismes de verrouillage

### 1. Verrou "ligne validée" — protection contre l'écrasement
`DashboardService.sauvegarderPointagesMensuels()` lignes 123-125 :
```java
if (tache.getId() != null && tache.getStatut() == StatutPointage.VALIDE) {
    continue;   // ← on ne touche jamais à une ligne validée
}
```
👉 Permet de remplir les jours vides AUTOUR d'une absence déjà validée sans la casser.

### 2. Verrou "mois entier" — frontend uniquement
`TimesheetForm.jsx:286` :
```js
if (monthStatus === 'EN_ATTENTE' || monthStatus === 'VALIDE') return;
```
👉 Si le mois est en validation/validé, on bloque la saisie **côté UI**. **MAIS le backend ne fait pas ce contrôle** — un client malicieux peut contourner.

### 3. Verrou "séquentialité mensuelle"
`DashboardService.isMoisPrecedentValide()` :
- Si le mois précédent n'a aucune ligne → autorisé (1er mois)
- Sinon : **toutes** les lignes du mois N-1 doivent être `VALIDE`

Mais regarde le frontend (`TimesheetForm.jsx:116`) :
```js
if (!resPrev.data || resPrev.data.length === 0 ||
    resPrev.data.some(t => t.statut !== 'VALIDE' && t.statut !== 'EN_ATTENTE')) {
    setIsSequentialLocked(true);
}
```
👉 Le frontend accepte aussi `EN_ATTENTE` comme "OK pour passer au mois suivant" — divergence avec le backend qui n'accepte que `VALIDE`. **Bug subtil**.

### 4. Bypass admin
```js
if (isSequentialLocked && userRole !== 'ADMIN') { alert(...); return; }
```
👉 L'admin peut tout faire — pas de verrou séquentiel pour lui.

---

## 💰 Conséquences budgétaires

C'est ici que ça devient intéressant. La validation d'un CRA n'est PAS qu'un changement de statut — elle a des **effets de bord financiers**.

### Lors de la sauvegarde initiale (consultant)
`actualiserCompteursBC()` est appelé après chaque `sauvegarderPointagesMensuels()` :
```java
private void actualiserCompteursBC(Long consultantId) {
    for (BonDeCommande bc : bcs) {
        Double total = tacheRepository.findAll().stream()
                .filter(t -> t.getBonDeCommande() != null && ...)
                .mapToDouble(TacheRealisee::getDuree)
                .sum();
        bc.setJoursConsommes(total);
        bc.setMontantConsomme(total * bc.getTjm());
    }
}
```
⚠️ **Problème majeur** : ce calcul inclut TOUS les jours peu importe le statut (BROUILLON, EN_ATTENTE, VALIDE, REJETE). Donc un consultant qui met 30 jours en BROUILLON **consomme déjà budgétairement le BC** — alors qu'aucune validation admin n'a eu lieu !

### Lors de la validation admin (`validerSaisie`)
```java
public void validerSaisie(Long id) {
    TacheRealisee t = tacheRepository.findById(id).orElseThrow();
    t.setStatut(StatutPointage.VALIDE);
    tacheRepository.save(t);
}
```
👉 **Aucune mise à jour budgétaire** — le BC n'est pas re-calculé. Le calcul a déjà été fait à la saisie.

### Le système legacy (`AdminService`) fait l'INVERSE
Dans `AdminService.validerSaisie()` (jamais appelé en pratique) :
```java
if (jour.getStatut() == StatutSaisie.SOUMIS && bc != null && !jour.isEstAbsence()) {
    if (bc.getJoursConsommes() + jour.getDuree() > bc.getJoursMax()) {
        throw new RuntimeException("Dépassement de budget");
    }
    bc.setJoursConsommes(bc.getJoursConsommes() + jour.getDuree());
    ...
}
```
👉 Vérification ET incrémentation au moment de la validation seulement.

📌 **C'est l'inversion totale de stratégie**. Le système legacy était "budget consommé à la validation", le moderne est "budget consommé à la saisie". Cette incohérence est probablement l'origine du nom de la branche `fix/CRA-BC`.

---

## 🪝 Cas particulier : la validation d'absence

`DashboardService.updateAbsenceStatus()` est plus complexe — quand on valide une absence, on **génère automatiquement une `TacheRealisee` correspondante** :
```java
if (statut == StatutPointage.VALIDE) {
    TacheRealisee tache = tacheRepository
        .findByConsultantIdAndDate(abs.getConsultant().getId(), abs.getDate())
        .orElse(new TacheRealisee());
    tache.setModeSaisie("ABSENCE");
    tache.setDuree(1.0);
    tache.setStatut(StatutPointage.VALIDE);  // ← verrouillage immédiat
    tache.setBonDeCommande(null);
    ...
}
```
👉 Cela explique le verrou "ligne validée" mentionné plus haut : si tu valides une absence le 15, puis le consultant saisit du travail le reste du mois, le jour 15 sera protégé.

---

## 🐛 Bugs et risques identifiés

| # | Sévérité | Problème |
|---|---|---|
| 1 | 🔴 Critique | `actualiserCompteursBC()` consomme le budget dès le BROUILLON |
| 2 | 🟠 Élevée | Pas de vérification de dépassement de budget dans le système moderne |
| 3 | 🟠 Élevée | Pas de validation backend du verrou "mois envoyé" — contournable par un client malicieux |
| 4 | 🟡 Moyenne | Divergence frontend/backend sur la sémantique de "mois précédent valide" (`EN_ATTENTE` accepté côté front, refusé côté back) |
| 5 | 🟡 Moyenne | Rejet en masse — `motif=RejetGlobal` hardcodé dans le frontend (`AdminPanel.jsx:221`), pas de saisie utilisateur |
| 6 | 🟢 Faible | Concaténation du motif dans `descriptionTache` — pollution du champ utile, et un rejet répété accumule `[REJET: x] [REJET: y]` |
| 7 | 🟢 Faible | Pas de transactionnalité globale au niveau de l'opération "valider tout le mois" — Promise.all peut laisser un état partiel si un appel échoue |

---

## 🤔 Décision architecturale à clarifier

Le code montre clairement les traces d'un **refactoring en cours** (la branche `fix/CRA-BC`).

### Trade-off : "Budget réservé vs Budget consommé"

Dans un système ERP/Achat, on distingue souvent deux notions :
- `réservé` (engagé mais pas encore validé)
- `consommé` (validé définitivement)

Le code mélange les deux dans un seul champ `joursConsommes`. Beaucoup de bugs viennent de cette confusion sémantique.

### Options pour la consommation du BC

| Option | Description | Avantage | Inconvénient |
|---|---|---|---|
| **A** | BC consommé dès le BROUILLON (actuel) | Vision temps réel du solde restant | Faux compteurs si beaucoup de brouillons abandonnés |
| **B** | BC consommé à `EN_ATTENTE` (envoi) | Engage le consultant | Pas de gestion des rejets |
| **C** | BC consommé seulement à `VALIDE` (legacy) | Strict, rigoureux | Le consultant ne voit pas son budget consommé avant validation admin |
| **D** | Deux champs : `joursEngages` + `joursConsommes` | Distingue les deux notions | Refactor plus lourd, mais plus propre |

---

## 🚀 Pour démarrer le projet

```bash
# Backend
cd ConsultTrack && ./mvnw spring-boot:run        # port 8081

# Frontend
cd ConsultTrackFront && npm install && npm run dev   # port 5173

# Prérequis : PostgreSQL + Keycloak (port 8080) lancés
```

---

## 📝 Pistes de refactoring prioritaires

1. **Réactiver Spring Security** avec validation JWT correcte
2. **Décider d'une stratégie BC** (option A/B/C/D) et la documenter
3. **Supprimer le code legacy** (`JourTravaille`, `TimesheetService`, méthodes `AdminService.validerSaisie`)
4. **Ajouter le contrôle backend du verrou "mois envoyé"** dans `sauvegarderPointagesMensuels`
5. **Optimiser les requêtes** — remplacer `findAll()` + filter par requêtes JPQL/Specifications
6. **Unifier le CORS** dans une seule source de vérité
7. **Connecter `AuthContext`** dans `App.jsx` au lieu du `useState` simulé
8. **Externaliser le motif de rejet** en colonne dédiée (`motifRejet`) au lieu de le concaténer dans `descriptionTache`

---

# ✅ État après refactor (branche `fix/CRA-BC`)

Les points ci-dessus ont été traités dans le refactor structuré en 10 phases.

## Décisions stratégiques actées

| Décision | Choix |
|---|---|
| Stratégie BC | **Option D** : double compteur `joursEngages` + `joursConsommes` |
| Code legacy | **Supprimé** complètement |
| Authentification | **JWT custom** (sans Keycloak) |
| Tests | Reportés |

## Statut des points d'attention

| # | Point initial | Statut |
|---|---|---|
| 1 | Sécurité désactivée (`permitAll()`) | ✅ Résolu — `SecurityConfig` avec JWT + rôles |
| 2 | Doublon `JourTravaille` / `TacheRealisee` | ✅ Résolu — legacy supprimé, `ReportService` migré |
| 3 | `findAll().stream().filter()` | ✅ Résolu — requêtes JPQL/derived dédiées |
| 4 | CORS configuré deux fois | ✅ Résolu — `@CrossOrigin` retirés, `WebConfig` unique source |
| 5 | `DataInitializer` commenté | ✅ Résolu — réactivé, idempotent, avec seeds BCrypt |
| 6 | Pas de vérif dépassement budget moderne | ✅ Résolu — `BusinessException` levée si dépassement |
| 7 | Verrou "mois envoyé" frontend uniquement | ✅ Résolu — vérif backend dans `sauvegarderPointagesMensuels` |
| 8 | Concaténation motif rejet dans `descriptionTache` | ✅ Résolu — colonne `motif_rejet` dédiée |
| 9 | Pas de transactionnalité validation en masse | ✅ Résolu — endpoint `PUT /admin/saisies/valider-mois` `@Transactional` |
| 10 | `BROUILLON` consomme le budget | ✅ Résolu — seuls `EN_ATTENTE` + `VALIDE` impactent `joursEngages` |
| 11 | `AuthContext` non utilisé | ✅ Résolu — `AuthProvider` monté, `PrivateRoute` actif, `currentUserId=1` retiré |
| 12 | Divergence sémantique `EN_ATTENTE` front/back | ✅ Résolu — frontend exige `VALIDE` (cohérence backend) |
| 13 | Motif `RejetGlobal` hardcodé | ✅ Résolu — saisie utilisateur via `prompt()` |
| 14 | `Map<String, Object>` payloads | ✅ Résolu — DTOs typés (`AbsenceDemandeRequest`, `AbsenceStatusRequest`) |
| 15 | Entités exposées directement | ✅ Résolu — tous les endpoints de `DashboardController` renvoient des DTOs via `EntityMapper`. DTOs **consumer-driven** : leur forme JSON est calquée sur ce que lit le frontend (champ `duree` conservé, `id` présent, `consultant`/`bonDeCommande` imbriqués) → aucun changement frontend requis. `password` n'est plus jamais sérialisé. |

## Nouveaux fichiers créés

### Backend
- `dto/auth/{LoginRequest,LoginResponse,AuthUserDTO}.java`
- `dto/{CabinetDTO,ConsultantDTO,BonDeCommandeDTO,AbsenceDTO,AbsenceDemandeRequest,AbsenceStatusRequest}.java`
- `dto/{ConsultantRefDTO,BcRefDTO}.java` (refs allégées imbriquées dans les DTOs — forme attendue par le frontend)
- `model/Role.java` (extrait de `Consultant.java`)
- `exception/{BusinessException,GlobalExceptionHandler}.java`
- `security/{JwtService,JwtAuthFilter}.java`
- `service/AuthService.java`
- `service/mapper/EntityMapper.java`
- `controller/AuthController.java`

### Frontend
- (aucun fichier ajouté — `PrivateRoute.jsx`, `Login.jsx`, `AuthContext.jsx` existaient déjà mais étaient orphelins)

### Documentation
- `MIGRATION.md` (étapes SQL + breaking changes)
- `readme.md` (mis à jour : retrait Keycloak, ajout JWT, seeds)

