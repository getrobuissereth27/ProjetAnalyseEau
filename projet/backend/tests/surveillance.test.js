const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../services/email.service');

let mongod;
let app;
let Site, Capteur, Seuil, Alerte, Utilisateur, Destinataire;
let email, surveillance;
let siteTest;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'secret-de-test';
  await mongoose.connect(process.env.MONGODB_URI);

  app = require('../app');
  Site = require('../models/site.model');
  Capteur = require('../models/capteur.model');
  Seuil = require('../models/seuil.model');
  Alerte = require('../models/alerte.model');
  Utilisateur = require('../models/utilisateur.model');
  Destinataire = require('../models/destinataire.model');
  email = require('../services/email.service');
  surveillance = require('../services/surveillance.service');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  siteTest = await Site.create({ nom: 'Site de test' });
});

afterEach(async () => {
  jest.clearAllMocks();
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// La notification est lancée en best-effort (non attendue) et fait elle-même des
// requêtes en base : on lui laisse un court instant pour aboutir.
const laisserPasser = () => new Promise((r) => setTimeout(r, 150));
const ilYA = (secondes) => new Date(Date.now() - secondes * 1000);

test("un capteur silencieux au-delà de son délai est déclaré défectueux : alerte + email aux responsables du site", async () => {
  const hash = await bcrypt.hash('x', 4);
  await Utilisateur.create({ nom: 'Resp', email: 'resp@site.local', motDePasseHash: hash, role: 'communautaire', sites: [siteTest._id] });
  await Utilisateur.create({ nom: 'Autre', email: 'autre@site.local', motDePasseHash: hash, role: 'communautaire', sites: [] });
  await Destinataire.create({ site_id: siteTest._id, email: 'liste@site.local' });

  const capteur = await Capteur.create({
    site_id: siteTest._id, type: 'pH', modele: 'T', unite: 'pH',
    delaiDefaillanceSecondes: 60, dernierBattement: ilYA(90),
  });
  expect(capteur.statut).toBe('defectueux');

  const nouvelles = await surveillance.verifierCapteursDefaillants();
  await laisserPasser();

  expect(nouvelles).toHaveLength(1);
  const alerte = await Alerte.findOne({ capteur_id: capteur._id });
  expect(alerte.categorie).toBe('capteur_defaillant');
  expect(alerte.site_id.toString()).toBe(siteTest._id.toString());

  expect(email.envoyerAlerteCapteurDefaillant).toHaveBeenCalledTimes(1);
  const { destinataires } = email.envoyerAlerteCapteurDefaillant.mock.calls[0][0];
  expect(destinataires.sort()).toEqual(['liste@site.local', 'resp@site.local']);
});

test("respecte le délai configuré par capteur", async () => {
  await Capteur.create({
    site_id: siteTest._id, type: 'pH', modele: 'T', unite: 'pH',
    delaiDefaillanceSecondes: 300, dernierBattement: ilYA(90),
  });
  const nouvelles = await surveillance.verifierCapteursDefaillants();
  expect(nouvelles).toHaveLength(0);
});

test("une seule alerte (et un seul email) tant que le capteur reste silencieux", async () => {
  await Capteur.create({
    site_id: siteTest._id, type: 'pH', modele: 'T', unite: 'pH',
    delaiDefaillanceSecondes: 30, dernierBattement: ilYA(60),
  });
  await surveillance.verifierCapteursDefaillants();
  await surveillance.verifierCapteursDefaillants();
  expect(await Alerte.countDocuments({ categorie: 'capteur_defaillant', statut: 'active' })).toBe(1);
});

test("ignore les capteurs désactivés et ceux qui n'ont jamais envoyé de mesure", async () => {
  await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'T', unite: 'pH', actif: false, delaiDefaillanceSecondes: 30, dernierBattement: ilYA(600) });
  await Capteur.create({ site_id: siteTest._id, type: 'tds', modele: 'T', unite: 'ppm', delaiDefaillanceSecondes: 30 });
  expect(await surveillance.verifierCapteursDefaillants()).toHaveLength(0);
});

test("l'alerte de défaillance se résout dès qu'une mesure est de nouveau reçue, sans fermer la vanne", async () => {
  const capteur = await Capteur.create({
    site_id: siteTest._id, type: 'pH', modele: 'T', unite: 'pH',
    delaiDefaillanceSecondes: 30, dernierBattement: ilYA(60),
  });
  await surveillance.verifierCapteursDefaillants();

  const vanne = await request(app).get(`/api/valve/state?site=${siteTest._id}`);
  expect(vanne.body.etat).toBe('ouverte');

  await request(app).post('/api/measurements').send({ capteur_id: capteur._id.toString(), valeur: 7 });
  const alerte = await Alerte.findOne({ capteur_id: capteur._id });
  expect(alerte.statut).toBe('resolue');
});

describe('seuils critiques (intégration)', () => {
  let jeton;
  let capteur;

  beforeEach(async () => {
    const hash = await bcrypt.hash('motdepasse123', 4);
    await Utilisateur.create({ nom: 'Admin', email: 'admin@test.local', motDePasseHash: hash, role: 'administrateur', sites: [siteTest._id] });
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', motDePasse: 'motdepasse123' });
    jeton = `Bearer ${res.body.jeton}`;
    capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'T', unite: 'pH' });
  });

  test("l'administrateur configure des seuils critiques", async () => {
    const res = await request(app).put(`/api/thresholds/${capteur._id}`).set('Authorization', jeton)
      .send({ valeur_min: 6.5, valeur_max: 8.5, critique_min: 6, critique_max: 9 });
    expect(res.status).toBe(200);
    expect(res.body.critique_max).toBe(9);
  });

  test('refuse un seuil critique à l\'intérieur de la plage normale', async () => {
    const res = await request(app).put(`/api/thresholds/${capteur._id}`).set('Authorization', jeton)
      .send({ valeur_min: 6.5, valeur_max: 8.5, critique_max: 8 });
    expect(res.status).toBe(400);
  });

  test("l'email n'est envoyé qu'au franchissement du seuil critique", async () => {
    await Seuil.create({ capteur_id: capteur._id, valeur_min: 6.5, valeur_max: 8.5, critique_min: 6, critique_max: 9 });
    await Destinataire.create({ site_id: siteTest._id, email: 'liste@site.local' });

    await request(app).post('/api/measurements').send({ capteur_id: capteur._id.toString(), valeur: 8.8 });
    await laisserPasser();
    expect(email.envoyerAlerteEmail).not.toHaveBeenCalled();
    let alerte = await Alerte.findOne({ capteur_id: capteur._id, statut: 'active' });
    expect(alerte.niveau).toBe('avertissement');

    await request(app).post('/api/measurements').send({ capteur_id: capteur._id.toString(), valeur: 9.4 });
    await laisserPasser();
    expect(email.envoyerAlerteEmail).toHaveBeenCalledTimes(1);
    alerte = await Alerte.findOne({ capteur_id: capteur._id, statut: 'active' });
    expect(alerte.niveau).toBe('critique');
  });

  test("le délai de défaillance est configurable par l'administrateur (minimum 10 s)", async () => {
    const ok = await request(app).patch(`/api/sensors/${capteur._id}`).set('Authorization', jeton).send({ delaiDefaillanceSecondes: 120 });
    expect(ok.status).toBe(200);
    expect(ok.body.delaiDefaillanceSecondes).toBe(120);

    const refus = await request(app).patch(`/api/sensors/${capteur._id}`).set('Authorization', jeton).send({ delaiDefaillanceSecondes: 2 });
    expect(refus.status).toBe(400);
  });
});
