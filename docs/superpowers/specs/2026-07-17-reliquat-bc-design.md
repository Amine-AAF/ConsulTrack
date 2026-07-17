# Reliquat BC inter-années + masquage des consultants sans BC — Design

**Date** : 2026-07-17
**Branche** : fix/CRA-BC

## Problème

1. Le Pilotage Global (`getGlobalReport`) affiche une ligne pour **tous** les BC,
   quelle que soit l'année sélectionnée : un consultant dont la mission est terminée
   apparaît encore en 2026 avec 0 conso, car seuls les pointages sont filtrés par année.
2. Les BC sont rattachés à une année budgétaire. Quand des jours restent en fin
   d'année (reliquat), l'admin ou le responsable doit pouvoir **décider** que ces
   jours sont consommables l'année suivante, et le dashboard doit afficher
   « reliquat année précédente + BC de l'année en cours ».

## Décisions

| Question | Décision |
|---|---|
| Modèle de consommation du reliquat | **Même BC, prolongé** : le consultant continue de pointer sur le BC N−1 pendant l'année N. Pas de transfert, pas de BC artificiel. |
| Granularité | **Tout le reliquat** : un booléen d'autorisation ; le montant est toujours calculé, jamais stocké. |
| Emplacement de la décision | **Liste BC de l'AdminPanel** (admin = tout, responsable = ses cabinets, scopé serveur). |
| Portée du report | Une seule année (N−1 → N). Un reliquat 2024 n'apparaît pas en 2026. |

## Modèle de données

`BonDeCommande` gagne un champ :

```java
/** Reliquat consommable sur l'année budgétaire suivante (décision admin/responsable). */
private Boolean reportReliquat = false;
```

- `null` est traité comme `false`.
- Colonne créée automatiquement (`ddl-auto=update`).
- **Le reliquat n'est jamais stocké** : il vaut
  `joursMax − Σ(tâches VALIDE dont date.year < N)` au moment du calcul du rapport
  de l'année N. La décision (booléen) et le montant (calcul) sont indépendants :
  une validation tardive d'un pointage N−1 ajuste le reliquat sans intervention.

## Backend

### Endpoint de décision

`PUT /api/admin/bcs/{id}/report-reliquat` — body `{ "autorise": true|false }`
(PUT et non PATCH : `WebConfig.allowedMethods` n'autorise pas PATCH en CORS).

- Rôles : ADMIN, RESPONSABLE.
- RESPONSABLE : refus (`AccessDeniedException`) si le consultant du BC n'appartient
  pas à ses cabinets gérés (même garde que les autres actions admin scopées).
- Pas de validation sur le montant du reliquat : le booléen peut être posé à tout
  moment ; il n'a d'effet que si le reliquat calculé est > 0.

### `DashboardService.getGlobalReport(cabinetId, annee, viewer)`

Produit désormais :

1. **Une ligne par BC de l'année** : `anneeBudgetaire == annee`.
   C'est ce filtre qui masque les consultants sans BC sur l'année sélectionnée.
2. **Une ligne par reliquat reporté** : `anneeBudgetaire == annee − 1`
   ET `reportReliquat == true` ET reliquat calculé > 0. Cette ligne porte :
   - `reliquatAnneePrecedente = true`, `anneeOrigine = annee − 1` ;
   - `totalJoursBC` = reliquat calculé (jours consommables en N) ;
   - `joursConsommesYTD` / `mensuel` = pointages VALIDE de l'année N uniquement
     (logique existante inchangée) ;
   - `joursRestants` = reliquat − conso N.
3. **Compatibilité** : BC avec `anneeBudgetaire == null` → visible toutes les
   années (comportement actuel conservé). À backfiller manuellement.

Le rapport des années passées est inchangé : en 2025, le BC 2025 affiche son
enveloppe complète et sa conso 2025.

### DTO

`ConsultantDashboardDTO` gagne `reliquatAnneePrecedente` (boolean, défaut false)
et `anneeOrigine` (Integer, null hors reliquat).

### Sélecteur de BC du pointage

Le consultant ne doit pouvoir pointer, pour un mois de l'année N, que sur :
- les BC `anneeBudgetaire == N` (ou null, compat) ;
- les BC `anneeBudgetaire == N − 1` avec `reportReliquat == true`.

Filtrage appliqué dans `TimesheetForm.jsx` sur la liste `/admin/bcs` déjà chargée,
en fonction de l'année du mois affiché.

### Garde-fous existants suffisants

Le plafond de consommation reste `joursMax` du BC toutes années confondues,
déjà garanti par `joursEngages`. Aucun nouveau contrôle serveur de dépassement.

## Frontend

### AdminPanel — section Bons de Commande

Sur chaque BC dont `anneeBudgetaire < année courante` et reliquat calculé > 0 :
un interrupteur « Report reliquat sur N+1 », badge vert quand actif.
(Le reliquat affiché côté admin utilise les champs déjà exposés du BC :
`joursMax − joursConsommes`.)

### Dashboard Pilotage Global (et vue consultant)

- Les lignes reliquat portent un badge « Reliquat {anneeOrigine} » à côté de la
  référence BC (tableau Activité réalisée, cartes consultant, alertes).
- KPI, jauges, groupements par cabinet/consultant, export Excel : aucune logique
  nouvelle — les lignes reliquat sont des lignes ordinaires du rapport. L'export
  Excel suffixe la description avec « (Reliquat {anneeOrigine}) ».

## Hors périmètre

- Report partiel (nombre de jours choisi).
- Report en chaîne sur plus d'une année.
- Backfill automatique des `anneeBudgetaire` null.
- Facturation spécifique du reliquat (les pré-factures utilisent déjà les
  pointages par mois, indépendamment de l'année du BC).

## Tests (manuels, pas de suite de tests existante)

1. BC 2025 (10 j restants) non reporté → absent du pilotage 2026 ; consultant
   sans autre BC 2026 → n'apparaît plus du tout.
2. Activation du report → ligne « Reliquat 2025 » en 2026, enveloppe 10 j ;
   pointage 2026 sur ce BC visible dans la colonne du mois.
3. Rapport 2025 inchangé après activation du report.
4. RESPONSABLE : peut activer le report d'un BC de ses cabinets, refus (403) hors
   périmètre.
5. Timesheet 2026 : BC 2025 proposé uniquement si reporté ; BC 2026 toujours
   proposés.
