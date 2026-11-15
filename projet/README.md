# Système de surveillance de la qualité de l'eau potable

Projet de Travail de Fin d'Études — architecture centralisée (Node.js + MongoDB).

```
projet/
├── docker-compose.yml   Orchestration Docker (MongoDB, backend, frontend, Mailpit, simulateur)
├── backend/             API Node.js + MongoDB
├── frontend/            Tableau de bord React
├── raspberry-client/    Client Python du Raspberry Pi (vrai matériel ou simulation)
└── capteurs_eau.ino     Programme Arduino Mega qui lit les 4 capteurs
```

```
Capteurs → Arduino Mega → (USB série) → Raspberry Pi → (HTTPS) → API Node.js → MongoDB
                                                                       ↓
                                                         Analyse des seuils → alertes, emails, vanne
                                                                       ↓
                                                              Tableau de bord web
```

## Fonctionnalités

- **Connexion** (page `/connexion`) avec rôles et droits par site
- **Tableau de bord** — une carte par capteur (pH, turbidité, température, TDS) avec sa
  valeur, son état et ses seuils, l'état de la vanne, le graphique 7 jours et les
  dernières alertes
- **Historique** — graphique et tableau sur une plage de dates au choix, export CSV / Excel
- **Alertes** — liste filtrable (actives / résolues), paginée, avec niveau
  (avertissement / critique) et alertes « capteur ne répond plus »
- **Paramètres (admin)** — capteurs, seuils normaux et critiques, délai sans mesure,
  destinataires des emails
- **Utilisateurs (admin)** — comptes, rôles et attribution des sites
- **Multi-sites** — chaque utilisateur ne voit que ses sites ; un super administrateur gère l'ensemble

---

## Démarrage avec Docker (recommandé)

