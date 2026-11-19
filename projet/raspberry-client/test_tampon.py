"""Tests du tampon local (python3 -m unittest test_tampon -v)."""
import json
import os
import tempfile
import unittest

import tampon


class TestTampon(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        tampon.FICHIER_TAMPON = os.path.join(self.dossier.name, 'attente.jsonl')

    def tearDown(self):
        self.dossier.cleanup()

    def lignes(self):
        with open(tampon.FICHIER_TAMPON) as f:
            return [json.loads(l) for l in f if l.strip()]

    def test_le_tampon_conserve_l_horodatage_et_l_identifiant(self):
        tampon.mettre_en_attente('c1', 7.2, '2026-11-17T10:00:00+00:00', 'abc12345')
        self.assertEqual(self.lignes(), [{
            'capteur_id': 'c1', 'valeur': 7.2,
            'horodatage': '2026-11-17T10:00:00+00:00', 'mesure_uid': 'abc12345'}])

    def test_le_rejeu_renvoie_l_horodatage_d_origine_et_le_meme_identifiant(self):
        tampon.mettre_en_attente('c1', 7.2, '2026-11-17T10:00:00+00:00', 'abc12345')
        recu = []
        tampon.rejouer_mesures_en_attente(lambda *a: recu.append(a) or True)
        self.assertEqual(recu, [('c1', 7.2, '2026-11-17T10:00:00+00:00', 'abc12345')])
        self.assertEqual(self.lignes(), [])

    def test_une_mesure_non_acceptee_reste_avec_le_meme_identifiant(self):
        tampon.mettre_en_attente('c1', 7.2, '2026-11-17T10:00:00+00:00', 'abc12345')
        tampon.rejouer_mesures_en_attente(lambda *a: False)
        tampon.rejouer_mesures_en_attente(lambda *a: False)
        self.assertEqual([m['mesure_uid'] for m in self.lignes()], ['abc12345'])

    def test_ancienne_ligne_sans_identifiant_en_recoit_un_qui_est_conserve(self):
        with open(tampon.FICHIER_TAMPON, 'w') as f:
            f.write(json.dumps({'capteur_id': 'c1', 'valeur': 7.0, 'horodatage': '2026-11-17T09:00:00+00:00'}) + '\n')
        tampon.rejouer_mesures_en_attente(lambda *a: False)
        uid = self.lignes()[0]['mesure_uid']
        self.assertTrue(uid)
        tampon.rejouer_mesures_en_attente(lambda *a: False)
        self.assertEqual(self.lignes()[0]['mesure_uid'], uid)

    def test_ordre_chronologique_conserve(self):
        for i in range(3):
            tampon.mettre_en_attente('c1', float(i), f'2026-11-17T10:0{i}:00+00:00', f'uid0000{i}')
        ordre = []
        tampon.rejouer_mesures_en_attente(lambda c, v, h, u: ordre.append(v) or True)
        self.assertEqual(ordre, [0.0, 1.0, 2.0])


if __name__ == '__main__':
    unittest.main()
