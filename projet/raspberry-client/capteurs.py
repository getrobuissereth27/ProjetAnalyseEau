"""
Expose les mesures des 4 capteurs (température, pH, turbidité, TDS),
désormais lues depuis l'Arduino Mega via le module arduino.py.

Toute la conversion tension → valeur physique se fait maintenant côté
Arduino (voir capteurs_eau.ino) — ce module ne fait plus que relayer
la dernière lecture reçue.
"""
from arduino import lire_mesures


def lire_toutes_les_mesures():
    """Une seule lecture série renvoie les 4 valeurs d'un coup."""
    return lire_mesures()
