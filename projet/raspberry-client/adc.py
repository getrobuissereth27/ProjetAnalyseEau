"""
Lecture du convertisseur ADC (MCP3008).

Sur un ordinateur normal (pas de bus SPI), la bibliothèque spidev ne
s'importe pas : on bascule alors automatiquement en simulation, pour
pouvoir tester tout le reste du pipeline (calcul, envoi API, tampon)
sans matériel branché.
"""
import random

try:
    import spidev
    _spi = spidev.SpiDev()
    _spi.open(0, 0)
    _spi.max_speed_hz = 1350000
    MATERIEL_DISPONIBLE = True
except (ImportError, FileNotFoundError):
    MATERIEL_DISPONIBLE = False
    print("⚠ spidev indisponible : lecture ADC en mode simulation")


def lire_canal(canal):
    """Retourne une valeur brute 0-1023, réelle ou simulée."""
    if MATERIEL_DISPONIBLE:
        cmd = [1, (8 + canal) << 4, 0]
        reponse = _spi.xfer2(cmd)
        return ((reponse[1] & 3) << 8) + reponse[2]
    # Simulation : valeur brute plausible avec un peu de bruit
    return random.randint(400, 600)


def brute_vers_tension(valeur_brute, vref=3.3):
    return (valeur_brute / 1023.0) * vref
