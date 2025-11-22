// src/hooks/useStudents.js
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

export function useStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(
            collection(db, "students"), 
            where("teacherId", "==", user.uid)
        );

        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          try {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Ordenar: Grado -> Sección -> Número lista
            data.sort((a, b) => {
                if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
                if (a.section !== b.section) return a.section.localeCompare(b.section);
                return (Number(a.listNumber) || 0) - (Number(b.listNumber) || 0);
            });

            setStudents(data);
            setLoading(false);
          } catch (err) {
            console.error("Error procesando alumnos:", err);
            setError(err);
          }
        }, (err) => {
          console.error("Error Firebase:", err);
          setError(err);
          setLoading(false);
        });

        return () => unsubscribeSnapshot();
      } else {
        setStudents([]);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  return { students, loading, error };
}