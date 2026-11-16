// Validation des entrées par express-validator (voir middleware/validation.js)
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let Site;
let Capteur;
let siteTest;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'secret-de-test';
  await mongoose.connect(process.env.MONGODB_URI);

  app = require('../app');
  Site = require('../models/site.model');
  Capteur = require('../models/capteur.model');
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
});

async function jetonPour(role, sites) {
  const bcrypt = require('bcryptjs');
  const Utilisateur = require('../models/utilisateur.model');
  const motDePasseHash = await bcrypt.hash('motdepasse123', 4);
  await Utilisateur.create({ nom: 'Test', email: `${role}@test.local`, motDePasseHash, role, sites });
  const res = await request(app).post('/api/auth/login').send({ email: `${role}@test.local`, motDePasse: 'motdepasse123' });
  return res.body.jeton;
}

test('POST /api/measurements refuse une valeur non numérique', async () => {
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  const res = await request(app).post('/api/measurements').send({ capteur_id: capteur._id, valeur: 'abc' });
  expect(res.status).toBe(400);
  expect(res.body.erreur).toBe('La valeur doit être un nombre');
  expect(res.body.details[0].champ).toBe('valeur');
});

test('POST /api/measurements refuse un capteur_id mal formé (400 au lieu de 500)', async () => {
  const res = await request(app).post('/api/measurements').send({ capteur_id: 'pas-un-id', valeur: 7 });
  expect(res.status).toBe(400);
  expect(res.body.erreur).toBe('capteur_id invalide');
});

test('POST /api/measurements accepte toujours une mesure valide', async () => {
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  const res = await request(app).post('/api/measurements').send({ capteur_id: capteur._id.toString(), valeur: 7.2 });
  expect(res.status).toBe(201);
});

test("POST /api/auth/login refuse un objet à la place de l'email (injection NoSQL)", async () => {
  const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, motDePasse: 'x' });
  expect(res.status).toBe(400);
});

test('GET /api/alerts refuse un filtre statut sous forme d\'objet (injection NoSQL)', async () => {
  const jeton = await jetonPour('communautaire', [siteTest._id]);
  const res = await request(app)
    .get(`/api/alerts?site=${siteTest._id}&statut[$ne]=active`)
    .set('Authorization', 'Bearer ' + jeton);
  expect(res.status).toBe(400);
  expect(res.body.erreur).toBe('Statut invalide');
});

test('DELETE /api/sensors/:id refuse un identifiant mal formé', async () => {
  const jeton = await jetonPour('administrateur', [siteTest._id]);
  const res = await request(app).delete('/api/sensors/123').set('Authorization', 'Bearer ' + jeton);
  expect(res.status).toBe(400);
  expect(res.body.erreur).toBe('Identifiant invalide');
});

test("la validation passe après l'authentification : sans jeton, toujours 401", async () => {
  const res = await request(app).delete('/api/sensors/123');
  expect(res.status).toBe(401);
});

test('POST /api/recipients refuse un email invalide', async () => {
  const jeton = await jetonPour('administrateur', [siteTest._id]);
  const res = await request(app)
    .post('/api/recipients')
    .set('Authorization', 'Bearer ' + jeton)
    .send({ site_id: siteTest._id, email: 'pas-un-email' });
  expect(res.status).toBe(400);
  expect(res.body.erreur).toBe('Adresse email invalide');
});
