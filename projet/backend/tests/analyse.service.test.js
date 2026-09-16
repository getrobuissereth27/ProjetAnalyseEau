const { verifierSeuil } = require('../services/analyse.service');
const Seuil = require('../models/seuil.model');
const Alerte = require('../models/alerte.model');
const Mesure = require('../models/mesure.model');
const Capteur = require('../models/capteur.model');
const Site = require('../models/site.model');
const Destinataire = require('../models/destinataire.model');
const { envoyerAlerteEmail } = require('../services/email.service');

jest.mock('../models/seuil.model');
jest.mock('../models/alerte.model');
jest.mock('../models/mesure.model');
jest.mock('../models/capteur.model');
jest.mock('../models/site.model');
jest.mock('../models/destinataire.model');
jest.mock('../services/email.service');

// Attend la fin des envois de notification "fire-and-forget" déclenchés en
// arrière-plan par verifierSeuil, pour pouvoir vérifier leurs effets ensuite.
const laisserTournerLesPromesses = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  Capteur.findById.mockResolvedValue({ _id: '1', type: 'pH', unite: 'pH', site_id: 'site1' });
  Site.findById.mockResolvedValue({ _id: 'site1', nom: 'Site de test' });
  Destinataire.find.mockResolvedValue([{ email: 'admin@demo.local' }]);
  envoyerAlerteEmail.mockResolvedValue({ envoye: true });
});

afterEach(() => jest.clearAllMocks());

test("crée une alerte si la mesure dépasse le seuil max et qu'aucune alerte n'est déjà active", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
  Mesure.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  Alerte.find.mockResolvedValue([]); // aucune alerte active existante
  Alerte.create.mockResolvedValue({ _id: 'a1', type_alerte: 'Valeur hors seuil', horodatage: new Date() });

  const mesure = { _id: 'm1', capteur_id: '1', valeur: 9.2 };
  await verifierSeuil(mesure);
  await laisserTournerLesPromesses();

  expect(Alerte.create).toHaveBeenCalledWith(
    expect.objectContaining({ mesure_id: 'm1', statut: 'active' })
  );
});

test("ne crée pas de doublon si une alerte est déjà active pour ce capteur", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
  Mesure.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'm0' }]) });
  Alerte.find.mockResolvedValue([{ _id: 'a0', statut: 'active' }]); // déjà une alerte active

  const mesure = { _id: 'm2', capteur_id: '1', valeur: 9.4 };
  await verifierSeuil(mesure);

  expect(Alerte.create).not.toHaveBeenCalled();
});

test("ne crée pas d'alerte si la mesure est dans les seuils", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
  Mesure.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  Alerte.find.mockResolvedValue([]);

  const mesure = { _id: 'm3', capteur_id: '1', valeur: 7.1 };
  await verifierSeuil(mesure);

  expect(Alerte.create).not.toHaveBeenCalled();
  expect(Alerte.updateMany).not.toHaveBeenCalled();
});

test("résout les alertes actives quand la mesure revient dans les seuils", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
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

  const mesure = { _id: 'm5', capteur_id: '99', valeur: 1000 };
  const resultat = await verifierSeuil(mesure);

  expect(resultat).toBeNull();
  expect(Alerte.create).not.toHaveBeenCalled();
  expect(Alerte.updateMany).not.toHaveBeenCalled();
});

test("notifie par email les destinataires du site concerné lors d'une nouvelle alerte", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
  Mesure.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  Alerte.find.mockResolvedValue([]);
  Alerte.create.mockResolvedValue({ _id: 'a1', type_alerte: 'Valeur hors seuil', horodatage: new Date() });

  const mesure = { _id: 'm6', capteur_id: '1', valeur: 9.9 };
  await verifierSeuil(mesure);
  await laisserTournerLesPromesses();

  expect(envoyerAlerteEmail).toHaveBeenCalledWith(
    expect.objectContaining({ destinataires: ['admin@demo.local'] })
  );
});

test("n'envoie pas d'email si la mesure reste dans les seuils", async () => {
  Seuil.findOne.mockResolvedValue({ capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5 });
  Mesure.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  Alerte.find.mockResolvedValue([]);

  const mesure = { _id: 'm7', capteur_id: '1', valeur: 7.0 };
  await verifierSeuil(mesure);
  await laisserTournerLesPromesses();

  expect(envoyerAlerteEmail).not.toHaveBeenCalled();
});
