// src/App.jsx
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast'; 
import { Camera, Users, Image as ImageIcon, LogOut, CloudOff } from 'lucide-react'; 
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'; // <--- NUEVOS IMPORTS

// Componentes
import { Login } from './components/Login';
import { CaptureForm } from './components/CaptureForm';
import { SyncStatus } from './components/SyncStatus';
import { StudentForm } from './components/StudentForm';
import { EvidenceList } from './components/EvidenceList';
import { useAuth } from './context/AuthContext';

function App() {
  const { user, logout } = useAuth(); 
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const navigate = useNavigate(); // Hook para navegar
  const location = useLocation(); // Hook para saber dónde estamos

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  const handleLogout = async () => { 
      if(confirm("¿Cerrar sesión?")) await logout();
  };

  if (!user) return <Login />;

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#f4f6f8' }}>
      <Toaster position="top-center" />

      {/* HEADER */}
      <div style={{ flexShrink: 0, backgroundColor: 'white', padding: '12px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e1e4e8', zIndex: 10 }}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <h2 style={{margin: 0, fontSize: '1.1rem', color: '#1a1a1a'}}>🏃‍♂️ Huella Escolar</h2>
            <span style={{fontSize:'10px', color:'#666', background:'#f3f4f6', padding:'2px 6px', borderRadius:'4px'}}>Hola, {user.displayName?.split(' ')[0]}</span>
        </div>
        <button onClick={handleLogout} style={{background:'transparent', border:'none', padding:'5px'}}><LogOut size={20} color="#666" /></button>
      </div>

      {/* BARRA OFFLINE */}
      {!isOnline && (
        <div style={{backgroundColor: '#ef4444', color: 'white', padding: '8px', textAlign: 'center', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexShrink: 0, animation: 'slideDown 0.3s ease-out'}}>
          <CloudOff size={16} /> <span>Estás Offline. Guardando en celular.</span>
        </div>
      )}

      {/* CONTENIDO CON RUTAS REALES */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '15px', paddingBottom: '20px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {isOnline && <SyncStatus />} 
          
          <Routes>
            {/* Ruta por defecto: redirigir a captura */}
            <Route path="/" element={<Navigate to="/capture" replace />} />
            
            <Route path="/capture" element={<CaptureForm />} />
            <Route path="/students" element={<StudentForm />} />
            <Route path="/gallery" element={<EvidenceList />} />
          </Routes>

        </div>
      </div>

      {/* BARRA INFERIOR DE NAVEGACIÓN */}
      <div style={{ flexShrink: 0, backgroundColor: 'white', borderTop: '1px solid #e1e4e8', display: 'flex', justifyContent: 'space-around', padding: '8px 0', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))', zIndex: 100 }}>
          <NavButton icon={<Camera size={24} />} label="Captura" active={location.pathname === '/capture'} onClick={() => navigate('/capture')} />
          <NavButton icon={<ImageIcon size={24} />} label="Galería" active={location.pathname === '/gallery'} onClick={() => navigate('/gallery')} />
          <NavButton icon={<Users size={24} />} label="Alumnos" active={location.pathname === '/students'} onClick={() => navigate('/students')} />
      </div>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: active ? '#2563eb' : '#94a3b8', cursor: 'pointer', flex: 1, padding: '5px' }}>
      {icon}
      <span style={{fontSize: '11px', marginTop: '3px', fontWeight: active ? '600' : '400'}}>{label}</span>
    </button>
  );
}

export default App;