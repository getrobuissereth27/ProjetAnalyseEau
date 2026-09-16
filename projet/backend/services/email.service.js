const nodemailer = require('nodemailer');

let transporteur = null;

function obtenirTransporteur() {
  if (transporteur) return transporteur;
  if (!process.env.SMTP_HOST) return null; // pas de config SMTP -> envoi désactivé (voir README)

  transporteur = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporteur;
}

const LABELS = { pH: 'pH', turbidite: 'Turbidité', temperature: 'Température', tds: 'Conductivité' };

// Construit le même contenu que le panneau de détail d'une alerte côté interface,
// pour que l'email reçu corresponde exactement à ce que verrait un utilisateur
// en cliquant sur l'alerte dans le tableau de bord.
function construireContenuEmail({ site, capteur, mesure, seuil, typeAlerte, horodatage }) {
  const nomParametre = LABELS[capteur.type] || capteur.type;
  const seuilTexte = seuil ? `${seuil.valeur_min} — ${seuil.valeur_max} ${capteur.unite}` : 'non défini';
  const dateTexte = new Date(horodatage).toLocaleString('fr-FR');

  const sujet = `⚠ Alerte ${nomParametre} — ${site.nom}`;

  const texte = [
    `Une alerte a été déclenchée sur le site "${site.nom}".`,
    ``,
    `Paramètre concerné : ${nomParametre}`,
    `Valeur mesurée : ${mesure.valeur} ${capteur.unite}`,
    `Seuil autorisé : ${seuilTexte}`,
    `Type d'alerte : ${typeAlerte}`,
    `Déclenchée le : ${dateTexte}`,
    ``,
    `La vanne de distribution de ce site a été fermée automatiquement.`,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
      <div style="background:#B91C1C;color:white;padding:16px 20px;border-radius:10px 10px 0 0;">
        <strong>⚠ Alerte ${nomParametre}</strong>
      </div>
      <div style="border:1px solid #E2E8F0;border-top:none;padding:20px;border-radius:0 0 10px 10px;">
        <p style="color:#334155;">Site concerné : <strong>${site.nom}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tr><td style="padding:6px 0;color:#64748B;">Paramètre</td><td style="padding:6px 0;font-weight:bold;">${nomParametre}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Valeur mesurée</td><td style="padding:6px 0;font-weight:bold;">${mesure.valeur} ${capteur.unite}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Seuil autorisé</td><td style="padding:6px 0;font-weight:bold;">${seuilTexte}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Déclenchée le</td><td style="padding:6px 0;font-weight:bold;">${dateTexte}</td></tr>
        </table>
        <p style="margin-top:16px;padding:12px;background:#FEF2F2;border-radius:8px;color:#B91C1C;">
          La vanne de distribution de ce site a été fermée automatiquement.
        </p>
      </div>
    </div>`;

  return { sujet, texte, html };
}

async function envoyerAlerteEmail({ site, capteur, mesure, seuil, typeAlerte, horodatage, destinataires }) {
  if (destinataires.length === 0) return { envoye: false, raison: 'aucun destinataire configuré pour ce site' };

  const t = obtenirTransporteur();
  if (!t) {
    console.log(`✉ (SMTP non configuré) Alerte ${capteur.type} — aurait été envoyée à : ${destinataires.join(', ')}`);
    return { envoye: false, raison: 'SMTP non configuré (voir .env.example)' };
  }

  const { sujet, texte, html } = construireContenuEmail({ site, capteur, mesure, seuil, typeAlerte, horodatage });

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || 'alertes@aquasuivi.local',
      to: destinataires.join(', '),
      subject: sujet,
      text: texte,
      html,
    });
    return { envoye: true };
  } catch (err) {
    console.error('✘ Échec envoi email alerte :', err.message);
    return { envoye: false, raison: err.message };
  }
}

module.exports = { envoyerAlerteEmail, construireContenuEmail };
