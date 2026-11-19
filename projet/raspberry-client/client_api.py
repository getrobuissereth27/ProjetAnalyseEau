import requests
from config import API_URL, TIMEOUT_SECONDES, SITE_ID, CLE_API


def envoyer_mesure(capteur_id, valeur, horodatage=None, mesure_uid=None):
    """Envoie une mesure à l'API. Renvoie True si elle est enregistrée (201) ou déjà
    connue du serveur (200 : doublon ignoré), False sinon.

    - mesure_uid : identifiant unique de CETTE mesure. Le renvoyer plusieurs fois (après
      un accusé de réception perdu) ne crée pas de doublon côté serveur.
    - horodatage : heure d'origine de la mesure (ISO 8601). Sans lui, le serveur
      utiliserait l'heure de réception, ce qui fausserait une mesure rejouée du tampon."""
    if not capteur_id:
        print("⚠ capteur_id manquant — as-tu lancé 'npm run seed' côté backend et rempli config.py ?")
        return False

    payload = {'capteur_id': capteur_id, 'valeur': valeur}
    if mesure_uid:
        payload['mesure_uid'] = mesure_uid
    if horodatage:
        payload['horodatage'] = horodatage
    entetes = {'X-API-Key': CLE_API} if CLE_API else {}
    try:
        reponse = requests.post(f'{API_URL}/api/measurements', json=payload, headers=entetes, timeout=TIMEOUT_SECONDES)
        if reponse.status_code == 401:
            print("✘ Clé d'API refusée par le serveur : vérifie la variable CLE_API (npm run cle:site côté backend)")
            return False
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
        reponse = requests.get(f'{API_URL}/api/sensors', params=params, timeout=TIMEOUT_SECONDES)
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
        reponse = requests.get(f'{API_URL}/api/valve/state', params=params, timeout=TIMEOUT_SECONDES)
        reponse.raise_for_status()
        return reponse.json()
    except requests.exceptions.RequestException as erreur:
        print(f"✘ Impossible de récupérer l'état de la vanne : {erreur}")
        return None
