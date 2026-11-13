const { verifierSeuil, niveauDepassement } = require('../services/analyse.service');
const Seuil = require('../models/seuil.model');
const Alerte = require('../models/alerte.model');
const Capteur = require('../models/capteur.model');
const Site = require('../models/site.model');
const { envoyerAlerteEmail } = require('../services/email.service');
const { emailsResponsablesSite } = require('../services/responsables.service');

jest.mock('../models/seuil.model');
jest.mock('../models/alerte.model');
jest.mock('../models/capteur.model');
jest.mock('../models/site.model');
jest.mock('../services/email.service');
jest.mock('../services/responsables.service');

const CAPTEUR = { _id: '1', actif: true, site_id: 's1', type: 'pH', unite: 'pH' };
const SEUIL_SIMPLE = { capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5, critique_min: null, critique_max: null };
const SEUIL_CRITIQUE = { capteur_id: '1', valeur_min: 6.5, valeur_max: 8.5, critique_min: 6, critique_max: 9 };

// La notification est envoyée en best-effort (non attendue par verifierSeuil) :
// on laisse les micro-ticks s'écouler avant de vérifier l'appel.
const laisserPasser = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  emailsResponsablesSite.mockResolvedValue([]);
  Site.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ nom: 'Site de test' }) });
  Capteur.findById.mockResolvedValue(CAPTEUR);
  Alerte.find.mockResolvedValue([]);
});

afterEach(() => jest.clearAllMocks());

describe('niveauDepassement', () => {
  test('dans la plage normale → null', () => {
    expect(niveauDepassement(7, SEUIL_CRITIQUE)).toBeNull();
  });
  test('hors plage normale mais avant le seuil critique → avertissement', () => {
    expect(niveauDepassement(8.8, SEUIL_CRITIQUE)).toBe('avertissement');
    expect(niveauDepassement(6.2, SEUIL_CRITIQUE)).toBe('avertissement');
  });
  test('au-delà du seuil critique → critique', () => {
    expect(niveauDepassement(9.3, SEUIL_CRITIQUE)).toBe('critique');
    expect(niveauDepassement(5.5, SEUIL_CRITIQUE)).toBe('critique');
  });
  test('sans seuil critique, tout dépassement est critique (comportement historique)', () => {
    expect(niveauDepassement(8.8, SEUIL_SIMPLE)).toBe('critique');
  });
  test('seuil critique défini d\'un seul côté', () => {
    const seuil = { valeur_min: 0, valeur_max: 5, critique_min: null, critique_max: 10 };
    expect(niveauDepassement(7, seuil)).toBe('avertissement');
    expect(niveauDepassement(-1, seuil)).toBe('critique');
  });
});

test("crée une alerte si la mesure dépasse le seuil max et qu'aucune alerte n'est déjà active", async () => {
  Seuil.findOne.mockResolvedValue(SEUIL_SIMPLE);

  await verifierSeuil({ _id: 'm1', capteur_id: '1', valeur: 9.2 });

  expect(Alerte.create).toHaveBeenCalledWith(expect.objectContaining({
    mesure_id: 'm1', capteur_id: '1', site_id: 's1', categorie: 'seuil', statut: 'active',
  }));
});

test("ne crée pas de doublon si une alerte est déjà active pour ce capteur", async () => {
  Seuil.findOne.mockResolvedValue(SEUIL_SIMPLE);
  Alerte.find.mockResolvedValue([{ _id: 'a0', statut: 'active', niveau: 'critique' }]);

  await verifierSeuil({ _id: 'm2', capteur_id: '1', valeur: 9.4 });

  expect(Alerte.create).not.toHaveBeenCalled();
});

test("ne crée pas d'alerte si la mesure est dans les seuils, et résout les alertes de seuil", async () => {
  Seuil.findOne.mockResolvedValue(SEUIL_SIMPLE);

  await verifierSeuil({ _id: 'm3', capteur_id: '1', valeur: 7.1 });

  expect(Alerte.create).not.toHaveBeenCalled();
  expect(Alerte.updateMany).toHaveBeenCalledWith(
    { capteur_id: '1', statut: 'active', categorie: 'seuil' },
    { statut: 'resolue', dateResolution: expect.any(Date) }
  );
});

