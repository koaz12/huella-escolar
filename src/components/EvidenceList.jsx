// src/components/EvidenceList.jsx
import { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase';
import { collection, query, onSnapshot, doc, deleteDoc, where } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Image as ImageIcon, Trash2, ChevronLeft, ChevronRight, Search, LayoutGrid, List as ListIcon, X, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from './Skeleton';

export function EvidenceList() {
  const [evidences, setEvidences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = viewMode === 'grid' ? 12 : 5;

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        // SOLO MIS EVIDENCIAS
        const q = query(
          collection(db, "evidence"), 
          where("teacherId", "==", user.uid)
        );

        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Ordenar por fecha en JS
          docs.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate() : new Date(0);
            const dateB = b.date?.toDate ? b.date.toDate() : new Date(0);
            return dateB - dateA;
          });
          setEvidences(docs);
          setLoading(false);
        });
        return () => unsubscribeSnapshot();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleDelete = async (item) => {
    if (!confirm("¿Borrar?")) return;
    const toastId = toast.loading("Borrando...");
    try {
      const fileRef = ref(storage, item.fileUrl);
      await deleteObject(fileRef).catch(e => console.log("Nube limpia"));
      await deleteDoc(doc(db, "evidence", item.id));
      setSelectedItem(null);
      toast.success("Eliminada", { id: toastId });
    } catch (error) {
      toast.error("Error", { id: toastId });
    }
  };

  // Filtros y Paginación
  const filteredEvidences = evidences.filter(item => item.activityName.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.ceil(filteredEvidences.length / itemsPerPage);
  const visibleEvidences = filteredEvidences.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, viewMode]);

  if (loading) {
    return (
      <div style={{ paddingBottom: '20px' }}>
        {/* Skeleton del Buscador */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <Skeleton height="45px" />
          <Skeleton width="80px" height="45px" />
        </div>
        
        {/* Skeleton de la Grilla (Simulamos 9 fotos) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
          {[...Array(9)].map((_, i) => (
            <div key={i} style={{ aspectRatio: '1/1' }}>
              <Skeleton height="100%" style={{borderRadius: 0}} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#9ca3af' }} />
          <input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
        </div>
        <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '2px' }}>
          <button onClick={() => setViewMode('grid')} style={{ border: 'none', background: viewMode === 'grid' ? 'white' : 'transparent', padding: '8px', borderRadius: '6px' }}><LayoutGrid size={20} /></button>
          <button onClick={() => setViewMode('list')} style={{ border: 'none', background: viewMode === 'list' ? 'white' : 'transparent', padding: '8px', borderRadius: '6px' }}><ListIcon size={20} /></button>
        </div>
      </div>

      {filteredEvidences.length === 0 && <p style={{textAlign:'center', color:'#ccc'}}>Sin evidencias.</p>}

      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
          {visibleEvidences.map((item) => (
            <div key={item.id} onClick={() => setSelectedItem(item)} style={{ aspectRatio: '1/1', background: '#f1f5f9', overflow: 'hidden' }}>
              {item.fileUrl.includes('.mp4') ? <video src={item.fileUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={item.fileUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
          ))}
        </div>
      )}

      {viewMode === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {visibleEvidences.map((item) => (
            <div key={item.id} style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', background: 'white' }}>
              <div style={{ padding: '10px', borderBottom: '1px solid #f0f0f0', display:'flex', justifyContent:'space-between' }}>
                <strong>{item.activityName}</strong>
                <button onClick={() => handleDelete(item)}><Trash2 size={16} color="red"/></button>
              </div>
              <img src={item.fileUrl} style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', background:'black' }} />
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setSelectedItem(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius:'50%', border:'none', color:'white' }}><X size={24}/></button>
          {selectedItem.fileUrl.includes('.mp4') ? <video src={selectedItem.fileUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '70%' }} /> : <img src={selectedItem.fileUrl} style={{ maxWidth: '100%', maxHeight: '70%', objectFit: 'contain' }} />}
          <div style={{color:'white', marginTop:'20px', textAlign:'center'}}><h3>{selectedItem.activityName}</h3></div>
        </div>
      )}

       {/* Paginación */}
       {totalPages > 1 && (
        <div style={{display:'flex', justifyContent:'center', gap:'15px', marginTop:'20px'}}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} style={{background:'white', border:'1px solid #ccc', padding:'5px'}}><ChevronLeft/></button>
          <span style={{fontSize:'14px'}}>Pág {currentPage}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} style={{background:'white', border:'1px solid #ccc', padding:'5px'}}><ChevronRight/></button>
        </div>
      )}
    </div>
  );
}