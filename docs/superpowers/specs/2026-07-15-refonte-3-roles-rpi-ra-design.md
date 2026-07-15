# Refonte ConsulTrack — 3 rôles, RPI/RA fidèles aux documents réels, UX homogène

Date : 2026-07-15 · Branche : `fix/CRA-BC` · Statut : **validé en brainstorming, à relire**

## 1. Contexte et objectifs

L'app gère le pointage de consultants externes par Bon de Commande (BC). Trois revues
(UX/UI, fonctionnelle, technique) + l'analyse visuelle des documents réels du dossier
`samples/` (rendus via poppler) ont établi les écarts. Objectifs :

1. **Modèle à 3 rôles** : ADMIN / RESPONSABLE / CONSULTANT.
2. **Documents générés identiques aux documents réels** (RPI « Relevé Périodique
   d'Intervention » et Rapport d'Activité), avec double signature.
3. **UX homogène et fluide** : navigation par rôle sans redondance, hub de validation
   unique, design-system unifié.
4. **Règle métier** : une absence validée verrouille (grise) les jours dans le
   timesheet de présence ; le timesheet de présence EST la source du RPI.

## 2. Rôles et permissions (cible)

| Action | ADMIN | RESPONSABLE | CONSULTANT |
|---|:--:|:--:|:--:|
| Créer utilisateurs (consultant/responsable, rôle + mot de passe) | ✓ | ✗ | ✗ |
| Ajouter cabinet / BC | ✓ | ✓ | ✗ |
| Gérer les jours fériés (globaux) | ✓ | ✗ | ✗ |
| Valider/rejeter présence (RPI), absences, RA | ✓ | ✓ (cabinets assignés) | ✗ |
| Saisie déléguée (timesheet/absence d'un consultant) | ✓ | ✗ | ✗ |
| Saisir sa présence / son RA / ses demandes d'absence | ✓ (délégué) | ✗ | ✓ (soi) |
| Télécharger PDF RPI/RA | tous | ses cabinets | les siens |
| Dashboard | global | scopé cabinets assignés (conso + **facturation**) | soi |

- « Valider le RPI » = valider la présence du mois (pas d'entité RPI séparée).
- Un RESPONSABLE est un utilisateur (table `consultant`) avec `role=RESPONSABLE` et
  une association **N-N `cabinets_geres`** (assignée par l'Admin à la création).
  Son périmètre (dashboard, validation, documents) = consultants de ces cabinets.

## 3. Documents générés (source de vérité : samples)

### 3.1 RPI — template unifié « Relevé Périodique d'Intervention » (style CODA)
**Granularité : 1 consultant × 1 mois, TOUS BC confondus** (correction majeure :
l'implémentation actuelle est par BC).

Contenu (dans l'ordre) :
1. En-tête : titre centré ; bloc gauche Consultant / Société (cabinet) / Mission
   (désignation d'affectation) ; logos cabinet + CDG Capital à droite.
2. Tableau BC : `Référence BC | JH | Reliquat | Consommé | JH Restant`
   (Reliquat = restant avant le mois, vert ; JH Restant = après le mois, rouge).
3. `Période : 01/MM/AAAA au 31/MM/AAAA` ; `Total JH (mtd)` ; `Total JH (std)`.
4. **Blocs hebdomadaires** : semaines complètes lundi→dimanche **chevauchant les
   bords de mois** (ex. 30/12→05/01). En-tête noir : Consultant | Mission |
   L..D (avec dates) | Total | Total (Mtd) (colonnes rouges). Cellules : valeur JH
   (0 / 0.5 / 1), week-ends grisés, `JF` férié, `ABS` absence.
5. Légende Mtd (« Month to date ») / Std (« Start to date »).
6. **Double signature** : Responsable (gauche) + Consultant (droite) — images
   embarquées à la validation (cf. §5).
7. **Historique annuel** : tableau `BDC | Jours BDC | Total Consommé | Jours
   Restants | mois 1..12` + ligne Totaux (c'est la « Fiche de suivi »).

### 3.2 RA — template unifié « Rapport d'activité »
**Granularité : 1 consultant × 1 mois, tous BC.**
1. Titre + bloc Cabinet / Fonction / Intervenant.
2. `Période : <Mois AAAA>`.
3. **BDC Utilisés** : liste auto `<référence> : <n> Jours` (calculée depuis les
   saisies validées — jamais saisie à la main → cohérence RPI garantie).
4. **Tâches réalisées** : liste à puces libre, éditable par le consultant
   (pré-remplie depuis les descriptions des saisies validées, dédupliquées).
5. Double signature (identique au RPI).

**Impact modèle** : `RapportActivite` — clé unique `(consultant, mois, annee)`
(suppression du `bc` de la clé). Champ narratif principal `tachesRealisees`
(liste de puces) ; `syntheseMois/faitsMarquants/perspectives` fusionnés dans les
puces (suppression). Les données RA seedées (par BC×mois) sont purgées et
re-seedées par mois.

## 4. Règle métier absence / férié

- **Verrou explicite serveur** : `sauvegarderPointagesMensuels` rejette (400,
  message clair) toute présence BC sur un jour ayant une absence **VALIDE**
  (`AbsenceRepository.existsByConsultantIdAndDateAndStatut`, existant mais
  jamais appelé). Remplace le skip silencieux actuel.
- **Intégrité compteur** : `updateAbsenceStatus` — si le jour portait une présence
  VALIDE sur un BC, recréditer via `recalculerCompteursBC` avant d'écraser.
- **Absences en attente visibles** : le timesheet affiche (hachuré/jaune `ABS?`)
  les jours à demande EN_ATTENTE ; non verrouillés mais signalés.
- **Marquage d'absence dans la grille conservé** (un consultant déclare a
  posteriori un jour non travaillé) : ce marquage crée une **demande d'absence**
  (EN_ATTENTE) — même circuit que le formulaire. Une seule source de vérité.
- **Fériés** : nouvelle entité `JourFerie {date unique, libelle}`, CRUD **Admin**.
  Appliqués à tous : jours `JF` auto-verrouillés dans toutes les grilles, non
  pointables, comptés « férié » dans RPI. Suppression de la peinture manuelle.
- **Absence multi-jours** : la demande accepte `dateDebut/dateFin` ; création de
  N lignes `Absence` partageant un `demandeId` (UUID) ; validation/rejet groupés
  par `demandeId` en un clic.

## 5. Signatures

- Champ `signatureImage` (base64, colonne TEXT) sur l'utilisateur ; upload depuis
  la page profil (consultant et responsable).
- À la **validation** d'un mois de présence ou d'un RA, les PDF générés embarquent
  les deux signatures (consultant + responsable validateur) ; avant validation,
  blocs avec noms seuls.

## 6. Backend — Phase 1 (livrable seul)

B1. `Role` : + `RESPONSABLE` (enum STRING, zéro migration ; JWT/login déjà génériques).
B2. `SecurityConfig` (ordre spécifique→général) :
    `POST /api/admin/consultants` → ADMIN ; `/api/admin/jours-feries/**` → ADMIN ;
    `/api/admin/**` → ADMIN|RESPONSABLE ; reste inchangé.
B3. `RapportActiviteController` : `@PreAuthorize` → `hasAnyRole('ADMIN','RESPONSABLE')`.
B4. `AccessGuard` : RESPONSABLE passe si le consultant cible appartient à un de ses
    `cabinets_geres` (ADMIN bypass inchangé).
B5. Création d'utilisateur réparée : rôle + mot de passe + cabinets gérés (si
    RESPONSABLE) acceptés par l'API ; garde anti-escalade (seul ADMIN fixe un rôle).
B6. Règle absence (verrou explicite + recrédit BC) + absences EN_ATTENTE exposées.
B7. `JourFerie` : entité + CRUD admin + `GET /api/jours-feries?annee=` (authentifié).
B8. Absence multi-jours (`demandeId`) + endpoints de validation groupée.
B9. **RPI mensuel** : `GET /api/reports/rpi-mensuel?consultantId&annee&mois` →
    DTO conforme §3.1 (tableau BC, semaines L→D chevauchantes, mtd/std, historique
    annuel). `GET /api/reports/rpi/disponibles` → liste de **mois** (plus BC×mois).
    Les anciens endpoints par BC sont supprimés (remplacés).
B10. **RA mensuel** : entité re-clé `(consultant, mois, annee)` ; `GET/POST
    /api/rapports/activite` par mois ; « BDC Utilisés » calculés ; purge + re-seed
    des données RA de dev.
B11. `GET /api/validation/pending-counts` (ADMIN|RESPONSABLE, scopé) →
    `{pointages, absences, rapports}` pour les badges.
B12. Upload signature : `PUT /api/me/signature` (image base64) + exposition dans
    les DTO RPI/RA après validation.
B13. IDOR pré-existant : `POST /api/dashboard/timesheet/bulk` et
    `POST /api/dashboard/absences/demande` passent sous `AccessGuard`
    (consultant = soi ; ADMIN délégué).

## 7. Frontend — Phase 2

F1. **Navigation par rôle** (`App.jsx`, `PrivateRoute` 3 rôles) :
    - CONSULTANT : Dashboard · Ma Présence (RPI) · Mes Congés/Absences ·
      Mes Documents (RPI | RA) · Profil (signature).
    - RESPONSABLE : Dashboard équipe (conso + facturation, scopé) ·
      Validation (badges) · Référentiel (Cabinets, BC) · Documents · Profil.
    - ADMIN : Pilotage global · Validation · Administration (Cabinets,
      Utilisateurs, BC, Jours fériés) · Saisie déléguée · Documents · Profil.
F2. **Hub Validation** unique `/validation` (onglets Pointages·RPI / Absences /
    RA, compteurs, validation groupée par demandeId et par mois). Remplace les
    4 surfaces actuelles ; suppression `AbsenceValidation.jsx` (mort) et de
    l'onglet RA ligne-par-ligne d'`AdminPanel`.
F3. **Documents** : fusion `Rpi.jsx` + `RapportActivite.jsx` en un hub (sélection
    consultant/année/mois ; onglets RPI | RA ; export PDF).
F4. **Timesheet** : présence par BC + marquage absence (→ demande) ; fériés `JF`
    auto ; jours d'absence validée grisés/verrouillés ; timeline de statut du mois
    (Brouillon→Soumis→Validé/Rejeté + motif + « corriger & resoumettre ») ;
    « remplir la semaine / le mois avec ce BC » (jours libres uniquement) ;
    jauges budget BC avec alerte ≥ 80 %.
F5. **Dashboard Responsable** : cartes cabinet → consultants, conso JH, montants
    facturables (jours validés × TJM), BC proches de l'épuisement.
F6. **Générateurs PDF** refaits : `rpiPdfGenerator` (template §3.1) et
    `raPdfGenerator` (template §3.2) ; signatures embarquées ; logo cabinet
    (champ logo base64 sur Cabinet, upload admin). Suppression du 3ᵉ générateur
    (`pdfGenerator.js` timesheet) — un seul document de présence : le RPI.
F7. **Export « Fiche de suivi BC » (Excel)** : bouton Admin/Responsable ;
    endpoint JSON + génération client (lib `xlsx`) au format du fichier DDS
    (une feuille par consultant : BC × mois, absence, fériés, totaux).
F8. **Design-system** : tokens (`#003366` bleu, `#008858` vert primaire unique,
    `#C5A059` réservé aux accents data ; suppression `#2D6A4F`/`#1b4332`) ;
    composants partagés `PageHeader`, `StatCard`, `Button`, `Tabs`,
    `StatusBadge`, `Select` ; fin des styles inline ; radius/ombres unifiés.

## 8. Séquencement et vérification

1. **Phase 1 backend** (B1→B13) : compile après chaque bloc ; tests API
   (rôles 403/200, verrou absence 400, RPI mensuel = totaux xlsx, RA mensuel).
2. **Re-seed dev** : RA par mois ; comptes de test : 1 RESPONSABLE
   (`responsable@cdgcapital.ma`, cabinets CODA + UP Advisory assignés).
3. **Phase 2 frontend** (F1→F8) : build après chaque bloc ; test navigateur des
   3 rôles ; comparaison visuelle PDF générés vs samples (rendus poppler).

## 9. Risques

- Ordre des matchers SecurityConfig (spécifique avant générique) — sinon
  escalade RESPONSABLE→création d'utilisateurs.
- Cohérence `@PreAuthorize` vs règles URL (les deux doivent être alignés).
- Le passage RPI/RA « par BC » → « par mois » casse les endpoints/écrans actuels :
  remplacés dans la même phase, pas de période mixte.
- RESPONSABLE sans nav (frontend pas encore livré) : ne créer les comptes
  RESPONSABLE qu'après la Phase 2.
