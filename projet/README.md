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
tester sans matériel), puis comment déployer le client sur le **vrai Raspberry Pi**.

## Fonctionnalités de l'interface web

- **Connexion réelle** (page `/connexion`) — le nom et le rôle affichés en haut à droite
  viennent du compte connecté, ce ne sont plus des valeurs figées dans le code
- **5 pages**, accessibles depuis la barre latérale :
  - `Tableau de bord` — une carte par capteur (valeur, état, et en petit les **seuils
    configurés** : « Seuil : 6.5 – 8.5 pH · Critique : 6 – 9 pH »), état de la vanne,
    graphique 7 jours et alertes les plus récentes
  - `Historique` — graphique 7 jours + tableau détaillé ; l'utilisateur choisit librement
    la **plage de dates** (« Du … au … ») et exporte cette plage en CSV ou Excel
  - `Alertes` — liste complète avec filtres (actives/résolues), **pagination** (15 par page),
    niveau (avertissement / critique) et alertes « capteur ne répond plus »
  - `Paramètres (admin)` — capteurs du site, seuils normaux et **critiques**, **délai sans
    mesure** avant de déclarer un capteur défectueux, destinataires des emails
  - `Utilisateurs (admin)` — comptes, rôles et attribution des sites (voir section 4ter)
- **Multi-sites avec droits par site** : chaque utilisateur ne voit que les sites qui lui
  sont attribués ; un super administrateur gère l'ensemble
- **Graphique** avec 4 courbes (pH, turbidité, température, conductivité), chacune mise à
  l'échelle indépendamment puisque leurs unités n'ont pas le même ordre de grandeur

---

## Option A — Avec Docker (le plus simple)

Si [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé,
donc **rien d'autre à installer** — pas de Node.js, pas de MongoDB, pas de Python
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

Ce script crée aussi 3 comptes de démonstration pour te connecter au tableau de bord :

| Email | Mot de passe | Rôle |
|---|---|---|
| `super.admin@demo.local` | `motdepasse123` | Super administrateur — tous les sites, crée les sites et les attribue |
| `genio.admin@demo.local` | `motdepasse123` | Administrateur du site 1 — « Paramètres » et « Utilisateurs » de son site |
| `caepa@demo.local` | `motdepasse123` | Responsable CAEPA du site 1 — consultation uniquement |

> Mot de passe oublié sur une base existante ? Remets tous les comptes à `motdepasse123` :
>
> ```bash
> docker compose exec backend node -e "const m=require('mongoose'),b=require('bcryptjs'),U=require('./models/utilisateur.model');m.connect(process.env.MONGODB_URI).then(async()=>{await U.updateMany({},{motDePasseHash:await b.hash('motdepasse123',10)});await m.disconnect()})"
> ```

C'est tout. Ouvre ensuite :
- Le tableau de bord : http://localhost:5174 (tu seras redirigé vers la page de connexion)
- L'API : http://localhost:3002/api/health (doit répondre `{"statut":"ok"}`)

**Simulation automatique :** `docker compose up` démarre aussi le conteneur
`simulateur`, qui envoie des mesures aléatoires réalistes toutes les 10 s — le
tableau de bord évolue donc tout seul, sans rien installer. Pour suivre ce qu'il
envoie : `docker compose logs -f simulateur`. Quand le vrai Raspberry Pi est
branché, arrête-le pour ne pas mélanger mesures simulées et réelles :
`docker compose stop simulateur`.

**Emails d'alerte simulés :** les emails envoyés aux destinataires (page
Paramètres) sont capturés par **Mailpit**, une fausse boîte mail — rien ne part
réellement. Consulte-les sur http://localhost:8025.

Le client Raspberry Pi (Python) peut aussi tourner **hors de Docker** — directement
sur le Raspberry Pi, ou sur ton ordinateur en simulation (voir section 2 plus bas).
Dans ce cas, arrête d'abord le conteneur `simulateur`, puis lance-le normalement :

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

Ensuite, pointe vers l'API (adapte selon ton OS) :

Linux / Mac :
```bash
API_URL=http://localhost:3002 python3 main.py
```
Windows (PowerShell) :
```powershell
$env:API_URL="http://localhost:3002"; python main.py
```

Pour arrêter les conteneurs :

```bash
docker compose down          # arrête tout
docker compose down -v       # arrête tout ET efface les données MongoDB
```

### Supprimer les images Docker et les reconstruire

Lance ces commandes depuis le dossier `projet/`.

**En gardant les données** (comptes, mesures, alertes) :

