// src/components/OfflineIndicator.jsx
import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Conexión recuperada 🟢");
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("Modo Offline activado 🔴");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div style={{
      position: 'fixed',
      /* CAMBIO RADICAL: Lo mandamos arriba */
      top: '60px', 
      left: '50%',
      transform: 'translateX(-50%)', /* Centrado horizontal */
      
      width: 'auto',
      minWidth: '200px',
      
      backgroundColor: '#ef4444', // Rojo alerta
      color: 'white',
      padding: '8px 16px',
      borderRadius: '20px', /* Cápsula redondeada */
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      
      textAlign: 'center',
      fontSize: '12px',
      fontWeight: '600',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      pointerEvents: 'none', // <--- TRUCO FINAL: Permite hacer clic "a través" del aviso si tapara algo
      animation: 'slideDown 0.3s ease-out'
    }}>
      <WifiOff size={14} />
      <span>Offline: Guardando localmente</span>
      
      <style>{`
        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
}