"""
Lecture des 4 capteurs et conversion en valeurs physiques.

Formules de conversion typiques (à réajuster après calibration réelle
avec les solutions tampon pH 4/7/10 et l'eau distillée - voir chapitre matériel).
"""
import glob
import random

from adc import lire_canal, brute_vers_tension, MATERIEL_DISPONIBLE
from config import CANAL_PH, CANAL_TURBIDITE, CANAL_TDS

try:
    _fichiers_temp = glob.glob('/sys/bus/w1/devices/28-*/w1_slave')
    TEMPERATURE_DISPONIBLE = len(_fichiers_temp) > 0
except Exception:
    TEMPERATURE_DISPONIBLE = False


def lire_temperature():
    if not TEMPERATURE_DISPONIBLE:
        return round(random.uniform(22.0, 27.0), 1)  # simulation
    fichier = glob.glob('/sys/bus/w1/devices/28-*/w1_slave')[0]
    with open(fichier, 'r') as f:
        lignes = f.readlines()
    if lignes[0].strip()[-3:] != 'YES':
        return None
    position = lignes[1].find('t=')
    return float(lignes[1][position + 2:]) / 1000.0


def lire_ph():
    if not MATERIEL_DISPONIBLE:
        return round(random.uniform(6.3, 8.8), 2)  # simulation, occasionnellement hors seuil
    tension = brute_vers_tension(lire_canal(CANAL_PH))
    pente = -5.70
    decalage = 21.34
    valeur = pente * tension + decalage
    return round(max(0, min(14, valeur)), 2)  # une valeur de pH est toujours entre 0 et 14


def lire_turbidite():
    if not MATERIEL_DISPONIBLE:
        return round(random.uniform(0.5, 6.5), 2)  # simulation, occasionnellement hors seuil
    tension = brute_vers_tension(lire_canal(CANAL_TURBIDITE))
    ntu = -1120.4 * tension**2 + 5742.3 * tension - 4353.8
    return round(max(ntu, 0), 2)


def lire_tds(temperature_c=25.0):
    if not MATERIEL_DISPONIBLE:
        return round(random.uniform(80, 380), 1)  # simulation
    tension = brute_vers_tension(lire_canal(CANAL_TDS))
    coefficient = 1.0 + 0.02 * (temperature_c - 25.0)
    tension_compensee = tension / coefficient
    tds = (133.42 * tension_compensee**3
           - 255.86 * tension_compensee**2
           + 857.39 * tension_compensee) * 0.5
    return round(max(tds, 0), 1)