```bash
docker compose down --rmi local   # arrête les conteneurs et supprime les images backend et frontend
docker compose build --no-cache   # reconstruit les images sans réutiliser le cache
docker compose up -d              # redémarre tout en arrière-plan
```

L'image `mongo:7` est conservée, elle n'a donc pas besoin d'être retéléchargée.

**En repartant de zéro** — ⚠️ `-v` efface définitivement toutes les données MongoDB :

```bash
docker compose down --rmi local -v
docker compose build --no-cache
docker compose up -d
docker compose exec backend npm run seed   # recrée le site, les capteurs et les comptes de démonstration
```

Les capteurs recréés par le seed ont de nouveaux identifiants. Avant de relancer le client
Raspberry Pi, arrête-le et supprime `raspberry-client/mesures_en_attente.jsonl` si ce fichier existe.

Évite `docker system prune` pour ce nettoyage : cette commande concerne tous les projets
Docker de la machine, pas seulement celui-ci.

**Point de transparence** : cette configuration Docker a été vérifiée pour sa
cohérence (syntaxe YAML, ports et variables d'environnement, dépendances de l'image
de production) mais pas exécutée de bout en bout dans mon environnement de
préparation. Un premier test réel a d'ailleurs révélé que les numéros de port donnés
plus haut dans une version antérieure de ce README (3001 et 5173) ne correspondaient
pas à `docker-compose.yml` (3002 et 5174) — c'est corrigé ci-dessus. Si quelque chose
d'autre ne démarre pas comme prévu chez toi, montre-moi le message d'erreur exact et
on corrige ensemble.

### En cas de conflit de port

L'API est publiée sur le port **3002** (et non 3000) car ce dernier est souvent déjà
utilisé par un autre programme sur Windows. Si tu vois une erreur du type
`port is already allocated`, deux solutions :
1. Identifie et arrête le programme qui occupe le port concerné :
   `netstat -ano | findstr :3002` (Windows) puis `Stop-Process -Id <PID> -Force`
