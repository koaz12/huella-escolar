// src/components/CaptureForm.jsx
import { useState, useEffect } from 'react';
import { dbLocal, saveOffline } from '../db';
import { db, storage, auth } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, onSnapshot, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';

export function CaptureForm() {
  const [activity, setActivity] = useState('');
  const [comment, setComment] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]); 
  const [selectedStudents, setSelectedStudents] = useState([]);

  // Filtros
  const [filterLevel, setFilterLevel] = useState('Primaria');
  const [filterShift, setFilterShift] = useState('Matutina');
  const [filterGrade, setFilterGrade] = useState('4to');
  const [filterSection, setFilterSection] = useState('A');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(collection(db, "students"), where("teacherId", "==", user.uid));
        const unsubscribeSnapshot = onSnapshot(q, (qs) => {
          const arr = [];
          qs.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
          arr.sort((a, b) => (Number(a.listNumber) || 0) - (Number(b.listNumber) || 0));
          setStudents(arr);
        }, (error) => {
            if(error.code !== 'permission-denied') toast.error("Error cargando alumnos");
        });
        return () => unsubscribeSnapshot();
      } else {
        setStudents([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const visibleStudents = students.filter(student => {
    if (searchTerm !== '') return student.name.toLowerCase().includes(searchTerm.toLowerCase());
    return (
      student.level === filterLevel &&
      student.shift === filterShift &&
      student.grade === filterGrade &&
      student.section === filterSection
    );
  });

  // 1. VALIDACIÓN AL SELECCIONAR EL ARCHIVO
  const handleFileChange = (e) => { 
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Límite para VIDEO: 50MB (50 * 1024 * 1024 bytes)
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; 
    
    if (selectedFile.type.startsWith('video/') && selectedFile.size > MAX_VIDEO_SIZE) {
        toast.error("⚠️ El video es muy pesado (Máx 50MB). Intenta grabarlo en menor calidad o más corto.", {
            duration: 5000, // Que dure 5 segundos el mensaje
            icon: '🎥'
        });
        e.target.value = ""; // Limpiar input
        setFile(null);
        return;
    }

    setFile(selectedFile); 
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
    if (!file || !activity) return toast.error("Falta foto o actividad");
    
    setLoading(true);
    const loadingToast = toast.loading("Procesando..."); 

    try {
      let fileToUpload = file;

      // 2. COMPRESIÓN (SOLO IMÁGENES)
      if (file.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 0.5,          
          maxWidthOrHeight: 1280,  
          useWebWorker: true       
        };
        
        try {
            toast.loading("Comprimiendo foto...", { id: loadingToast });
            const compressedFile = await imageCompression(file, options);
            fileToUpload = compressedFile;
        } catch (error) {
            console.error("Error comprimiendo:", error);
        }
      } else {
        // Si es video, avisamos que tardará un poco más
        toast.loading("Subiendo video (esto puede tardar)...", { id: loadingToast });
      }

      // 3. GUARDADO
      if (!navigator.onLine) {
        await saveOffline(fileToUpload, activity, selectedStudents, comment);
        toast.success("Guardado OFFLINE (Pendiente)", { id: loadingToast });
      } else {
        const storageRef = ref(storage, `evidencias/${auth.currentUser.uid}/${Date.now()}_${fileToUpload.name}`);
        const snapshot = await uploadBytes(storageRef, fileToUpload);
        const downloadURL = await getDownloadURL(snapshot.ref);

        await addDoc(collection(db, "evidence"), {
          activityName: activity,
          comment: comment,
          fileUrl: downloadURL,
          studentIds: selectedStudents,
          date: new Date(),
          teacherId: auth.currentUser.uid
        });
        toast.success("¡Subido Exitosamente!", { id: loadingToast });
      }
      
      setActivity(''); setComment(''); setFile(null); setSelectedStudents([]);
      document.getElementById('fileInput').value = ""; 

    } catch (error) {
      console.error(error);
      toast.error("Error: " + error.message, { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '15px', border: '1px solid #eee', borderRadius: '12px', background: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
      <h3 style={{marginTop: 0, color: '#444'}}>📸 Nueva Evidencia</h3>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input type="text" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Título Actividad" style={{ padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid #ddd' }} />
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentarios..." style={{ padding: '10px', height: '60px', borderRadius: '8px', border: '1px solid #ddd' }} />
        
        {/* Input con accept para video e imagen */}
        <input id="fileInput" type="file" accept="image/*,video/*" onChange={handleFileChange} />

        <div style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          {/* ... (Resto de los filtros y lista de alumnos IGUAL que antes) ... */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '5px' }}>
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}><option>Primaria</option><option>Secundaria</option></select>
            <select value={filterShift} onChange={e => setFilterShift(e.target.value)} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}><option>Matutina</option><option>Vespertina</option><option>Extendida</option></select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '10px' }}>
             <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>{['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}</select>
             <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>{['A','B','C','D','E'].map(l=><option key={l}>{l}</option>)}</select>
          </div>
          <input placeholder="Buscar alumno..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{width: '100%', padding: '8px', marginBottom: '5px', border: '1px solid #ccc', borderRadius: '6px'}} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <small style={{color:'#666'}}>Lista filtrada:</small>
            <button type="button" onClick={selectAllVisible} style={{fontSize: '12px', padding: '4px 8px', background: '#e9ecef', border: 'none', borderRadius: '4px'}}>Seleccionar Todos</button>
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'white', borderRadius: '4px', border: '1px solid #eee' }}>
            {visibleStudents.length === 0 && <p style={{textAlign:'center', color:'#999', padding:'10px'}}>No coincide ningún alumno.</p>}
            {visibleStudents.map(student => (
              <div key={student.id} style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor:'pointer' }}>
                  <input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={() => toggleStudent(student.id)} style={{ transform: 'scale(1.3)' }} />
                  <span style={{ fontSize: '14px' }}><strong>#{student.listNumber}</strong> {student.name}</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ backgroundColor: '#007bff', color: 'white', padding: '14px', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold' }}>
          {loading ? 'Procesando...' : '💾 Guardar Evidencia'}
        </button>
      </form>
    </div>
  );
}