// src/App.jsx
import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Toaster } from 'react-hot-toast'; // <--- El sistema de avisos
import { Camera, Users, Image as ImageIcon, LogOut } from 'lucide-react'; // Iconos bonitos

import { Login } from './components/Login';
import { CaptureForm } from './components/CaptureForm';
import { SyncStatus } from './components/SyncStatus';
import { StudentForm } from './components/StudentForm';
import { EvidenceList } from './components/EvidenceList';

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

  const handleLogout = () => {
    if(confirm("¿Cerrar sesión?")) signOut(auth);
  };

  if (loading) return <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>Cargando...</div>;

  if (!user) return <Login />;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {/* --- 1. SISTEMA DE NOTIFICACIONES --- */}
      <Toaster position="top-center" reverseOrder={false} />

      {/* --- 2. BARRA SUPERIOR (Header) --- */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '10px 15px', 
        position: 'sticky', 
        top: 0, 
        zIndex: 100,
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #eee',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <h2 style={{margin: 0, fontSize: '1.2rem', color: '#333'}}>🏃‍♂️ Huella Escolar</h2>
        <button onClick={handleLogout} style={{background:'transparent', border:'none', color:'#666'}}>
          <LogOut size={20} />
        </button>
      </div>

      {/* --- 3. CONTENIDO PRINCIPAL (Con espacio abajo para el menú) --- */}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 10px 80px 10px' }}>
        <SyncStatus /> 
        
        {/* Efecto de transición simple */}
        <div style={{animation: 'fadeIn 0.3s'}}>
          {view === 'capture' && <CaptureForm />}
          {view === 'students' && <StudentForm />}
          {view === 'gallery' && <EvidenceList />}
        </div>
      </div>

      {/* --- 4. BARRA DE NAVEGACIÓN INFERIOR (Bottom Nav) --- */}
      <div style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        width: '100%', 
        backgroundColor: 'white', 
        borderTop: '1px solid #eee',
        display: 'flex', 
        justifyContent: 'space-around',
        padding: '10px 0',
        zIndex: 1000,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
      }}>
          <NavButton 
            icon={<Camera size={24} />} 
            label="Captura" 
            active={view==='capture'} 
            onClick={() => setView('capture')} 
          />
          <NavButton 
            icon={<ImageIcon size={24} />} 
            label="Galería" 
            active={view==='gallery'} 
            onClick={() => setView('gallery')} 
          />
          <NavButton 
            icon={<Users size={24} />} 
            label="Alumnos" 
            active={view==='students'} 
            onClick={() => setView('students')} 
          />
      </div>
    </div>
  );
}

// Componente de Botón Inferior
function NavButton({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      style={{ 
        background: 'none', 
        border: 'none', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        color: active ? '#007bff' : '#999',
        cursor: 'pointer',
        flex: 1
      }}
    >
      {icon}
      <span style={{fontSize: '10px', marginTop: '4px', fontWeight: active ? 'bold' : 'normal'}}>{label}</span>
    </button>
  );
}

export default App;