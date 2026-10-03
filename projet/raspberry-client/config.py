import os

# URL de l'API. Pour tester sur ton ordinateur avec le backend lancé en local :
#   API_URL = "http://localhost:3000"
# Une fois déployé (chapitre déploiement) :
#   API_URL = "https://api-projet-eau.onrender.com"
API_URL = os.environ.get("API_URL", "http://localhost:3000")

TIMEOUT_SECONDES = 5
INTERVALLE_SECONDES = int(os.environ.get("INTERVALLE_SECONDES", "10"))

# Mode simulation : True = génère des valeurs aléatoires réalistes (pour tester
# sur un ordinateur sans capteurs branchés). False = lit les vrais capteurs
# (à utiliser sur le Raspberry Pi avec le matériel connecté).
# Se met automatiquement en simulation si les bibliothèques matérielles
# (spidev, w1thermsensor...) ne sont pas disponibles - voir capteurs.py.
FORCER_SIMULATION = os.environ.get("SIMULATION", "auto")  # "auto" | "true" | "false"

# Ces identifiants doivent correspondre aux _id MongoDB réels après le "npm run seed"
# du backend. Remplace-les par les vraies valeurs affichées lors du seed, ou
# laisse tel quel si tu utilises le mode simulation avec correspondance par nom (voir main.py).
# Identifiant MongoDB du site auquel ce Raspberry Pi est rattaché (affiché
# lors du "npm run seed" côté backend, ou visible sur la page /api/sites).
# Nécessaire dès que plusieurs sites existent, pour ne récupérer/piloter que
# les capteurs et la vanne de CE site précis.
SITE_ID = os.environ.get("SITE_ID", "")

CAPTEURS_ID = {
    "temperature": os.environ.get("ID_CAPTEUR_TEMPERATURE", ""),
    "ph": os.environ.get("ID_CAPTEUR_PH", ""),
    "turbidite": os.environ.get("ID_CAPTEUR_TURBIDITE", ""),
    "tds": os.environ.get("ID_CAPTEUR_TDS", ""),
}

# Port série de l'Arduino Mega. '*' = motif auto-détecté (utile car le port
# peut être /dev/ttyACM0 ou /dev/ttyACM1 selon l'ordre de branchement USB).
PORT_SERIE = os.environ.get("PORT_SERIE", "/dev/ttyACM*")
BAUDRATE = int(os.environ.get("BAUDRATE", "9600"))

# GPIO (numérotation BCM) de la LED simulant l'électrovanne
PIN_LED_VANNE = int(os.environ.get("PIN_LED_VANNE", "17"))
