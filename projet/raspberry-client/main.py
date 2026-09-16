import time
from datetime import datetime, timezone

from capteurs import lire_toutes_les_mesures
from client_api import envoyer_mesure, recuperer_capteurs, recuperer_etat_vanne
from tampon import mettre_en_attente, rejouer_mesures_en_attente
from vanne import appliquer_etat_vanne, nettoyer
from config import INTERVALLE_SECONDES, CAPTEURS_ID, API_URL


def completer_capteurs_id():
    """
    Si config.py n'a pas les vrais identifiants MongoDB, on les récupère
    automatiquement depuis l'API (pratique pour tester rapidement après
    un 'npm run seed' côté backend, sans copier-coller les ObjectId à la main).
    """
    if all(CAPTEURS_ID.values()):
        return CAPTEURS_ID

    print("→ Récupération automatique des identifiants de capteurs depuis l'API...")
    capteurs_api = recuperer_capteurs()
    correspondance = {'temperature': 'temperature', 'ph': 'pH', 'turbidite': 'turbidite', 'tds': 'tds'}

    ids = dict(CAPTEURS_ID)
    for cle_locale, type_api in correspondance.items():
        if ids.get(cle_locale):
            continue
        trouve = next((c for c in capteurs_api if c['type'] == type_api), None)
        if trouve:
            ids[cle_locale] = trouve['_id']
            print(f"  {cle_locale} → {trouve['_id']}")
        else:
            print(f"  ⚠ Capteur '{type_api}' introuvable côté API (as-tu lancé 'npm run seed' ?)")
    return ids


def cycle_de_mesure(capteurs_id):
    mesures = lire_toutes_les_mesures()
    lectures = {
        capteurs_id.get('temperature'): mesures['temperature'],
        capteurs_id.get('ph'): mesures['ph'],
        capteurs_id.get('turbidite'): mesures['turbidite'],
        capteurs_id.get('tds'): mesures['tds'],
    }

    horodatage = datetime.now(timezone.utc).isoformat()
    for capteur_id, valeur in lectures.items():
        if valeur is None or not capteur_id:
            continue
        print(f"  {capteur_id} = {valeur}")
        if not envoyer_mesure(capteur_id, valeur):
            mettre_en_attente(capteur_id, valeur, horodatage)


def mettre_a_jour_la_vanne():
    """Demande au serveur l'état actuel (calculé à partir des alertes actives)
    et met à jour la LED en conséquence — l'automatisation à proprement parler."""
    info = recuperer_etat_vanne()
    if info is None:
        return
    appliquer_etat_vanne(info['etat'])
    if info['etat'] == 'fermee':
        params = ', '.join(p['type'] for p in info['parametresHorsLimite'])
        print(f"    Paramètre(s) en cause : {params}")


if __name__ == '__main__':
    print(f"Client de mesure — API cible : {API_URL}")
    print(f"Intervalle : {INTERVALLE_SECONDES}s — Ctrl+C pour arrêter\n")

    capteurs_id = completer_capteurs_id()

    try:
        while True:
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Cycle de mesure")
            rejouer_mesures_en_attente(envoyer_mesure)
            cycle_de_mesure(capteurs_id)
            mettre_a_jour_la_vanne()
            time.sleep(INTERVALLE_SECONDES)
    except KeyboardInterrupt:
        print("\nArrêt du client, nettoyage des GPIO...")
        nettoyer()
