import * as XLSX from 'xlsx';

function telechargerBlob(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

// ---------- Export générique (utilisé par l'historique ET les alertes) ----------

export function exporterCSVGenerique(entetes, rangs, nomFichier) {
  const toutesLesLignes = [entetes, ...rangs];
  const contenu = toutesLesLignes.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  // le BOM UTF-8 évite les problèmes d'accents à l'ouverture dans Excel
  const blob = new Blob(['\uFEFF' + contenu], { type: 'text/csv;charset=utf-8;' });
  telechargerBlob(blob, nomFichier);
}

export function exporterExcelGenerique(entetes, rangs, nomFichier, nomFeuille, largeurs) {
  const toutesLesLignes = [entetes, ...rangs];
  const feuille = XLSX.utils.aoa_to_sheet(toutesLesLignes);
  if (largeurs) feuille['!cols'] = largeurs.map((wch) => ({ wch }));

  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, nomFeuille);
  XLSX.writeFile(classeur, nomFichier);
}

// ---------- Export de l'historique des mesures ----------

const ENTETES_HISTORIQUE = ['Date / heure', 'pH', 'Turbidité (NTU)', 'Température (°C)', 'Conductivité (ppm)'];
const LARGEURS_HISTORIQUE = [20, 8, 16, 16, 18];

function ligneHistoriqueVersTableau(ligne) {
  return [
    new Date(ligne.t).toLocaleString('fr-FR'),
    ligne.ph ?? '',
    ligne.turbidite ?? '',
    ligne.temperature ?? '',
    ligne.tds ?? '',
  ];
}

export function exporterCSV(lignes, nomFichier = 'historique.csv') {
  exporterCSVGenerique(ENTETES_HISTORIQUE, lignes.map(ligneHistoriqueVersTableau), nomFichier);
}

export function exporterExcel(lignes, nomFichier = 'historique.xlsx', nomFeuille = 'Historique') {
  exporterExcelGenerique(ENTETES_HISTORIQUE, lignes.map(ligneHistoriqueVersTableau), nomFichier, nomFeuille, LARGEURS_HISTORIQUE);
}

// ---------- Export de la liste des alertes ----------

const ENTETES_ALERTES = ['Date / heure', 'Type', 'Capteur', 'Valeur mesurée', 'Statut', 'Date de résolution'];
const LARGEURS_ALERTES = [20, 20, 16, 16, 12, 20];

function ligneAlerteVersTableau(a) {
  return [
    new Date(a.horodatage).toLocaleString('fr-FR'),
    a.type_alerte,
    a.mesure_id?.capteur_id?.type ?? '?',
    a.mesure_id ? `${a.mesure_id.valeur} ${a.mesure_id.capteur_id?.unite ?? ''}`.trim() : '',
    a.statut === 'active' ? 'Active' : 'Résolue',
    a.dateResolution ? new Date(a.dateResolution).toLocaleString('fr-FR') : '',
  ];
}

export function exporterAlertesCSV(alertes, nomFichier = 'alertes.csv') {
  exporterCSVGenerique(ENTETES_ALERTES, alertes.map(ligneAlerteVersTableau), nomFichier);
}

export function exporterAlertesExcel(alertes, nomFichier = 'alertes.xlsx') {
  exporterExcelGenerique(ENTETES_ALERTES, alertes.map(ligneAlerteVersTableau), nomFichier, 'Alertes', LARGEURS_ALERTES);
}
