"""
Pilotage de la LED qui simule physiquement l'électrovanne.

Comme pour l'ADC (adc.py), le code détecte automatiquement s'il tourne sur un
vrai Raspberry Pi (bibliothèque RPi.GPIO disponible) ou sur un ordinateur de
test (bascule alors en simulation, avec un simple message dans le terminal).

Câblage prévu sur le vrai Raspberry Pi : LED + résistance ~330 ohms entre le
GPIO 17 et la masse (GND).
"""
from config import PIN_LED_VANNE

try:
    import RPi.GPIO as GPIO
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(PIN_LED_VANNE, GPIO.OUT)
    MATERIEL_DISPONIBLE = True
except (ImportError, RuntimeError):
    MATERIEL_DISPONIBLE = False
    print("⚠ RPi.GPIO indisponible : pilotage de la LED en mode simulation")

_dernier_etat_affiche = None


def appliquer_etat_vanne(etat):
    """etat: 'ouverte' ou 'fermee'. Allume la LED si fermée (alerte visible),
    l'éteint si ouverte (fonctionnement normal)."""
    global _dernier_etat_affiche

    led_allumee = (etat == 'fermee')

    if MATERIEL_DISPONIBLE:
        GPIO.output(PIN_LED_VANNE, GPIO.HIGH if led_allumee else GPIO.LOW)

    if etat != _dernier_etat_affiche:
        symbole = "🔴 FERMÉE (LED allumée)" if led_allumee else "🟢 OUVERTE (LED éteinte)"
        print(f"  → Vanne : {symbole}")
        _dernier_etat_affiche = etat


def nettoyer():
    if MATERIEL_DISPONIBLE:
        GPIO.cleanup()
