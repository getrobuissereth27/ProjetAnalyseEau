import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ChangerMotDePasse from './ChangerMotDePasse';
import ModifierProfil from './ModifierProfil';

function initiales(nom) {
  return nom
    .split(' ')
    .map((mot) => mot[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function Topbar({ titre, sousTitre }) {
  const { utilisateur, deconnexion } = useAuth();
  const navigate = useNavigate();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [modalMotDePasseOuvert, setModalMotDePasseOuvert] = useState(false);
  const [modalProfilOuvert, setModalProfilOuvert] = useState(false);

  const seDeconnecter = () => {
    deconnexion();
    navigate('/connexion');
  };

  return (
    <div className="topbar">
      <div>
        <h1>{titre}</h1>
        {sousTitre && <p className="subtitle">{sousTitre}</p>}
      </div>
      {utilisateur && (
        <div style={{ position: 'relative' }}>
          <div className="user-chip" style={{ cursor: 'pointer' }} onClick={() => setMenuOuvert((v) => !v)}>
            <div className="avatar">{initiales(utilisateur.nom)}</div>
            <div>
              <div className="name">{utilisateur.nom}</div>
              <div className="role">{utilisateur.role === 'administrateur' ? 'Administrateur' : 'Responsable CAEPA'}</div>
            </div>
          </div>

          {menuOuvert && (
            <>
              <div style={styles.fondMenu} onClick={() => setMenuOuvert(false)} />
              <div style={styles.menu}>
                <button
                  style={styles.itemMenu}
                  onClick={() => { setModalProfilOuvert(true); setMenuOuvert(false); }}
                >
                  Modifier mon profil
                </button>
                <button
                  style={styles.itemMenu}
                  onClick={() => { setModalMotDePasseOuvert(true); setMenuOuvert(false); }}
                >
                  Changer mon mot de passe
                </button>
                <button style={{ ...styles.itemMenu, color: '#B91C1C' }} onClick={seDeconnecter}>
                  ↪ Se déconnecter
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {modalProfilOuvert && <ModifierProfil onFermer={() => setModalProfilOuvert(false)} />}
      {modalMotDePasseOuvert && <ChangerMotDePasse onFermer={() => setModalMotDePasseOuvert(false)} />}
    </div>
  );
}

const styles = {
  fondMenu: { position: 'fixed', inset: 0, zIndex: 10 },
  menu: {
    position: 'absolute', top: '110%', right: 0, background: 'white', borderRadius: 10,
    border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(15,23,42,0.12)', minWidth: 220,
    zIndex: 20, overflow: 'hidden',
  },
  itemMenu: {
    display: 'block', width: '100%', textAlign: 'left', padding: '11px 16px', fontSize: 13,
    fontWeight: 600, color: '#334155', background: 'white', border: 'none', cursor: 'pointer',
  },
};
