const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let Capteur;
let Site;
let siteTest;
let jeton;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'secret-de-test';
  await mongoose.connect(process.env.MONGODB_URI);

  app = require('../app');
  Capteur = require('../models/capteur.model');
  Site = require('../models/site.model');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

beforeEach(async () => {
  siteTest = await Site.create({ nom: 'Site de test' });
  jeton = await jetonPour('communautaire', [siteTest._id]);
});

// Les routes de lecture du tableau de bord exigent un compte rattaché au site.
async function jetonPour(role, sites) {
  const bcrypt = require('bcryptjs');
  const Utilisateur = require('../models/utilisateur.model');
  const motDePasseHash = await bcrypt.hash('motdepasse123', 4);
  await Utilisateur.create({ nom: 'Test', email: `${role}@test.local`, motDePasseHash, role, sites });
  const res = await request(app).post('/api/auth/login').send({ email: `${role}@test.local`, motDePasse: 'motdepasse123' });
  return res.body.jeton;
}

test("GET /api/health répond ok", async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body.statut).toBe('ok');
});

test("POST /api/measurements refuse une requête sans capteur_id", async () => {
  const res = await request(app).post('/api/measurements').send({ valeur: 7.2 });
  expect(res.status).toBe(400);
});

test("POST /api/measurements enregistre une mesure valide", async () => {
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });

  const res = await request(app)
    .post('/api/measurements')
    .send({ capteur_id: capteur._id.toString(), valeur: 7.2 });

  expect(res.status).toBe(201);
  expect(res.body.valeur).toBe(7.2);
});

test("GET /api/measurements/latest renvoie la dernière valeur par capteur", async () => {
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'temperature', modele: 'Test', unite: '°C' });
  await request(app).post('/api/measurements').send({ capteur_id: capteur._id.toString(), valeur: 24 });
  await request(app).post('/api/measurements').send({ capteur_id: capteur._id.toString(), valeur: 25.5 });

  const res = await request(app).get('/api/measurements/latest').set('Authorization', 'Bearer ' + jeton);

  expect(res.status).toBe(200);
  expect(res.body[0].valeur).toBe(25.5);
});

test("GET /api/measurements/latest?site=<id> ne renvoie que les capteurs de ce site", async () => {
  const autreSite = await Site.create({ nom: 'Autre site' });
  await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  await Capteur.create({ site_id: autreSite._id, type: 'pH', modele: 'Test', unite: 'pH' });

  const res = await request(app).get(`/api/measurements/latest?site=${siteTest._id}`).set('Authorization', 'Bearer ' + jeton);

  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
});

test("GET /api/measurements/latest refuse sans jeton", async () => {
  const res = await request(app).get('/api/measurements/latest');
  expect(res.status).toBe(401);
});

test("GET /api/measurements/latest refuse un site non attribué à l'utilisateur", async () => {
  const autreSite = await Site.create({ nom: 'Autre site' });
  const res = await request(app).get(`/api/measurements/latest?site=${autreSite._id}`).set('Authorization', 'Bearer ' + jeton);
  expect(res.status).toBe(403);
});

test("GET /api/measurements/latest sans ?site ne renvoie que les capteurs des sites de l'utilisateur", async () => {
  const autreSite = await Site.create({ nom: 'Autre site' });
  await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  await Capteur.create({ site_id: autreSite._id, type: 'tds', modele: 'Test', unite: 'ppm' });

  const res = await request(app).get('/api/measurements/latest').set('Authorization', 'Bearer ' + jeton);
  expect(res.body).toHaveLength(1);
  expect(res.body[0].type).toBe('pH');
});

test("GET /api/measurements/latest renvoie le seuil configuré de chaque capteur", async () => {
  const Seuil = require('../models/seuil.model');
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  await Seuil.create({ capteur_id: capteur._id, valeur_min: 6.5, valeur_max: 8.5, critique_min: 6, critique_max: 9 });

  const res = await request(app).get(`/api/measurements/latest?site=${siteTest._id}`).set('Authorization', 'Bearer ' + jeton);
  expect(res.body[0].seuil).toEqual({ valeur_min: 6.5, valeur_max: 8.5, critique_min: 6, critique_max: 9 });
});

test("GET /api/measurements/history?debut=&fin= ne renvoie que les mesures de la plage choisie", async () => {
  const Mesure = require('../models/mesure.model');
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  await Mesure.create([
    { capteur_id: capteur._id, valeur: 7.0, horodatage: new Date('2026-01-01T12:00:00Z') },
    { capteur_id: capteur._id, valeur: 7.1, horodatage: new Date('2026-01-05T12:00:00Z') },
    { capteur_id: capteur._id, valeur: 7.2, horodatage: new Date('2026-01-10T12:00:00Z') },
  ]);

  const res = await request(app)
    .get(`/api/measurements/history?capteur=${capteur._id}&debut=2026-01-02T00:00:00Z&fin=2026-01-09T23:59:59Z`)
    .set('Authorization', 'Bearer ' + jeton);

  expect(res.status).toBe(200);
  expect(res.body.map((m) => m.valeur)).toEqual([7.1]);
});

test("GET /api/measurements/history refuse une plage inversée", async () => {
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  const res = await request(app)
    .get(`/api/measurements/history?capteur=${capteur._id}&debut=2026-02-01T00:00:00Z&fin=2026-01-01T00:00:00Z`)
    .set('Authorization', 'Bearer ' + jeton);
  expect(res.status).toBe(400);
});
