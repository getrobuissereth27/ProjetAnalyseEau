import * as XLSX from 'xlsx';
import { capteurDeLAlerte } from './roles';

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

const ENTETES_HISTORIQUE = ['Date / heure', 'pH', 'Turbidité (NTU)', 'Température (°C)', 'TDS (ppm)'];
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

/**
 * Export Excel de l'historique AVEC les graphiques :
 *   - feuille « Historique » : le tableau des mesures
 *   - feuille « Graphiques » : une image par graphique, les unes sous les autres
 * images : [{ titre, dataUrl, largeur, hauteur }] (voir utils/graphiqueImage.js)
 *
 * La bibliothèque xlsx ne sait pas insérer d'images : on utilise exceljs, chargé
 * seulement au moment de l'export pour ne pas alourdir le chargement de la page.
 */
export async function exporterExcelAvecGraphiques(lignes, images, nomFichier = 'historique.xlsx') {
  const { default: ExcelJS } = await import('exceljs');
  const classeur = new ExcelJS.Workbook();

  const feuille = classeur.addWorksheet('Historique', { views: [{ state: 'frozen', ySplit: 1 }] });
  feuille.columns = ENTETES_HISTORIQUE.map((entete, i) => ({ header: entete, width: LARGEURS_HISTORIQUE[i] }));
  feuille.getRow(1).font = { bold: true };
  lignes.forEach((l) => feuille.addRow(ligneHistoriqueVersTableau(l)));

  if (images.length > 0) {
    const feuilleGraphiques = classeur.addWorksheet('Graphiques');
    const LARGEUR_IMAGE = 760; // px dans Excel ; la hauteur garde les proportions
    const HAUTEUR_LIGNE_EXCEL = 20; // px, hauteur par défaut d'une ligne Excel
    let ligne = 0;
    images.forEach(({ dataUrl, largeur, hauteur }) => {
      const id = classeur.addImage({ base64: dataUrl, extension: 'png' });
      const hauteurImage = Math.round((hauteur / largeur) * LARGEUR_IMAGE);
      feuilleGraphiques.addImage(id, { tl: { col: 0, row: ligne }, ext: { width: LARGEUR_IMAGE, height: hauteurImage } });
      ligne += Math.ceil(hauteurImage / HAUTEUR_LIGNE_EXCEL) + 2;
    });
  }

  const tampon = await classeur.xlsx.writeBuffer();
  telechargerBlob(
    new Blob([tampon], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    nomFichier,
  );
}

// ---------- Export de la liste des alertes ----------

const ENTETES_ALERTES = ['Date / heure', 'Type', 'Capteur', 'Valeur mesurée', 'Statut', 'Date de résolution'];
const LARGEURS_ALERTES = [20, 20, 16, 16, 12, 20];

function ligneAlerteVersTableau(a) {
  return [
    new Date(a.horodatage).toLocaleString('fr-FR'),
    a.type_alerte,
    capteurDeLAlerte(a)?.type ?? '?',
    a.mesure_id ? `${a.mesure_id.valeur} ${capteurDeLAlerte(a)?.unite ?? ''}`.trim() : '',
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
