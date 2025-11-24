// src/components/Login.jsx
import { useState } from 'react';
import { Activity } from 'lucide-react';
// IMPORTAMOS EL HOOK
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { login } = useAuth(); // Usamos la función del contexto
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await login();
      // No necesitamos redirigir manual, el AuthContext actualiza el estado 'user' en App.jsx
    } catch (error) {
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{ 
      height: '100dvh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', 
      background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', color: 'white', padding: '40px 20px', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{flex: 1}}></div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', animation: 'fadeInUp 0.8s ease-out' }}>
        <div style={{ width: '100px', height: '100px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', animation: 'float 3s ease-in-out infinite' }}>
          <Activity size={50} color="#2563eb" strokeWidth={2.5} />
        </div>
        <div style={{textAlign: 'center'}}>
          <h1 style={{ margin: '0', fontSize: '2.5rem', fontWeight: '800', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>Huella Escolar</h1>
          <p style={{ margin: '10px 0 0 0', fontSize: '1.1rem', opacity: 0.9, maxWidth: '300px', lineHeight: '1.5' }}>Gestiona tus clases, alumnos y evidencias de Educación Física.</p>
        </div>
        <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
            <span style={badgeStyle}>📸 Evidencias</span><span style={badgeStyle}>📂 Portafolio</span><span style={badgeStyle}>📶 Offline</span>
        </div>
      </div>
      <div style={{flex: 1}}></div>
      <div style={{ width: '100%', maxWidth: '350px', animation: 'fadeIn 1.2s ease-in' }}>
        <button onClick={handleLogin} disabled={isLoggingIn} style={{ width: '100%', backgroundColor: 'white', color: '#333', padding: '16px', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 'bold', cursor: isLoggingIn ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', transition: 'transform 0.1s', opacity: isLoggingIn ? 0.8 : 1 }} onMouseDown={e => !isLoggingIn && (e.currentTarget.style.transform = 'scale(0.98)')} onMouseUp={e => !isLoggingIn && (e.currentTarget.style.transform = 'scale(1)')}>
          {isLoggingIn ? (<div style={{width: '20px', height: '20px', border: '3px solid #ccc', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>) : (
             <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          )}
          {isLoggingIn ? 'Iniciando...' : 'Continuar con Google'}
        </button>
        <p style={{ textAlign: 'center', fontSize: '12px', marginTop: '20px', opacity: 0.6 }}>v1.3 • by Erick Moreta</p>
      </div>
      <style>{`@keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } } @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const badgeStyle = { fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.3)' };