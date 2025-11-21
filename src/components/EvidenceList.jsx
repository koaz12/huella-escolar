// src/components/EvidenceList.jsx
import { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Image as ImageIcon, Trash2 } from 'lucide-react'; // Iconos
import toast from 'react-hot-toast';

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

  const handleDelete = async (item) => {
    if (!confirm("¿Seguro que quieres borrar esta evidencia?")) return;
    const toastId = toast.loading("Borrando...");
    try {
      const fileRef = ref(storage, item.fileUrl);
      await deleteObject(fileRef).catch(e => console.log("Archivo no encontrado en nube", e));
      await deleteDoc(doc(db, "evidence", item.id));
      toast.success("Eliminada", { id: toastId });
    } catch (error) {
      toast.error("Error: " + error.message, { id: toastId });
    }
  };

  if (loading) return <div style={{textAlign:'center', marginTop:'50px', color:'#666'}}>Cargando galería...</div>;

  return (
    <div style={{ paddingBottom: '20px' }}>
      
      {/* --- ESTADO VACÍO CORREGIDO --- */}
      {evidences.length === 0 && (
        <div style={{ 
          height: '60vh', // Ocupa el 60% de la pantalla para mantener estructura
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: '#ccc',
          textAlign: 'center'
        }}>
          <ImageIcon size={64} strokeWidth={1} />
          <p style={{marginTop: '10px'}}>No hay evidencias aún.<br/><small>Ve a la pestaña Captura</small></p>
        </div>
      )}

      {/* --- LISTA DE EVIDENCIAS --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {evidences.map((item) => (
          <div key={item.id} style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            
            {/* Encabezado Tarjeta */}
            <div style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#333' }}>{item.activityName}</h4>
                <small style={{ color: '#888', fontSize: '12px' }}>
                  {item.date?.toDate ? item.date.toDate().toLocaleDateString() : 'Fecha desc.'}
                </small>
              </div>
              <button onClick={() => handleDelete(item)} style={{background: '#fee2e2', border: 'none', padding: '8px', borderRadius: '50%', color: '#dc2626', display:'flex'}}>
                <Trash2 size={16} />
              </button>
            </div>

            {/* Media */}
            <div style={{ background: '#000', display:'flex', justifyContent:'center' }}>
              {item.fileUrl.includes('.mp4') || item.fileUrl.includes('.webm') ? (
                <video src={item.fileUrl} controls style={{ maxWidth: '100%', maxHeight: '400px' }} />
              ) : (
                <img src={item.fileUrl} alt="Evidencia" style={{ maxWidth: '100%', objectFit: 'contain', maxHeight: '400px' }} />
              )}
            </div>

            {/* Pie de página */}
            <div style={{ padding: '12px' }}>
              {item.comment && (
                <div style={{background: '#fffbeb', padding: '8px', borderRadius: '6px', marginBottom: '8px', fontSize: '13px', color: '#b45309'}}>
                  📝 {item.comment}
                </div>
              )}
              <div style={{ fontSize: '13px', color: '#555' }}>
                <strong>👥 {item.studentIds?.length || 0} Alumnos etiquetados</strong>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}