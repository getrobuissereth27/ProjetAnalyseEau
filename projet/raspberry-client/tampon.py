import json
import os

FICHIER_TAMPON = os.path.join(os.path.dirname(__file__), 'mesures_en_attente.jsonl')


def mettre_en_attente(capteur_id, valeur, horodatage):
    with open(FICHIER_TAMPON, 'a') as f:
        f.write(json.dumps({
            'capteur_id': capteur_id,
            'valeur': valeur,
            'horodatage': horodatage,
        }) + '\n')


def rejouer_mesures_en_attente(envoyer_fn):
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
        if not envoyer_fn(mesure['capteur_id'], mesure['valeur']):
            restantes.append(ligne)

    with open(FICHIER_TAMPON, 'w') as f:
        f.writelines(restantes)

    envoyees = len(lignes) - len(restantes)
    if envoyees:
        print(f"✔ {envoyees} mesure(s) en attente envoyée(s) avec succès")
