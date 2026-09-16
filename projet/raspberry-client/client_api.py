import requests
from config import API_URL, TIMEOUT_SECONDES, SITE_ID


def envoyer_mesure(capteur_id, valeur):
    if not capteur_id:
        print("⚠ capteur_id manquant — as-tu lancé 'npm run seed' côté backend et rempli config.py ?")
        return False

    payload = {'capteur_id': capteur_id, 'valeur': valeur}
    try:
        reponse = requests.post(f'{API_URL}/api/mesures', json=payload, timeout=TIMEOUT_SECONDES)
        reponse.raise_for_status()
        return True
    except requests.exceptions.RequestException as erreur:
        print(f"✘ Échec d'envoi ({capteur_id}) : {erreur}")
        return False


def recuperer_capteurs():
    """Récupère la liste des capteurs enregistrés côté API (utile pour l'auto-config).
    Filtré par SITE_ID si renseigné, pour ne récupérer que les capteurs de ce site."""
    try:
        params = {'site': SITE_ID} if SITE_ID else {}
        reponse = requests.get(f'{API_URL}/api/capteurs', params=params, timeout=TIMEOUT_SECONDES)
        reponse.raise_for_status()
        return reponse.json()
    except requests.exceptions.RequestException as erreur:
        print(f"✘ Impossible de récupérer les capteurs : {erreur}")
        return []


def recuperer_etat_vanne():
    """Interroge l'API pour savoir si la vanne doit être ouverte ou fermée.
    C'est le serveur qui décide (à partir des alertes actives DE CE SITE) — le
    Raspberry Pi ne fait qu'appliquer cette décision sur la LED."""
    try:
        params = {'site': SITE_ID} if SITE_ID else {}
        reponse = requests.get(f'{API_URL}/api/vanne/etat', params=params, timeout=TIMEOUT_SECONDES)
        reponse.raise_for_status()
        return reponse.json()
    except requests.exceptions.RequestException as erreur:
        print(f"✘ Impossible de récupérer l'état de la vanne : {erreur}")
        return None
