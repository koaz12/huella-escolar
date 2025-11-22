// src/components/SyncStatus.jsx
import { useState, useEffect } from 'react';
import { dbLocal, getPendingUploads, deletePendingUpload } from '../db';
import { db, storage, auth } from '../firebase'; // Asegúrate de que la ruta sea correcta
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { RefreshCw, CloudOff, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function SyncStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // 1. Monitorear Conexión y Cola
  useEffect(() => {
    const updateCount = async () => {
        const count = await dbLocal.pendingUploads.count();
        setPendingCount(count);
    };

    // Chequear cada 5 segundos o cuando vuelva internet
    const interval = setInterval(updateCount, 5000);
    updateCount(); // Chequeo inicial

    const handleOnline = () => { setIsOnline(true); syncNow(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. La Gran Función de Sincronización
  const syncNow = async () => {
    if (isSyncing || !navigator.onLine) return;
    
    const items = await getPendingUploads();
    if (items.length === 0) return;

    setIsSyncing(true);
    const toastId = toast.loading(`Sincronizando ${items.length} evidencias...`);

    try {
      let successCount = 0;

      for (const item of items) {
        try {
          // A. Subir Archivo a Storage
          const storageRef = ref(storage, `evidencias/${auth.currentUser?.uid || 'anon'}/${item.timestamp}_${item.file.name}`);
          const snapshot = await uploadBytes(storageRef, item.file);
          const downloadURL = await getDownloadURL(snapshot.ref);

          // B. Guardar en Firestore (Recuperando TODOS los datos guardados)
          // Nota: Convertimos fechas de string a Date si es necesario
          const finalData = {
              ...item.metadata,
              fileUrl: downloadURL,
              fileType: item.file.type.startsWith('video/') ? 'video' : 'image',
              date: new Date(item.metadata.date || Date.now()), // Restaurar fecha real
              createdAt: new Date() // Fecha de subida real
          };

          await addDoc(collection(db, "evidence"), finalData);

          // C. Borrar de la cola local si tuvo éxito
          await deletePendingUpload(item.id);
          successCount++;

        } catch (err) {
          console.error("Error subiendo item:", err);
          // No lo borramos para reintentar luego
        }
      }

      if (successCount > 0) {
          toast.success(`¡${successCount} evidencias subidas!`, { id: toastId });
          setPendingCount(prev => prev - successCount);
      } else {
          toast.error("Error de sincronización", { id: toastId });
      }

    } catch (error) {
      console.error("Error crítico sync:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. Renderizado Visual
  if (pendingCount === 0) return null; // Si no hay nada pendiente, no se muestra

  return (
    <div style={{
        marginBottom: '15px', padding: '10px', borderRadius: '8px',
        background: isOnline ? '#ecfdf5' : '#fff7ed',
        border: `1px solid ${isOnline ? '#10b981' : '#f97316'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        animation: 'fadeIn 0.5s'
    }}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            {isSyncing ? <RefreshCw className="spin" size={20} color="#10b981"/> : <CloudOff size={20} color="#f97316"/>}
            <div>
                <div style={{fontWeight:'bold', fontSize:'13px', color:'#333'}}>
                    {isSyncing ? 'Subiendo a la nube...' : 'Pendiente de subir'}
                </div>
                <div style={{fontSize:'11px', color:'#666'}}>
                    {pendingCount} archivos guardados en celular
                </div>
            </div>
        </div>
        
        {/* Botón manual si hay internet pero no ha empezado */}
        {isOnline && !isSyncing && (
            <button onClick={syncNow} style={{background:'#10b981', color:'white', border:'none', padding:'5px 12px', borderRadius:'20px', fontSize:'11px', fontWeight:'bold', cursor:'pointer'}}>
                Subir
            </button>
        )}
        
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}