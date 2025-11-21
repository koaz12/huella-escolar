// src/components/EvidenceList.jsx
import { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { 
  Trash2, Search, X, PlayCircle, Folder, ArrowLeft, 
  Edit2, Save, Filter, Download, User, Star, MoreVertical, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from './Skeleton';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export function EvidenceList() {
  // --- ESTADOS DE DATOS ---
  const [evidences, setEvidences] = useState([]);
  const [studentsMap, setStudentsMap] = useState({}); // Mapa ID -> Nombre (ej: "uid123": "Juan")
  const [studentsList, setStudentsList] = useState([]); // Array simple para selectores
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE VISTA Y FILTROS ---
  const [viewMode, setViewMode] = useState('folders'); // 'folders' | 'grid'
  const [filterActivity, setFilterActivity] = useState(null); // Si tiene valor, entramos a esa carpeta
  const [filterStudent, setFilterStudent] = useState(''); // ID del estudiante para filtrar "Portafolio"
  const [searchTerm, setSearchTerm] = useState('');

  // --- ESTADOS DE INTERACCIÓN ---
  const [inspectorItem, setInspectorItem] = useState(null); // Item abierto en el modal
  const [isEditing, setIsEditing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Datos temporales para el formulario de edición
  const [editData, setEditData] = useState({ activityName: '', comment: '', studentIds: [] });

  // 1. CARGA INICIAL (Evidencias + Alumnos para traducir IDs)
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        // A) Cargar Evidencias
        const qEv = query(collection(db, "evidence"), where("teacherId", "==", user.uid));
        const unsubEv = onSnapshot(qEv, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Ordenar: Favoritos primero, luego fecha
          docs.sort((a, b) => {
             if (a.isFavorite && !b.isFavorite) return -1;
             if (!a.isFavorite && b.isFavorite) return 1;
             return (b.date?.seconds || 0) - (a.date?.seconds || 0);
          });
          setEvidences(docs);
          setLoading(false);
        });

        // B) Cargar Alumnos (Para mostrar nombres en vez de IDs)
        const qStu = query(collection(db, "students"), where("teacherId", "==", user.uid));
        const unsubStu = onSnapshot(qStu, (qs) => {
           const map = {};
           const list = [];
           qs.forEach(d => {
               const data = d.data();
               map[d.id] = data.name; // Crear mapa de búsqueda rápida
               list.push({ id: d.id, name: data.name });
           });
           setStudentsMap(map);
           setStudentsList(list.sort((a,b) => a.name.localeCompare(b.name)));
        });

        return () => { unsubEv(); unsubStu(); };
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // --- LÓGICA DE FILTRADO INTELIGENTE ---
  const getFilteredEvidences = () => {
    return evidences.filter(item => {
      // 1. Filtro Texto (Busca en actividad o comentario)
      const matchesText = 
          item.activityName.toLowerCase().includes(searchTerm.toLowerCase()) || 
          (item.comment && item.comment.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // 2. Filtro Actividad (Carpeta)
      const matchesActivity = filterActivity ? item.activityName === filterActivity : true;
      
      // 3. Filtro Estudiante (Portafolio)
      const matchesStudent = filterStudent ? (item.studentIds && item.studentIds.includes(filterStudent)) : true;

      return matchesText && matchesActivity && matchesStudent;
    });
  };

  const filteredItems = getFilteredEvidences();

  // Agrupar por carpetas (solo si no estamos filtrando por estudiante)
  const folders = {};
  if (!filterStudent) {
      filteredItems.forEach(item => {
        const name = item.activityName || "Sin Nombre";
        if (!folders[name]) folders[name] = [];
        folders[name].push(item);
      });
  }

  // --- ACCIONES DEL GESTOR ---

  const handleDelete = async () => {
    if (!confirm("¿Borrar esta evidencia definitivamente?")) return;
    try {
      // Borrar de storage y db... (lógica igual a la anterior)
      const fileRef = ref(storage, inspectorItem.fileUrl);
      await deleteObject(fileRef).catch(() => {});
      await deleteDoc(doc(db, "evidence", inspectorItem.id));
      setInspectorItem(null);
      toast.success("Evidencia eliminada");
    } catch (error) {
      toast.error("Error borrando");
    }
  };

  const toggleFavorite = async (item, e) => {
    e?.stopPropagation(); // Evitar abrir el modal si toco la estrella
    try {
        await updateDoc(doc(db, "evidence", item.id), {
            isFavorite: !item.isFavorite
        });
        // Actualizar estado local si está abierto en inspector
        if(inspectorItem?.id === item.id) {
            setInspectorItem(prev => ({...prev, isFavorite: !prev.isFavorite}));
        }
        toast.success(item.isFavorite ? "Quitado de favoritos" : "Agregado a favoritos ⭐", {duration: 1000});
    } catch (e) { console.error(e); }
  };

  const handleUpdate = async () => {
    const toastId = toast.loading("Guardando cambios...");
    try {
        await updateDoc(doc(db, "evidence", inspectorItem.id), {
            activityName: editData.activityName,
            comment: editData.comment,
            studentIds: editData.studentIds
        });
        setInspectorItem(prev => ({...prev, ...editData}));
        setIsEditing(false);
        toast.success("Actualizado", {id: toastId});
    } catch (e) {
        toast.error("Error al guardar", {id: toastId});
    }
  };

  // --- DESCARGA ZIP (LA JOYA DE LA CORONA) ---
  const downloadFolderZip = async () => {
    if (filteredItems.length === 0) return;
    
    setIsDownloading(true);
    const toastId = toast.loading(`Empaquetando ${filteredItems.length} archivos...`);
    const zip = new JSZip();
    
    try {
        // Descargar cada archivo y añadirlo al ZIP
        const promises = filteredItems.map(async (item, index) => {
            const response = await fetch(item.fileUrl);
            const blob = await response.blob();
            // Nombre del archivo: 1_Juan_Actividad.jpg
            const ext = item.fileUrl.includes('.mp4') ? 'mp4' : 'jpg';
            const fileName = `${index+1}_${item.activityName}.${ext}`;
            zip.file(fileName, blob);
        });

        await Promise.all(promises);
        
        // Generar ZIP
        const content = await zip.generateAsync({type:"blob"});
        const zipName = filterActivity ? `${filterActivity}.zip` : `Evidencias_HuellaEscolar.zip`;
        saveAs(content, zipName);
        
        toast.success("¡Descarga lista!", {id: toastId});
    } catch (error) {
        console.error(error);
        toast.error("Error en descarga. Intenta con menos archivos.", {id: toastId});
    } finally {
        setIsDownloading(false);
    }
  };

  // --- RENDERIZADO ---

  if (loading) return <div style={{paddingBottom:'20px'}}><Skeleton height="50px" style={{marginBottom:'10px'}}/><Skeleton height="200px"/></div>;

  return (
    <div style={{ paddingBottom: '20px' }}>
      
      {/* 1. BARRA DE HERRAMIENTAS SUPERIOR (FILTROS) */}
      <div style={{background:'white', padding:'10px', borderRadius:'12px', marginBottom:'15px', border:'1px solid #e2e8f0', display:'flex', flexDirection:'column', gap:'10px'}}>
         
         <div style={{display:'flex', gap:'10px'}}>
             {/* Buscador Texto */}
             <div style={{position:'relative', flex:1}}>
                 <Search size={16} style={{position:'absolute', left:'10px', top:'10px', color:'#9ca3af'}}/>
                 <input 
                    placeholder="Buscar..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{width:'100%', padding:'8px 8px 8px 32px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'13px'}}
                 />
             </div>
             
             {/* Filtro Alumno (Modo Portafolio) */}
             <select 
                value={filterStudent} 
                onChange={e => { setFilterStudent(e.target.value); setFilterActivity(null); }}
                style={{maxWidth:'120px', padding:'8px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'12px', background: filterStudent ? '#eff6ff' : 'white'}}
             >
                 <option value="">👤 Todos</option>
                 {studentsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
         </div>

         {/* Breadcrumbs / Título de lo que veo */}
         <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
             <div style={{display:'flex', alignItems:'center', gap:'5px', fontSize:'14px', fontWeight:'bold', color:'#333'}}>
                 {filterStudent ? (
                     <>👤 Portafolio: <span style={{color:'#3b82f6'}}>{studentsMap[filterStudent] || 'Estudiante'}</span></>
                 ) : filterActivity ? (
                     <><button onClick={()=>setFilterActivity(null)} style={{background:'none', border:'none', cursor:'pointer'}}><ArrowLeft size={16}/></button> 📂 {filterActivity}</>
                 ) : (
                     <>📂 Todas las Carpetas</>
                 )}
             </div>
             
             {/* Botón Descargar ZIP (Solo si estoy filtrando algo) */}
             {(filterActivity || filterStudent) && (
                 <button onClick={downloadFolderZip} disabled={isDownloading} style={{display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', padding:'6px 10px', background:'#10b981', color:'white', border:'none', borderRadius:'20px'}}>
                     <Download size={12}/> {isDownloading ? '...' : 'ZIP'}
                 </button>
             )}
         </div>
      </div>

      {/* 2. VISTA DE CARPETAS (Solo si no filtro nada) */}
      {!filterActivity && !filterStudent && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
              {Object.keys(folders).map(name => (
                  <div key={name} onClick={() => setFilterActivity(name)} style={{background:'white', borderRadius:'10px', border:'1px solid #e2e8f0', padding:'10px', display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', boxShadow:'0 1px 2px rgba(0,0,0,0.05)'}}>
                      <Folder size={24} color="#3b82f6" fill="#dbeafe"/>
                      <div style={{overflow:'hidden'}}>
                          <div style={{fontWeight:'600', fontSize:'13px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{name}</div>
                          <div style={{fontSize:'10px', color:'#666'}}>{folders[name].length} archivos</div>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* 3. VISTA DE GRILLA (Si filtro actividad o alumno) */}
      {(filterActivity || filterStudent) && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'2px'}}>
              {filteredItems.map(item => (
                  <div key={item.id} onClick={() => { setInspectorItem(item); setIsEditing(false); }} style={{aspectRatio:'1/1', position:'relative', overflow:'hidden', background:'#f1f5f9'}}>
                      {/* Badge Video */}
                      {(item.fileUrl.includes('.mp4') || item.fileType === 'video') && <Film size={16} color="white" style={{position:'absolute', top:5, left:5, zIndex:2}}/>}
                      {/* Badge Favorito */}
                      {item.isFavorite && <Star size={16} color="#f59e0b" fill="#f59e0b" style={{position:'absolute', top:5, right:5, zIndex:2}}/>}
                      
                      {item.fileUrl.includes('.mp4') || item.fileType === 'video' ? (
                          <video src={item.fileUrl} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                      ) : (
                          <img src={item.fileUrl} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                      )}
                  </div>
              ))}
              {filteredItems.length === 0 && <p style={{gridColumn:'span 3', textAlign:'center', padding:'20px', color:'#999'}}>No se encontraron fotos.</p>}
          </div>
      )}

      {/* 4. EL INSPECTOR (VISOR PRO) */}
      {inspectorItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
            
            {/* Header del Inspector */}
            <div style={{padding:'15px', display:'flex', justifyContent:'space-between', alignItems:'center', color:'white'}}>
                <button onClick={() => setInspectorItem(null)} style={{background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', padding:'8px', color:'white'}}><X size={20}/></button>
                <div style={{display:'flex', gap:'15px'}}>
                    <button onClick={(e) => toggleFavorite(inspectorItem, e)} style={{background:'none', border:'none', color:'white'}}>
                        <Star size={24} fill={inspectorItem.isFavorite ? "#f59e0b" : "none"} color={inspectorItem.isFavorite ? "#f59e0b" : "white"}/>
                    </button>
                    <button onClick={() => {
                        setEditData({
                            activityName: inspectorItem.activityName, 
                            comment: inspectorItem.comment || '', 
                            studentIds: inspectorItem.studentIds || []
                        });
                        setIsEditing(!isEditing);
                    }} style={{background: isEditing ? '#3b82f6' : 'none', border:'none', color:'white', borderRadius:'4px', padding:'2px'}}>
                        <Edit2 size={24}/>
                    </button>
                </div>
            </div>

            {/* Área de Visualización (Centro) */}
            <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden'}}>
                {inspectorItem.fileUrl.includes('.mp4') || inspectorItem.fileType === 'video' ? (
                     <video src={inspectorItem.fileUrl} controls autoPlay style={{maxWidth:'100%', maxHeight:'100%'}} />
                ) : (
                     <img src={inspectorItem.fileUrl} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}} />
                )}
            </div>

            {/* Panel Inferior (Detalles) */}
            <div style={{background:'white', borderTopLeftRadius:'20px', borderTopRightRadius:'20px', maxHeight:'40vh', overflowY:'auto', transition:'all 0.3s'}}>
                {!isEditing ? (
                    // MODO LECTURA
                    <div style={{padding:'20px'}}>
                        <h3 style={{margin:'0 0 5px 0', fontSize:'18px'}}>{inspectorItem.activityName}</h3>
                        <p style={{fontSize:'12px', color:'#666', margin:0}}>
                            {inspectorItem.date?.toDate().toLocaleString()}
                        </p>
                        
                        {/* Lista de Alumnos Etiquetados */}
                        <div style={{display:'flex', flexWrap:'wrap', gap:'5px', marginTop:'10px'}}>
                            {inspectorItem.studentIds?.map(uid => (
                                <span key={uid} style={{fontSize:'11px', background:'#eff6ff', color:'#1e40af', padding:'3px 8px', borderRadius:'10px', display:'flex', alignItems:'center', gap:'3px'}}>
                                    <User size={10}/> {studentsMap[uid] || 'Desconocido'}
                                </span>
                            ))}
                        </div>

                        {inspectorItem.comment && (
                            <div style={{marginTop:'15px', background:'#f8f9fa', padding:'10px', borderRadius:'8px', fontSize:'14px', fontStyle:'italic'}}>
                                "{inspectorItem.comment}"
                            </div>
                        )}
                        
                        <div style={{marginTop:'20px', display:'flex', justifyContent:'flex-end'}}>
                             <button onClick={handleDelete} style={{color:'#ef4444', background:'none', border:'none', display:'flex', alignItems:'center', gap:'5px', fontSize:'12px'}}>
                                 <Trash2 size={14}/> Eliminar Evidencia
                             </button>
                        </div>
                    </div>
                ) : (
                    // MODO EDICIÓN
                    <div style={{padding:'20px', display:'flex', flexDirection:'column', gap:'10px'}}>
                        <label style={{fontSize:'11px', fontWeight:'bold', color:'#666'}}>Nombre Actividad</label>
                        <input 
                            value={editData.activityName} 
                            onChange={e => setEditData({...editData, activityName: e.target.value})}
                            style={{padding:'8px', border:'1px solid #ccc', borderRadius:'6px'}}
                        />

                        <label style={{fontSize:'11px', fontWeight:'bold', color:'#666'}}>Comentario</label>
                        <textarea 
                            value={editData.comment} 
                            onChange={e => setEditData({...editData, comment: e.target.value})}
                            style={{padding:'8px', border:'1px solid #ccc', borderRadius:'6px', height:'50px'}}
                        />

                        <label style={{fontSize:'11px', fontWeight:'bold', color:'#666'}}>Etiquetar Alumnos (Toque para agregar/quitar)</label>
                        <div style={{maxHeight:'100px', overflowY:'auto', border:'1px solid #eee', padding:'5px', borderRadius:'6px'}}>
                            {studentsList.map(s => {
                                const isSelected = editData.studentIds.includes(s.id);
                                return (
                                    <div 
                                        key={s.id} 
                                        onClick={() => {
                                            const newIds = isSelected 
                                                ? editData.studentIds.filter(id => id !== s.id)
                                                : [...editData.studentIds, s.id];
                                            setEditData({...editData, studentIds: newIds});
                                        }}
                                        style={{padding:'5px', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px', cursor:'pointer', background: isSelected ? '#eff6ff' : 'white'}}
                                    >
                                        {isSelected ? <Check size={14} color="blue"/> : <div style={{width:14}}/>}
                                        {s.name}
                                    </div>
                                )
                            })}
                        </div>
                        
                        <button onClick={handleUpdate} style={{marginTop:'10px', padding:'12px', background:'#3b82f6', color:'white', border:'none', borderRadius:'8px', fontWeight:'bold'}}>
                            Guardar Cambios
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
}