// src/components/StudentForm.jsx
import { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase'; // Importamos auth
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as XLSX from 'xlsx';

export function StudentForm() {
  const [formData, setFormData] = useState({
    name: '', studentId: '', level: 'Primaria', shift: 'Matutina',
    grade: '4to', section: 'A', listNumber: '', birthDate: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null); // Para saber si estamos editando

  // Lista de alumnos para mostrar abajo y poder editar
  const [myStudents, setMyStudents] = useState([]);

  // Cargar SOLO mis alumnos
  useEffect(() => {
    if (!auth.currentUser) return;
    const userEmail = auth.currentUser.email; // Usamos email o UID
    
    // Query simple
    const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (qs) => {
      const arr = [];
      qs.forEach(doc => {
        const data = doc.data();
        // Filtro manual por seguridad si las reglas no están listas
        if(data.teacherEmail === userEmail) {
          arr.push({ id: doc.id, ...data });
        }
      });
      setMyStudents(arr);
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleFileChange = (e) => { if (e.target.files[0]) setPhotoFile(e.target.files[0]); };

  // --- GUARDAR O ACTUALIZAR ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return alert("Debes iniciar sesión");
    setLoading(true);

    try {
      let photoUrl = formData.photoUrl || ''; // Mantener foto vieja si existe
      
      if (photoFile) {
        const storageRef = ref(storage, `perfiles_alumnos/${Date.now()}_${photoFile.name}`);
        const snapshot = await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(snapshot.ref);
      }

      const dataToSave = {
        ...formData,
        listNumber: Number(formData.listNumber),
        photoUrl: photoUrl,
        teacherId: auth.currentUser.uid, // ID real del usuario
        teacherEmail: auth.currentUser.email, // Para filtrar fácil
        updatedAt: new Date()
      };

      if (editingId) {
        // MODO EDITAR
        await updateDoc(doc(db, "students", editingId), dataToSave);
        alert("✅ Alumno actualizado");
        setEditingId(null);
      } else {
        // MODO CREAR
        await addDoc(collection(db, "students"), {
          ...dataToSave,
          createdAt: new Date()
        });
        alert("✅ Alumno creado");
      }
      
      // Limpiar
      setFormData({ name: '', studentId: '', level: 'Primaria', shift: 'Matutina', grade: '4to', section: 'A', listNumber: '', birthDate: '' });
      setPhotoFile(null);
      
    } catch (error) {
      console.error(error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- FUNCIONES EDITAR / BORRAR ---
  const handleEdit = (student) => {
    setFormData({
      name: student.name,
      studentId: student.studentId || '',
      level: student.level,
      shift: student.shift,
      grade: student.grade,
      section: student.section,
      listNumber: student.listNumber,
      birthDate: student.birthDate || '',
      photoUrl: student.photoUrl // Guardamos la URL vieja por si no sube nueva
    });
    setEditingId(student.id);
    // Hacer scroll arriba
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if(!confirm("¿Seguro que quieres borrar a este alumno?")) return;
    try {
      await deleteDoc(doc(db, "students", id));
    } catch (e) {
      alert("Error al borrar: " + e.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', studentId: '', level: 'Primaria', shift: 'Matutina', grade: '4to', section: 'A', listNumber: '', birthDate: '' });
  };

  // Dentro de StudentForm.jsx...

  return (
    <div style={{ padding: '15px', border: '1px solid #eee', borderRadius: '12px', background: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
      
      {/* ... Sección Excel ... */}
      
      <h3 style={{marginTop: '20px', color: '#333'}}>{editingId ? '✏️ Editando' : '🎓 Nuevo Alumno'}</h3>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <input name="name" placeholder="Nombre Completo" value={formData.name} onChange={handleChange} required 
          style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }} />
        
        {/* FILA FLEXIBLE: Se adapta al ancho */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input name="birthDate" type="date" value={formData.birthDate} onChange={handleChange} 
            style={{ flex: '1 1 140px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} />
          <input name="studentId" placeholder="Matrícula" value={formData.studentId} onChange={handleChange} 
            style={{ flex: '1 1 100px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
           <select name="grade" value={formData.grade} onChange={handleChange} 
             style={{ flex: '1 1 80px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background:'white' }}>
             <option>1ro</option><option>2do</option><option>3ro</option><option>4to</option><option>5to</option><option>6to</option>
           </select>
           <select name="section" value={formData.section} onChange={handleChange} 
             style={{ flex: '1 1 80px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', background:'white' }}>
             {['A','B','C','D','E'].map(l => <option key={l} value={l}>{l}</option>)}
           </select>
           <input name="listNumber" type="number" placeholder="#" value={formData.listNumber} onChange={handleChange} 
             style={{ flex: '1 1 60px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} />
        </div>

        {/* Botones... */}
        <button type="submit" disabled={loading} 
          style={{ padding: '14px', backgroundColor: editingId ? '#f59e0b' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight:'bold', fontSize:'16px' }}>
          {loading ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar')}
        </button>
        
        {editingId && (
          <button type="button" onClick={handleCancelEdit} style={{ padding: '10px', background: '#e5e7eb', border: 'none', borderRadius: '8px' }}>Cancelar</button>
        )}
      </form>

      {/* ... Lista de alumnos ... */}
    </div>
  );
}