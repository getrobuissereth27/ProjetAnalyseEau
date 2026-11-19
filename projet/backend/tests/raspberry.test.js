const net = require('net');
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let Utilisateur, Site;
let site;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'secret-de-test';
  await mongoose.connect(process.env.MONGODB_URI);
  app = require('../app');
  Utilisateur = require('../models/utilisateur.model');
  Site = require('../models/site.model');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  site = await Site.create({ nom: 'Site A' });
});

afterEach(async () => {
  for (const key in mongoose.connection.collections) {
    await mongoose.connection.collections[key].deleteMany({});
  }
});

async function jeton(role, sites = []) {
  const email = `${role}@test.local`;
  const motDePasseHash = await bcrypt.hash('motdepasse123', 4);
  await Utilisateur.create({ nom: role, email, motDePasseHash, role, sites });
  const res = await request(app).post('/api/auth/login').send({ email, motDePasse: 'motdepasse123' });
  return `Bearer ${res.body.jeton}`;
}

test('le superadmin enregistre l\'adresse IP et le port du Raspberry d\'un site', async () => {
  const sup = await jeton('superadmin');
  const res = await request(app).patch(`/api/sites/${site._id}`).set('Authorization', sup)
    .send({ ipRaspberry: ' 192.168.1.50 ', portRaspberry: '2222' });
  expect(res.status).toBe(200);
  expect(res.body.ipRaspberry).toBe('192.168.1.50');
  expect(res.body.portRaspberry).toBe(2222);

  // nom d'hôte accepté, chaîne vide = adresse effacée
  const hote = await request(app).patch(`/api/sites/${site._id}`).set('Authorization', sup).send({ ipRaspberry: 'raspberrypi.local' });
  expect(hote.body.ipRaspberry).toBe('raspberrypi.local');
  const vide = await request(app).patch(`/api/sites/${site._id}`).set('Authorization', sup).send({ ipRaspberry: '' });
  expect(vide.status).toBe(200);
  expect(vide.body.ipRaspberry).toBe('');
});

test('adresse ou port invalides : 400', async () => {
  const sup = await jeton('superadmin');
  for (const ipRaspberry of ['999.1.1.1', '192.168.1', 'pas une ip', { $ne: '' }]) {
    const res = await request(app).patch(`/api/sites/${site._id}`).set('Authorization', sup).send({ ipRaspberry });
    expect(res.status).toBe(400);
    expect(res.body.erreur).toBe('Adresse IP du Raspberry invalide');
  }
  const port = await request(app).patch(`/api/sites/${site._id}`).set('Authorization', sup).send({ portRaspberry: 70000 });
  expect(port.status).toBe(400);
});

test('un administrateur ne peut pas modifier l\'adresse du Raspberry', async () => {
  const admin = await jeton('administrateur', [site._id]);
  const res = await request(app).patch(`/api/sites/${site._id}`).set('Authorization', admin).send({ ipRaspberry: '10.0.0.5' });
  expect(res.status).toBe(403);
  const statut = await request(app).get(`/api/sites/${site._id}/raspberry/statut`).set('Authorization', admin);
  expect(statut.status).toBe(403);
});

test('deux sites ne peuvent pas avoir la même adresse : 409', async () => {
  const sup = await jeton('superadmin');
  await Site.create({ nom: 'Site B', ipRaspberry: '10.0.0.7' });
  const res = await request(app).patch(`/api/sites/${site._id}`).set('Authorization', sup).send({ ipRaspberry: '10.0.0.7' });
  expect(res.status).toBe(409);
  expect(res.body.erreur).toMatch(/Site B/);
});

test('statut : non configuré, joignable, puis port fermé', async () => {
  const sup = await jeton('superadmin');
  const url = `/api/sites/${site._id}/raspberry/statut`;

  const nonConfigure = await request(app).get(url).set('Authorization', sup);
  expect(nonConfigure.body).toMatchObject({ configure: false, joignable: null, dernierContact: null });

  // Un petit serveur TCP local joue le rôle du Raspberry Pi
  const serveur = net.createServer((s) => s.end());
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const { port } = serveur.address();
  await Site.updateOne({ _id: site._id }, { ipRaspberry: '127.0.0.1', portRaspberry: port });

  const ok = await request(app).get(url).set('Authorization', sup);
  expect(ok.status).toBe(200);
  expect(ok.body).toMatchObject({ configure: true, ip: '127.0.0.1', port, joignable: true });

  await new Promise((r) => serveur.close(r));
  const ferme = await request(app).get(url).set('Authorization', sup);
  expect(ferme.body.joignable).toBe(false);
  expect(ferme.body.raison).toBeTruthy();
});
