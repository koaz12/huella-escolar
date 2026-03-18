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
    <div className="fixed top-[60px] left-1/2 -translate-x-1/2 w-auto min-w-[200px] bg-red-500 text-white py-2 px-4 rounded-full shadow-md text-center text-xs font-bold z-[9999] flex items-center justify-center gap-2 pointer-events-none animate-[slideDown_0.3s_ease-out]">
      <WifiOff size={14} />
      <span>Offline: Guardando localmente</span>
      
      <style>{`
        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
}