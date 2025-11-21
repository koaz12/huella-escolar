// src/components/CaptureForm.jsx
import { useState, useEffect, useRef } from 'react';
import { saveOffline } from '../db';
import { db, storage, auth } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
// IMPORTAMOS ICONOS NUEVOS PARA LA CÁMARA
import { FolderPlus, Image as ImageIcon, Film, X, Camera, Circle, Check } from 'lucide-react';

export function CaptureForm() {
  const [activity, setActivity] = useState('');
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]); 
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  // --- ESTADOS Y REFS PARA CÁMARA PERSONALIZADA ---
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

  // ... (El useEffect de cargar alumnos y actividades recientes SIGUE IGUAL) ...
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

  // --- LÓGICA DE CÁMARA MÚLTIPLE ---

  // 1. Iniciar Cámara
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, // Usa la cámara trasera si existe
        audio: false 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
    } catch (err) {
      toast.error("Error al abrir cámara: " + err.message);
    }
  };

  // 2. Detener Cámara
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
    setCameraStream(null);
  };

  // 3. Tomar Foto (Capturar frame del video)
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    // Ajustar tamaño del canvas al video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Dibujar el frame actual en el canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convertir canvas a archivo Blob
    canvas.toBlob((blob) => {
        if (!blob) return;
        // Crear un archivo con nombre único
        const fileName = `capture_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        
        // AGREGAR A LA LISTA PRINCIPAL DE ARCHIVOS
        setFiles(prev => [...prev, file]);
        toast.success("¡Foto capturada!", { duration: 1000, icon: '📸' });
    }, 'image/jpeg', 0.9); // Calidad 0.9
  };

  // --- LÓGICA DE ARCHIVOS NORMALES ---
  const handleFilesChange = (e) => { 
    const selectedFiles = Array.from(e.target.files); 
    if (selectedFiles.length === 0) return;
    const validFiles = [];
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; 
    selectedFiles.forEach(file => {
        if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE) {
            toast.error(`⚠️ Video "${file.name}" muy pesado (>50MB). Ignorado.`);
        } else {
            validFiles.push(file);
        }
    });
    setFiles(prev => [...prev, ...validFiles]); 
  };
  
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleStudent = (id) => {
    if (selectedStudents.includes(id)) setSelectedStudents(selectedStudents.filter(s => s !== id));
    else setSelectedStudents([...selectedStudents, id]);
  };

  const selectAllVisible = () => {
    const visibleIds = visibleStudents.map(s => s.id);
    setSelectedStudents(prev => [...new Set([...prev, ...visibleIds])]);
    toast.success(`Seleccionados: ${visibleIds.length}`);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (files.length === 0 || !activity) return toast.error("Falta foto/video o nombre de actividad");
    setLoading(true);
    const loadingToast = toast.loading(`Iniciando carga de ${files.length} archivos...`);
    try {
      let count = 0;
      for (const file of files) {
          count++;
          toast.loading(`Procesando archivo ${count} de ${files.length}...`, { id: loadingToast });
          let fileToUpload = file;
          if (file.type.startsWith('image/')) {
            try {
                const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1280, useWebWorker: true };
                fileToUpload = await imageCompression(file, options);
            } catch (error) { console.error("Error compresión", error); }
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
      toast.success("¡Todo subido correctamente!", { id: loadingToast });
      setActivity(''); setComment(''); setFiles([]); setSelectedStudents([]);
    } catch (error) {
      console.error(error);
      toast.error("Error: " + error.message, { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '15px', border: '1px solid #eee', borderRadius: '12px', background: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
      
      {/* --- INTERFAZ DE CÁMARA A PANTALLA COMPLETA (OVERLAY) --- */}
      {isCameraOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 9999, display:'flex', flexDirection:'column' }}>
            {/* Video en vivo */}
            <video ref={videoRef} autoPlay playsInline style={{ width:'100%', flex:1, objectFit:'cover' }}></video>
            {/* Canvas oculto para capturar */}
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            
            {/* Controles de Cámara */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'20px', background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                {/* Botón Cerrar/Listo */}
                <button onClick={stopCamera} style={{ color:'white', background:'transparent', border:'none', display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <Check size={30} color="#10b981"/>
                    <span style={{fontSize:'12px'}}>Listo ({files.length})</span>
                </button>

                {/* Botón Obturador (Disparar) */}
                <button onClick={capturePhoto} style={{ width:'70px', height:'70px', borderRadius:'50%', background:'white', border:'4px solid #ccc', display:'grid', placeItems:'center', padding:0 }}>
                    <Circle size={60} fill="white" color="#999" />
                </button>

                 {/* Miniatura de última foto (si hay) */}
                 {files.length > 0 && files[files.length-1].type.startsWith('image/') ? (
                    <div style={{width:'40px', height:'40px', borderRadius:'8px', overflow:'hidden', border:'2px solid white'}}>
                         <img src={URL.createObjectURL(files[files.length-1])} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                    </div>
                 ) : <div style={{width:'40px'}}></div>}
            </div>
        </div>
      )}

      <h3 style={{marginTop: 0, color: '#444'}}>📸 Carga Múltiple</h3>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {/* INPUT CON SUGERENCIAS (CARPETAS) */}
        <div>
            <label style={{fontSize:'12px', fontWeight:'bold', color:'#666'}}>Nombre de Actividad (Carpeta)</label>
            <input list="activities-list" type="text" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Ej: Baloncesto, Voleibol..." style={{ width: '100%', padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid #3b82f6', outline:'none' }} />
            <datalist id="activities-list">{recentActivities.map((act, i) => <option key={i} value={act} />)}</datalist>
        </div>

        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentarios (opcional)..." style={{ padding: '10px', height: '60px', borderRadius: '8px', border: '1px solid #ddd' }} />
        
        {/* --- ZONA DE BOTONES DE CARGA (NUEVO DISEÑO) --- */}
        <div style={{display:'flex', gap:'10px'}}>
            
            {/* BOTÓN 1: ABRIR CÁMARA MÚLTIPLE */}
            <button type="button" onClick={startCamera} style={{flex: 1, border:'2px dashed #10b981', background:'#ecfdf5', padding:'15px', borderRadius:'8px', textAlign:'center', cursor:'pointer', color:'#059669'}}>
                <Camera size={30} style={{marginBottom:'5px'}}/>
                <div style={{fontWeight:'bold'}}>Modo Cámara</div>
                <div style={{fontSize:'11px'}}>Tomar varias fotos seguidas</div>
            </button>

            {/* BOTÓN 2: SELECCIONAR ARCHIVOS (Input oculto) */}
            <label style={{flex: 1, border:'2px dashed #3b82f6', background:'#eff6ff', padding:'15px', borderRadius:'8px', textAlign:'center', cursor:'pointer', color:'#1d4ed8'}}>
                <FolderPlus size={30} style={{marginBottom:'5px'}}/>
                <div style={{fontWeight:'bold'}}>Galería/Archivos</div>
                <div style={{fontSize:'11px'}}>Elegir fotos o videos existentes</div>
                <input type="file" multiple accept="image/*,video/*" onChange={handleFilesChange} style={{display:'none'}} />
            </label>
        </div>

        {/* PREVISUALIZACIÓN DE ARCHIVOS SELECCIONADOS */}
        {files.length > 0 && (
            <div style={{display:'flex', gap:'10px', overflowX:'auto', padding:'5px', background:'#f8f9fa', borderRadius:'8px'}}>
                {files.map((f, i) => (
                    <div key={i} style={{position:'relative', minWidth:'60px', height:'60px', borderRadius:'8px', overflow:'hidden', border:'1px solid #ddd', flexShrink:0}}>
                        {f.type.startsWith('video/') ? <Film size={24} style={{position:'absolute', top:'18px', left:'18px', color:'#666'}}/> : <img src={URL.createObjectURL(f)} style={{width:'100%', height:'100%', objectFit:'cover'}}/>}
                        <button type="button" onClick={()=>removeFile(i)} style={{position:'absolute', top:0, right:0, background:'rgba(0,0,0,0.5)', color:'white', border:'none', padding:'2px'}}><X size={12}/></button>
                    </div>
                ))}
                <div style={{alignSelf:'center', fontSize:'12px', color:'#666', whiteSpace:'nowrap'}}>+{files.length} archivos</div>
            </div>
        )}

        <div style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          {/* ... (Selectores de filtro y lista de alumnos IGUAL que antes) ... */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '5px' }}>
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}><option>Primaria</option><option>Secundaria</option></select>
            <select value={filterShift} onChange={e => setFilterShift(e.target.value)} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}><option>Matutina</option><option>Vespertina</option><option>Extendida</option></select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '10px' }}>
             <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>{['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}</select>
             <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>{['A','B','C','D','E'].map(l=><option key={l}>{l}</option>)}</select>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <small style={{color:'#666'}}>Etiquetar alumnos visibles:</small>
            <button type="button" onClick={selectAllVisible} style={{fontSize: '12px', padding: '4px 8px', background: '#e9ecef', border: 'none', borderRadius: '4px'}}>Todos</button>
          </div>

          <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'white', borderRadius: '4px', border: '1px solid #eee' }}>
            {visibleStudents.map(student => (
              <div key={student.id} style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor:'pointer' }}>
                  <input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={() => toggleStudent(student.id)} style={{ transform: 'scale(1.3)' }} />
                  <span style={{ fontSize: '13px' }}><strong>#{student.listNumber}</strong> {student.name}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ backgroundColor: '#007bff', color: 'white', padding: '14px', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold' }}>
          {loading ? 'Subiendo...' : `💾 Guardar ${files.length} Evidencias`}
        </button>
      </form>
    </div>
  );
}