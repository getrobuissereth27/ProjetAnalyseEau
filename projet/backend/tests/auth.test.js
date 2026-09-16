const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let Utilisateur;
let Capteur;
let Site;
let siteTest;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'secret-de-test';
  await mongoose.connect(process.env.MONGODB_URI);

  app = require('../app');
  Utilisateur = require('../models/utilisateur.model');
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
});

async function creerUtilisateur(role) {
  const motDePasseHash = await bcrypt.hash('motdepasse123', 10);
  return Utilisateur.create({ nom: 'Test', email: `${role}@test.local`, motDePasseHash, role });
}

test('POST /api/auth/login refuse un mauvais mot de passe', async () => {
  await creerUtilisateur('administrateur');
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'administrateur@test.local', motDePasse: 'mauvais' });
  expect(res.status).toBe(401);
});

test('POST /api/auth/login renvoie un jeton pour des identifiants valides', async () => {
  await creerUtilisateur('communautaire');
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'communautaire@test.local', motDePasse: 'motdepasse123' });

  expect(res.status).toBe(200);
  expect(res.body.jeton).toBeDefined();
  expect(res.body.utilisateur.role).toBe('communautaire');
});

test('PUT /api/seuils/:id refuse sans jeton', async () => {
  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  const res = await request(app)
    .put(`/api/seuils/${capteur._id}`)
    .send({ valeur_min: 6, valeur_max: 8 });
  expect(res.status).toBe(401);
});

test('PUT /api/seuils/:id refuse un rôle communautaire', async () => {
  await creerUtilisateur('communautaire');
  const connexion = await request(app)
    .post('/api/auth/login')
    .send({ email: 'communautaire@test.local', motDePasse: 'motdepasse123' });

  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  const res = await request(app)
    .put(`/api/seuils/${capteur._id}`)
    .set('Authorization', `Bearer ${connexion.body.jeton}`)
    .send({ valeur_min: 6, valeur_max: 8 });

  expect(res.status).toBe(403);
});

test('PUT /api/seuils/:id autorise un rôle administrateur', async () => {
  await creerUtilisateur('administrateur');
  const connexion = await request(app)
    .post('/api/auth/login')
    .send({ email: 'administrateur@test.local', motDePasse: 'motdepasse123' });

  const capteur = await Capteur.create({ site_id: siteTest._id, type: 'pH', modele: 'Test', unite: 'pH' });
  const res = await request(app)
    .put(`/api/seuils/${capteur._id}`)
    .set('Authorization', `Bearer ${connexion.body.jeton}`)
    .send({ valeur_min: 6, valeur_max: 8 });

  expect(res.status).toBe(200);
  expect(res.body.valeur_min).toBe(6);
});
