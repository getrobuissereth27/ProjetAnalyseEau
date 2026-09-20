const { verifierSeuil } = require('../services/analyse.service');
const Seuil = require('../models/seuil.model');
const Alerte = require('../models/alerte.model');
const Mesure = require('../models/mesure.model');
const Capteur = require('../models/capteur.model');
const Destinataire = require('../models/destinataire.model');
const Site = require('../models/site.model');
const { envoyerAlerteEmail } = require('../services/email.service');

jest.mock('../models/seuil.model');
jest.mock('../models/alerte.model');
jest.mock('../models/mesure.model');
jest.mock('../models/capteur.model');
jest.mock('../models/destinataire.model');
jest.mock('../models/site.model');
jest.mock('../services/email.service');

// Petit utilitaire pour éviter de répéter cette chaîne .select() dans chaque test.
function mockDestinataires(liste) {
  Destinataire.find.mockReturnValue({ select: jest.fn().mockResolvedValue(liste) });
}

beforeEach(() => {
  // Par défaut, aucun destinataire configuré : la notification par email est
  // silencieusement ignorée, sauf dans les tests qui la testent explicitement.
  mockDestinataires([]);
});

afterEach(() => jest.clearAllMocks());

test("crée une alerte si la mesure dépasse le seuil max et qu'aucune alerte n'est déjà active", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
  Capteur.findById.mockResolvedValue({ actif: true, site_id: 's1', type: 'pH', unite: 'pH' });
  Mesure.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  Alerte.find.mockResolvedValue([]); // aucune alerte active existante

  const mesure = { _id: 'm1', capteur_id: '1', valeur: 9.2 };
  await verifierSeuil(mesure);

  expect(Alerte.create).toHaveBeenCalledWith(
    expect.objectContaining({ mesure_id: 'm1', statut: 'active' })
  );
});

test("ne crée pas de doublon si une alerte est déjà active pour ce capteur", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
  Capteur.findById.mockResolvedValue({ actif: true, site_id: 's1', type: 'pH', unite: 'pH' });
  Mesure.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'm0' }]) });
  Alerte.find.mockResolvedValue([{ _id: 'a0', statut: 'active' }]); // déjà une alerte active

  const mesure = { _id: 'm2', capteur_id: '1', valeur: 9.4 };
  await verifierSeuil(mesure);

  expect(Alerte.create).not.toHaveBeenCalled();
});

test("ne crée pas d'alerte si la mesure est dans les seuils", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
  Capteur.findById.mockResolvedValue({ actif: true, site_id: 's1', type: 'pH', unite: 'pH' });
  Mesure.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  Alerte.find.mockResolvedValue([]);

  const mesure = { _id: 'm3', capteur_id: '1', valeur: 7.1 };
  await verifierSeuil(mesure);

  expect(Alerte.create).not.toHaveBeenCalled();
  expect(Alerte.updateMany).not.toHaveBeenCalled();
});

test("résout les alertes actives quand la mesure revient dans les seuils", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
  Capteur.findById.mockResolvedValue({ actif: true, site_id: 's1', type: 'pH', unite: 'pH' });
  Mesure.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'm0' }]) });
  Alerte.find.mockResolvedValue([{ _id: 'a0', statut: 'active' }]);

  const mesure = { _id: 'm4', capteur_id: '1', valeur: 7.3 };
  await verifierSeuil(mesure);

  expect(Alerte.updateMany).toHaveBeenCalledWith(
    { _id: { $in: ['a0'] } },
    { statut: 'resolue', dateResolution: expect.any(Date) }
  );
});

test("ne fait rien si aucun seuil n'est défini pour ce capteur", async () => {
  Seuil.findOne.mockResolvedValue(null);
  Capteur.findById.mockResolvedValue({ actif: true, site_id: 's1' });

  const mesure = { _id: 'm5', capteur_id: '99', valeur: 1000 };
  const resultat = await verifierSeuil(mesure);

  expect(resultat).toBeNull();
  expect(Alerte.create).not.toHaveBeenCalled();
  expect(Alerte.updateMany).not.toHaveBeenCalled();
});

test("ne fait rien si le capteur a été désactivé, même hors seuil", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
  Capteur.findById.mockResolvedValue({ actif: false, site_id: 's1' });

  const mesure = { _id: 'm6', capteur_id: '1', valeur: 12.0 };
  const resultat = await verifierSeuil(mesure);

  expect(resultat).toBeNull();
  expect(Alerte.create).not.toHaveBeenCalled();
});

test("envoie un email aux destinataires actifs du site quand une nouvelle alerte est créée", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
  Capteur.findById.mockResolvedValue({ actif: true, site_id: 's1', type: 'pH', unite: 'pH' });
  Mesure.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  Alerte.find.mockResolvedValue([]);
  Alerte.create.mockResolvedValue({ _id: 'a1' });
  mockDestinataires([{ email: 'admin@demo.local' }, { email: 'caepa@demo.local' }]);
  Site.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ nom: 'Site de test' }) });

  const mesure = { _id: 'm7', capteur_id: '1', valeur: 9.2 };
  await verifierSeuil(mesure);

  // La notification est envoyée en best-effort (non attendue par verifierSeuil) :
  // on laisse le micro-tick courant s'écouler avant de vérifier l'appel.
  await new Promise((r) => setImmediate(r));

  expect(envoyerAlerteEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      destinataires: ['admin@demo.local', 'caepa@demo.local'],
      type: 'pH',
    })
  );
});

test("n'appelle pas le service d'email si aucun destinataire n'est configuré", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
  Capteur.findById.mockResolvedValue({ actif: true, site_id: 's1', type: 'pH', unite: 'pH' });
  Mesure.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  Alerte.find.mockResolvedValue([]);
  Alerte.create.mockResolvedValue({ _id: 'a2' });
  // mockDestinataires([]) déjà appliqué par le beforeEach

  const mesure = { _id: 'm8', capteur_id: '1', valeur: 9.2 };
  await verifierSeuil(mesure);
  await new Promise((r) => setImmediate(r));

  expect(envoyerAlerteEmail).not.toHaveBeenCalled();
});
