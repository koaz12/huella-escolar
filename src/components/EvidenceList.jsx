import { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { 
  Trash2, Search, X, Folder, ArrowLeft, 
  Edit2, Download, User, Star, PieChart, AlertTriangle, CheckCircle,
  Film, Smile, Meh, Frown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from './Skeleton';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export function EvidenceList({ initialStudentId }) {
  // --- ESTADOS ---
  const [evidences, setEvidences] = useState([]);
  const [studentsMap, setStudentsMap] = useState({});
  const [studentsList, setStudentsList] = useState([]); 
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filterActivity, setFilterActivity] = useState(null);
  const [filterStudent, setFilterStudent] = useState(initialStudentId || ''); // Inicializado con el prop
  const [filterPerformance, setFilterPerformance] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [showStats, setShowStats] = useState(false);

  // UI
  const [inspectorItem, setInspectorItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [editData, setEditData] = useState({ activityName: '', comment: '', studentIds: [], performance: '' });
  const [modalFilters, setModalFilters] = useState({ grade: 'Todos', section: 'Todos', level: 'Todos', shift: 'Todos' });

  // --- CARGA ---
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const qEv = query(collection(db, "evidence"), where("teacherId", "==", user.uid));
        const unsubEv = onSnapshot(qEv, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          docs.sort((a, b) => {
             if (a.isFavorite && !b.isFavorite) return -1;
             if (!a.isFavorite && b.isFavorite) return 1;
             return (b.date?.seconds || 0) - (a.date?.seconds || 0);
          });
          setEvidences(docs);
          setLoading(false);
        });

        const qStu = query(collection(db, "students"), where("teacherId", "==", user.uid));
        const unsubStu = onSnapshot(qStu, (qs) => {
           const map = {};
           const list = [];
           qs.forEach(d => {
               const data = d.data();
               map[d.id] = data.name; 
               list.push({ 
                   id: d.id, name: data.name,
                   grade: data.grade || '', section: data.section || '',
                   level: data.level || '', shift: data.shift || ''
               });
           });
           setStudentsMap(map);
           setStudentsList(list.sort((a,b) => a.name.localeCompare(b.name)));
        });
        return () => { unsubEv(); unsubStu(); };
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // --- HELPERS ---
  const getMissingStudents = () => {
      if (studentsList.length === 0) return [];
      const seenIds = new Set();
      evidences.forEach(ev => {
          if (ev.studentIds && Array.isArray(ev.studentIds)) ev.studentIds.forEach(id => seenIds.add(id));
      });
      return studentsList.filter(s => !seenIds.has(s.id));
  };
  const missingStudents = getMissingStudents();
  const coveragePercent = studentsList.length > 0 ? Math.round(((studentsList.length - missingStudents.length) / studentsList.length) * 100) : 0;

  const getFilteredEvidences = () => {
    return evidences.filter(item => {
      const matchesText = item.activityName.toLowerCase().includes(searchTerm.toLowerCase()) || (item.comment && item.comment.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesActivity = filterActivity ? item.activityName === filterActivity : true;
      const matchesStudent = filterStudent ? (item.studentIds && item.studentIds.includes(filterStudent)) : true;
      const matchesPerformance = filterPerformance === 'Todos' || item.performance === filterPerformance;
      return matchesText && matchesActivity && matchesStudent && matchesPerformance;
    });
  };
  const filteredItems = getFilteredEvidences();
  
  const folders = {};
  if (!filterStudent && filterPerformance === 'Todos') {
      filteredItems.forEach(item => {
        const name = item.activityName || "Sin Nombre";
        if (!folders[name]) folders[name] = [];
        folders[name].push(item);
      });
  }

  const getStudentsForEdit = () => {
      return studentsList.filter(s => {
          const matchGrade = modalFilters.grade === 'Todos' || s.grade === modalFilters.grade;
          const matchSection = modalFilters.section === 'Todos' || s.section === modalFilters.section;
          const matchLevel = modalFilters.level === 'Todos' || s.level === modalFilters.level;
          const matchShift = modalFilters.shift === 'Todos' || s.shift === modalFilters.shift;
          return matchGrade && matchSection && matchLevel && matchShift;
      });
  };

  const getPerformanceIcon = (perf) => {
      switch(perf) {
          case 'logrado': return <Smile size={16} color="#10b981" fill="#ecfdf5"/>;
          case 'proceso': return <Meh size={16} color="#f59e0b" fill="#fffbeb"/>;
          case 'apoyo': return <Frown size={16} color="#ef4444" fill="#fef2f2"/>;
          default: return null;
      }
  };
  const getPerformanceColor = (perf) => {
      switch(perf) {
          case 'logrado': return '#10b981';
          case 'proceso': return '#f59e0b';
          case 'apoyo': return '#ef4444';
          default: return '#e5e7eb';
      }
  };

  // --- ACCIONES ---
  const handleDelete = async () => {
    if (!confirm("¿Borrar esta evidencia definitivamente?")) return;
    try {
      const fileRef = ref(storage, inspectorItem.fileUrl);
      await deleteObject(fileRef).catch(() => {});
      await deleteDoc(doc(db, "evidence", inspectorItem.id));
      setInspectorItem(null);
      toast.success("Evidencia eliminada");
    } catch (error) { toast.error("Error borrando"); }
  };

  const toggleFavorite = async (item, e) => {
    e?.stopPropagation(); 
    try {
        await updateDoc(doc(db, "evidence", item.id), { isFavorite: !item.isFavorite });
        if(inspectorItem?.id === item.id) setInspectorItem(prev => ({...prev, isFavorite: !prev.isFavorite}));
        toast.success(item.isFavorite ? "Quitado de favoritos" : "Agregado a favoritos ⭐", {duration: 1000});
    } catch (e) { console.error(e); }
  };

  const handleUpdate = async () => {
    const toastId = toast.loading("Guardando cambios...");
    try {
        await updateDoc(doc(db, "evidence", inspectorItem.id), {
            activityName: editData.activityName, comment: editData.comment,
            studentIds: editData.studentIds, performance: editData.performance
        });
        setInspectorItem(prev => ({...prev, ...editData}));
        setIsEditing(false);
        toast.success("Actualizado", {id: toastId});
    } catch (e) { toast.error("Error al guardar", {id: toastId}); }
  };

  const downloadFolderZip = async () => {
    if (filteredItems.length === 0) return;
    setIsDownloading(true);
    const toastId = toast.loading(`Empaquetando ${filteredItems.length} archivos...`);
    const zip = new JSZip();
    try {
        const promises = filteredItems.map(async (item, index) => {
            const response = await fetch(item.fileUrl);
            const blob = await response.blob();
            const ext = item.fileUrl.includes('.mp4') ? 'mp4' : 'jpg';
            const fileName = `${index+1}_${item.activityName}.${ext}`;
            zip.file(fileName, blob);
        });
        await Promise.all(promises);
        const content = await zip.generateAsync({type:"blob"});
        const zipName = filterActivity ? `${filterActivity}.zip` : `Evidencias.zip`;
        saveAs(content, zipName);
        toast.success("¡Descarga lista!", {id: toastId});
    } catch (error) { console.error(error); toast.error("Error descarga.", {id: toastId}); } finally { setIsDownloading(false); }
  };

  if (loading) return <div style={{paddingBottom:'20px'}}><Skeleton height="50px" style={{marginBottom:'10px'}}/><Skeleton height="200px"/></div>;

  return (
    <div style={{ paddingBottom: '20px' }}>
      
      {/* TOOLBAR */}
      <div style={{background:'white', padding:'10px', borderRadius:'12px', marginBottom:'15px', border:'1px solid #e2e8f0', display:'flex', flexDirection:'column', gap:'10px'}}>
         <div style={{display:'flex', gap:'10px'}}>
             <div style={{position:'relative', flex:1}}>
                 <Search size={16} style={{position:'absolute', left:'10px', top:'10px', color:'#9ca3af'}}/>
                 <input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{width:'100%', padding:'8px 8px 8px 32px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'13px'}}/>
             </div>
             <select value={filterStudent} onChange={e => { setFilterStudent(e.target.value); setFilterActivity(null); }} style={{maxWidth:'120px', padding:'8px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'12px', background: filterStudent ? '#eff6ff' : 'white'}}>
                 <option value="">👤 Portafolio...</option>
                 {studentsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
         </div>

         <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
             <div style={{display:'flex', gap:'5px'}}>
                 <select value={filterPerformance} onChange={e=>setFilterPerformance(e.target.value)} style={{padding:'6px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'11px'}}>
                     <option value="Todos">🌈 Todos</option>
                     <option value="logrado">🟢 Logrado</option>
                     <option value="proceso">🟡 Proceso</option>
                     <option value="apoyo">🔴 Apoyo</option>
                 </select>
             </div>
             <div style={{display:'flex', gap:'5px'}}>
                 {(filterActivity || filterStudent) && <button onClick={downloadFolderZip} disabled={isDownloading} style={{display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', padding:'6px 10px', background:'#10b981', color:'white', border:'none', borderRadius:'20px'}}><Download size={12}/> ZIP</button>}
                 <button onClick={()=>setShowStats(!showStats)} style={{display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', padding:'6px 10px', background: showStats ? '#f59e0b' : '#f3f4f6', color: showStats ? 'white' : '#444', border:'none', borderRadius:'20px'}}><PieChart size={12}/></button>
             </div>
         </div>

         <div style={{display:'flex', alignItems:'center', gap:'5px', fontSize:'13px', fontWeight:'bold', color:'#333', marginTop:'5px'}}>
             {filterStudent ? (<>👤 Portafolio: <span style={{color:'#3b82f6'}}>{studentsMap[filterStudent]}</span></>) : filterActivity ? (<><button onClick={()=>setFilterActivity(null)} style={{background:'none', border:'none', cursor:'pointer'}}><ArrowLeft size={14}/></button> 📂 {filterActivity}</>) : (<>📂 Todas las Carpetas</>)}
         </div>

         {showStats && (
             <div style={{marginTop:'5px', paddingTop:'10px', borderTop:'1px dashed #e2e8f0', animation:'fadeIn 0.3s'}}>
                 <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
                     <span style={{fontSize:'12px', fontWeight:'bold', color:'#555'}}>Cobertura: {coveragePercent}%</span>
                     <span style={{fontSize:'12px', color:'#888'}}>{studentsList.length - missingStudents.length}/{studentsList.length}</span>
                 </div>
                 <div style={{width:'100%', height:'8px', background:'#e2e8f0', borderRadius:'4px', overflow:'hidden', marginBottom:'10px'}}>
                     <div style={{width:`${coveragePercent}%`, height:'100%', background: coveragePercent === 100 ? '#10b981' : coveragePercent > 50 ? '#f59e0b' : '#ef4444', transition:'width 0.5s'}}></div>
                 </div>
                 {missingStudents.length > 0 && <div style={{fontSize:'11px', color:'#b91c1c'}}>Faltan: {missingStudents.slice(0,5).map(s=>s.name).join(', ')}{missingStudents.length>5&&'...'}</div>}
             </div>
         )}
      </div>

      {/* VISTA CARPETAS */}
      {!filterActivity && !filterStudent && filterPerformance === 'Todos' && (
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
              {Object.keys(folders).length === 0 && filteredItems.length === 0 && <p style={{gridColumn:'span 2', textAlign:'center', color:'#999'}}>No hay evidencias.</p>}
          </div>
      )}

      {/* VISTA GRID */}
      {(filterActivity || filterStudent || filterPerformance !== 'Todos') && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'2px'}}>
              {filteredItems.map(item => (
                  <div key={item.id} onClick={() => { setInspectorItem(item); setIsEditing(false); }} style={{aspectRatio:'1/1', position:'relative', overflow:'hidden', background:'#f1f5f9', borderBottom:`3px solid ${getPerformanceColor(item.performance)}`}}>
                      {(item.fileUrl.includes('.mp4') || item.fileType === 'video') && <Film size={16} color="white" style={{position:'absolute', top:5, left:5, zIndex:2}}/>}
                      {item.isFavorite && <Star size={16} color="#f59e0b" fill="#f59e0b" style={{position:'absolute', top:5, right:5, zIndex:2}}/>}
                      {item.performance && <div style={{position:'absolute', bottom:5, right:5, zIndex:2}}>{getPerformanceIcon(item.performance)}</div>}
                      {item.fileUrl.includes('.mp4') || item.fileType === 'video' ? (
                          <video src={item.fileUrl} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                      ) : <img src={item.fileUrl} style={{width:'100%', height:'100%', objectFit:'cover'}} />}
                  </div>
              ))}
              {filteredItems.length === 0 && <p style={{gridColumn:'span 3', textAlign:'center', padding:'20px', color:'#999'}}>No se encontraron fotos.</p>}
          </div>
      )}

      {/* INSPECTOR */}
      {inspectorItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
            <div style={{padding:'15px', display:'flex', justifyContent:'space-between', alignItems:'center', color:'white'}}>
                <button onClick={() => setInspectorItem(null)} style={{background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', padding:'8px', color:'white'}}><X size={20}/></button>
                <div style={{display:'flex', gap:'15px'}}>
                    <button onClick={(e) => toggleFavorite(inspectorItem, e)} style={{background:'none', border:'none', color:'white'}}>
                        <Star size={24} fill={inspectorItem.isFavorite ? "#f59e0b" : "none"} color={inspectorItem.isFavorite ? "#f59e0b" : "white"}/>
                    </button>
                    <button onClick={() => {
                        setEditData({ activityName: inspectorItem.activityName, comment: inspectorItem.comment || '', studentIds: inspectorItem.studentIds || [], performance: inspectorItem.performance || '' });
                        setIsEditing(!isEditing);
                    }} style={{background: isEditing ? '#3b82f6' : 'none', border:'none', color:'white', borderRadius:'4px', padding:'2px'}}><Edit2 size={24}/></button>
                </div>
            </div>
            
            <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden'}}>
                {inspectorItem.fileUrl.includes('.mp4') || inspectorItem.fileType === 'video' ? (
                     <video src={inspectorItem.fileUrl} controls autoPlay style={{maxWidth:'100%', maxHeight:'100%'}} />
                ) : <img src={inspectorItem.fileUrl} style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}} />}
            </div>
            
            <div style={{background:'white', borderTopLeftRadius:'20px', borderTopRightRadius:'20px', maxHeight:'50vh', overflowY:'auto'}}>
                {!isEditing ? (
                    <div style={{padding:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
                            <h3 style={{margin:'0 0 5px 0', fontSize:'18px'}}>{inspectorItem.activityName}</h3>
                            {inspectorItem.performance && <span style={{display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', padding:'4px 8px', borderRadius:'12px', background: getPerformanceColor(inspectorItem.performance) + '20', color: getPerformanceColor(inspectorItem.performance), border:`1px solid ${getPerformanceColor(inspectorItem.performance)}`, fontWeight:'bold', textTransform:'uppercase'}}>{getPerformanceIcon(inspectorItem.performance)} {inspectorItem.performance}</span>}
                        </div>
                        <p style={{fontSize:'12px', color:'#666', margin:0}}>{inspectorItem.date?.toDate().toLocaleString()}</p>
                        <div style={{display:'flex', flexWrap:'wrap', gap:'5px', marginTop:'10px'}}>
                            {inspectorItem.studentIds?.map(uid => <span key={uid} style={{fontSize:'11px', background:'#eff6ff', color:'#1e40af', padding:'3px 8px', borderRadius:'10px', display:'flex', alignItems:'center', gap:'3px'}}><User size={10}/> {studentsMap[uid] || 'Desconocido'}</span>)}
                        </div>
                        {inspectorItem.comment && <div style={{marginTop:'15px', background:'#f8f9fa', padding:'10px', borderRadius:'8px', fontSize:'14px', fontStyle:'italic'}}>"{inspectorItem.comment}"</div>}
                        <div style={{marginTop:'20px', display:'flex', justifyContent:'flex-end'}}>
                             <button onClick={handleDelete} style={{color:'#ef4444', background:'none', border:'none', display:'flex', alignItems:'center', gap:'5px', fontSize:'12px'}}><Trash2 size={14}/> Eliminar</button>
                        </div>
                    </div>
                ) : (
                    <div style={{padding:'20px', display:'flex', flexDirection:'column', gap:'10px'}}>
                        <label style={{fontSize:'11px', fontWeight:'bold', color:'#666'}}>Evaluación de Desempeño</label>
                        <div style={{display:'flex', gap:'10px'}}>
                            <button onClick={()=>setEditData({...editData, performance: 'logrado'})} style={{flex:1, padding:'8px', borderRadius:'8px', border:`2px solid ${editData.performance==='logrado' ? '#10b981' : '#e5e7eb'}`, background: editData.performance==='logrado' ? '#ecfdf5' : 'white', display:'flex', flexDirection:'column', alignItems:'center', gap:'2px'}}><Smile color="#10b981"/> <span style={{fontSize:'10px', color:'#10b981'}}>Logrado</span></button>
                            <button onClick={()=>setEditData({...editData, performance: 'proceso'})} style={{flex:1, padding:'8px', borderRadius:'8px', border:`2px solid ${editData.performance==='proceso' ? '#f59e0b' : '#e5e7eb'}`, background: editData.performance==='proceso' ? '#fffbeb' : 'white', display:'flex', flexDirection:'column', alignItems:'center', gap:'2px'}}><Meh color="#f59e0b"/> <span style={{fontSize:'10px', color:'#f59e0b'}}>Proceso</span></button>
                            <button onClick={()=>setEditData({...editData, performance: 'apoyo'})} style={{flex:1, padding:'8px', borderRadius:'8px', border:`2px solid ${editData.performance==='apoyo' ? '#ef4444' : '#e5e7eb'}`, background: editData.performance==='apoyo' ? '#fef2f2' : 'white', display:'flex', flexDirection:'column', alignItems:'center', gap:'2px'}}><Frown color="#ef4444"/> <span style={{fontSize:'10px', color:'#ef4444'}}>Apoyo</span></button>
                        </div>

                        <div style={{padding:'10px', background:'#f8f9fa', borderRadius:'8px', border:'1px solid #e2e8f0'}}>
                            <div style={{fontSize:'11px', fontWeight:'bold', color:'#666', marginBottom:'5px'}}>Filtrar lista de Alumnos:</div>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginBottom:'5px'}}>
                                <select value={modalFilters.level} onChange={e=>setModalFilters({...modalFilters, level:e.target.value})} style={selectStyle}><option>Todos</option><option>Primaria</option><option>Secundaria</option></select>
                                <select value={modalFilters.shift} onChange={e=>setModalFilters({...modalFilters, shift:e.target.value})} style={selectStyle}><option>Todos</option><option>Matutina</option><option>Vespertina</option><option>Extendida</option></select>
                            </div>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px'}}>
                                <select value={modalFilters.grade} onChange={e=>setModalFilters({...modalFilters, grade:e.target.value})} style={selectStyle}><option>Todos</option>{['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}</select>
                                <select value={modalFilters.section} onChange={e=>setModalFilters({...modalFilters, section:e.target.value})} style={selectStyle}><option>Todos</option>{['A','B','C','D','E'].map(o=><option key={o}>{o}</option>)}</select>
                            </div>
                        </div>

                        <label style={{fontSize:'11px', fontWeight:'bold', color:'#666'}}>Etiquetar ({getStudentsForEdit().length} visibles)</label>
                        <div style={{maxHeight:'100px', overflowY:'auto', border:'1px solid #eee', padding:'5px', borderRadius:'6px'}}>
                            {getStudentsForEdit().map(s => {
                                const isSelected = editData.studentIds.includes(s.id);
                                return (
                                    <div key={s.id} onClick={() => {
                                        const newIds = isSelected ? editData.studentIds.filter(id => id !== s.id) : [...editData.studentIds, s.id];
                                        setEditData({...editData, studentIds: newIds});
                                    }} style={{padding:'6px', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px', cursor:'pointer', background: isSelected ? '#eff6ff' : 'white', borderBottom:'1px solid #f9fafb'}}>
                                        {isSelected ? <CheckCircle size={14} color="blue"/> : <div style={{width:14}}/>}
                                        <span>{s.name} <small style={{color:'#999'}}>({s.grade} {s.section})</small></span>
                                    </div>
                                )
                            })}
                        </div>

                        <label style={{fontSize:'11px', fontWeight:'bold', color:'#666'}}>Nombre Actividad</label>
                        <input value={editData.activityName} onChange={e => setEditData({...editData, activityName: e.target.value})} style={{padding:'8px', border:'1px solid #ccc', borderRadius:'6px'}}/>
                        
                        <label style={{fontSize:'11px', fontWeight:'bold', color:'#666'}}>Comentario</label>
                        <textarea value={editData.comment} onChange={e => setEditData({...editData, comment: e.target.value})} style={{padding:'8px', border:'1px solid #ccc', borderRadius:'6px', height:'40px'}}/>
                        
                        <button onClick={handleUpdate} style={{marginTop:'5px', padding:'12px', background:'#3b82f6', color:'white', border:'none', borderRadius:'8px', fontWeight:'bold'}}>Guardar Cambios</button>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
}

const selectStyle = { padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '11px' };