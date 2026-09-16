import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout({ titre, sousTitre, children }) {
  const [menuOuvert, setMenuOuvert] = useState(false);

  return (
    <div className="app">
      <div className={`sidebar-fond ${menuOuvert ? 'visible' : ''}`} onClick={() => setMenuOuvert(false)} />
      <div className={`sidebar-conteneur ${menuOuvert ? 'ouvert' : ''}`}>
        <Sidebar onNavigate={() => setMenuOuvert(false)} />
      </div>

      <div className="main">
        <button className="bouton-menu-mobile" onClick={() => setMenuOuvert(true)} aria-label="Ouvrir le menu">
          ☰
        </button>
        <Topbar titre={titre} sousTitre={sousTitre} />
        {children}
      </div>
    </div>
  );
}
