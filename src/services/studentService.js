// src/services/studentService.js
import { db } from '../firebase';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs 
} from 'firebase/firestore';

const COLLECTION_NAME = 'students';

export const StudentService = {
  
  // Crear nuevo alumno
  create: async (studentData, userId, userEmail) => {
    const dataToSave = {
      ...studentData,
      listNumber: Number(studentData.listNumber) || 0,
      teacherId: userId,
      teacherEmail: userEmail,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return await addDoc(collection(db, COLLECTION_NAME), dataToSave);
  },

  // Actualizar alumno existente
  update: async (id, studentData) => {
    const dataToUpdate = {
      ...studentData,
      listNumber: Number(studentData.listNumber) || 0,
      updatedAt: new Date()
    };
    // Si viene foto, la incluimos, si no, no sobreescribimos con null
    if (studentData.photoUrl === undefined) delete dataToUpdate.photoUrl;
    
    const docRef = doc(db, COLLECTION_NAME, id);
    return await updateDoc(docRef, dataToUpdate);
  },

  // Borrar alumno
  delete: async (id) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await deleteDoc(docRef);
  },

  // Verificar duplicados (ID Estudiante)
  checkDuplicateId: async (studentId, userId, excludeId = null) => {
    if (!studentId) return false;
    const q = query(
      collection(db, COLLECTION_NAME), 
      where("teacherId", "==", userId), 
      where("studentId", "==", studentId)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty && excludeId) {
      // Si estamos editando, verificar que no sea el mismo documento
      if (snapshot.docs[0].id === excludeId) return false;
    }
    return !snapshot.empty;
  }
};