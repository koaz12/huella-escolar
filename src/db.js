// src/db.js
import Dexie from 'dexie';

// Creamos la base de datos local llamada 'HuellaEscolarDB'
export const dbLocal = new Dexie('HuellaEscolarDB');

// Definimos las tablas (stores)
dbLocal.version(1).stores({
  // Tabla para evidencias pendientes de subir
  // ++id = ID automático
  // fileBlob = El video/foto en sí
  // synced = Si ya se subió o no (0 = No, 1 = Si)
  offlineEvidence: '++id, activityName, studentIds, timestamp, synced' 
});

// Función auxiliar para guardar una evidencia offline
export const saveOffline = async (file, activityName, studentIds, comment = '') => {
  try {
    await dbLocal.offlineEvidence.add({
      fileBlob: file,
      activityName,
      studentIds,
      comment, // <--- Nuevo campo
      timestamp: new Date().toISOString(),
      synced: 0
    });
    console.log("Evidencia guardada localmente");
    return true;
  } catch (error) {
    console.error("Error guardando offline:", error);
    return false;
  }
};