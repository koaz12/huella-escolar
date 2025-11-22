// src/db.js
import Dexie from 'dexie';

// 1. Definir la base de datos local
export const dbLocal = new Dexie('HuellaEscolarDB');

// Definimos las tablas (stores)
dbLocal.version(1).stores({
  pendingUploads: '++id, timestamp' // id autoincremental
});

/**
 * Guarda una evidencia en la cola local para subirla luego.
 * @param {File} file - El archivo de imagen o video.
 * @param {Object} docData - Todos los datos (actividad, alumnos, tags, fecha, etc).
 */
export async function saveOffline(file, docData) {
  try {
    // Convertir el File a Blob para guardarlo en Dexie
    // Dexie maneja Blobs nativamente, pero nos aseguramos.
    await dbLocal.pendingUploads.add({
      file: file, 
      metadata: docData, // Guardamos el objeto completo con tags, performance, etc.
      timestamp: Date.now()
    });
    console.log("Guardado offline en Dexie 📥");
  } catch (error) {
    console.error("Error guardando en Dexie:", error);
    throw new Error("No se pudo guardar localmente.");
  }
}

// Funciones auxiliares para el Sincronizador
export async function getPendingUploads() {
  return await dbLocal.pendingUploads.toArray();
}

export async function deletePendingUpload(id) {
  return await dbLocal.pendingUploads.delete(id);
}