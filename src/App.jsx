// src/App.jsx
import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Toaster } from 'react-hot-toast'; 
import { Camera, Users, Image as ImageIcon, LogOut } from 'lucide-react'; 

import { Login } from './components/Login';
import { CaptureForm } from './components/CaptureForm';
import { SyncStatus } from './components/SyncStatus';
import { StudentForm } from './components/StudentForm';
import { EvidenceList } from './components/EvidenceList';
// 1. IMPORTAMOS EL NUEVO COMPONENTE
import { OfflineIndicator } from './components/OfflineIndicator';

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('capture'); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => { if(confirm("¿Cerrar sesión?")) signOut(auth); };

  if (loading) return <div style={{height:'100dvh', display:'grid', placeItems:'center'}}>Cargando...</div>;
  if (!user) return <Login />;

  return (
    <div style={{ 
      height: '100dvh', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden', 
      backgroundColor: '#f4f6f8'
    }}>
      
      <Toaster position="top-center" />
      
      {/* 2. AQUÍ VA EL INDICADOR (Se mostrará solo si se va el internet) */}
      <OfflineIndicator />

      {/* --- 1. HEADER (Fijo) --- */}
      <div style={{ 
        flexShrink: 0, 
        backgroundColor: 'white', 
        padding: '12px 15px', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #e1e4e8',
        zIndex: 10
      }}>
        <h2 style={{margin: 0, fontSize: '1.1rem', color: '#1a1a1a', display:'flex', alignItems:'center', gap:'8px'}}>
          🏃‍♂️ Huella Escolar
        </h2>
        <button onClick={handleLogout} style={{background:'transparent', border:'none', padding:'5px'}}>
          <LogOut size={20} color="#666" />
        </button>
      </div>

      {/* --- 2. ÁREA DE CONTENIDO (Scrollable) --- */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '15px',
        paddingBottom: '20px' 
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <SyncStatus /> 
          <div key={view} style={{ animation: 'fadeIn 0.2s ease-in' }}>
            {view === 'capture' && <CaptureForm />}
            {view === 'students' && <StudentForm />}
            {view === 'gallery' && <EvidenceList />}
          </div>
        </div>
      </div>

      {/* --- 3. BARRA INFERIOR (Fija) --- */}
      <div style={{ 
        flexShrink: 0,
        backgroundColor: 'white', 
        borderTop: '1px solid #e1e4e8',
        display: 'flex', 
        justifyContent: 'space-around',
        padding: '8px 0',
        paddingBottom: 'safe-area-inset-bottom',
        zIndex: 100
      }}>
          <NavButton icon={<Camera size={24} />} label="Captura" active={view==='capture'} onClick={() => setView('capture')} />
          <NavButton icon={<ImageIcon size={24} />} label="Galería" active={view==='gallery'} onClick={() => setView('gallery')} />
          <NavButton icon={<Users size={24} />} label="Alumnos" active={view==='students'} onClick={() => setView('students')} />
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      style={{ 
        background: 'none', border: 'none', 
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: active ? '#007bff' : '#94a3b8',
        cursor: 'pointer', flex: 1, padding: '5px'
      }}
    >
      {icon}
      <span style={{fontSize: '11px', marginTop: '3px', fontWeight: active ? '600' : '400'}}>{label}</span>
    </button>
  );
}

export default App;