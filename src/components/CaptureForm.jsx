// src/components/CaptureForm.jsx
import { useState, useEffect, useRef } from 'react';
import { saveOffline } from '../db';
import { db, storage, auth } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import { 
  FolderPlus, Image as ImageIcon, Film, X, Camera, Circle, Check, 
  User, Filter, Search 
} from 'lucide-react';

export function CaptureForm() {
  const [activity, setActivity] = useState('');
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]); 
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  // Estados Cámara
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Filtros
  const [filterLevel, setFilterLevel] = useState('Primaria');
  const [filterShift, setFilterShift] = useState('Matutina');
  const [filterGrade, setFilterGrade] = useState('4to');
  const [filterSection, setFilterSection] = useState('A');
  const [searchTerm, setSearchTerm] = useState('');

  // --- CARGA DE DATOS ---
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(collection(db, "students"), where("teacherId", "==", user.uid));
        const unsubStudents = onSnapshot(q, (qs) => {
          const arr = [];
          qs.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
          arr.sort((a, b) => (Number(a.listNumber) || 0) - (Number(b.listNumber) || 0));
          setStudents(arr);
        });
        const qRecent = query(collection(db, "evidence"), where("teacherId", "==", user.uid), orderBy("date", "desc"), limit(20));
        const unsubRecent = onSnapshot(qRecent, (qs) => {
            const names = new Set();
            qs.forEach(doc => names.add(doc.data().activityName));
            setRecentActivities([...names]);
        });
        return () => { unsubStudents(); unsubRecent(); };
      } else {
        setStudents([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const visibleStudents = students.filter(student => {
    if (searchTerm !== '') return student.name.toLowerCase().includes(searchTerm.toLowerCase());
    return (student.level === filterLevel && student.shift === filterShift && student.grade === filterGrade && student.section === filterSection);
  });

  // --- LÓGICA CÁMARA ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraOpen(true);
    } catch (err) { toast.error("Error cámara: " + err.message); }
  };

  const stopCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
    setCameraStream(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
        if (!blob) return;
        const fileName = `capture_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        setFiles(prev => [...prev, file]);
        toast.success("¡Foto capturada!", { duration: 1000, icon: '📸' });
    }, 'image/jpeg', 0.9);
  };

  // --- ARCHIVOS ---
  const handleFilesChange = (e) => { 
    const selectedFiles = Array.from(e.target.files); 
    if (selectedFiles.length === 0) return;
    const validFiles = [];
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; 
    selectedFiles.forEach(file => {
        if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE) {
            toast.error(`⚠️ Video muy pesado (>50MB). Ignorado.`);
        } else {
            validFiles.push(file);
        }
    });
    setFiles(prev => [...prev, ...validFiles]); 
  };
  
  const removeFile = (index) => setFiles(prev => prev.filter((_, i) => i !== index));

  // --- SELECCIÓN DE ALUMNOS (TOGGLE) ---
  const toggleStudent = (id) => {
    if (selectedStudents.includes(id)) setSelectedStudents(selectedStudents.filter(s => s !== id));
    else setSelectedStudents([...selectedStudents, id]);
  };

  const selectAllVisible = () => {
    const visibleIds = visibleStudents.map(s => s.id);
    // Si ya están todos seleccionados, deseleccionar todos
    const allSelected = visibleIds.every(id => selectedStudents.includes(id));
    if (allSelected) {
        setSelectedStudents(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
        setSelectedStudents(prev => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (files.length === 0 || !activity) return toast.error("Falta foto/video o actividad");
    setLoading(true);
    const loadingToast = toast.loading(`Subiendo ${files.length} archivos...`);
    try {
      let count = 0;
      for (const file of files) {
          count++;
          let fileToUpload = file;
          if (file.type.startsWith('image/')) {
            try { fileToUpload = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true }); } 
            catch (error) { console.error(error); }
          }
          if (!navigator.onLine) {
             await saveOffline(fileToUpload, activity, selectedStudents, comment);
          } else {
             const storageRef = ref(storage, `evidencias/${auth.currentUser.uid}/${Date.now()}_${count}_${fileToUpload.name}`);
             const snapshot = await uploadBytes(storageRef, fileToUpload);
             const downloadURL = await getDownloadURL(snapshot.ref);
             await addDoc(collection(db, "evidence"), {
               activityName: activity, comment: comment, fileUrl: downloadURL,
               fileType: file.type.startsWith('video/') ? 'video' : 'image',
               studentIds: selectedStudents, date: new Date(), teacherId: auth.currentUser.uid,
               grade: filterGrade, section: filterSection
             });
          }
      }
      toast.success("¡Guardado!", { id: loadingToast });
      setActivity(''); setComment(''); setFiles([]); setSelectedStudents([]);
    } catch (error) {
      console.error(error);
      toast.error("Error: " + error.message, { id: loadingToast });
    } finally { setLoading(false); }
  };

  return (
    <div style={{ paddingBottom:'20px' }}>
      
      {/* CÁMARA OVERLAY */}
      {isCameraOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 9999, display:'flex', flexDirection:'column' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width:'100%', flex:1, objectFit:'cover' }}></video>
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'30px 20px', background:'linear-gradient(to top, black, transparent)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <button onClick={stopCamera} style={{ color:'white', background:'transparent', border:'none', display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <Check size={32} color="#10b981"/> <span style={{fontSize:'12px', fontWeight:'bold'}}>Listo ({files.length})</span>
                </button>
                <button onClick={capturePhoto} style={{ width:'75px', height:'75px', borderRadius:'50%', background:'white', border:'4px solid #e5e5e5', display:'grid', placeItems:'center', padding:0, boxShadow:'0 0 15px rgba(0,0,0,0.5)' }}>
                    <div style={{width:'60px', height:'60px', borderRadius:'50%', border:'2px solid black'}}></div>
                </button>
                 {files.length > 0 && files[files.length-1].type.startsWith('image/') ? (
                    <div style={{width:'45px', height:'45px', borderRadius:'8px', overflow:'hidden', border:'2px solid white'}}>
                         <img src={URL.createObjectURL(files[files.length-1])} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                    </div>
                 ) : <div style={{width:'45px'}}></div>}
            </div>
        </div>
      )}

      <div style={{background:'white', padding:'15px', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
          <h3 style={{marginTop: 0, marginBottom:'15px', color: '#1f2937'}}>📸 Nueva Captura</h3>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* INPUT ACTIVIDAD */}
            <div>
                <label style={{fontSize:'11px', fontWeight:'bold', color:'#6b7280', marginBottom:'4px', display:'block'}}>ACTIVIDAD / TEMA</label>
                <input list="activities-list" type="text" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Ej: Voleibol, Resistencia..." style={{ width: '100%', padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid #3b82f6', outline:'none', boxSizing:'border-box' }} />
                <datalist id="activities-list">{recentActivities.map((act, i) => <option key={i} value={act} />)}</datalist>
            </div>

            {/* BOTONES GRANDES DE ACCIÓN */}
            <div style={{display:'flex', gap:'10px'}}>
                <button type="button" onClick={startCamera} style={{flex: 1, border:'none', background:'#10b981', padding:'15px', borderRadius:'10px', textAlign:'center', cursor:'pointer', color:'white', boxShadow:'0 4px 6px rgba(16, 185, 129, 0.2)', display:'flex', flexDirection:'column', alignItems:'center', gap:'5px'}}>
                    <Camera size={28}/>
                    <div style={{fontWeight:'bold', fontSize:'14px'}}>Cámara</div>
                </button>
                <label style={{flex: 1, border:'2px solid #3b82f6', background:'white', padding:'15px', borderRadius:'10px', textAlign:'center', cursor:'pointer', color:'#3b82f6', display:'flex', flexDirection:'column', alignItems:'center', gap:'5px'}}>
                    <FolderPlus size={28}/>
                    <div style={{fontWeight:'bold', fontSize:'14px'}}>Galería</div>
                    <input type="file" multiple accept="image/*,video/*" onChange={handleFilesChange} style={{display:'none'}} />
                </label>
            </div>

            {/* PREVIEW DE ARCHIVOS */}
            {files.length > 0 && (
                <div style={{display:'flex', gap:'8px', overflowX:'auto', padding:'10px', background:'#f9fafb', borderRadius:'8px', border:'1px solid #e5e7eb'}}>
                    {files.map((f, i) => (
                        <div key={i} style={{position:'relative', minWidth:'70px', height:'70px', borderRadius:'8px', overflow:'hidden', border:'1px solid #ddd', flexShrink:0, background:'white'}}>
                            {f.type.startsWith('video/') ? <Film size={24} style={{position:'absolute', top:'22px', left:'22px', color:'#666'}}/> : <img src={URL.createObjectURL(f)} style={{width:'100%', height:'100%', objectFit:'cover'}}/>}
                            <button type="button" onClick={()=>removeFile(i)} style={{position:'absolute', top:0, right:0, background:'rgba(0,0,0,0.6)', color:'white', border:'none', width:'20px', height:'20px', display:'grid', placeItems:'center'}}><X size={12}/></button>
                        </div>
                    ))}
                </div>
            )}

            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentarios sobre la clase..." style={{ padding: '10px', height: '50px', borderRadius: '8px', border: '1px solid #d1d5db', width:'100%', boxSizing:'border-box' }} />

            {/* SECCIÓN DE ALUMNOS (REDISEÑADA) */}
            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                  <div style={{fontSize:'11px', fontWeight:'bold', color:'#64748b', display:'flex', alignItems:'center', gap:'4px'}}><Filter size={12}/> FILTRAR CLASE:</div>
              </div>
              
              {/* FILTROS DE CLASE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '5px', marginBottom: '10px' }}>
                 <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={selectStyle}><option>Primaria</option><option>Secundaria</option></select>
                 <select value={filterShift} onChange={e => setFilterShift(e.target.value)} style={selectStyle}><option>Matutina</option><option>Vespertina</option></select>
                 <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={selectStyle}>{['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}</select>
                 <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={selectStyle}>{['A','B','C','D','E'].map(l=><option key={l}>{l}</option>)}</select>
              </div>
              
              {/* BARRA BUSCADOR Y SELECCIONAR TODOS */}
              <div style={{display:'flex', gap:'8px', marginBottom:'10px'}}>
                  <div style={{position:'relative', flex:1}}>
                      <Search size={14} style={{position:'absolute', left:'8px', top:'8px', color:'#94a3b8'}}/>
                      <input placeholder="Buscar alumno..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{width:'100%', padding:'6px 6px 6px 28px', borderRadius:'6px', border:'1px solid #cbd5e1', fontSize:'13px', boxSizing:'border-box'}} />
                  </div>
                  <button type="button" onClick={selectAllVisible} style={{fontSize: '11px', padding: '0 12px', background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight:'600', color:'#475569'}}>
                      Todos
                  </button>
              </div>

              {/* GRILLA DE CHIPS DE ALUMNOS (NUEVO DISEÑO) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {visibleStudents.length === 0 && <p style={{gridColumn:'1/-1', textAlign:'center', color:'#999', fontSize:'12px', padding:'10px'}}>No hay alumnos con estos filtros.</p>}
                
                {visibleStudents.map(student => {
                   const isSelected = selectedStudents.includes(student.id);
                   return (
                      <div 
                        key={student.id} 
                        onClick={() => toggleStudent(student.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px', borderRadius: '8px',
                            border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                            background: isSelected ? '#eff6ff' : 'white',
                            cursor: 'pointer', transition: 'all 0.1s'
                        }}
                      >
                         {/* Check visual */}
                         <div style={{
                             width:'18px', height:'18px', borderRadius:'4px', 
                             border: isSelected ? 'none' : '2px solid #cbd5e1',
                             background: isSelected ? '#2563eb' : 'transparent',
                             display:'grid', placeItems:'center'
                         }}>
                             {isSelected && <Check size={12} color="white"/>}
                         </div>
                         
                         {/* Foto mini */}
                         {student.photoUrl ? (
                             <img src={student.photoUrl} style={{width:'24px', height:'24px', borderRadius:'50%', objectFit:'cover'}}/>
                         ) : (
                             <div style={{width:'24px', height:'24px', borderRadius:'50%', background:'#f1f5f9', display:'grid', placeItems:'center'}}><User size={14} color="#94a3b8"/></div>
                         )}

                         <div style={{overflow:'hidden'}}>
                             <div style={{fontSize:'12px', fontWeight:'600', color: isSelected ? '#1e40af' : '#333', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{student.name}</div>
                             <div style={{fontSize:'10px', color: isSelected ? '#60a5fa' : '#94a3b8'}}>#{student.listNumber}</div>
                         </div>
                      </div>
                   )
                })}
              </div>
            </div>

            <button type="submit" disabled={loading} style={{ backgroundColor: '#2563eb', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', marginTop:'5px', boxShadow:'0 4px 10px rgba(37, 99, 235, 0.3)' }}>
              {loading ? 'Guardando...' : `💾 Guardar Evidencia`}
            </button>
          </form>
      </div>
    </div>
  );
}

const selectStyle = { padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', width:'100%', background:'white' };