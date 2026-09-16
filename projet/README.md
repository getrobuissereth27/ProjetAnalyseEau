# Système de surveillance de la qualité de l'eau potable

Projet de Travail de Fin d'Études — architecture centralisée (Node.js + MongoDB).

Ce dépôt contient les trois briques du système :

```
projet/
├── docker-compose.yml   Orchestration Docker (backend + frontend + MongoDB)
├── backend/            API Node.js + MongoDB (Dockerfile inclus)
├── raspberry-client/   Script Python (à lancer sur le Raspberry Pi ou en simulation, hors Docker)
└── frontend/           Tableau de bord React (Dockerfile inclus)
```

Ce guide explique comment tout faire tourner **d'abord sur un ordinateur** (pour
tester sans matériel), puis comment déployer le client sur un **Raspberry Pi**.

## Fonctionnalités de l'interface web

- **Connexion réelle** (page `/connexion`) — le nom et le rôle affichés en haut à droite
  viennent du compte connecté, ce ne sont plus des valeurs figées dans le code
- **4 pages fonctionnelles**, accessibles depuis la barre latérale :
  - `Tableau de bord` — cartes de mesures + aperçu du graphique + 15 alertes les plus récentes
  - `Historique` — graphique 7 jours + tableau détaillé par capteur, avec sélecteur de période
  - `Alertes` — liste complète avec filtres (actives/résolues) et **pagination** (15 par page)
  - `Paramètres (admin)` — configuration des seuils, **visible uniquement pour le rôle administrateur**
- **Graphique** avec 3 courbes (pH, turbidité, conductivité), chacune mise à l'échelle
  indépendamment puisque leurs unités n'ont pas le même ordre de grandeur

---

## Option A — Avec Docker (le plus simple)

