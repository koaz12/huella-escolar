// src/components/CaptureForm.jsx
import { useState, useEffect } from 'react';
import { dbLocal, saveOffline } from '../db';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast'; // <--- IMPORTANTE

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
    const q = query(collection(db, "students"), orderBy("listNumber"));
    const unsubscribe = onSnapshot(q, (qs) => {
      const arr = [];
      qs.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
      setStudents(arr);
    });
    return () => unsubscribe();
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

  const handleFileChange = (e) => { if (e.target.files[0]) setFile(e.target.files[0]); };
  
  const toggleStudent = (id) => {
    if (selectedStudents.includes(id)) setSelectedStudents(selectedStudents.filter(s => s !== id));
    else setSelectedStudents([...selectedStudents, id]);
  };

  const selectAllVisible = () => {
    const visibleIds = visibleStudents.map(s => s.id);
    setSelectedStudents([...new Set([...selectedStudents, ...visibleIds])]);
    toast.success(`Seleccionados ${visibleIds.length} alumnos`); // FEEDBACK
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!file || !activity) return toast.error("❌ Falta foto o nombre de actividad");
    
    setLoading(true);
    const loadingToast = toast.loading("Guardando evidencia..."); // FEEDBACK DE CARGA

    try {
      if (!navigator.onLine) {
        await saveOffline(file, activity, selectedStudents, comment);
        toast.success("⚠️ Guardado en el celular (Sin Internet)", { id: loadingToast });
      } else {
        const storageRef = ref(storage, `evidencias/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        await addDoc(collection(db, "evidence"), {
          activityName: activity,
          comment: comment,
          fileUrl: downloadURL,
          studentIds: selectedStudents,
          date: new Date(),
          teacherId: "profe_123" 
        });
        toast.success("✅ ¡Subido a la nube!", { id: loadingToast });
      }
      
      setActivity('');
      setComment('');
      setFile(null);
      setSelectedStudents([]);
    } catch (error) {
      console.error(error);
      toast.error("Error: " + error.message, { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '15px', border: '1px solid #eee', borderRadius: '12px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h3 style={{marginTop: 0, color: '#444'}}>📸 Nueva Evidencia</h3>
      
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="text" 
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          placeholder="Título Actividad (Ej: Voleibol)"
          style={{ padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid #ddd', background: '#f9f9f9' }}
        />

        <textarea 
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comentarios..."
          style={{ padding: '10px', height: '60px', borderRadius: '8px', border: '1px solid #ddd' }}
        />

        <input type="file" accept="image/*,video/*" onChange={handleFileChange} style={{fontSize: '14px'}}/>

        {/* FILTROS */}
        <div style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={{flex:1, padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>
              <option value="Primaria">Primaria</option><option value="Secundaria">Secundaria</option>
            </select>
            <select value={filterShift} onChange={e => setFilterShift(e.target.value)} style={{flex:1, padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>
              <option value="Matutina">Matutina</option><option value="Vespertina">Vespertina</option><option value="Extendida">Extendida</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
             <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{flex:1, padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>
              <option value="1ro">1ro</option><option value="2do">2do</option><option value="3ro">3ro</option><option value="4to">4to</option><option value="5to">5to</option><option value="6to">6to</option>
            </select>
            <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={{flex:1, padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>
              {['A','B','C','D','E'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <input 
            placeholder="Buscar alumno..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{width: '100%', padding: '8px', marginBottom: '5px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box'}}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <small style={{color:'#666'}}>{visibleStudents.length} alumnos</small>
            <button type="button" onClick={selectAllVisible} style={{fontSize: '12px', padding: '4px 8px', background: '#e9ecef', border: 'none', borderRadius: '4px', cursor:'pointer'}}>Seleccionar Todos</button>
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'white', borderRadius: '4px', border: '1px solid #eee' }}>
            {visibleStudents.length === 0 ? (
              <p style={{padding: '10px', textAlign: 'center', color: '#999', fontSize:'12px'}}>No hay resultados.</p>
            ) : (
              visibleStudents.map(student => (
                <div key={student.id} style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      style={{ transform: 'scale(1.3)', accentColor: '#007bff' }}
                    />
                    <span style={{ fontSize: '14px' }}>
                       <strong>#{student.listNumber}</strong> {student.name}
                    </span>
                  </label>
                </div>
              ))
            )}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ backgroundColor: '#007bff', color: 'white', padding: '14px', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,123,255,0.2)' }}
        >
          {loading ? 'Guardando...' : '💾 Guardar Evidencia'}
        </button>
      </form>
    </div>
  );
}