# Migration — branche `fix/CRA-BC`

Document de référence pour le passage de l'ancien modèle au refactor de la branche `fix/CRA-BC`.

## ⚠️ Étape SQL manuelle obligatoire

Hibernate avec `ddl-auto=update` **ajoute** les colonnes mais **ne supprime jamais** les tables. Après avoir déployé le nouveau code, exécuter manuellement :

```sql
-- Supprime la table de l'ancien modèle (JourTravaille remplacé par TacheRealisee)
DROP TABLE IF EXISTS jour_travaille CASCADE;
```

## 🗑️ Code supprimé

### Backend
- `model/JourTravaille.java`
- `model/StatutSaisie.java`
- `repository/JourTravailleRepository.java`
- `service/TimesheetService.java`
- `controller/ConsultantController.java`
- `controller/AbsenceController.java`
- Sections "GESTION DES SAISIES" et `validerSaisie`/`rejeterSaisie` legacy d'`AdminService`

### Frontend
- `components/ActivityForm.jsx`
- `components/ActivityHistory.jsx`

### Endpoints supprimés
- `POST /api/consultant/saisir-jour`
- `GET /api/consultant/{id}/historique`
- `POST /api/consultant/absences/demander`
- `GET /api/consultant/absences/types`

Aucun consommateur frontend de ces endpoints. Si une intégration externe existe, prévenir.

## ➕ Colonnes ajoutées

### `bon_de_commande`
- `jours_engages` (DOUBLE, default 0.0) — somme des jours dont le statut est `EN_ATTENTE` ou `VALIDE`
- Distinction métier : `jours_consommes` = `VALIDE` seulement, `jours_engages` = `EN_ATTENTE` + `VALIDE`

### `tache_realisee`
- `motif_rejet` (VARCHAR) — au lieu de polluer `description_tache`

## 🔐 Authentification — changement de stratégie

**Avant** : Keycloak (OAuth2 resource server) sur `localhost:8080` — jamais déployé en pratique.
**Maintenant** : JWT custom signé HS256 via JJWT 0.12.

### Dépendances pom.xml
- **Ajouté** : `io.jsonwebtoken:jjwt-{api,impl,jackson}:0.12.6`
- **Supprimé** : `spring-boot-starter-oauth2-resource-server`

### Properties
- **Supprimé** : `spring.security.oauth2.resourceserver.jwt.issuer-uri`
- **Ajouté** :
  ```
  app.jwt.secret=<base64-256bits>
  app.jwt.expiration-ms=86400000
  ```

⚠️ **En prod : remplacer `app.jwt.secret`** par une vraie clé HMAC base64 256 bits. Génération :

```bash
openssl rand -base64 32
```

## 🔒 Sécurité activée

Endpoints exposés :
- `POST /api/auth/login` — public
- `/api/public/**` — public
- `/api/admin/**` — ROLE_ADMIN obligatoire
- Tout le reste — authentifié (n'importe quel rôle)

Le `permitAll()` en dur (DEV) a été remplacé par cette vraie config.

## 🗃️ Comptes de seed (DataInitializer)

Créés uniquement si la base est vide (idempotent) :

| Email | Mot de passe | Rôle |
|---|---|---|
| `admin@cdgcapital.ma` | `admin123` | ADMIN |
| `y.boutkhourst@coda.com` | `consultant123` | CONSULTANT |
| `a.elkassimi@coda.com` | `consultant123` | CONSULTANT |

⚠️ **À changer en prod**. Ces seeds sont uniquement pour le développement local.

## 🚀 Vérification post-déploiement

```bash
# 1. Tester l'API publique
curl http://localhost:8081/api/public/status

# 2. Tester le login
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cdgcapital.ma","password":"admin123"}'

# 3. Tester un endpoint protégé sans token → 401
curl -i http://localhost:8081/api/admin/consultants

# 4. Tester avec le token reçu (remplacer <TOKEN>)
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:8081/api/admin/consultants
```
