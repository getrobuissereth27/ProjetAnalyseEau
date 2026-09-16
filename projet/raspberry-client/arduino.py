"""
Lecture des mesures envoyées par l'Arduino Mega via le port série USB.

Remplace l'ancien adc.py (MCP3008 en SPI direct sur le Pi) : l'Arduino fait
maintenant toute la lecture des capteurs et envoie une ligne JSON toutes les
2 secondes, ex. {"temperature":24.5,"turbidity":12.3,"tds":345.2,"ph":6.85}

Comme pour les autres modules matériels du projet, bascule automatiquement
en simulation si aucun Arduino n'est détecté (pratique pour tester le
pipeline sur un ordinateur sans matériel branché).
"""
import glob
import json
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


def lire_mesures():
    """Retourne un dict {temperature, ph, turbidite, tds} — réel ou simulé."""
    global _dernieres_mesures

    if not MATERIEL_DISPONIBLE:
        return {
            'temperature': round(random.uniform(22.0, 27.0), 1),
            'ph': round(random.uniform(6.3, 8.8), 2),
            'turbidite': round(random.uniform(0.5, 6.5), 2),
            'tds': round(random.uniform(80, 380), 1),
        }

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
