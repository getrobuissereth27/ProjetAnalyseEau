"""
Lecture des mesures envoyées par l'Arduino Mega via le port série USB.

L'Arduino fait toute la lecture des capteurs et envoie une ligne JSON toutes
les 2 secondes, ex. {"temperature":24.5,"turbidity":12.3,"tds":345.2,"ph":6.85}

Comme pour les autres modules matériels du projet, bascule automatiquement
en simulation si aucun Arduino n'est détecté (pratique pour tester le
pipeline sur un ordinateur sans matériel branché).
"""
import glob
import json
import os
import random
import time

from config import PORT_SERIE, BAUDRATE

try:
    import serial
    _candidats = glob.glob(PORT_SERIE) if '*' in PORT_SERIE else [PORT_SERIE]
    _port_trouve = next((p for p in _candidats if p), None)
    if not _port_trouve:
        raise FileNotFoundError("Aucun port série ne correspond à PORT_SERIE")
    _liaison = serial.Serial(_port_trouve, BAUDRATE, timeout=2)
    time.sleep(2)  # laisse le temps à l'Arduino de redémarrer après l'ouverture du port
    _liaison.reset_input_buffer()
    _liaison.readline()  # ignore une première ligne potentiellement déjà partielle
    MATERIEL_DISPONIBLE = True
    print(f"✔ Arduino détecté sur {_port_trouve}")
except (ImportError, FileNotFoundError, OSError):
    MATERIEL_DISPONIBLE = False
    print("⚠ Arduino indisponible : lecture des capteurs en mode simulation")

_dernieres_mesures = None  # dernière lecture valide, réutilisée si une ligne série est corrompue

# --- Pics critiques simulés -------------------------------------------------
# À chaque cycle, une chance sur ~20 (PROBA_PIC_CRITIQUE) de déclencher un
# incident : un paramètre tiré au hasard sort franchement des seuils critiques
# pendant DUREE_PIC_CYCLES cycles, puis revient à la normale. Cela permet de
# voir la chaîne complète en démo : alerte critique -> email (Mailpit) ->
# fermeture de la vanne -> résolution automatique. Mettre 0 pour désactiver.
PROBA_PIC_CRITIQUE = float(os.environ.get('PROBA_PIC_CRITIQUE', '0.05'))
DUREE_PIC_CYCLES = int(os.environ.get('DUREE_PIC_CYCLES', '3'))

# Valeurs hors des seuils critiques par défaut (voir backend/scripts/seed.js)
VALEURS_PIC = {
    'temperature': lambda: random.uniform(36.0, 40.0),
    'ph': lambda: random.choice([random.uniform(1.0, 1.8), random.uniform(11.5, 12.5)]),
    'turbidite': lambda: random.uniform(9.0, 12.0),
    'tds': lambda: random.uniform(470, 550),
}
DECIMALES = {'temperature': 1, 'ph': 2, 'turbidite': 2, 'tds': 1}

_pic_parametre = None
_pic_cycles_restants = 0


def _mesures_simulees():
    global _pic_parametre, _pic_cycles_restants

    mesures = {
        'temperature': random.uniform(22.0, 27.0),
        'ph': random.uniform(6.3, 8.8),
        'turbidite': random.uniform(0.5, 6.5),
        'tds': random.uniform(80, 380),
    }

    if _pic_cycles_restants == 0 and random.random() < PROBA_PIC_CRITIQUE:
        _pic_parametre = random.choice(list(VALEURS_PIC))
        _pic_cycles_restants = DUREE_PIC_CYCLES
        print(f"  ⚡ Simulation : pic critique sur '{_pic_parametre}' pendant {DUREE_PIC_CYCLES} cycle(s)")

    if _pic_cycles_restants > 0:
        mesures[_pic_parametre] = VALEURS_PIC[_pic_parametre]()
        _pic_cycles_restants -= 1

    return {cle: round(v, DECIMALES[cle]) for cle, v in mesures.items()}


def lire_mesures():
    """Retourne un dict {temperature, ph, turbidite, tds} — réel ou simulé."""
    global _dernieres_mesures

    if not MATERIEL_DISPONIBLE:
        return _mesures_simulees()

    ligne = _liaison.readline().decode('utf-8', errors='ignore').strip()
    try:
        donnees = json.loads(ligne)
        _dernieres_mesures = {
            'temperature': donnees['temperature'],
            'ph': donnees['ph'],
            'turbidite': donnees['turbidity'],
            'tds': donnees['tds'],
        }
    except (json.JSONDecodeError, KeyError):
        print(f"⚠ Ligne série invalide ignorée : {ligne!r}")

    return _dernieres_mesures or {'temperature': None, 'ph': None, 'turbidite': None, 'tds': None}
