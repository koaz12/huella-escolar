import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Funciones para actualizar el estado
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Conexión recuperada 🟢");
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("Sin conexión. Modo Offline activado 🔴");
    };

    // Escuchamos los eventos del navegador
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Limpieza al desmontar
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Si hay internet, no mostramos nada (o un iconito verde discreto si prefieres)
  if (isOnline) return null;

  // Si NO hay internet, mostramos esta barra roja fija
  return (
    <div style={{
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
      backgroundColor: '#ef4444', // Rojo
      color: 'white',
      padding: '8px',
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: 'bold',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px'
    }}>
      <WifiOff size={18} />
      Estás Offline. Los cambios se guardarán en tu celular.
    </div>
  );
}