2. Ou change simplement le port dans `docker-compose.yml` (les deux occurrences
   `3002:3000` et `http://localhost:3002`) pour un autre numéro libre.

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
curl http://localhost:3000/api/health
# doit répondre {"statut":"ok"}
```

### Lancer les tests unitaires

```bash
npm test
```

---

## 2. Lancer le client Raspberry Pi (en simulation, sur ton ordinateur)

Le code détecte automatiquement l'absence de matériel (pas de bus SPI sur un PC/Mac) et
bascule en simulation — tu peux donc tester tout le pipeline sans capteur ni Raspberry Pi.

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

Ouvre l'URL affichée (en général http://localhost:5173) — tu dois voir les cartes de
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

Le même code qui tournait en simulation sur ton ordinateur lira maintenant les vrais
capteurs, car `adc.py` détecte automatiquement la présence de `spidev` sur le Raspberry Pi.

Pour un démarrage automatique au boot, voir le service systemd fourni dans le chapitre
déploiement du mémoire (`capteurs-eau.service`).

---

## 4bis. Automatisation : la vanne de distribution (LED)

Le système ferme automatiquement la vanne (simulée par une LED) dès qu'un paramètre
sort des seuils, et la rouvre dès que tout redevient normal — sans action humaine.

**Comment ça marche** : c'est le **serveur** qui décide (à partir des alertes actives
en base), pas le Raspberry Pi. À chaque cycle, le client interroge `GET /api/valve/state`
et met à jour la LED en conséquence — le Raspberry Pi ne fait qu'exécuter la décision.

**Câblage sur le vrai Raspberry Pi** : une LED + une résistance ~330 Ω entre le
**GPIO 17** (broche physique 11) et la masse (**GND**, par exemple broche physique 9).

```
GPIO 17 ──[résistance 330Ω]──▶│LED│── GND
```

- Sur ton ordinateur (sans matériel), `vanne.py` bascule automatiquement en simulation
  et affiche l'état dans le terminal (`🟢 OUVERTE` / `🔴 FERMÉE`) au lieu de piloter un
  vrai GPIO.
- Sur le vrai Raspberry Pi, installe en plus `RPi.GPIO` :
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

### Sites et utilisateurs

Un utilisateur appartient à **un ou plusieurs sites**, et un site a **plusieurs
utilisateurs** (y compris plusieurs administrateurs). Chacun ne voit que les sites qui lui
sont attribués : tableau de bord, historique, alertes, paramètres et liste des comptes.

| Action | Super administrateur | Administrateur | Responsable CAEPA |
|---|:---:|:---:|:---:|
| Consulter les données de ses sites | ✅ (tous les sites) | ✅ | ✅ |
| Créer un site | ✅ | ❌ | ❌ |
| **Attribuer / retirer des sites** à un compte | ✅ | ❌ | ❌ |
| Ajouter un administrateur | ✅ (sur les sites choisis) | ✅ (sur son site) | ❌ |
| Ajouter un responsable CAEPA | ✅ (sur les sites choisis) | ✅ (sur son site) | ❌ |
| Nommer un super administrateur | ✅ | ❌ | ❌ |
| Capteurs, seuils, destinataires email | ✅ | ✅ (ses sites) | ❌ |

Précisions :
- Le **super administrateur** attribue les sites depuis la page « Utilisateurs » : une liste
  déroulante « Choisir un site à attribuer » ajoute un site, le **×** le retire.
- Un compte créé par un **administrateur** est rattaché **automatiquement à son site**
  (le site sélectionné dans la barre latérale s'il en gère plusieurs). Seul le super
  administrateur peut ensuite l'ajouter à d'autres sites.
- Un administrateur ne peut modifier, changer le rôle ou supprimer un compte que si
  **tous** les sites de ce compte sont les siens, et il ne peut jamais toucher à un super
  administrateur.
- Au premier démarrage après la mise à jour, si aucun super administrateur n'existe, le
  plus ancien administrateur est promu automatiquement (voir
  `backend/services/migration.service.js`).

### Alertes et notifications

- **Hors seuil min / max** → alerte « avertissement » affichée, vanne fermée, **pas d'email**.
- **Au-delà du seuil critique** → l'alerte passe en « critique » et un email est envoyé une
  seule fois aux responsables du site (destinataires configurés dans « Paramètres » +
  utilisateurs rattachés au site). Sans seuil critique configuré, l'email part dès le seuil
  min / max. Les seuils critiques doivent être au-delà de la plage normale.
- **Capteur qui ne répond plus** : si un capteur n'envoie aucune mesure pendant plus de son
  **délai sans mesure** (en secondes, minimum 10, réglable par capteur dans « Paramètres »),
  il est déclaré défectueux, une alerte est créée et les responsables du site sont prévenus
  par email. Cette alerte ne ferme pas la vanne et se résout dès la mesure suivante.

Variables d'environnement associées (`backend/.env`, facultatives) :

| Variable | Défaut | Rôle |
|---|---|---|
| `DELAI_DEFAILLANCE_DEFAUT_S` | `300` | Délai sans mesure par défaut pour un nouveau capteur (secondes) |
| `SURVEILLANCE_INTERVALLE_MS` | `15000` | Fréquence de vérification des capteurs défaillants |

Avec Docker, les emails envoyés sont visibles dans Mailpit : http://localhost:8025.

### Gestion des sites

**Changer de site** : le sélecteur en bas de la barre latérale liste les sites
qui te sont attribués — un simple clic change instantanément toutes les données affichées.

**Ajouter un site** (réservé au super administrateur) : bouton "+ Ajouter un site" sous le
sélecteur, qui ouvre un petit formulaire (nom + localisation optionnelle).

**Rattacher des capteurs à un nouveau site** : après création d'un site, ses capteurs
ne sont pas créés automatiquement. Le plus simple : sélectionne le site dans la barre
latérale, puis « Paramètres » → « + Ajouter un capteur ». Par l'API, utilise
`POST /api/sensors` avec le `site_id` du nouveau site (visible dans `GET /api/sites`,
qui exige d'être connecté), par exemple :

```bash
# Remplace le port : 3002 avec Docker (Option A), 3000 sans Docker (Option B)
curl -X POST http://localhost:3002/api/sensors \
  -H "Authorization: Bearer <jeton_admin>" \
  -H "Content-Type: application/json" \
  -d '{"site_id":"<id_du_nouveau_site>","type":"pH","modele":"DFRobot Pro V2","unite":"pH","broche":"A2","delaiDefaillanceSecondes":300}'
```

Le jeton s'obtient avec `POST /api/auth/login` (`{"email": "...", "motDePasse": "..."}`),
avec un compte super administrateur ou administrateur de ce site.

Ou plus simplement, adapte `backend/scripts/seed.js` (variable `NOM_SITE_DEFAUT`) et
relance `npm run seed` pour créer un jeu complet de capteurs sur un nouveau site.

**Côté Raspberry Pi** : chaque appareil déployé sur le terrain doit connaître le site
auquel il appartient, via la variable `SITE_ID` (voir `raspberry-client/config.py`) :

```bash
export SITE_ID=<id_du_site>
python3 main.py
```

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
binaire MongoDB au premier lancement. Sur ton ordinateur avec un accès internet normal,
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