Seul [Docker Desktop](https://www.docker.com/products/docker-desktop/) est nécessaire.
Depuis le dossier `projet/` :

```bash
docker compose up -d --build
docker compose exec backend npm run seed   # site, capteurs, seuils et comptes de démo
```

| Service | Adresse |
|---|---|
| Tableau de bord | http://localhost:5174 |
| API (test) | http://localhost:3002/api/health → `{"statut":"ok"}` |
| Mailpit (emails d'alerte) | http://localhost:8025 |

Comptes créés par le seed :

| Email | Mot de passe | Rôle |
|---|---|---|
| `super.admin@demo.local` | `motdepasse123` | Super administrateur — tous les sites |
| `genio.admin@demo.local` | `motdepasse123` | Administrateur du site 1 |
| `caepa@demo.local` | `motdepasse123` | Responsable CAEPA du site 1 — consultation |

Pour remplir l'historique avec 7 jours de mesures fictives (graphiques, alertes) :

```bash
docker compose exec backend npm run donnees:demo
```

> Mot de passe oublié ? Remet tous les comptes à `motdepasse123` :
>
> ```bash
> docker compose exec backend node -e "const m=require('mongoose'),b=require('bcryptjs'),U=require('./models/utilisateur.model');m.connect(process.env.MONGODB_URI).then(async()=>{await U.updateMany({},{motDePasseHash:await b.hash('motdepasse123',10)});await m.disconnect()})"
> ```

### Arrêter / reconstruire

```bash
docker compose down              # arrête tout (les données sont conservées)
docker compose down -v           # arrête tout ET efface les données MongoDB
```

Reconstruire les images après une modification du code :

```bash
docker compose down --rmi local
docker compose build --no-cache
docker compose up -d
```

Après un `down -v`, relance `docker compose exec backend npm run seed`. Les capteurs
recréés ont de nouveaux identifiants : supprime `raspberry-client/mesures_en_attente.jsonl`
s'il existe avant de relancer un client Python.

### Conflit de port

L'API est publiée sur le port **3002** (le 3000 est souvent occupé sous Windows). En cas
d'erreur `port is already allocated`, trouve le programme qui occupe le port
(`netstat -ano | findstr :3002`, puis `Stop-Process -Id <PID> -Force`) ou change le port
dans `docker-compose.yml` (`3002:3000` et `http://localhost:3002`).

---

## Simulateur de mesures

`docker compose up` démarre le conteneur `simulateur` : il envoie une mesure aléatoire
réaliste pour chaque capteur toutes les 10 s, et déclenche de temps en temps un **pic
critique** (un paramètre sort des seuils critiques pendant 3 cycles). On voit ainsi toute
la chaîne : alerte critique → email dans Mailpit → fermeture de la vanne → résolution
automatique.

| Action | Commande |
|---|---|
| Démarrer | `docker compose start simulateur` |
| Arrêter | `docker compose stop simulateur` |
| Redémarrer | `docker compose restart simulateur` |
| Suivre les mesures envoyées | `docker compose logs -f simulateur` |
| Appliquer une modification du code | `docker compose up -d --build simulateur` |

Réglages dans `docker-compose.yml` (service `simulateur`) :

| Variable              | Défaut   | Rôle |
|-----------------------|------    |---|
| `INTERVALLE_SECONDES` | `10`     | Délai entre deux cycles de mesure |
| `PROBA_PIC_CRITIQUE`  | `0.05`   | Chance par cycle de déclencher un pic critique (`0` = jamais) |
| `DUREE_PIC_CYCLES`    | `3`      | Nombre de cycles que dure un pic |

**Arrête le simulateur dès que le vrai Raspberry Pi est branché**, pour ne pas mélanger
mesures simulées et réelles.

### Lancer le simulateur hors de Docker

Le même client Python peut tourner directement sur ton ordinateur (arrête d'abord le
conteneur `simulateur`). Sans Arduino branché, il passe automatiquement en simulation.

```bash
cd raspberry-client
python -m venv venv
source venv/bin/activate          # Linux / Mac
venv\Scripts\Activate.ps1         # Windows (PowerShell)
pip install -r requirements.txt
python main.py                    # démarre — Ctrl+C pour arrêter
```

Par défaut il vise l'API Docker (`http://localhost:3002`). Avec le backend lancé sans
Docker (`npm run dev`, port 3000) :

```bash
API_URL=http://localhost:3000 python3 main.py          # Linux / Mac
$env:API_URL="http://localhost:3000"; python main.py   # Windows (PowerShell)
```

Si PowerShell refuse le script d'activation (*"running scripts is disabled"*), lance une
fois `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

Si l'API est injoignable, les mesures sont stockées dans `mesures_en_attente.jsonl` et
renvoyées automatiquement au cycle suivant.

---

## Démarrage sans Docker

Prérequis : [Node.js](https://nodejs.org) 18+, [Python](https://python.org) 3.9+ et une base
MongoDB (locale ou [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)).

**Terminal 1 — backend**

```bash
cd backend
npm install
cp .env.example .env    # renseigne MONGODB_URI (local : mongodb://127.0.0.1:27017/eau)
npm run seed
npm run dev             # → ✔ API démarrée sur http://localhost:3000
```

Sans `SMTP_HOST` dans `.env`, les emails d'alerte sont seulement écrits dans les logs.

**Terminal 2 — frontend**

```bash
cd frontend
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:3000
npm run dev             # → http://localhost:5173
```

**Terminal 3 — simulateur** : voir [Lancer le simulateur hors de Docker](#lancer-le-simulateur-hors-de-docker),
avec `API_URL=http://localhost:3000`.

**Tests du backend** :

```bash
cd backend
npm test
```

---

## Déploiement sur le Raspberry Pi

L'Arduino Mega (programme `capteurs_eau.ino`) lit les 4 capteurs et envoie une ligne JSON
toutes les 2 s sur le port USB série. Le Raspberry Pi la relaie à l'API.

| Capteur | Broche Arduino |
|---|---|
| Température DS18B20 | D2 (+ résistance 4,7 kΩ entre DATA et 5V) |
| TDS Gravity | A1 |
| Turbidité SEN0189 | A0 |
| pH | A2 |

Sur le Raspberry Pi :

```bash
git clone <le-dépôt>
cd raspberry-client
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt   # inclut pyserial pour le port série
pip install RPi.GPIO              # pilotage de la LED de la vanne

export API_URL=https://api-projet-eau.onrender.com
export SITE_ID=<id_du_site>       # visible dans GET /api/sites
python3 main.py
```

Le client détecte l'Arduino sur `/dev/ttyACM*` et lit alors les vraies mesures.

| Variable | Défaut | Rôle |
|---|---|---|
| `API_URL` | `http://localhost:3002` | Adresse de l'API |
| `SITE_ID` | *(vide)* | Site auquel appartient ce Raspberry Pi |
| `PORT_SERIE` | `/dev/ttyACM*` | Port série de l'Arduino |
| `BAUDRATE` | `9600` | Vitesse série |
| `PIN_LED_VANNE` | `17` | GPIO (BCM) de la LED de la vanne |
| `INTERVALLE_SECONDES` | `10` | Délai entre deux envois |

### Vanne de distribution (LED)

Le **serveur** décide de l'état de la vanne à partir des alertes actives. À chaque cycle,
le client interroge `GET /api/valve/state` et allume ou éteint la LED. La vanne se ferme dès
qu'un paramètre sort de sa plage normale et se rouvre quand tout redevient normal.

Câblage : LED + résistance ~330 Ω entre le **GPIO 17** (broche 11) et **GND** (broche 9).

```
GPIO 17 ──[330Ω]──▶│LED│── GND
```

Sans matériel, l'état s'affiche dans le terminal (`🟢 OUVERTE` / `🔴 FERMÉE`).

---

## Alertes et notifications

- **Hors plage normale** → alerte « avertissement », vanne fermée, **pas d'email**.
- **Au-delà du seuil critique** → alerte « critique » et **un seul email** aux responsables
  du site (destinataires de « Paramètres » + utilisateurs rattachés au site). Sans seuil
  critique configuré, l'email part dès la sortie de la plage normale.
- **Capteur qui ne répond plus** : sans mesure pendant son délai (réglable par capteur,
  minimum 10 s), le capteur est déclaré défectueux, une alerte est créée et un email est
  envoyé. Cette alerte ne ferme pas la vanne et se résout à la mesure suivante.

Variables facultatives (`backend/.env`) :

| Variable | Défaut | Rôle |
|---|---|---|
| `DELAI_DEFAILLANCE_DEFAUT_S` | `300` | Délai sans mesure par défaut d'un nouveau capteur (s) |
| `SURVEILLANCE_INTERVALLE_MS` | `15000` | Fréquence de vérification des capteurs défaillants |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | — | Serveur d'envoi des emails |

---

## Sites et utilisateurs

Chaque site (point de captage) a ses propres capteurs, seuils, vanne et utilisateurs. Un
utilisateur peut appartenir à plusieurs sites et ne voit que ceux-là.

| Action | Super administrateur | Administrateur | Responsable CAEPA |
|---|:---:|:---:|:---:|
| Consulter les données de ses sites | ✅ (tous) | ✅ | ✅ |
| Créer un site | ✅ | ❌ | ❌ |
| Attribuer / retirer des sites à un compte | ✅ | ❌ | ❌ |
| Ajouter un administrateur ou un responsable CAEPA | ✅ | ✅ (sur son site) | ❌ |
| Nommer un super administrateur | ✅ | ❌ | ❌ |
| Capteurs, seuils, destinataires email | ✅ | ✅ (ses sites) | ❌ |

- **Changer de site** : sélecteur en bas de la barre latérale.
- **Ajouter un site** (super administrateur) : bouton « + Ajouter un site » sous le sélecteur.
- **Ajouter les capteurs d'un nouveau site** : sélectionne le site, puis « Paramètres » →
  « + Ajouter un capteur ».
- Un compte créé par un administrateur est rattaché automatiquement à son site. Un
  administrateur ne peut modifier ou supprimer un compte que si tous les sites de ce compte
  sont les siens, et jamais un super administrateur.
- Si aucun super administrateur n'existe au démarrage, le plus ancien administrateur est
  promu automatiquement (`backend/services/migration.service.js`).
