// src/components/EvidenceList.jsx
import { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Image as ImageIcon, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export function EvidenceList() {
  const [evidences, setEvidences] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Mostramos 5 evidencias por página para no saturar

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
      await deleteObject(fileRef).catch(e => console.log("Nube limpia", e));
      await deleteDoc(doc(db, "evidence", item.id));
      toast.success("Eliminada", { id: toastId });
    } catch (error) {
      toast.error("Error: " + error.message, { id: toastId });
    }
  };

  // Cálculos de paginación
  const totalPages = Math.ceil(evidences.length / itemsPerPage);
  const visibleEvidences = evidences.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return <div style={{textAlign:'center', marginTop:'50px', color:'#666'}}>Cargando galería...</div>;

  return (
    <div style={{ paddingBottom: '20px' }}>
      
      {/* ESTADO VACÍO */}
      {evidences.length === 0 && (
        <div style={{ height: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ccc', textAlign: 'center' }}>
          <ImageIcon size={64} strokeWidth={1} />
          <p style={{marginTop: '10px'}}>No hay evidencias aún.</p>
        </div>
      )}

      {/* LISTA PAGINADA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {visibleEvidences.map((item) => (
          <div key={item.id} style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#333' }}>{item.activityName}</h4>
                <small style={{ color: '#888', fontSize: '12px' }}>{item.date?.toDate ? item.date.toDate().toLocaleDateString() : ''}</small>
              </div>
              <button onClick={() => handleDelete(item)} style={{background: '#fee2e2', border: 'none', padding: '8px', borderRadius: '50%', color: '#dc2626'}}><Trash2 size={16} /></button>
            </div>
            <div style={{ background: '#000', display:'flex', justifyContent:'center' }}>
              {item.fileUrl.includes('.mp4') || item.fileUrl.includes('.webm') ? (
                <video src={item.fileUrl} controls style={{ maxWidth: '100%', maxHeight: '400px' }} />
              ) : (
                <img src={item.fileUrl} alt="Evidencia" style={{ maxWidth: '100%', objectFit: 'contain', maxHeight: '400px' }} />
              )}
            </div>
            <div style={{ padding: '12px' }}>
              {item.comment && <div style={{background: '#fffbeb', padding: '8px', borderRadius: '6px', marginBottom: '8px', fontSize: '13px', color: '#b45309'}}>📝 {item.comment}</div>}
              <div style={{ fontSize: '13px', color: '#555' }}><strong>👥 {item.studentIds?.length || 0} Alumnos</strong></div>
            </div>
          </div>
        ))}
      </div>

      {/* CONTROLES PAGINACIÓN */}
      {totalPages > 1 && (
        <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'15px', marginTop:'20px'}}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} style={{background:'white', border:'1px solid #ccc', padding:'8px', borderRadius:'6px'}}><ChevronLeft size={20}/></button>
          <span style={{fontSize:'14px', color:'#666'}}>Pág {currentPage} de {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} style={{background:'white', border:'1px solid #ccc', padding:'8px', borderRadius:'6px'}}><ChevronRight size={20}/></button>
        </div>
      )}
    </div>
  );
}