# ConsulTrack

**ConsulTrack** est une application web complète de gestion des activités pour les consultants et les administrateurs. Elle permet de digitaliser le processus de suivi des temps (CRA), la gestion des absences et le suivi budgétaire des Bons de Commande (BC).

## Fonctionnalités Principales

### Espace Consultant
* **Saisie des Temps (CRA) :** Interface intuitive (calendrier visuel) pour saisir les jours travaillés, les absences et les jours fériés.
* **Contrôle Budgétaire :** Vérification en temps réel du solde restant sur le Bon de Commande actif.
* **Génération PDF :** Exportation du CRA mensuel au format PDF officiel.
* **Gestion des Absences :** Déclaration et suivi des demandes de congés.

### Espace Administrateur (Supervision)
* **Tableau de Bord Global :** Vue d'ensemble des consultants, des cabinets et des BC.
* **Validation :** Workflow de validation ou de rejet des CRA et des absences (avec validation atomique de mois entier).
* **Gestion Administrative :** CRUD pour les Consultants, Cabinets (ESN) et Bons de Commande.
* **Historique :** Accès à l'historique complet des activités et génération des PDF pour n'importe quelle période.

---

## Architecture

- **Backend** : Spring Boot 3.2 + Java 17 + PostgreSQL + Spring Security + JWT custom (JJWT 0.12)
- **Frontend** : React 19 + Vite + React Router 7 + Tailwind CSS + Axios + jsPDF

---

## Prérequis techniques

* **Java JDK 17** (ou version supérieure)
* **Node.js** v18+ et **npm**
* **Git**
* **PostgreSQL 14+**

> Note : Keycloak n'est plus requis depuis le refactor `fix/CRA-BC`. L'authentification est gérée en interne via JWT custom.

---

## Installation et Lancement

### 1. Base de données

```sql
CREATE DATABASE consult_track_db;
CREATE USER consult_track_user WITH PASSWORD 'admin';
GRANT ALL PRIVILEGES ON DATABASE consult_track_db TO consult_track_user;
```

### 2. Backend

```bash
cd ConsultTrack
mvn spring-boot:run     # port 8081
```

Au premier démarrage, les seeds sont créés automatiquement :
- Admin : `admin@cdgcapital.ma` / `admin123`
- Consultants : `y.boutkhourst@coda.com`, `a.elkassimi@coda.com` / `consultant123`

### 3. Frontend

```bash
cd ConsultTrackFront
npm install
npm run dev             # port 5173
```

Ouvrir [http://localhost:5173](http://localhost:5173).

---

## Authentification

L'application utilise **JWT signé HS256** (sans Keycloak). Le flux :

1. `POST /api/auth/login` avec `{email, password}` → reçoit `{token, user}`
2. Le frontend stocke le token en `localStorage` et l'ajoute automatiquement à chaque requête via un intercepteur axios
3. Backend valide la signature et place le rôle (`ROLE_ADMIN` ou `ROLE_CONSULTANT`) dans le contexte Spring Security

### Routes protégées

| Préfixe | Rôle requis |
|---|---|
| `/api/auth/**` | Public |
| `/api/public/**` | Public |
| `/api/admin/**` | `ROLE_ADMIN` |
| `/api/dashboard/**`, `/api/reports/**` | Authentifié |

---

## Documents annexes

- `ANALYSE.md` — Analyse technique détaillée (architecture, choix, dette technique)
- `MIGRATION.md` — Migration depuis l'ancienne version (étapes SQL, breaking changes)
