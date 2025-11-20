// src/components/SyncStatus.jsx
import { useState, useEffect } from 'react';
import { dbLocal } from '../db'; // Tu BD Offline
import { db, storage } from '../firebase'; // Tu Nube
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { useLiveQuery } from 'dexie-react-hooks'; // Para que el contador se actualice solo

export function SyncStatus() {
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Cuenta cuántas evidencias hay guardadas en el celular (pendientes)
  const pendingItems = useLiveQuery(
    () => dbLocal.offlineEvidence.toArray()
  );

  if (!pendingItems || pendingItems.length === 0) return null;

  const handleSync = async () => {
    if (!navigator.onLine) return alert("❌ Aún no tienes internet.");
    
    if (!confirm(`¿Subir ${pendingItems.length} evidencias a la nube ahora?`)) return;

    setIsSyncing(true);

    try {
      for (const item of pendingItems) {
        // 1. Subir el archivo (video/foto) a Firebase Storage
        const storageRef = ref(storage, `evidencias/OFFLINE_${Date.now()}_${item.activityName}`);
        const snapshot = await uploadBytes(storageRef, item.fileBlob);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // 2. Guardar los datos en Firestore
        await addDoc(collection(db, "evidence"), {
          activityName: item.activityName,
          fileUrl: downloadURL,
          studentIds: item.studentIds,
          date: new Date(item.timestamp),
          teacherId: "profe_123",
          uploadedFromOffline: true
        });

        // 3. ¡Éxito! Borrar de la memoria del celular para liberar espacio
        await dbLocal.offlineEvidence.delete(item.id);
      }
      alert("✅ ¡Todo sincronizado correctamente!");
      
    } catch (error) {
      console.error(error);
      alert("Hubo un error al subir: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div style={{ 
      backgroundColor: '#fff3cd', 
      color: '#856404', 
      padding: '15px', 
      marginBottom: '20px', 
      borderRadius: '8px',
      border: '1px solid #ffeeba',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <span>⚠️ Tienes <strong>{pendingItems.length}</strong> evidencias pendientes.</span>
      
      <button 
        onClick={handleSync}
        disabled={isSyncing}
        style={{
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          padding: '8px 15px',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        {isSyncing ? 'Subiendo...' : '☁️ Sincronizar Ahora'}
      </button>
    </div>
  );
}