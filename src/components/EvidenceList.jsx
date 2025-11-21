// src/components/EvidenceList.jsx
import { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase';
import { collection, query, onSnapshot, doc, deleteDoc, where } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { 
  Trash2, Search, X, PlayCircle, Folder, ArrowLeft, 
  ChevronRight, Image as ImageIcon, Film 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from './Skeleton'; 

export function EvidenceList() {
  const [evidences, setEvidences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- ESTADO NUEVO: CARPETAS ---
  const [selectedFolder, setSelectedFolder] = useState(null); // Si es null, veo carpetas. Si tiene texto, veo fotos.
  const [selectedItem, setSelectedItem] = useState(null); // Para el modal de pantalla completa

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(collection(db, "evidence"), where("teacherId", "==", user.uid));
        
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Ordenamos por fecha (lo más nuevo primero)
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
    if (!confirm("¿Borrar esta evidencia permanentemente?")) return;
    const toastId = toast.loading("Borrando...");
    try {
      // 1. Borrar archivo de Storage (Nube)
      const fileRef = ref(storage, item.fileUrl);
      await deleteObject(fileRef).catch(e => console.log("Archivo ya no existía en nube"));
      
      // 2. Borrar documento de Firestore (Base de datos)
      await deleteDoc(doc(db, "evidence", item.id));
      
      setSelectedItem(null);
      toast.success("Eliminada", { id: toastId });
      
      // Si borramos la última foto de una carpeta, nos salimos
      const remainingInFolder = evidences.filter(e => e.id !== item.id && e.activityName === selectedFolder);
      if (remainingInFolder.length === 0) setSelectedFolder(null);

    } catch (error) {
      toast.error("Error al borrar", { id: toastId });
    }
  };

  // --- LÓGICA DE AGRUPACIÓN (CARPETAS) ---
  
  // 1. Filtro global por buscador
  const filteredEvidences = evidences.filter(item => 
    item.activityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.grade && item.grade.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.section && item.section.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 2. Obtener lista única de carpetas (Nombres de actividades)
  const folders = {};
  filteredEvidences.forEach(item => {
    const name = item.activityName || "Sin Nombre";
    if (!folders[name]) folders[name] = [];
    folders[name].push(item);
  });

  // 3. Si estoy dentro de una carpeta, muestro solo sus archivos
  const folderContent = selectedFolder ? folders[selectedFolder] : [];

  // --- RENDERIZADO ---

  if (loading) {
    return (
      <div style={{ paddingBottom: '20px' }}>
        <Skeleton height="45px" style={{marginBottom:'15px'}}/>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {[...Array(6)].map((_, i) => <Skeleton key={i} height="100px" />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '20px' }}>
      
      {/* BARRA SUPERIOR */}
      <div style={{ marginBottom: '15px' }}>
        
        {/* Si estoy dentro de una carpeta, muestro botón ATRÁS */}
        {selectedFolder ? (
            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <button onClick={() => setSelectedFolder(null)} style={{background:'white', border:'1px solid #ddd', padding:'8px', borderRadius:'8px', cursor:'pointer'}}>
                    <ArrowLeft size={20}/>
                </button>
                <div>
                    <h3 style={{margin:0, fontSize:'18px', color:'#333'}}>{selectedFolder}</h3>
                    <span style={{fontSize:'12px', color:'#666'}}>{folderContent?.length || 0} archivos</span>
                </div>
            </div>
        ) : (
            // Si estoy fuera, muestro el BUSCADOR
            <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#9ca3af' }} />
                <input 
                    placeholder="Buscar carpeta, grado..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid #cbd5e1' }} 
                />
            </div>
        )}
      </div>

      {/* VISTA 1: LISTA DE CARPETAS */}
      {!selectedFolder && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {Object.keys(folders).length === 0 && <p style={{gridColumn:'span 2', textAlign:'center', color:'#999'}}>No hay evidencias aún.</p>}
            
            {Object.keys(folders).map(folderName => {
                const items = folders[folderName];
                const lastItem = items[0]; // La foto más reciente para la portada
                const isVideo = lastItem.fileUrl.includes('.mp4') || lastItem.fileType === 'video';

                return (
                    <div 
                        key={folderName} 
                        onClick={() => setSelectedFolder(folderName)}
                        style={{
                            background:'white', borderRadius:'12px', border:'1px solid #eee', overflow:'hidden',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)', cursor:'pointer'
                        }}
                    >
                        {/* Portada de la Carpeta (Miniatura) */}
                        <div style={{height:'100px', background:'#f1f5f9', position:'relative'}}>
                            {isVideo ? (
                                <div style={{width:'100%', height:'100%', display:'grid', placeItems:'center', background:'#333'}}>
                                    <Film color="white" size={30}/>
                                </div>
                            ) : (
                                <img src={lastItem.fileUrl} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                            )}
                            <div style={{position:'absolute', top:'5px', right:'5px', background:'rgba(0,0,0,0.6)', color:'white', fontSize:'10px', padding:'2px 6px', borderRadius:'10px'}}>
                                {items.length}
                            </div>
                        </div>
                        
                        {/* Nombre de la Carpeta */}
                        <div style={{padding:'10px', display:'flex', alignItems:'center', gap:'8px'}}>
                            <Folder size={18} color="#3b82f6" fill="#dbeafe" />
                            <span style={{fontSize:'14px', fontWeight:'600', color:'#333', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                                {folderName}
                            </span>
                        </div>
                    </div>
                )
            })}
        </div>
      )}

      {/* VISTA 2: CONTENIDO DE LA CARPETA (GRILLA) */}
      {selectedFolder && folderContent && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
            {folderContent.map((item) => (
                <div key={item.id} onClick={() => setSelectedItem(item)} style={{ aspectRatio: '1/1', background: '#f1f5f9', overflow: 'hidden', position:'relative', cursor:'pointer' }}>
                    {item.fileUrl.includes('.mp4') || item.fileType === 'video' ? (
                        <>
                            <video src={item.fileUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <PlayCircle size={24} color="white" style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)'}} />
                        </>
                    ) : (
                        <img src={item.fileUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                </div>
            ))}
        </div>
      )}

      {/* MODAL DE PANTALLA COMPLETA (VISOR) */}
      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          
          {/* Botón Cerrar */}
          <button onClick={() => setSelectedItem(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius:'50%', border:'none', color:'white', cursor:'pointer' }}><X size={24}/></button>
          
          {/* Botón Borrar */}
          <button onClick={() => handleDelete(selectedItem)} style={{ position: 'absolute', bottom: '30px', background: '#ef4444', color:'white', padding: '10px 20px', borderRadius:'30px', border:'none', display:'flex', gap:'8px', alignItems:'center', cursor:'pointer' }}>
            <Trash2 size={18}/> Borrar Evidencia
          </button>

          {/* Contenido */}
          {selectedItem.fileUrl.includes('.mp4') || selectedItem.fileType === 'video' ? (
              <video src={selectedItem.fileUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '70%' }} />
          ) : (
              <img src={selectedItem.fileUrl} style={{ maxWidth: '100%', maxHeight: '70%', objectFit: 'contain' }} />
          )}
          
          <div style={{color:'white', marginTop:'20px', textAlign:'center'}}>
             <h3>{selectedItem.activityName}</h3>
             <p style={{fontSize:'12px', opacity:0.8}}>
                {selectedItem.date?.toDate().toLocaleDateString()} - {selectedItem.grade} {selectedItem.section}
             </p>
             {selectedItem.comment && <p style={{fontStyle:'italic', marginTop:'5px'}}>"{selectedItem.comment}"</p>}
          </div>
        </div>
      )}
    </div>
  );
}