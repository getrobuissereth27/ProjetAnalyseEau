// Fiabilité de POST /api/measurements : idempotence (mesure_uid), horodatage
// d'origine et authentification du Raspberry Pi par clé d'API de site.
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let Capteur, Site, Mesure, Alerte, Seuil;
let site, capteur;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'secret-de-test';
  await mongoose.connect(process.env.MONGODB_URI);
  app = require('../app');
  Capteur = require('../models/capteur.model');
  Site = require('../models/site.model');
  Mesure = require('../models/mesure.model');
  Alerte = require('../models/alerte.model');
  Seuil = require('../models/seuil.model');
  await Mesure.init(); // construit l'index unique avant les tests
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  delete process.env.CLE_API_OBLIGATOIRE;
  site = await Site.create({ nom: 'Site A' });
  capteur = await Capteur.create({ site_id: site._id, type: 'pH', modele: 'Test', unite: 'pH' });
});

afterEach(async () => {
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }
});

const poster = (corps, cle) => {
  const r = request(app).post('/api/measurements');
  if (cle) r.set('X-API-Key', cle);
  return r.send({ capteur_id: capteur._id.toString(), ...corps });
};

describe('idempotence', () => {
  test('un renvoi avec le même mesure_uid ne crée pas de doublon', async () => {
    const premiere = await poster({ valeur: 7.2, mesure_uid: 'uid-aaaa-0001' });
    const renvoi = await poster({ valeur: 7.2, mesure_uid: 'uid-aaaa-0001' });
    expect(premiere.status).toBe(201);
    expect(renvoi.status).toBe(200);
    expect(renvoi.body._id).toBe(premiere.body._id);
    expect(await Mesure.countDocuments()).toBe(1);
  });

  test('le renvoi d\'une mesure hors seuils ne crée pas une seconde alerte', async () => {
    await Seuil.create({ capteur_id: capteur._id, valeur_min: 6.5, valeur_max: 8.5 });
    await poster({ valeur: 12, mesure_uid: 'uid-bbbb-0002' }); // hors seuils : une alerte
    expect(await Alerte.countDocuments()).toBe(1);
    await poster({ valeur: 12, mesure_uid: 'uid-bbbb-0002' }); // renvoi : rien de plus
    expect(await Alerte.countDocuments()).toBe(1);
    expect(await Mesure.countDocuments()).toBe(1);
  });

  test('des mesure_uid différents créent bien deux mesures', async () => {
    await poster({ valeur: 7.2, mesure_uid: 'uid-cccc-0003' });
    await poster({ valeur: 7.2, mesure_uid: 'uid-cccc-0004' });
    expect(await Mesure.countDocuments()).toBe(2);
  });

  test('sans mesure_uid, le comportement reste celui d\'avant (compatibilité)', async () => {
    const a = await poster({ valeur: 7.2 });
    const b = await poster({ valeur: 7.2 });
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(await Mesure.countDocuments()).toBe(2);
  });

  test('deux envois simultanés du même mesure_uid donnent une seule mesure', async () => {
    const res = await Promise.all([
      poster({ valeur: 7.2, mesure_uid: 'uid-dddd-0005' }),
      poster({ valeur: 7.2, mesure_uid: 'uid-dddd-0005' }),
    ]);
    expect(res.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(await Mesure.countDocuments()).toBe(1);
  });

  test('refuse un mesure_uid mal formé', async () => {
    const res = await poster({ valeur: 7.2, mesure_uid: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('horodatage d\'origine', () => {
  test('conserve l\'horodatage envoyé par le client', async () => {
    const origine = new Date(Date.now() - 45 * 60 * 1000); // mesure prise il y a 45 minutes
    const res = await poster({ valeur: 7.2, horodatage: origine.toISOString() });
    expect(res.status).toBe(201);
    expect(new Date(res.body.horodatage).getTime()).toBe(origine.getTime());
  });

  test('sans horodatage, utilise l\'heure de réception', async () => {
    const avant = Date.now();
    const res = await poster({ valeur: 7.2 });
    expect(new Date(res.body.horodatage).getTime()).toBeGreaterThanOrEqual(avant - 1000);
  });

  test('refuse un horodatage dans le futur ou invalide', async () => {
    const futur = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect((await poster({ valeur: 7.2, horodatage: futur })).status).toBe(400);
    expect((await poster({ valeur: 7.2, horodatage: 'pas-une-date' })).status).toBe(400);
  });

  test('une mesure rejouée en retard ne devient pas la dernière mesure affichée', async () => {
    const bcrypt = require('bcryptjs');
    const Utilisateur = require('../models/utilisateur.model');
    await Utilisateur.create({
      nom: 'Resp', email: 'resp@test.local', role: 'communautaire', sites: [site._id],
      motDePasseHash: await bcrypt.hash('motdepasse123', 4),
    });
    const login = await request(app).post('/api/auth/login').send({ email: 'resp@test.local', motDePasse: 'motdepasse123' });

    await poster({ valeur: 7.5, horodatage: new Date().toISOString() });
    await poster({ valeur: 6.9, horodatage: new Date(Date.now() - 3600 * 1000).toISOString() }); // rejouée, plus ancienne
    const res = await request(app).get(`/api/measurements/latest?site=${site._id}`)
      .set('Authorization', `Bearer ${login.body.jeton}`);
    expect(res.body.find((m) => m.capteur_id === capteur._id.toString()).valeur).toBe(7.5);
  });
});

describe('clé d\'API du Raspberry Pi', () => {
  const { genererCle } = require('../middleware/cleapi.middleware');

  test('site sans clé : mesure acceptée (mode de transition)', async () => {
    expect((await poster({ valeur: 7.2 })).status).toBe(201);
  });

  test('site sans clé avec CLE_API_OBLIGATOIRE=true : refusée (401)', async () => {
    process.env.CLE_API_OBLIGATOIRE = 'true';
    expect((await poster({ valeur: 7.2 })).status).toBe(401);
  });

  test('site avec clé : refus sans clé ou avec une mauvaise clé, accepté avec la bonne', async () => {
    const { cle, hash } = genererCle();
    await Site.updateOne({ _id: site._id }, { cleApiHash: hash });

    expect((await poster({ valeur: 7.2 })).status).toBe(401);
    expect((await poster({ valeur: 7.2 }, 'mauvaise-cle')).status).toBe(401);
    expect(await Mesure.countDocuments()).toBe(0);
    expect((await poster({ valeur: 7.2 }, cle)).status).toBe(201);
  });

  test('la clé d\'un site ne permet pas d\'écrire sur un autre site', async () => {
    const { cle, hash } = genererCle();
    await Site.updateOne({ _id: site._id }, { cleApiHash: hash });
    const autreSite = await Site.create({ nom: 'Site B' });
    const { hash: hashB } = genererCle();
    await Site.updateOne({ _id: autreSite._id }, { cleApiHash: hashB });
    const capteurB = await Capteur.create({ site_id: autreSite._id, type: 'pH', modele: 'Test', unite: 'pH' });

    const res = await request(app).post('/api/measurements').set('X-API-Key', cle)
      .send({ capteur_id: capteurB._id.toString(), valeur: 7.2 });
    expect(res.status).toBe(401);
  });

  test('capteur inconnu : 404', async () => {
    const res = await request(app).post('/api/measurements')
      .send({ capteur_id: new mongoose.Types.ObjectId().toString(), valeur: 7.2 });
    expect(res.status).toBe(404);
  });

  test('la clé (ou son empreinte) n\'est jamais renvoyée par l\'API des sites', async () => {
    const { hash } = genererCle();
    await Site.updateOne({ _id: site._id }, { cleApiHash: hash });
    const lu = await Site.findById(site._id);
    expect(lu.cleApiHash).toBeUndefined();
  });
});
