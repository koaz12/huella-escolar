// src/components/EvidenceList.jsx
import { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

export function EvidenceList() {
  const [evidences, setEvidences] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "evidence"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvidences(docs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // FUNCIÓN PARA BORRAR
  const handleDelete = async (item) => {
    if (!confirm("¿Seguro que quieres borrar esta evidencia? No se puede recuperar.")) return;

    try {
      // 1. Borrar el video/foto del Storage (Nube)
      // Necesitamos extraer la referencia del URL
      const fileRef = ref(storage, item.fileUrl);
      await deleteObject(fileRef).catch(e => console.log("Archivo ya borrado o no encontrado", e));

      // 2. Borrar el documento de la base de datos
      await deleteDoc(doc(db, "evidence", item.id));
      
      alert("🗑️ Evidencia eliminada.");
    } catch (error) {
      console.error("Error borrando:", error);
      alert("Error al borrar: " + error.message);
    }
  };

  if (loading) return <p style={{textAlign: 'center'}}>Cargando galería...</p>;

  return (
    <div style={{ paddingBottom: '50px' }}>
      <h3 style={{ textAlign: 'center' }}>📂 Historial de Evidencias</h3>
      
      {evidences.length === 0 && <p style={{ textAlign: 'center', color: '#777' }}>Vacío.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {evidences.map((item) => (
          <div key={item.id} style={{ border: '1px solid #ddd', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', backgroundColor: 'white' }}>
            
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: '0 0 5px 0' }}>{item.activityName}</h4>
                <small style={{ color: '#666' }}>
                  📅 {item.date?.toDate ? item.date.toDate().toLocaleDateString() : 'Fecha desconocida'}
                </small>
              </div>
              {/* BOTÓN BORRAR */}
              <button onClick={() => handleDelete(item)} style={{background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer'}}>🗑️</button>
            </div>

            <div style={{ backgroundColor: 'black', textAlign: 'center' }}>
              {item.fileUrl.includes('.mp4') || item.fileUrl.includes('.webm') ? (
                <video src={item.fileUrl} controls style={{ width: '100%', maxHeight: '300px', display: 'block' }} />
              ) : (
                <img src={item.fileUrl} alt="Evidencia" style={{ width: '100%', objectFit: 'cover' }} />
              )}
            </div>

            <div style={{ padding: '10px' }}>
              {/* MOSTRAR COMENTARIO SI EXISTE */}
              {item.comment && (
                <div style={{background: '#fff3cd', padding: '5px', borderRadius: '4px', marginBottom: '10px', fontSize: '14px'}}>
                  📝 <em>{item.comment}</em>
                </div>
              )}
              <p style={{ margin: 0, fontSize: '14px' }}>
                <strong>👥 {item.studentIds?.length || 0} Alumnos:</strong>
              </p>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}