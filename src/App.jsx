// src/App.jsx
import { useState, useEffect } from 'react';
import { auth } from './firebase'; // Importar auth
import { onAuthStateChanged, signOut } from 'firebase/auth'; // Funciones de sesión

import { Login } from './components/Login';
import { CaptureForm } from './components/CaptureForm';
import { SyncStatus } from './components/SyncStatus';
import { StudentForm } from './components/StudentForm';
import { EvidenceList } from './components/EvidenceList';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('capture'); 
  const [loading, setLoading] = useState(true);

  // Escuchar si el usuario entra o sale
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    if(confirm("¿Cerrar sesión?")) signOut(auth);
  };

  if (loading) return <div style={{textAlign:'center', marginTop:'50px'}}>Cargando...</div>;

  // SI NO HAY USUARIO, MOSTRAR LOGIN
  if (!user) {
    return <Login />;
  }

  // SI HAY USUARIO, MOSTRAR LA APP
  return (
    <div style={{ paddingBottom: '60px', fontFamily: 'sans-serif' }}>
      
      {/* --- BARRA SUPERIOR --- */}
      <div style={{ 
        backgroundColor: '#282c34', 
        color: 'white', 
        padding: '10px', 
        position: 'sticky', 
        top: 0, 
        zIndex: 100,
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
      }}>
        <div>
          <h2 style={{margin: 0, fontSize: '1.1rem'}}>🏃‍♂️ Huella Escolar</h2>
          <small style={{fontSize: '0.7rem', color: '#aaa'}}>{user.displayName}</small>
        </div>
        <button onClick={handleLogout} style={{background:'transparent', border:'1px solid #555', color:'white', padding:'5px 10px', borderRadius:'4px', fontSize:'0.8rem'}}>Salir</button>
      </div>
      
      {/* --- MENÚ NAVEGACIÓN --- */}
      <div style={{ backgroundColor: '#f8f9fa', padding: '10px', display: 'flex', justifyContent: 'center', gap: '10px', borderBottom: '1px solid #ddd' }}>
          <NavButton label="📷 Captura" active={view==='capture'} onClick={() => setView('capture')} />
          <NavButton label="📂 Galería" active={view==='gallery'} onClick={() => setView('gallery')} />
          <NavButton label="🎓 Alumnos" active={view==='students'} onClick={() => setView('students')} />
      </div>

      {/* --- CONTENIDO --- */}
      <div style={{ maxWidth: '600px', margin: '20px auto', padding: '0 10px' }}>
        <SyncStatus /> 
        {view === 'capture' && <CaptureForm />}
        {view === 'students' && <StudentForm />}
        {view === 'gallery' && <EvidenceList />}
      </div>
    </div>
  );
}

// Pequeño componente para botones bonitos
function NavButton({ label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      style={{ 
        background: active ? '#007bff' : 'white', 
        color: active ? 'white' : '#333', 
        border: '1px solid #ccc', 
        padding: '8px 12px', 
        borderRadius: '20px',
        fontWeight: 'bold',
        boxShadow: active ? '0 2px 5px rgba(0,123,255,0.3)' : 'none',
        transition: 'all 0.2s'
      }}
    >
      {label}
    </button>
  );
}

export default App;