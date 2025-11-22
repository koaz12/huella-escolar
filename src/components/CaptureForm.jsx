// src/components/CaptureForm.jsx
import { useState, useEffect, useRef } from 'react';
import { saveOffline } from '../db';
import { db, storage, auth } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import { 
  FolderPlus, Image as ImageIcon, Film, X, Camera, Check, 
  User, Filter, Search, Calendar, CheckSquare, Square,
  RefreshCw, Zap, ZoomIn, Tag, Eye, Video, StopCircle
} from 'lucide-react';

export function CaptureForm() {
  // --- ESTADOS DE DATOS ---
  const [activity, setActivity] = useState('');
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState([]); // NUEVO: Etiquetas de contexto
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]); 
  const [files, setFiles] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null); // NUEVO: Para ver foto en grande
  
  // --- ESTADOS DE ALUMNOS Y FILTROS ---
  const [students, setStudents] = useState([]); 
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [filters, setFilters] = useState(() => {
      const saved = localStorage.getItem('captureFilters');
      return saved ? JSON.parse(saved) : { level: 'Primaria', shift: 'Matutina', grade: 'Todos', section: 'Todos' };
  });
  const [searchTerm, setSearchTerm] = useState('');

  // --- ESTADOS CÁMARA AVANZADA ---
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState('photo'); // 'photo' | 'video'
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraStream, setCameraStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (trasera) | 'user' (frontal)
  const [flashOn, setFlashOn] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomCap, setZoomCap] = useState(null); // Capacidades de zoom del dispositivo

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Opciones de Tags
  const AVAILABLE_TAGS = ['Evaluación', 'Práctica', 'Torneo', 'Conducta', 'Juego Libre'];

  // --- 1. CARGA INICIAL ---
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
      } else { setStudents([]); }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => { localStorage.setItem('captureFilters', JSON.stringify(filters)); }, [filters]);

  // --- LÓGICA FILTRADO ---
  const visibleStudents = students.filter(student => {
    if (searchTerm !== '' && !student.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filters.level !== 'Todos' && student.level !== filters.level) return false;
    if (filters.shift !== 'Todos' && student.shift !== filters.shift) return false;
    if (filters.grade !== 'Todos' && student.grade !== filters.grade) return false;
    if (filters.section !== 'Todos' && student.section !== filters.section) return false;
    return true;
  });

  const toggleSelectAll = () => {
      const visibleIds = visibleStudents.map(s => s.id);
      const areAllSelected = visibleIds.length > 0 && visibleIds.every(id => selectedStudents.includes(id));
      if (areAllSelected) setSelectedStudents(prev => prev.filter(id => !visibleIds.includes(id)));
      else setSelectedStudents(prev => [...new Set([...prev, ...visibleIds])]);
  };

  const toggleStudent = (id) => {
    if (selectedStudents.includes(id)) setSelectedStudents(selectedStudents.filter(s => s !== id));
    else setSelectedStudents([...selectedStudents, id]);
  };

  // --- LÓGICA CÁMARA PRO ---
  
  // Iniciar Stream con configuraciones
  const startCamera = async () => {
    try {
      if (cameraStream) stopCamera(); // Detener anterior si existe
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
              facingMode: facingMode,
              width: { ideal: 1920 },
              height: { ideal: 1080 }
          }, 
          audio: cameraMode === 'video' // Solo pedir audio si es modo video
      });
      
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraOpen(true);

      // Detectar capacidades de hardware (Zoom/Flash)
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      
      if (capabilities.zoom) setZoomCap(capabilities.zoom);
      else setZoomCap(null);

    } catch (err) { toast.error("Error cámara: " + err.message); }
  };

  const stopCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
    setCameraStream(null);
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  // Cambiar cámara (Frontal/Trasera)
  const toggleFacingMode = () => {
      setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
      // El useEffect reiniciará la cámara al cambiar facingMode
  };
  useEffect(() => { if(isCameraOpen) startCamera(); }, [facingMode]);

  // Controlar Zoom
  const handleZoom = (e) => {
      const value = Number(e.target.value);
      setZoom(value);
      if (cameraStream) {
          const track = cameraStream.getVideoTracks()[0];
          if (track.applyConstraints) {
              track.applyConstraints({ advanced: [{ zoom: value }] }).catch(e => console.log(e));
          }
      }
  };

  // Controlar Flash (Antorcha)
  const toggleFlash = () => {
      if (!cameraStream) return;
      const track = cameraStream.getVideoTracks()[0];
      const newStatus = !flashOn;
      setFlashOn(newStatus);
      if (track.applyConstraints) {
          track.applyConstraints({ advanced: [{ torch: newStatus }] }).catch(() => toast("Flash no soportado en este dispositivo"));
      }
  };

  // --- CAPTURA FOTO ---
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    
    // Espejo si es frontal
    if (facingMode === 'user') {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
    }
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
        if (!blob) return;
        const fileName = `capture_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        setFiles(prev => [...prev, file]);
        toast.success("¡Foto capturada!", { duration: 1000, icon: '📸' });
    }, 'image/jpeg', 0.9);
  };

  // --- CAPTURA VIDEO ---
  const startRecording = () => {
      if (!cameraStream) return;
      chunksRef.current = [];
      try {
          const mediaRecorder = new MediaRecorder(cameraStream); // Codec automático
          mediaRecorderRef.current = mediaRecorder;
          
          mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunksRef.current.push(e.data);
          };

          mediaRecorder.onstop = () => {
              const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
              const fileName = `video_${Date.now()}.mp4`;
              const file = new File([blob], fileName, { type: 'video/mp4' });
              
              // Validar tamaño (50MB)
              if (file.size > 50 * 1024 * 1024) {
                  toast.error("Video muy pesado (>50MB). Descartado.");
              } else {
                  setFiles(prev => [...prev, file]);
                  toast.success("¡Video guardado!", {icon: '🎥'});
              }
              setRecordingTime(0);
          };

          mediaRecorder.start();
          setIsRecording(true);
          
          // Timer
          timerRef.current = setInterval(() => {
              setRecordingTime(prev => prev + 1);
          }, 1000);

      } catch (e) {
          toast.error("Error al grabar: " + e.message);
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          clearInterval(timerRef.current);
      }
  };

  const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- MANEJO ARCHIVOS ---
  const handleFilesChange = (e) => { 
    const selectedFiles = Array.from(e.target.files); 
    if (selectedFiles.length === 0) return;
    const validFiles = [];
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; 
    selectedFiles.forEach(file => {
        if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE) toast.error(`⚠️ Video pesado ignorado.`);
        else validFiles.push(file);
    });
    setFiles(prev => [...prev, ...validFiles]); 
  };
  
  const removeFile = (index) => setFiles(prev => prev.filter((_, i) => i !== index));

  // --- TAGS ---
  const toggleTag = (tag) => {
      if (tags.includes(tag)) setTags(prev => prev.filter(t => t !== tag));
      else setTags(prev => [...prev, tag]);
  };

  // --- GUARDADO ---
  const handleSave = async (e) => {
    e.preventDefault();
    if (files.length === 0 || !activity) return toast.error("Falta foto/video o actividad");
    setLoading(true);
    const loadingToast = toast.loading(`Subiendo ${files.length} archivos...`);
    try {
      const now = new Date();
      const [year, month, day] = customDate.split('-').map(Number);
      const finalDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes());

      let count = 0;
      for (const file of files) {
          count++;
          let fileToUpload = file;
          if (file.type.startsWith('image/')) {
            try { fileToUpload = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true }); } 
            catch (error) { console.error(error); }
          }
          
          const docData = {
               activityName: activity, comment: comment, studentIds: selectedStudents, date: finalDate, teacherId: auth.currentUser.uid,
               grade: filters.grade === 'Todos' ? 'Varios' : filters.grade,
               section: filters.section === 'Todos' ? 'Varios' : filters.section,
               tags: tags // GUARDAMOS LOS TAGS
          };

          if (!navigator.onLine) {
             // 2. USAMOS LA NUEVA FUNCIÓN DE DB.JS
             // Pasamos el archivo Y el objeto de datos completo
             await saveOffline(fileToUpload, docData);
          } else {
             const storageRef = ref(storage, `evidencias/${auth.currentUser.uid}/${Date.now()}_${count}_${fileToUpload.name}`);
             const snapshot = await uploadBytes(storageRef, fileToUpload);
             const downloadURL = await getDownloadURL(snapshot.ref);
             await addDoc(collection(db, "evidence"), { ...docData, fileUrl: downloadURL, fileType: file.type.startsWith('video/') ? 'video' : 'image' });
          }
      }
      toast.success("¡Guardado!", { id: loadingToast });
      setComment(''); setFiles([]); setSelectedStudents([]); setTags([]);
    } catch (error) { toast.error("Error: " + error.message, { id: loadingToast }); } finally { setLoading(false); }
  };

  const handleFilterChange = (field, value) => setFilters(prev => ({ ...prev, [field]: value }));

  return (
    <div style={{ paddingBottom:'20px' }}>
      
      {/* --- CÁMARA PRO OVERLAY --- */}
      {isCameraOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 9999, display:'flex', flexDirection:'column' }}>
            
            {/* TOP BAR: Controles Extra */}
            <div style={{padding:'15px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(0,0,0,0.3)', position:'absolute', top:0, left:0, right:0, zIndex:10}}>
                <div style={{display:'flex', gap:'20px'}}>
                    <button onClick={toggleFacingMode} style={{background:'none', border:'none', color:'white'}}><RefreshCw size={24}/></button>
                    <button onClick={toggleFlash} style={{background:'none', border:'none', color: flashOn ? '#f59e0b' : 'white'}}><Zap size={24} fill={flashOn ? 'currentColor' : 'none'}/></button>
                </div>
                {isRecording && <div style={{color:'#ef4444', fontWeight:'bold', fontSize:'18px', display:'flex', alignItems:'center', gap:'5px'}}><div style={{width:10, height:10, background:'red', borderRadius:'50%'}}></div> {formatTime(recordingTime)}</div>}
            </div>

            <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', flex:1, objectFit:'cover', transform: facingMode==='user' ? 'scaleX(-1)' : 'none' }}></video>
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            
            {/* CONTROLES INFERIORES */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'20px', background:'linear-gradient(to top, black, transparent)' }}>
                
                {/* SLIDER DE ZOOM (Solo si soporta) */}
                {zoomCap && (
                    <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px', padding:'0 20px'}}>
                        <ZoomIn size={20} color="white"/>
                        <input type="range" min={zoomCap.min} max={zoomCap.max} step={zoomCap.step} value={zoom} onChange={handleZoom} style={{width:'100%', accentColor:'#2563eb'}} />
                        <span style={{color:'white', fontSize:'12px'}}>{zoom}x</span>
                    </div>
                )}

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    {/* Cerrar */}
                    <button onClick={stopCamera} style={{ color:'white', background:'transparent', border:'none', display:'flex', flexDirection:'column', alignItems:'center' }}>
                        <Check size={30} color="#10b981"/> <span style={{fontSize:'10px'}}>Listo ({files.length})</span>
                    </button>

                    {/* OBTURADOR DINÁMICO */}
                    <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'10px'}}>
                        {cameraMode === 'photo' ? (
                            <button onClick={capturePhoto} style={{ width:'70px', height:'70px', borderRadius:'50%', background:'white', border:'4px solid #e5e5e5', display:'grid', placeItems:'center', padding:0 }}>
                                <div style={{width:'60px', height:'60px', borderRadius:'50%', border:'2px solid black'}}></div>
                            </button>
                        ) : (
                            <button onClick={isRecording ? stopRecording : startRecording} style={{ width:'70px', height:'70px', borderRadius:'50%', background: isRecording ? 'white' : '#ef4444', border:'4px solid #e5e5e5', display:'grid', placeItems:'center', padding:0 }}>
                                {isRecording ? <Square size={30} fill="red" color="red"/> : <div style={{width:'60px', height:'60px', borderRadius:'50%', border:'2px solid white'}}></div>}
                            </button>
                        )}
                        
                        {/* Selector Modo */}
                        <div style={{background:'rgba(255,255,255,0.2)', borderRadius:'20px', padding:'4px', display:'flex'}}>
                            <button onClick={()=>!isRecording && setCameraMode('photo')} style={{padding:'5px 12px', borderRadius:'16px', border:'none', background: cameraMode==='photo' ? 'white' : 'transparent', color: cameraMode==='photo' ? 'black' : 'white', fontSize:'12px', fontWeight:'bold'}}>Foto</button>
                            <button onClick={()=>!isRecording && setCameraMode('video')} style={{padding:'5px 12px', borderRadius:'16px', border:'none', background: cameraMode==='video' ? 'white' : 'transparent', color: cameraMode==='video' ? 'black' : 'white', fontSize:'12px', fontWeight:'bold'}}>Video</button>
                        </div>
                    </div>

                    {/* Galería Mini */}
                    {files.length > 0 ? (
                        <div style={{width:'40px', height:'40px', borderRadius:'8px', overflow:'hidden', border:'2px solid white'}}>
                             {files[files.length-1].type.startsWith('video/') ? <div style={{width:'100%', height:'100%', background:'#333', display:'grid', placeItems:'center'}}><Video size={20} color="white"/></div> : <img src={URL.createObjectURL(files[files.length-1])} style={{width:'100%', height:'100%', objectFit:'cover'}} />}
                        </div>
                    ) : <div style={{width:'40px'}}></div>}
                </div>
            </div>
        </div>
      )}

      <div style={{background:'white', padding:'15px', borderRadius:'12px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
          
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
              <h3 style={{margin: 0, color: '#1f2937'}}>📸 Nueva Evidencia</h3>
              <div style={{position:'relative'}}>
                  <Calendar size={16} style={{position:'absolute', left:'8px', top:'8px', color:'#666'}}/>
                  <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} style={{padding:'6px 6px 6px 28px', borderRadius:'8px', border:'1px solid #ccc', fontSize:'13px', color:'#444', fontWeight:'500'}}/>
              </div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* ACTIVIDAD + TAGS */}
            <div>
                <label style={{fontSize:'11px', fontWeight:'bold', color:'#6b7280', marginBottom:'4px', display:'block'}}>ACTIVIDAD / TEMA</label>
                <input list="activities-list" type="text" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Ej: Baloncesto, Voleibol..." style={{ width: '100%', padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid #3b82f6', outline:'none', boxSizing:'border-box', backgroundColor: '#eff6ff' }} />
                <datalist id="activities-list">{recentActivities.map((act, i) => <option key={i} value={act} />)}</datalist>
                
                {/* NUEVO: SELECCIÓN DE TAGS */}
                <div style={{display:'flex', gap:'5px', flexWrap:'wrap', marginTop:'8px'}}>
                    {AVAILABLE_TAGS.map(tag => (
                        <button key={tag} type="button" onClick={() => toggleTag(tag)} style={{fontSize:'11px', padding:'4px 10px', borderRadius:'15px', border:'1px solid', borderColor: tags.includes(tag) ? '#2563eb' : '#e5e7eb', background: tags.includes(tag) ? '#eff6ff' : 'white', color: tags.includes(tag) ? '#1d4ed8' : '#6b7280', cursor:'pointer'}}>
                            {tags.includes(tag) && <Check size={10} style={{marginRight:'3px'}}/>} {tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* BOTONES DE ENTRADA */}
            <div style={{display:'flex', gap:'10px'}}>
                <button type="button" onClick={startCamera} style={{flex: 1, border:'none', background:'#10b981', padding:'15px', borderRadius:'10px', textAlign:'center', cursor:'pointer', color:'white', boxShadow:'0 4px 6px rgba(16, 185, 129, 0.2)', display:'flex', flexDirection:'column', alignItems:'center', gap:'5px'}}>
                    <Camera size={28}/>
                    <div style={{fontWeight:'bold', fontSize:'14px'}}>Cámara Pro</div>
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
                        <div key={i} onClick={() => setPreviewFile(f)} style={{position:'relative', minWidth:'70px', height:'70px', borderRadius:'8px', overflow:'hidden', border:'1px solid #ddd', flexShrink:0, background:'white', cursor:'zoom-in'}}>
                            {f.type.startsWith('video/') ? <Film size={24} style={{position:'absolute', top:'22px', left:'22px', color:'#666'}}/> : <img src={URL.createObjectURL(f)} style={{width:'100%', height:'100%', objectFit:'cover'}}/>}
                            <button type="button" onClick={(e)=>{e.stopPropagation(); removeFile(i);}} style={{position:'absolute', top:0, right:0, background:'rgba(0,0,0,0.6)', color:'white', border:'none', width:'20px', height:'20px', display:'grid', placeItems:'center'}}><X size={12}/></button>
                        </div>
                    ))}
                </div>
            )}

            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentarios sobre la clase..." style={{ padding: '10px', height: '50px', borderRadius: '8px', border: '1px solid #d1d5db', width:'100%', boxSizing:'border-box' }} />

            {/* SECCIÓN ALUMNOS */}
            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                  <div style={{fontSize:'11px', fontWeight:'bold', color:'#64748b', display:'flex', alignItems:'center', gap:'4px'}}><Filter size={12}/> FILTRAR CLASE:</div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '5px', marginBottom: '10px' }}>
                 <select value={filters.level} onChange={e => handleFilterChange('level', e.target.value)} style={selectStyle}><option>Todos</option><option>Primaria</option><option>Secundaria</option></select>
                 <select value={filters.shift} onChange={e => handleFilterChange('shift', e.target.value)} style={selectStyle}><option>Todos</option><option>Matutina</option><option>Vespertina</option></select>
                 <select value={filters.grade} onChange={e => handleFilterChange('grade', e.target.value)} style={selectStyle}><option>Todos</option>{['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}</select>
                 <select value={filters.section} onChange={e => handleFilterChange('section', e.target.value)} style={selectStyle}><option>Todos</option>{['A','B','C','D','E'].map(l=><option key={l}>{l}</option>)}</select>
              </div>
              
              <div style={{display:'flex', gap:'8px', marginBottom:'10px'}}>
                  <div style={{position:'relative', flex:1}}>
                      <Search size={14} style={{position:'absolute', left:'8px', top:'8px', color:'#94a3b8'}}/>
                      <input placeholder="Buscar alumno..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{width:'100%', padding:'6px 6px 6px 28px', borderRadius:'6px', border:'1px solid #cbd5e1', fontSize:'13px', boxSizing:'border-box'}} />
                  </div>
                  <button type="button" onClick={toggleSelectAll} style={{fontSize: '11px', padding: '0 12px', borderRadius: '6px', fontWeight:'600', border: '1px solid', background: visibleStudents.length>0 && visibleStudents.every(s=>selectedStudents.includes(s.id)) ? '#fee2e2' : '#ecfdf5', borderColor: visibleStudents.length>0 && visibleStudents.every(s=>selectedStudents.includes(s.id)) ? '#fca5a5' : '#6ee7b7', color: visibleStudents.length>0 && visibleStudents.every(s=>selectedStudents.includes(s.id)) ? '#991b1b' : '#065f46', display:'flex', alignItems:'center', gap:'5px'}}>
                      {visibleStudents.length>0 && visibleStudents.every(s=>selectedStudents.includes(s.id)) ? <><Square size={14}/> Ninguno</> : <><CheckSquare size={14}/> Todos</>}
                  </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {visibleStudents.length === 0 && <p style={{gridColumn:'1/-1', textAlign:'center', color:'#999', fontSize:'12px', padding:'10px'}}>No hay alumnos con estos filtros.</p>}
                {visibleStudents.map(student => {
                   const isSelected = selectedStudents.includes(student.id);
                   return (
                      <div key={student.id} onClick={() => toggleStudent(student.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '8px', border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0', background: isSelected ? '#eff6ff' : 'white', cursor: 'pointer', transition: 'all 0.1s' }}>
                         <div style={{ width:'18px', height:'18px', borderRadius:'4px', border: isSelected ? 'none' : '2px solid #cbd5e1', background: isSelected ? '#2563eb' : 'transparent', display:'grid', placeItems:'center' }}>{isSelected && <Check size={12} color="white"/>}</div>
                         {student.photoUrl ? <img src={student.photoUrl} style={{width:'24px', height:'24px', borderRadius:'50%', objectFit:'cover'}}/> : <div style={{width:'24px', height:'24px', borderRadius:'50%', background:'#f1f5f9', display:'grid', placeItems:'center'}}><User size={14} color="#94a3b8"/></div>}
                         <div style={{overflow:'hidden'}}><div style={{fontSize:'12px', fontWeight:'600', color: isSelected ? '#1e40af' : '#333', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{student.name}</div><div style={{fontSize:'10px', color: isSelected ? '#60a5fa' : '#94a3b8'}}>#{student.listNumber}</div></div>
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

      {/* VISOR PREVIEW (MODAL) */}
      {previewFile && (
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}>
              <button onClick={()=>setPreviewFile(null)} style={{position:'absolute', top:'20px', right:'20px', background:'rgba(255,255,255,0.2)', color:'white', border:'none', padding:'10px', borderRadius:'50%'}}><X/></button>
              {previewFile.type.startsWith('video/') ? (
                  <video src={URL.createObjectURL(previewFile)} controls style={{maxWidth:'100%', maxHeight:'80vh'}}/>
              ) : (
                  <img src={URL.createObjectURL(previewFile)} style={{maxWidth:'100%', maxHeight:'80vh', objectFit:'contain'}}/>
              )}
          </div>
      )}
    </div>
  );
}

const selectStyle = { padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', width:'100%', background:'white' };