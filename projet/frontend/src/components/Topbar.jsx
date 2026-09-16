import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ModalMonCompte from './ModalMonCompte';

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
  const [modalOuvert, setModalOuvert] = useState(false);

  const seDeconnecter = () => {
    setModalOuvert(false);
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
        <div className="user-chip" style={{ cursor: 'pointer' }} onClick={() => setModalOuvert(true)} title="Mon compte">
          <div className="avatar">{initiales(utilisateur.nom)}</div>
          <div>
            <div className="name">{utilisateur.nom}</div>
            <div className="role">{utilisateur.role === 'administrateur' ? 'Administrateur' : 'Responsable CAEPA'}</div>
          </div>
        </div>
      )}

      {modalOuvert && (
        <ModalMonCompte
          utilisateur={utilisateur}
          onFermer={() => setModalOuvert(false)}
          onDeconnexion={seDeconnecter}
        />
      )}
    </div>
  );
}
