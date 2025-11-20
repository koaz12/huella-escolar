// src/components/Login.jsx
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

export function Login() {
  
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // No necesitamos hacer nada más, Firebase avisa a App.jsx automáticamente
    } catch (error) {
      console.error(error);
      alert("Error al iniciar sesión: " + error.message);
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#282c34',
      color: 'white'
    }}>
      <h1>🏃‍♂️ Huella Escolar</h1>
      <p>Herramienta de Gestión para Educación Física</p>
      
      <button 
        onClick={handleLogin}
        style={{
          backgroundColor: 'white',
          color: '#333',
          padding: '15px 30px',
          border: 'none',
          borderRadius: '30px',
          fontSize: '18px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        {/* Icono simple de Google */}
        <span style={{fontWeight: 'bold', color: '#4285F4'}}>G</span> Iniciar con Google
      </button>
    </div>
  );
}