test("ne fait rien si aucun seuil n'est défini pour ce capteur", async () => {
  Seuil.findOne.mockResolvedValue(null);

  const resultat = await verifierSeuil({ _id: 'm5', capteur_id: '99', valeur: 1000 });

  expect(resultat).toBeNull();
  expect(Alerte.create).not.toHaveBeenCalled();
  expect(Alerte.updateMany).not.toHaveBeenCalled();
});

test("ne fait rien si le capteur a été désactivé, même hors seuil", async () => {
  Seuil.findOne.mockResolvedValue(SEUIL_SIMPLE);
  Capteur.findById.mockResolvedValue({ ...CAPTEUR, actif: false });

  const resultat = await verifierSeuil({ _id: 'm6', capteur_id: '1', valeur: 12.0 });

  expect(resultat).toBeNull();
  expect(Alerte.create).not.toHaveBeenCalled();
});

test("hors plage normale mais sous le seuil critique : alerte « avertissement » SANS email", async () => {
  Seuil.findOne.mockResolvedValue(SEUIL_CRITIQUE);
  emailsResponsablesSite.mockResolvedValue(['resp@site.local']);

  await verifierSeuil({ _id: 'm7', capteur_id: '1', valeur: 8.8 });
  await laisserPasser();

  expect(Alerte.create).toHaveBeenCalledWith(expect.objectContaining({ niveau: 'avertissement', emailEnvoye: false }));
  expect(envoyerAlerteEmail).not.toHaveBeenCalled();
});

test("seuil critique dépassé : alerte « critique » ET email aux responsables du site", async () => {
  Seuil.findOne.mockResolvedValue(SEUIL_CRITIQUE);
  emailsResponsablesSite.mockResolvedValue(['admin@site.local', 'caepa@site.local']);

  await verifierSeuil({ _id: 'm8', capteur_id: '1', valeur: 9.6 });
  await laisserPasser();

  expect(Alerte.create).toHaveBeenCalledWith(expect.objectContaining({ niveau: 'critique', emailEnvoye: true }));
  expect(emailsResponsablesSite).toHaveBeenCalledWith('s1');
  expect(envoyerAlerteEmail).toHaveBeenCalledWith(expect.objectContaining({
    destinataires: ['admin@site.local', 'caepa@site.local'],
    type: 'pH',
    valeur: 9.6,
  }));
});

test("escalade : une alerte « avertissement » active qui devient critique est mise à jour et notifiée une fois", async () => {
  Seuil.findOne.mockResolvedValue(SEUIL_CRITIQUE);
  emailsResponsablesSite.mockResolvedValue(['resp@site.local']);
  const existante = { _id: 'a0', statut: 'active', niveau: 'avertissement', save: jest.fn().mockResolvedValue() };
  Alerte.find.mockResolvedValue([existante]);

  await verifierSeuil({ _id: 'm9', capteur_id: '1', valeur: 9.5 });
  await laisserPasser();

  expect(Alerte.create).not.toHaveBeenCalled();
  expect(existante.niveau).toBe('critique');
  expect(existante.mesure_id).toBe('m9');
  expect(existante.save).toHaveBeenCalled();
  expect(envoyerAlerteEmail).toHaveBeenCalledTimes(1);
});

test("pas de nouvel email si l'alerte active est déjà critique", async () => {
  Seuil.findOne.mockResolvedValue(SEUIL_CRITIQUE);
  emailsResponsablesSite.mockResolvedValue(['resp@site.local']);
  Alerte.find.mockResolvedValue([{ _id: 'a0', statut: 'active', niveau: 'critique', save: jest.fn() }]);

  await verifierSeuil({ _id: 'm10', capteur_id: '1', valeur: 9.9 });
  await laisserPasser();

  expect(envoyerAlerteEmail).not.toHaveBeenCalled();
});

test("n'appelle pas le service d'email si aucun responsable n'est configuré", async () => {
  Seuil.findOne.mockResolvedValue(SEUIL_SIMPLE);

  await verifierSeuil({ _id: 'm11', capteur_id: '1', valeur: 9.2 });
  await laisserPasser();

  expect(envoyerAlerteEmail).not.toHaveBeenCalled();
});
