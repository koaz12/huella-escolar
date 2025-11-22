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
  User, Filter, Search, Calendar, CheckSquare, Square, // <--- AQUÍ ESTABA EL ERROR (User)
  RefreshCw, Zap, ZoomIn, Video, Smartphone, Clock, 
  Smile, Meh, Frown, Lock, Unlock
} from 'lucide-react';

export function CaptureForm() {
  // --- ESTADOS DE DATOS ---
  const [activity, setActivity] = useState('');
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState([]); 
  const [performance, setPerformance] = useState(''); 
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]); 
  const [files, setFiles] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  
  // --- ESTADOS INTELIGENTES ---
  const [allActivities, setAllActivities] = useState([]); 
  const [suggestions, setSuggestions] = useState([]); 
  const [recentActivities, setRecentActivities] = useState([]); 
  const [keepData, setKeepData] = useState(false); 

  // --- ESTADOS DE ALUMNOS Y FILTROS ---
  const [students, setStudents] = useState([]); 
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [filters, setFilters] = useState(() => {
      const saved = localStorage.getItem('captureFilters');
      return saved ? JSON.parse(saved) : { level: 'Todos', shift: 'Todos', grade: 'Todos', section: 'Todos' };
  });
  const [searchTerm, setSearchTerm] = useState('');

  // --- ESTADOS CÁMARA ---
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraStream, setCameraStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [flashOn, setFlashOn] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomCap, setZoomCap] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  
  const nativeVideoInputRef = useRef(null);
  const nativePhotoInputRef = useRef(null);

  const AVAILABLE_TAGS = ['Evaluación', 'Práctica', 'Torneo', 'Conducta', 'Juego Libre'];

  // --- LOGICA BOTÓN ATRÁS ---
  useEffect(() => {
    if (isCameraOpen) {
      window.history.pushState({ cameraOpen: true }, "");
      const handlePopState = () => stopCamera(); 
      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
  }, [isCameraOpen]);

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
        
        const qHistory = query(collection(db, "evidence"), where("teacherId", "==", user.uid), orderBy("date", "desc"), limit(100));
        const unsubHistory = onSnapshot(qHistory, (qs) => {
            const namesSet = new Set();
            qs.forEach(doc => { const act = doc.data().activityName; if(act) namesSet.add(act); });
            const uniqueNames = Array.from(namesSet);
            setAllActivities(uniqueNames);
            setRecentActivities(uniqueNames.slice(0, 5));
        });

        return () => { unsubStudents(); unsubHistory(); };
      } else { setStudents([]); }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => { localStorage.setItem('captureFilters', JSON.stringify(filters)); }, [filters]);

  // --- FIX CÁMARA ---
  useEffect(() => {
    if (isCameraOpen && videoRef.current && cameraStream) {
        videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraOpen, cameraStream]);

  // --- HANDLERS ---
  const handleActivityChange = (e) => {
      const val = e.target.value;
      setActivity(val);
      if (val.length > 1) {
          const matches = allActivities.filter(a => a.toLowerCase().includes(val.toLowerCase()));
          setSuggestions(matches);
      } else { setSuggestions([]); }
  };
  const selectActivity = (name) => { setActivity(name); setSuggestions([]); };

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

  // --- CÁMARA ---
  const startCamera = async () => {
    try {
      if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); }
      const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, 
          audio: cameraMode === 'video' 
      });
      setCameraStream(stream);
      setIsCameraOpen(true);
      
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.zoom) setZoomCap(capabilities.zoom); else setZoomCap(null);
    } catch (err) { toast.error("Error cámara: " + err.message); }
  };

  const stopCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
    setCameraStream(null);
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const toggleFacingMode = () => {
      setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
      // Al cambiar modo, cerramos momentáneamente para reiniciar en el useEffect
      if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
  };
  
  useEffect(() => { if(isCameraOpen && !cameraStream) startCamera(); }, [facingMode, isCameraOpen]);

  const handleZoom = (e) => {
      const value = Number(e.target.value);
      setZoom(value);
      if (cameraStream) {
          const track = cameraStream.getVideoTracks()[0];
          if (track.applyConstraints) track.applyConstraints({ advanced: [{ zoom: value }] }).catch(e => console.log(e));
      }
  };

  const toggleFlash = () => {
      if (!cameraStream) return;
      const track = cameraStream.getVideoTracks()[0];
      const newStatus = !flashOn;
      setFlashOn(newStatus);
      if (track.applyConstraints) track.applyConstraints({ advanced: [{ torch: newStatus }] }).catch(() => toast("Flash no soportado"));
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (facingMode === 'user') { context.translate(canvas.width, 0); context.scale(-1, 1); }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
        if (!blob) return;
        const fileName = `capture_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        setFiles(prev => [...prev, file]);
        toast.success("Capturado", { duration: 1000, icon: '📸' });
    }, 'image/jpeg', 0.85);
  };

  const startRecording = () => {
      if (!cameraStream) return;
      chunksRef.current = [];
      try {
          const options = { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1500000 }; 
          const mediaRecorder = new MediaRecorder(cameraStream, MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined);
          mediaRecorderRef.current = mediaRecorder;
          mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
          mediaRecorder.onstop = () => {
              const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
              const fileName = `video_${Date.now()}.mp4`;
              const file = new File([blob], fileName, { type: 'video/mp4' });
              if (file.size > 50 * 1024 * 1024) toast.error("Video muy pesado. Descartado.");
              else { setFiles(prev => [...prev, file]); toast.success("Guardado", {icon: '🎥'}); }
              setRecordingTime(0);
          };
          mediaRecorder.start();
          setIsRecording(true);
          timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      } catch (e) { toast.error("Error al grabar: " + e.message); }
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

  const openNativeVideo = () => { if (nativeVideoInputRef.current) nativeVideoInputRef.current.click(); };
  const openNativePhoto = () => { if (nativePhotoInputRef.current) nativePhotoInputRef.current.click(); };

  const handleFilesChange = (e) => { 
    const selectedFiles = Array.from(e.target.files); 
    if (selectedFiles.length === 0) return;
    const validFiles = [];
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; 
    selectedFiles.forEach(file => {
        if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE) toast.error(`Video pesado ignorado.`);
        else validFiles.push(file);
    });
    setFiles(prev => [...prev, ...validFiles]); 
    e.target.value = "";
  };
  
  const removeFile = (index) => setFiles(prev => prev.filter((_, i) => i !== index));
  const toggleTag = (tag) => { if (tags.includes(tag)) setTags(prev => prev.filter(t => t !== tag)); else setTags(prev => [...prev, tag]); };
  const handleFilterChange = (field, value) => setFilters(prev => ({ ...prev, [field]: value }));

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
               tags: tags, performance: performance
          };
          if (!navigator.onLine) {
             await saveOffline(fileToUpload, docData); 
          } else {
             const storageRef = ref(storage, `evidencias/${auth.currentUser.uid}/${Date.now()}_${count}_${fileToUpload.name}`);
             const snapshot = await uploadBytes(storageRef, fileToUpload);
             const downloadURL = await getDownloadURL(snapshot.ref);
             await addDoc(collection(db, "evidence"), { ...docData, fileUrl: downloadURL, fileType: file.type.startsWith('video/') ? 'video' : 'image' });
          }
      }
      toast.success("¡Guardado!", { id: loadingToast });
      if (keepData) { setFiles([]); setSelectedStudents([]); } 
      else { setActivity(''); setComment(''); setPerformance(''); setFiles([]); setSelectedStudents([]); setTags([]); }
    } catch (error) { toast.error("Error: " + error.message, { id: loadingToast }); } finally { setLoading(false); }
  };

  const getPerfColor = (p) => {
      if (p === 'logrado') return { bg: '#ecfdf5', border: '#10b981', color: '#047857' };
      if (p === 'proceso') return { bg: '#fffbeb', border: '#f59e0b', color: '#b45309' };
      if (p === 'apoyo') return { bg: '#fef2f2', border: '#ef4444', color: '#b91c1c' };
      return { bg: 'white', border: '#e5e7eb', color: '#6b7280' };
  };

  const activePerf = {
    logrado: { background:'#ecfdf5', borderColor:'#10b981', color:'#047857' },
    proceso: { background:'#fffbeb', borderColor:'#f59e0b', color:'#b45309' },
    apoyo: { background:'#fef2f2', borderColor:'#ef4444', color:'#b91c1c' }
  };

  return (
    <div style={{ paddingBottom:'20px' }}>
      
      {/* CÁMARA OVERLAY */}
      {isCameraOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 9999, display:'flex', flexDirection:'column' }}>
            <div style={{padding:'15px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(0,0,0,0.3)', position:'absolute', top:0, left:0, right:0, zIndex:10}}>
                <div style={{display:'flex', gap:'20px'}}>
                    <button onClick={toggleFacingMode} style={{background:'none', border:'none', color:'white'}}><RefreshCw size={24}/></button>
                    <button onClick={toggleFlash} style={{background:'none', border:'none', color: flashOn ? '#f59e0b' : 'white'}}><Zap size={24} fill={flashOn ? 'currentColor' : 'none'}/></button>
                </div>
                {isRecording && <div style={{color:'#ef4444', fontWeight:'bold', fontSize:'18px', display:'flex', alignItems:'center', gap:'5px'}}><div style={{width:10, height:10, background:'red', borderRadius:'50%'}}></div> {formatTime(recordingTime)}</div>}
            </div>
            
            <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', flex:1, objectFit:'cover', transform: facingMode==='user' ? 'scaleX(-1)' : 'none' }}></video>
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            
            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'20px', background:'linear-gradient(to top, black, transparent)' }}>
                {zoomCap && (<div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px', padding:'0 20px'}}><ZoomIn size={20} color="white"/><input type="range" min={zoomCap.min} max={zoomCap.max} step={zoomCap.step} value={zoom} onChange={handleZoom} style={{width:'100%', accentColor:'#2563eb'}} /><span style={{color:'white', fontSize:'12px'}}>{zoom}x</span></div>)}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <button onClick={stopCamera} style={{ color:'white', background:'transparent', border:'none', display:'flex', flexDirection:'column', alignItems:'center' }}><Check size={30} color="#10b981"/> <span style={{fontSize:'10px'}}>Listo ({files.length})</span></button>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'10px'}}>
                        {cameraMode === 'photo' ? (
                            <button onClick={capturePhoto} style={{ width:'70px', height:'70px', borderRadius:'50%', background:'white', border:'4px solid #e5e5e5', display:'grid', placeItems:'center', padding:0 }}><div style={{width:'60px', height:'60px', borderRadius:'50%', border:'2px solid black'}}></div></button>
                        ) : (
                            <button onClick={isRecording ? stopRecording : startRecording} style={{ width:'70px', height:'70px', borderRadius:'50%', background: isRecording ? 'white' : '#ef4444', border:'4px solid #e5e5e5', display:'grid', placeItems:'center', padding:0 }}>{isRecording ? <Square size={30} fill="red" color="red"/> : <div style={{width:'60px', height:'60px', borderRadius:'50%', border:'2px solid white'}}></div>}</button>
                        )}
                        <div style={{background:'rgba(255,255,255,0.2)', borderRadius:'20px', padding:'4px', display:'flex'}}>
                            <button onClick={()=>!isRecording && setCameraMode('photo')} style={{padding:'5px 12px', borderRadius:'16px', border:'none', background: cameraMode==='photo' ? 'white' : 'transparent', color: cameraMode==='photo' ? 'black' : 'white', fontSize:'12px', fontWeight:'bold'}}>Foto</button>
                            <button onClick={()=>!isRecording && setCameraMode('video')} style={{padding:'5px 12px', borderRadius:'16px', border:'none', background: cameraMode==='video' ? 'white' : 'transparent', color: cameraMode==='video' ? 'black' : 'white', fontSize:'12px', fontWeight:'bold'}}>Video</button>
                        </div>
                    </div>
                    {files.length > 0 ? (<div style={{width:'40px', height:'40px', borderRadius:'8px', overflow:'hidden', border:'2px solid white'}}>{files[files.length-1].type.startsWith('video/') ? <div style={{width:'100%', height:'100%', background:'#333', display:'grid', placeItems:'center'}}><Video size={20} color="white"/></div> : <img src={URL.createObjectURL(files[files.length-1])} style={{width:'100%', height:'100%', objectFit:'cover'}} />}</div>) : <div style={{width:'40px'}}></div>}
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
            
            {/* ACTIVIDAD */}
            <div style={{position:'relative'}}>
                <label style={{fontSize:'11px', fontWeight:'bold', color:'#6b7280', marginBottom:'4px', display:'block'}}>ACTIVIDAD / TEMA</label>
                {recentActivities.length > 0 && (
                    <div style={{display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'8px', marginBottom:'5px'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'4px', color:'#666', fontSize:'10px', whiteSpace:'nowrap'}}><Clock size={10}/> Recientes:</div>
                        {recentActivities.map((act, i) => (
                            <button key={i} type="button" onClick={() => setActivity(act)} style={{fontSize:'11px', padding:'4px 10px', borderRadius:'12px', border:'1px solid #ddd', background: activity === act ? '#dbeafe' : '#f3f4f6', color: activity === act ? '#1e40af' : '#4b5563', whiteSpace:'nowrap', cursor:'pointer'}}>
                                {act}
                            </button>
                        ))}
                    </div>
                )}
                <input type="text" value={activity} onChange={handleActivityChange} placeholder="Ej: Baloncesto..." style={{ width: '100%', padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid #3b82f6', outline:'none', boxSizing:'border-box', backgroundColor: '#eff6ff' }} onBlur={() => setTimeout(() => setSuggestions([]), 200)}/>
                {suggestions.length > 0 && (
                    <ul style={{position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1px solid #ddd', borderRadius:'8px', zIndex:50, listStyle:'none', padding:0, margin:0, boxShadow:'0 4px 10px rgba(0,0,0,0.1)', maxHeight:'150px', overflowY:'auto'}}>
                        {suggestions.map((sug, i) => (<li key={i} onClick={() => selectActivity(sug)} style={{padding:'10px', borderBottom:'1px solid #eee', cursor:'pointer', fontSize:'14px', color:'#333'}}>{sug}</li>))}
                    </ul>
                )}
                <div style={{display:'flex', gap:'5px', flexWrap:'wrap', marginTop:'8px'}}>
                    {AVAILABLE_TAGS.map(tag => (
                        <button key={tag} type="button" onClick={() => toggleTag(tag)} style={{fontSize:'11px', padding:'4px 10px', borderRadius:'15px', border:'1px solid', borderColor: tags.includes(tag) ? '#2563eb' : '#e5e7eb', background: tags.includes(tag) ? '#eff6ff' : 'white', color: tags.includes(tag) ? '#1d4ed8' : '#6b7280', cursor:'pointer'}}>
                            {tags.includes(tag) && <Check size={10} style={{marginRight:'3px'}}/>} {tag}
                        </button>
                    ))}
                </div>
            </div>

            <input type="file" accept="video/*" capture="environment" ref={nativeVideoInputRef} onChange={handleFilesChange} style={{display:'none'}} />
            <input type="file" accept="image/*" capture="environment" ref={nativePhotoInputRef} onChange={handleFilesChange} style={{display:'none'}} />

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'8px'}}>
                <button type="button" onClick={startCamera} style={{border:'none', background:'#ecfdf5', padding:'10px', borderRadius:'8px', cursor:'pointer', color:'#059669', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px'}}><Camera size={20}/><div style={{fontWeight:'bold', fontSize:'9px'}}>Web</div></button>
                <button type="button" onClick={openNativePhoto} style={{border:'none', background:'#eff6ff', padding:'10px', borderRadius:'8px', cursor:'pointer', color:'#2563eb', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px'}}><ImageIcon size={20}/><div style={{fontWeight:'bold', fontSize:'9px'}}>HQ Foto</div></button>
                <button type="button" onClick={openNativeVideo} style={{border:'none', background:'#fef2f2', padding:'10px', borderRadius:'8px', cursor:'pointer', color:'#dc2626', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px'}}><Smartphone size={20}/><div style={{fontWeight:'bold', fontSize:'9px'}}>HQ Video</div></button>
                <label style={{border:'1px solid #ddd', background:'white', padding:'10px', borderRadius:'8px', cursor:'pointer', color:'#666', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px'}}><FolderPlus size={20}/><div style={{fontWeight:'bold', fontSize:'9px'}}>Galería</div><input type="file" multiple accept="image/*,video/*" onChange={handleFilesChange} style={{display:'none'}} /></label>
            </div>

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

            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentarios..." style={{ padding: '10px', height: '50px', borderRadius: '8px', border: '1px solid #d1d5db', width:'100%', boxSizing:'border-box' }} />

            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                  <div style={{fontSize:'11px', fontWeight:'bold', color:'#64748b', display:'flex', alignItems:'center', gap:'4px'}}><Filter size={12}/> FILTRAR CLASE:</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '5px', marginBottom: '10px' }}>
                 <select value={filters.level} onChange={e => handleFilterChange('level', e.target.value)} style={selectStyle}><option value="Todos">Todos Niveles</option><option>Primaria</option><option>Secundaria</option></select>
                 <select value={filters.shift} onChange={e => handleFilterChange('shift', e.target.value)} style={selectStyle}><option value="Todos">Todas Tandas</option><option>Matutina</option><option>Vespertina</option></select>
                 <select value={filters.grade} onChange={e => handleFilterChange('grade', e.target.value)} style={selectStyle}><option value="Todos">Todos Grados</option>{['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}</select>
                 <select value={filters.section} onChange={e => handleFilterChange('section', e.target.value)} style={selectStyle}><option value="Todos">Todas Sec.</option>{['A','B','C','D','E'].map(l=><option key={l}>{l}</option>)}</select>
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

            <div style={{background:'#f9fafb', padding:'15px', borderRadius:'12px', border:'1px solid #e5e7eb'}}>
                <label style={{fontSize:'11px', fontWeight:'bold', color:'#666', marginBottom:'8px', display:'block'}}>EVALUACIÓN (OPCIONAL)</label>
                <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                    <button type="button" onClick={()=>setPerformance('logrado')} style={{...perfBtnStyle, ...(performance==='logrado'?activePerf.logrado:{})}}><Smile/> Logrado</button>
                    <button type="button" onClick={()=>setPerformance('proceso')} style={{...perfBtnStyle, ...(performance==='proceso'?activePerf.proceso:{})}}><Meh/> Proceso</button>
                    <button type="button" onClick={()=>setPerformance('apoyo')} style={{...perfBtnStyle, ...(performance==='apoyo'?activePerf.apoyo:{})}}><Frown/> Apoyo</button>
                </div>
                
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                    <div style={{fontSize:'12px', color:'#666'}}>Guardando <strong>{files.length} archivos</strong> para <strong>{selectedStudents.length} alumnos</strong></div>
                    <button type="button" onClick={()=>setKeepData(!keepData)} style={{display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', border:'none', background:'transparent', color: keepData ? '#2563eb' : '#666', cursor:'pointer'}}>
                        {keepData ? <Lock size={14}/> : <Unlock size={14}/>} {keepData ? 'Mantener Datos' : 'Limpiar'}
                    </button>
                </div>

                <button type="submit" disabled={loading} style={{ width:'100%', backgroundColor: '#2563eb', color: 'white', padding: '14px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', boxShadow:'0 4px 10px rgba(37, 99, 235, 0.3)' }}>
                  {loading ? 'Guardando...' : `💾 Guardar Evidencia`}
                </button>
            </div>
          </form>
      </div>

      {previewFile && (
          <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}>
              <button onClick={()=>setPreviewFile(null)} style={{position:'absolute', top:'20px', right:'20px', background:'rgba(255,255,255,0.2)', color:'white', border:'none', padding:'10px', borderRadius:'50%'}}><X/></button>
              {previewFile.type.startsWith('video/') ? <video src={URL.createObjectURL(previewFile)} controls style={{maxWidth:'100%', maxHeight:'80vh'}}/> : <img src={URL.createObjectURL(previewFile)} style={{maxWidth:'100%', maxHeight:'80vh', objectFit:'contain'}}/>}
          </div>
      )}
    </div>
  );
}

const selectStyle = { padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', width:'100%', background:'white' };
const perfBtnStyle = { flex:1, padding:'10px', borderRadius:'8px', border:'1px solid #e5e7eb', background:'white', color:'#6b7280', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', fontSize:'11px', fontWeight:'bold', cursor:'pointer', transition:'all 0.2s' };
const activePerf = {
    logrado: { background:'#ecfdf5', borderColor:'#10b981', color:'#047857' },
    proceso: { background:'#fffbeb', borderColor:'#f59e0b', color:'#b45309' },
    apoyo: { background:'#fef2f2', borderColor:'#ef4444', color:'#b91c1c' }
};