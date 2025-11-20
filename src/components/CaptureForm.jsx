// src/components/CaptureForm.jsx
import { useState, useEffect } from 'react';
import { dbLocal, saveOffline } from '../db';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

export function CaptureForm() {
  const [activity, setActivity] = useState('');
  const [comment, setComment] = useState(''); // NUEVO: Comentario
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);

  // --- FILTROS ---
  const [filterLevel, setFilterLevel] = useState('Primaria');
  const [filterShift, setFilterShift] = useState('Matutina');
  const [filterGrade, setFilterGrade] = useState('4to');
  const [filterSection, setFilterSection] = useState('A');
  const [searchTerm, setSearchTerm] = useState(''); // Buscador por nombre

  // Cargar alumnos
  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("listNumber")); // Ordenar por num lista
    const unsubscribe = onSnapshot(q, (qs) => {
      const arr = [];
      qs.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
      setStudents(arr);
    });
    return () => unsubscribe();
  }, []);

  // LÓGICA DE FILTRADO
  const visibleStudents = students.filter(student => {
    // 1. Filtro de texto (nombre)
    if (searchTerm !== '') {
      return student.name.toLowerCase().includes(searchTerm.toLowerCase());
    }
    // 2. Filtros jerárquicos
    return (
      student.level === filterLevel &&
      student.shift === filterShift &&
      student.grade === filterGrade &&
      student.section === filterSection
    );
  });

  const handleFileChange = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0]);
  };

  const toggleStudent = (id) => {
    if (selectedStudents.includes(id)) {
      setSelectedStudents(selectedStudents.filter(s => s !== id));
    } else {
      setSelectedStudents([...selectedStudents, id]);
    }
  };

  const selectAllVisible = () => {
    const visibleIds = visibleStudents.map(s => s.id);
    // Unión de arrays sin duplicados
    const newSelection = [...new Set([...selectedStudents, ...visibleIds])];
    setSelectedStudents(newSelection);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!file || !activity) return alert("Falta foto o nombre de actividad");
    
    setLoading(true);
    const isOnline = navigator.onLine;

    try {
      if (!isOnline) {
        // Guardamos offline (incluyendo el comentario)
        await saveOffline(file, activity, selectedStudents, comment);
        alert("⚠️ Guardado OFFLINE.");
      } else {
        // Online
        const storageRef = ref(storage, `evidencias/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        await addDoc(collection(db, "evidence"), {
          activityName: activity,
          comment: comment, // Guardamos el comentario
          fileUrl: downloadURL,
          studentIds: selectedStudents,
          date: new Date(), // Fecha actual automática
          teacherId: "profe_123"
        });
        alert("✅ ¡Subido a la nube!");
      }
      
      // Reset
      setActivity('');
      setComment('');
      setFile(null);
      setSelectedStudents([]);

    } catch (error) {
      console.error(error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px', background: 'white' }}>
      <h3 style={{marginTop: 0}}>📸 Nueva Evidencia</h3>
      
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <input 
          type="text" 
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          placeholder="Título Actividad (Ej: Voleibol)"
          style={{ padding: '10px', fontSize: '16px', fontWeight: 'bold' }}
        />

        <textarea 
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comentarios u observaciones..."
          style={{ padding: '10px', height: '60px' }}
        />

        <input type="file" accept="image/*,video/*" onChange={handleFileChange} />

        {/* --- ZONA DE FILTROS COMPLETOS --- */}
        <div style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          <p style={{margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '14px'}}>🔍 Filtrar Alumnos:</p>
          
          {/* Fila 1: Nivel y Tanda */}
          <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={{flex:1, padding:'5px'}}>
              <option value="Primaria">Primaria</option>
              <option value="Secundaria">Secundaria</option>
            </select>
            <select value={filterShift} onChange={e => setFilterShift(e.target.value)} style={{flex:1, padding:'5px'}}>
              <option value="Matutina">Matutina</option>
              <option value="Vespertina">Vespertina</option>
              <option value="Extendida">Extendida</option>
            </select>
          </div>

          {/* Fila 2: Grado y Sección */}
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
             <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{flex:1, padding:'5px'}}>
              <option value="1ro">1ro</option>
              <option value="2do">2do</option>
              <option value="3ro">3ro</option>
              <option value="4to">4to</option>
              <option value="5to">5to</option>
              <option value="6to">6to</option>
            </select>
            <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={{flex:1, padding:'5px'}}>
              {['A','B','C','D','E'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Buscador por Nombre */}
          <input 
            placeholder="O busca por nombre..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{width: '100%', padding: '5px', marginBottom: '5px', border: '1px solid #ccc'}}
          />

          {/* LISTA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <small>En lista: {visibleStudents.length}</small>
            <button type="button" onClick={selectAllVisible} style={{fontSize: '12px', padding: '2px 5px', cursor:'pointer'}}>Seleccionar Todos</button>
          </div>

          <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #ccc', background: 'white' }}>
            {visibleStudents.length === 0 ? (
              <p style={{padding: '10px', textAlign: 'center', color: '#999'}}>No hay alumnos con este filtro.</p>
            ) : (
              visibleStudents.map(student => (
                <div key={student.id} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      style={{ transform: 'scale(1.3)' }}
                    />
                    <div style={{display:'flex', alignItems:'center', gap: '10px'}}>
                      {/* Si tiene foto, la mostramos chiquita */}
                      {student.photoUrl && <img src={student.photoUrl} style={{width:30, height:30, borderRadius:'50%'}} />}
                      <span style={{ fontSize: '14px' }}>
                         <strong>#{student.listNumber}</strong> {student.name}
                      </span>
                    </div>
                  </label>
                </div>
              ))
            )}
          </div>
          <div style={{marginTop: '5px', textAlign:'right'}}>
             <span style={{ color: '#007bff', fontWeight:'bold' }}>Total marcados: {selectedStudents.length}</span>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ backgroundColor: '#007bff', color: 'white', padding: '15px', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {loading ? 'Guardando...' : '💾 GUARDAR EVIDENCIA'}
        </button>
      </form>
    </div>
  );
}