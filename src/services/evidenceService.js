// src/services/evidenceService.js
import { db, storage } from '../firebase';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const COLLECTION_NAME = 'evidence';

export const EvidenceService = {

  // 1. Subir archivo y Crear documento (Todo en uno)
  uploadAndCreate: async (file, data, userId) => {
    // A. Subir imagen/video a Storage
    const storageRef = ref(storage, `evidencias/${userId}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    // B. Guardar en Firestore
    const docData = {
      ...data,
      fileUrl: downloadURL,
      fileType: file.type.startsWith('video/') ? 'video' : 'image',
      createdAt: new Date()
    };

    return await addDoc(collection(db, COLLECTION_NAME), docData);
  },

  // 2. Solo Crear documento (Para cuando ya tienes la URL o es offline sync)
  createDoc: async (data) => {
    return await addDoc(collection(db, COLLECTION_NAME), data);
  },

  // 3. Actualizar datos (comentarios, tags, semáforo)
  update: async (id, data) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await updateDoc(docRef, data);
  },

  // 4. Borrar (Elimina de BD y de la Nube)
  delete: async (id, fileUrl) => {
    // Intentar borrar archivo de nube (si existe)
    if (fileUrl) {
      try {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
      } catch (e) {
        console.warn("Archivo no encontrado en storage o ya borrado", e);
      }
    }
    // Borrar documento
    const docRef = doc(db, COLLECTION_NAME, id);
    return await deleteDoc(docRef);
  },

  // 5. Toggle Favorito
  toggleFavorite: async (id, currentStatus) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await updateDoc(docRef, { isFavorite: !currentStatus });
  }
};