import json
import os
import uuid

FICHIER_TAMPON = os.path.join(os.path.dirname(__file__), 'mesures_en_attente.jsonl')


def nouvel_identifiant():
    """Identifiant unique d'une mesure, attribué AVANT le premier envoi : le même
    identifiant est réutilisé à chaque rejeu, ce qui permet au serveur d'ignorer un doublon."""
    return uuid.uuid4().hex


def mettre_en_attente(capteur_id, valeur, horodatage, mesure_uid):
    with open(FICHIER_TAMPON, 'a') as f:
        f.write(json.dumps({
            'capteur_id': capteur_id,
            'valeur': valeur,
            'horodatage': horodatage,
            'mesure_uid': mesure_uid,
        }) + '\n')


def rejouer_mesures_en_attente(envoyer_fn):
    """Rejoue le tampon dans l'ordre chronologique. envoyer_fn(capteur_id, valeur,
    horodatage, mesure_uid) renvoie True si la mesure est acceptée par le serveur ;
    une mesure n'est retirée du tampon qu'à ce moment-là (livraison « au moins une fois »)."""
    if not os.path.exists(FICHIER_TAMPON):
        return

    with open(FICHIER_TAMPON, 'r') as f:
        lignes = [l for l in f.readlines() if l.strip()]

    if not lignes:
        return

    print(f"↻ {len(lignes)} mesure(s) en attente, tentative de renvoi...")
    restantes = []
    for ligne in lignes:
        mesure = json.loads(ligne)
        # Anciennes lignes du tampon (écrites avant l'idempotence) : on leur attribue un
        # identifiant, conservé si l'envoi échoue pour que les rejeux suivants le réutilisent.
        if not mesure.get('mesure_uid'):
            mesure['mesure_uid'] = nouvel_identifiant()
        if not envoyer_fn(mesure['capteur_id'], mesure['valeur'], mesure.get('horodatage'), mesure['mesure_uid']):
            restantes.append(json.dumps(mesure) + '\n')

    with open(FICHIER_TAMPON, 'w') as f:
        f.writelines(restantes)

    envoyees = len(lignes) - len(restantes)
    if envoyees:
        print(f"✔ {envoyees} mesure(s) en attente envoyée(s) avec succès")