Si [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé,
on n'as **rien d'autre à installer** — pas de Node.js, pas de MongoDB, pas de Python
pour le backend/frontend. Docker s'occupe de tout, y compris la base de données.

```bash
cd projet
docker compose up --build
```

Attends que les trois services démarrent (les logs s'affichent dans le terminal), puis
dans un **second terminal**, initialise les capteurs et leurs seuils :

```bash
docker compose exec backend npm run seed
```

Ce script crée aussi 2 comptes de démonstration pour te connecter au tableau de bord :

| Email | Mot de passe | Rôle |
|---|---|---|
| `caepa@demo.local` | `motdepasse123` | Responsable CAEPA |
| `admin@demo.local` | `motdepasse123` | Administrateur (accès à "Paramètres") |

C'est tout. Ouvre ensuite :
- Le tableau de bord : http://localhost:5173 (tu seras redirigé vers la page de connexion)
- L'API : http://localhost:3001/api/sante (doit répondre `{"statut":"ok"}`)

Le client Raspberry Pi (Python), lui, **reste hors de Docker** — il est fait pour
tourner directement sur le Raspberry Pi ou sur un ordinateur en simulation (voir
section 2 plus bas). Lance-le normalement :

```bash
cd raspberry-client
python -m venv venv

# Linux / Mac :
source venv/bin/activate
# Windows (PowerShell) :
venv\Scripts\Activate.ps1

pip install -r requirements.txt
python main.py    # "python3" sur Linux/Mac si "python" ne fonctionne pas
```

Si PowerShell refuse d'exécuter le script d'activation (message *"running scripts is
disabled on this system"*), lance une fois :
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
puis réessaie `venv\Scripts\Activate.ps1`.

Ensuite, pointe vers l'API (adapte selon l'OS) :

Linux / Mac :
```bash
API_URL=http://localhost:3001 python3 main.py
```
Windows (PowerShell) :
```powershell
$env:API_URL="http://localhost:3001"; python main.py
```

Pour arrêter les conteneurs :

```bash
docker compose down          # arrête tout
docker compose down -v       # arrête tout ET efface les données MongoDB
```

### En cas de conflit de port

L'API est publiée sur le port **3001** (et non 3000) car ce dernier est souvent déjà
utilisé par un autre programme sur Windows. Si il y a une erreur du type
`port is already allocated`, deux solutions :
1. Identifie et arrête le programme qui occupe le port concerné :
   `netstat -ano | findstr :3001` (Windows) puis `Stop-Process -Id <PID> -Force`
2. Ou change simplement le port dans `docker-compose.yml` (les deux occurrences
   `3001:3000` et `http://localhost:3001`) pour un autre numéro libre, ex. `3002`.

Après toute modification de `docker-compose.yml`, relance avec
`docker compose down` puis `docker compose up --build`.

---

## Option B — Sans Docker (installation manuelle)

## 0. Prérequis

- [Node.js](https://nodejs.org) 18 ou plus récent
- [Python](https://python.org) 3.9 ou plus récent
- Une base MongoDB accessible : soit installée en local, soit un cluster gratuit
  [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (recommandé, voir chapitre déploiement
  du mémoire — aucune installation locale nécessaire)

---

## 1. Lancer le backend (API)

```bash
cd backend
npm install
cp .env.example .env
```

Ouvre `.env` et renseigne `MONGODB_URI` :
- Base locale : `mongodb://127.0.0.1:27017/eau`
- MongoDB Atlas : colle la chaîne de connexion fournie par Atlas (menu "Connect")

Initialise les 4 capteurs et leurs seuils par défaut :

```bash
npm run seed
```

Démarre l'API :

```bash
npm run dev
```

Tu dois voir `✔ API démarrée sur http://localhost:3000`. Vérifie avec :

```bash
curl http://localhost:3000/api/sante
# doit répondre {"statut":"ok"}
```

### Lancer les tests unitaires

```bash
npm test
```

---

## 2. Lancer le client Raspberry Pi (en simulation, sur un ordinateur)

Le code détecte automatiquement l'absence de matériel (pas de bus SPI sur un PC/Mac) et
bascule en simulation — on peut donc tester tout le pipeline sans capteur ni Raspberry Pi.

```bash
cd raspberry-client
python -m venv venv

# Linux / Mac :
source venv/bin/activate
# Windows (PowerShell) :
venv\Scripts\Activate.ps1

pip install -r requirements.txt
python main.py     # "python3" sur Linux/Mac si "python" ne fonctionne pas
```

Le script va :
1. Aller chercher automatiquement les identifiants des 4 capteurs auprès de l'API (grâce au `npm run seed` précédent)
2. Générer des valeurs simulées réalistes toutes les 10 secondes
3. Les envoyer à l'API — tu verras les logs d'envoi dans le terminal

Si l'API n'est pas jointe (backend arrêté), les mesures sont écrites dans
`mesures_en_attente.jsonl` et renvoyées automatiquement au prochain cycle.

Pour changer l'URL de l'API ciblée sans modifier le code :

```bash
API_URL=http://localhost:3000 python3 main.py
```

---

## 3. Lancer le frontend (tableau de bord)

```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_URL=http://localhost:3000 par défaut
npm run dev
```

Ouvre l'URL affichée (en général http://localhost:5173) — on doit voir les cartes de
mesures se remplir au bout de quelques secondes (le temps que le client Raspberry Pi
envoie ses premières valeurs).

---

## 4. Déployer le client sur le vrai Raspberry Pi

Une fois le backend déployé (voir le chapitre déploiement du mémoire — Render +
MongoDB Atlas), sur le Raspberry Pi réel :

```bash
git clone <ton-dépôt>
cd raspberry-client
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install spidev                 # nécessaire uniquement sur le vrai matériel
```

(Le Raspberry Pi tourne sous Linux, donc `source venv/bin/activate` est la bonne
commande une fois sur le vrai appareil — les commandes Windows ci-dessus ne servent
que pour tester en simulation sur ton PC.)

Modifie `config.py` (ou exporte la variable d'environnement) pour pointer vers l'API
en production :

```bash
export API_URL=https://api-projet-eau.onrender.com
python3 main.py
```

Le même code qui tournait en simulation sur l'ordinateur lira maintenant les vrais
capteurs, car `adc.py` détecte automatiquement la présence de `spidev` sur le Raspberry Pi.

Pour un démarrage automatique au boot, voir le service systemd fourni dans le chapitre
déploiement du mémoire (`capteurs-eau.service`).

---

## 4bis. Automatisation : la vanne de distribution (LED)

Le système ferme automatiquement la vanne (simulée par une LED) dès qu'un paramètre
sort des seuils, et la rouvre dès que tout redevient normal — sans action humaine.

**Comment ça marche** : c'est le **serveur** qui décide (à partir des alertes actives
en base), pas le Raspberry Pi. À chaque cycle, le client interroge `GET /api/vanne/etat`
et met à jour la LED en conséquence — le Raspberry Pi ne fait qu'exécuter la décision.

**Câblage sur le Raspberry Pi** : une LED + une résistance ~330 Ω entre le
**GPIO 17** (broche physique 11) et la masse (**GND**, par exemple broche physique 9).

```
GPIO 17 ──[résistance 330Ω]──▶│LED│── GND
```

- Sur l' ordinateur (sans matériel), `vanne.py` bascule automatiquement en simulation
  et affiche l'état dans le terminal (`🟢 OUVERTE` / `🔴 FERMÉE`) au lieu de piloter un
  vrai GPIO.
- Sur le Raspberry Pi, installe en plus `RPi.GPIO` :
  ```bash
  pip install RPi.GPIO
  ```
- Le numéro de GPIO utilisé peut être changé sans toucher au code :
  ```bash
  export PIN_LED_VANNE=27
  ```

Sur le tableau de bord, un bandeau très visible (vert/rouge) indique en permanence
l'état de la vanne, avec le ou les paramètres en cause si elle est fermée.

---

## 4ter. Gérer plusieurs sites (points de captage)

Le système peut surveiller **plusieurs points de captage indépendants** — chacun
avec ses propres capteurs, ses propres seuils, sa propre vanne. Toutes les données
affichées (tableau de bord, historique, alertes, vanne) sont filtrées par site.

**Changer de site** : le sélecteur en bas de la barre latérale liste tous les sites
existants — un simple clic change instantanément toutes les données affichées.

**Ajouter un site** (réservé à l'administrateur) : bouton "+ Ajouter un site" sous le
sélecteur, qui ouvre un petit formulaire (nom + localisation optionnelle).

**Rattacher des capteurs à un nouveau site** : après création d'un site, ses capteurs
ne sont pas créés automatiquement. Utilise `POST /api/capteurs` avec le `site_id` du
nouveau site (visible dans `GET /api/sites`), par exemple :

```bash
curl -X POST http://localhost:3001/api/capteurs \
  -H "Authorization: Bearer <jeton_admin>" \
  -H "Content-Type: application/json" \
  -d '{"site_id":"<id_du_nouveau_site>","type":"pH","modele":"DFRobot Pro V2","unite":"pH","canal_adc":0}'
```

Ou plus simplement, adapte `backend/scripts/seed.js` (variable `NOM_SITE_DEFAUT`) et
relance `npm run seed` pour créer un jeu complet de capteurs sur un nouveau site.

**Côté Raspberry Pi** : chaque appareil déployé sur le terrain doit connaître le site
auquel il appartient, via la variable `SITE_ID` (voir `raspberry-client/config.py`) :

```bash
export SITE_ID=<id_du_site>
python3 main.py
```

---

## 4quater. Gestion des utilisateurs et notifications par email

### Gestion des comptes (page "Utilisateurs", admin uniquement)

Un administrateur peut créer, modifier (nom, email, rôle) et supprimer des comptes
depuis la page **Utilisateurs**. Deux garde-fous sont en place : impossible de
supprimer son propre compte, et le mot de passe ne se change jamais depuis cette
page (voir ci-dessous) — uniquement le rôle et les informations du compte.

### Changer son propre mot de passe

N'importe quel utilisateur connecté (admin ou responsable CAEPA) peut changer son
mot de passe en cliquant sur son badge en haut à droite de l'écran ("Mon compte").
L'ancien mot de passe est requis pour confirmer le changement.

### Alertes par email (page "Alertes email", admin uniquement)

Chaque site a sa propre liste de destinataires. Un email est envoyé automatiquement
à chaque adresse configurée dès qu'une nouvelle alerte se déclenche sur ce site — le
contenu de l'email reprend exactement les mêmes informations que le panneau de
détail d'une alerte dans l'interface (paramètre, valeur mesurée, seuil, date, état
de la vanne).

**Important : l'envoi d'email est désactivé par défaut.** Sans configuration SMTP,
le système fonctionne normalement (alertes, fermeture de vanne...) mais l'email
n'est pas réellement envoyé — un message apparaît simplement dans les logs du
backend à sa place. Pour activer l'envoi réel :

- **Sans Docker** : renseigne `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
  dans `backend/.env` (voir `backend/.env.example` pour un exemple avec Gmail).
- **Avec Docker** : crée un fichier `.env` à la **racine du projet** (à côté de
  `docker-compose.yml`, pas dans `backend/`) avec ces mêmes variables — Docker
  Compose les injecte automatiquement dans le conteneur backend.

---

## 5. Ordre de démarrage recommandé (test complet en local)

1. **Terminal 1** — `cd backend && npm run dev`
2. **Terminal 2** — `cd raspberry-client && python3 main.py` (mode simulation)
3. **Terminal 3** — `cd frontend && npm run dev`
4. Ouvrir le tableau de bord dans le navigateur et observer les valeurs arriver

---

## Limite connue de cet environnement de préparation

Les tests d'intégration du backend (`backend/tests/mesures.routes.test.js`) utilisent
une base MongoDB temporaire en mémoire (`mongodb-memory-server`), qui télécharge un
binaire MongoDB au premier lancement. Sur un ordinateur avec un accès internet normal,
`npm test` fonctionnera sans souci. Les tests unitaires purs (`analyse.service.test.js`,
sans base de données) ont déjà été vérifiés et passent.

---

## Rappel de l'architecture (voir mémoire, chapitre "Architecture")

```
Capteurs + Raspberry Pi → Internet (HTTPS) → API Node.js → MongoDB
                                                    ↓
                                          Module d'analyse (alertes)
                                                    ↓
                                     Interface web (accessible partout)
```
