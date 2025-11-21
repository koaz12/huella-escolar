// src/components/EvidenceList.jsx
import { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, where } from 'firebase/firestore'; // <--- Agregamos updateDoc
import { ref, deleteObject } from 'firebase/storage';
import { 
  Trash2, Search, X, PlayCircle, Folder, ArrowLeft, 
  Edit2, Save, Image as ImageIcon, Film 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from './Skeleton'; 

export function EvidenceList() {
  const [evidences, setEvidences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados de Navegación
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Estados de Edición
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ activityName: '', comment: '' });

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(collection(db, "evidence"), where("teacherId", "==", user.uid));
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

  // --- ACCIONES ---

  const handleDelete = async (item) => {
    if (!confirm("¿Borrar esta evidencia permanentemente?")) return;
    const toastId = toast.loading("Borrando...");
    try {
      const fileRef = ref(storage, item.fileUrl);
      await deleteObject(fileRef).catch(e => console.log("Archivo ya no existía en nube"));
      await deleteDoc(doc(db, "evidence", item.id));
      setSelectedItem(null);
      toast.success("Eliminada", { id: toastId });
      
      // Verificar si la carpeta quedó vacía
      const remainingInFolder = evidences.filter(e => e.id !== item.id && e.activityName === selectedFolder);
      if (remainingInFolder.length === 0) setSelectedFolder(null);

    } catch (error) {
      toast.error("Error al borrar", { id: toastId });
    }
  };

  const startEditing = (item) => {
    setEditFormData({ activityName: item.activityName, comment: item.comment || '' });
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!editFormData.activityName.trim()) return toast.error("El nombre de la actividad es obligatorio");
    
    const toastId = toast.loading("Actualizando...");
    try {
      await updateDoc(doc(db, "evidence", selectedItem.id), {
        activityName: editFormData.activityName,
        comment: editFormData.comment
      });
      
      toast.success("Actualizado", { id: toastId });
      setIsEditing(false);
      
      // Si cambiamos el nombre de la actividad, la foto "desaparece" de la carpeta actual
      // porque técnicamente se movió a otra. Cerramos el modal.
      if (editFormData.activityName !== selectedFolder) {
          setSelectedItem(null);
          // Opcional: Podríamos mantenernos en la carpeta vieja o irnos a la raíz
      } else {
          // Actualizamos el item seleccionado visualmente
          setSelectedItem(prev => ({ ...prev, ...editFormData }));
      }

    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar", { id: toastId });
    }
  };

  // --- AGRUPACIÓN ---
  const filteredEvidences = evidences.filter(item => 
    item.activityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.grade && item.grade.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const folders = {};
  filteredEvidences.forEach(item => {
    const name = item.activityName || "Sin Nombre";
    if (!folders[name]) folders[name] = [];
    folders[name].push(item);
  });

  const folderContent = selectedFolder ? folders[selectedFolder] : [];

  if (loading) return <div style={{paddingBottom:'20px'}}><Skeleton height="45px"/><br/><Skeleton height="200px"/></div>;

  return (
    <div style={{ paddingBottom: '20px' }}>
      
      {/* HEADER NAVEGACIÓN */}
      <div style={{ marginBottom: '15px' }}>
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
            <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#9ca3af' }} />
                <input 
                    placeholder="Buscar carpeta o grado..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid #cbd5e1' }} 
                />
            </div>
        )}
      </div>

      {/* VISTA DE CARPETAS */}
      {!selectedFolder && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {Object.keys(folders).length === 0 && <p style={{gridColumn:'span 2', textAlign:'center', color:'#999'}}>No hay evidencias aún.</p>}
            {Object.keys(folders).map(folderName => {
                const items = folders[folderName];
                const lastItem = items[0];
                const isVideo = lastItem.fileUrl.includes('.mp4') || lastItem.fileType === 'video';
                return (
                    <div key={folderName} onClick={() => setSelectedFolder(folderName)} style={{background:'white', borderRadius:'12px', border:'1px solid #eee', overflow:'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', cursor:'pointer'}}>
                        <div style={{height:'100px', background:'#f1f5f9', position:'relative'}}>
                            {isVideo ? <div style={{width:'100%', height:'100%', display:'grid', placeItems:'center', background:'#333'}}><Film color="white" size={30}/></div> : <img src={lastItem.fileUrl} style={{width:'100%', height:'100%', objectFit:'cover'}} />}
                            <div style={{position:'absolute', top:'5px', right:'5px', background:'rgba(0,0,0,0.6)', color:'white', fontSize:'10px', padding:'2px 6px', borderRadius:'10px'}}>{items.length}</div>
                        </div>
                        <div style={{padding:'10px', display:'flex', alignItems:'center', gap:'8px'}}>
                            <Folder size={18} color="#3b82f6" fill="#dbeafe" />
                            <span style={{fontSize:'14px', fontWeight:'600', color:'#333', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{folderName}</span>
                        </div>
                    </div>
                )
            })}
        </div>
      )}

      {/* VISTA DE CONTENIDO */}
      {selectedFolder && folderContent && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
            {folderContent.map((item) => (
                <div key={item.id} onClick={() => {setSelectedItem(item); setIsEditing(false);}} style={{ aspectRatio: '1/1', background: '#f1f5f9', overflow: 'hidden', position:'relative', cursor:'pointer' }}>
                    {item.fileUrl.includes('.mp4') || item.fileType === 'video' ? (
                        <>
                            <video src={item.fileUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <PlayCircle size={24} color="white" style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)'}} />
                        </>
                    ) : <img src={item.fileUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
            ))}
        </div>
      )}

      {/* --- MODAL VISOR / EDITOR --- */}
      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          
          {/* Botón Cerrar */}
          <button onClick={() => setSelectedItem(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius:'50%', border:'none', color:'white', cursor:'pointer', zIndex:2010 }}><X size={24}/></button>
          
          {/* Contenido Multimedia */}
          <div style={{flex: 1, width:'100%', display:'flex', justifyContent:'center', alignItems:'center', padding:'20px'}}>
             {selectedItem.fileUrl.includes('.mp4') || selectedItem.fileType === 'video' ? (
                 <video src={selectedItem.fileUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '60vh' }} />
             ) : (
                 <img src={selectedItem.fileUrl} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
             )}
          </div>
          
          {/* PANEL DE INFORMACIÓN / EDICIÓN */}
          <div style={{width:'100%', background:'white', padding:'20px', borderTopLeftRadius:'20px', borderTopRightRadius:'20px', animation:'slideUp 0.3s ease-out'}}>
             
             {!isEditing ? (
                 // MODO LECTURA
                 <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
                        <div>
                            <h3 style={{margin:0, color:'#333'}}>{selectedItem.activityName}</h3>
                            <span style={{fontSize:'12px', color:'#666'}}>
                                {selectedItem.date?.toDate().toLocaleDateString()} • {selectedItem.grade} {selectedItem.section}
                            </span>
                        </div>
                        <div style={{display:'flex', gap:'10px'}}>
                            <button onClick={() => startEditing(selectedItem)} style={{background:'#f3f4f6', padding:'8px', borderRadius:'50%', border:'none', cursor:'pointer'}}><Edit2 size={20} color="#3b82f6"/></button>
                            <button onClick={() => handleDelete(selectedItem)} style={{background:'#fee2e2', padding:'8px', borderRadius:'50%', border:'none', cursor:'pointer'}}><Trash2 size={20} color="#ef4444"/></button>
                        </div>
                    </div>
                    {selectedItem.comment && <p style={{background:'#f8f9fa', padding:'10px', borderRadius:'8px', margin:0, fontSize:'14px', color:'#555'}}>"{selectedItem.comment}"</p>}
                 </div>
             ) : (
                 // MODO EDICIÓN
                 <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                    <label style={{fontSize:'12px', fontWeight:'bold', color:'#666'}}>Nombre Actividad (Mover carpeta)</label>
                    <input 
                        value={editFormData.activityName} 
                        onChange={e => setEditFormData({...editFormData, activityName: e.target.value})}
                        style={{padding:'10px', border:'1px solid #3b82f6', borderRadius:'8px'}}
                    />
                    
                    <label style={{fontSize:'12px', fontWeight:'bold', color:'#666'}}>Comentario</label>
                    <textarea 
                        value={editFormData.comment} 
                        onChange={e => setEditFormData({...editFormData, comment: e.target.value})}
                        style={{padding:'10px', border:'1px solid #ccc', borderRadius:'8px', height:'60px'}}
                    />

                    <div style={{display:'flex', gap:'10px', marginTop:'5px'}}>
                        <button onClick={() => setIsEditing(false)} style={{flex:1, padding:'12px', background:'#f3f4f6', border:'none', borderRadius:'8px', fontWeight:'bold', color:'#666'}}>Cancelar</button>
                        <button onClick={handleUpdate} style={{flex:1, padding:'12px', background:'#3b82f6', border:'none', borderRadius:'8px', fontWeight:'bold', color:'white', display:'flex', justifyContent:'center', gap:'5px'}}>
                            <Save size={18}/> Guardar Cambios
                        </button>
                    </div>
                 </div>
             )}
          </div>
        </div>
      )}
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}