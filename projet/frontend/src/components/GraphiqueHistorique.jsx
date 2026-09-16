import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, Brush,
} from 'recharts';
import client from '../api/client';

const SERIES = {
  ph: { libelle: 'pH', unite: '', couleur: '#2563EB' },
  turbidite: { libelle: 'Turbidité', unite: 'NTU', couleur: '#B45309' },
  conductivite: { libelle: 'Conductivité', unite: 'ppm', couleur: '#7C3AED' },
};

const NB_BUCKETS = 150; // assez fin pour un zoom utile, assez grossier pour rester lisible

function formatDateHeure(t) {
  return new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function formatDateCourte(t) {
  return new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

// Fusionne 3 séries indépendantes (avec des horodatages potentiellement différents)
// en une seule liste de points alignés sur des intervalles de temps communs, en
// moyennant les valeurs par intervalle — nécessaire pour un graphique multi-courbes
// avec un seul axe X partagé, et pour éviter des milliers de points bruts illisibles.
function fusionnerEtAgreger(donneesParCle) {
  const tousPoints = Object.values(donneesParCle).flat();
  if (tousPoints.length === 0) return [];

  const horodatages = tousPoints.map((p) => new Date(p.horodatage).getTime());
  const tMin = Math.min(...horodatages);
  const tMax = Math.max(...horodatages);
  const largeur = (tMax - tMin) / NB_BUCKETS || 1;

  const paniers = Array.from({ length: NB_BUCKETS }, (_, i) => ({
    t: tMin + (i + 0.5) * largeur,
    sommes: {}, comptes: {},
  }));

  Object.entries(donneesParCle).forEach(([cle, points]) => {
    points.forEach((p) => {
      const t = new Date(p.horodatage).getTime();
      let idx = Math.floor((t - tMin) / largeur);
      if (idx >= NB_BUCKETS) idx = NB_BUCKETS - 1;
      if (idx < 0) idx = 0;
      const panier = paniers[idx];
      panier.sommes[cle] = (panier.sommes[cle] || 0) + p.valeur;
      panier.comptes[cle] = (panier.comptes[cle] || 0) + 1;
    });
  });

  return paniers
    .map((panier) => {
      const ligne = { t: panier.t };
      Object.keys(SERIES).forEach((cle) => {
        ligne[cle] = panier.comptes[cle] ? panier.sommes[cle] / panier.comptes[cle] : null;
      });
      return ligne;
    })
    .filter((ligne) => Object.keys(SERIES).some((cle) => ligne[cle] !== null));
}

function InfoBulle({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={styles.infoBulle}>
      <p style={styles.infoBulleDate}>{formatDateHeure(label)}</p>
      {payload.map((entree) => {
        const cle = entree.dataKey;
        const s = SERIES[cle];
        if (entree.value === null || entree.value === undefined) return null;
        return (
          <p key={cle} style={{ ...styles.infoBulleLigne, color: s.couleur }}>
            <span style={{ ...styles.pointCouleur, background: s.couleur }} />
            {s.libelle} : <strong>{entree.value.toFixed(cle === 'conductivite' ? 0 : 2)}</strong> {s.unite}
          </p>
        );
      })}
    </div>
  );
}

export default function GraphiqueHistorique({ capteurPH, capteurTurbidite, capteurConductivite }) {
  const [donneesBrutes, setDonneesBrutes] = useState({ ph: [], turbidite: [], conductivite: [] });
  const [chargement, setChargement] = useState(true);

  const idsParCle = { ph: capteurPH, turbidite: capteurTurbidite, conductivite: capteurConductivite };

  useEffect(() => {
    const cles = Object.entries(idsParCle).filter(([, id]) => id);
    if (cles.length === 0) return;

    const charger = async () => {
      try {
        const reponses = await Promise.all(
          cles.map(([, id]) => client.get(`/api/mesures/historique?capteur=${id}&jours=7`))
        );
        const nouvelles = { ph: [], turbidite: [], conductivite: [] };
        cles.forEach(([cle], i) => { nouvelles[cle] = reponses[i].data; });
        setDonneesBrutes(nouvelles);
      } catch (err) {
        // silencieux, l'état vide gère l'affichage
      } finally {
        setChargement(false);
      }
    };

    charger();
    const intervalle = setInterval(charger, 15000);
    return () => clearInterval(intervalle);
  }, [capteurPH, capteurTurbidite, capteurConductivite]);

  const clesActives = Object.keys(SERIES).filter((cle) => idsParCle[cle] && donneesBrutes[cle].length > 1);
  const donnees = useMemo(() => fusionnerEtAgreger(donneesBrutes), [donneesBrutes]);

  if (chargement) return <p className="chargement">Chargement du graphique…</p>;
  if (clesActives.length === 0 || donnees.length < 2) {
    return (
      <p className="chargement">
        Pas encore assez de mesures pour tracer une courbe — laisse le client Raspberry Pi tourner
        quelques cycles de plus.
      </p>
    );
  }

  const axesGauche = clesActives.filter((c) => c !== 'conductivite');
  const axesDroite = clesActives.filter((c) => c === 'conductivite');

  return (
    <div>
      <p style={styles.astuce}>💡 Survole le graphique pour voir les valeurs · fais glisser la barre grisée en bas pour zoomer sur une période</p>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={donnees} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />

          <XAxis
            dataKey="t" type="number" domain={['dataMin', 'dataMax']}
            tickFormatter={formatDateCourte} stroke="#94A3B8" fontSize={11}
          />

          {axesGauche.map((cle, i) => (
            <YAxis
              key={cle} yAxisId={cle} orientation="left" domain={['auto', 'auto']}
              stroke={SERIES[cle].couleur} fontSize={10.5} width={44}
              tickFormatter={(v) => v.toFixed(cle === 'ph' ? 1 : 0)}
              {...(i > 0 ? { hide: false } : {})}
            />
          ))}
          {axesDroite.map((cle) => (
            <YAxis
              key={cle} yAxisId={cle} orientation="right" domain={['auto', 'auto']}
              stroke={SERIES[cle].couleur} fontSize={10.5} width={48}
              tickFormatter={(v) => v.toFixed(0)}
            />
          ))}

          <Tooltip content={<InfoBulle />} />
          <Legend
            formatter={(value) => <span style={{ color: '#334155', fontSize: 12.5 }}>{SERIES[value].libelle}{SERIES[value].unite ? ` (${SERIES[value].unite})` : ''}</span>}
          />

          {clesActives.map((cle) => (
            <Line
              key={cle} yAxisId={cle} dataKey={cle} name={cle}
              stroke={SERIES[cle].couleur} strokeWidth={2.4} dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'white' }}
              connectNulls type="monotone" isAnimationActive={false}
            />
          ))}

          <Brush
            dataKey="t" height={26} stroke="#0F766E" fill="#F1F5F9"
            tickFormatter={formatDateCourte} travellerWidth={9}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const styles = {
  astuce: { fontSize: 11.5, color: '#94A3B8', marginBottom: 8 },
  infoBulle: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 14px rgba(15,23,42,0.12)' },
  infoBulleDate: { fontSize: 11.5, color: '#64748B', fontWeight: 700, marginBottom: 6 },
  infoBulleLigne: { fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, margin: '3px 0' },
  pointCouleur: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
};
