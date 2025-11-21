// src/components/StudentForm.jsx
import { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload, UserPlus, Edit2, Trash2, X } from 'lucide-react'; // Iconos nuevos

export function StudentForm() {
  const [formData, setFormData] = useState({
    name: '', studentId: '', level: 'Primaria', shift: 'Matutina',
    grade: '4to', section: 'A', listNumber: '', birthDate: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [myStudents, setMyStudents] = useState([]);
  const [showExcel, setShowExcel] = useState(false); // Para ocultar/mostrar la carga de excel

  useEffect(() => {
    if (!auth.currentUser) return;
    const userEmail = auth.currentUser.email;
    const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (qs) => {
      const arr = [];
      qs.forEach(doc => {
        if(doc.data().teacherEmail === userEmail) arr.push({ id: doc.id, ...doc.data() });
      });
      setMyStudents(arr);
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleFileChange = (e) => { if (e.target.files[0]) setPhotoFile(e.target.files[0]); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return toast.error("Inicia sesión primero");
    setLoading(true);
    const toastId = toast.loading("Guardando...");

    try {
      let photoUrl = formData.photoUrl || '';
      if (photoFile) {
        const storageRef = ref(storage, `perfiles_alumnos/${Date.now()}_${photoFile.name}`);
        const snapshot = await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(snapshot.ref);
      }

      const dataToSave = {
        ...formData,
        listNumber: Number(formData.listNumber),
        photoUrl,
        teacherId: auth.currentUser.uid,
        teacherEmail: auth.currentUser.email,
        updatedAt: new Date()
      };

      if (editingId) {
        await updateDoc(doc(db, "students", editingId), dataToSave);
        toast.success("Alumno actualizado", { id: toastId });
        setEditingId(null);
      } else {
        await addDoc(collection(db, "students"), { ...dataToSave, createdAt: new Date() });
        toast.success("Alumno creado", { id: toastId });
      }
      
      setFormData({ name: '', studentId: '', level: 'Primaria', shift: 'Matutina', grade: '4to', section: 'A', listNumber: '', birthDate: '' });
      setPhotoFile(null);
    } catch (error) {
      toast.error("Error: " + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // ... (Mantén aquí tu función handleExcelUpload igual que antes, la omito para ahorrar espacio pero NO LA BORRES) ...
   const handleExcelUpload = (e) => { /* ... TU CÓDIGO EXCEL ANTERIOR ... */ };

  const handleEdit = (student) => {
    setFormData({ ...student, photoUrl: student.photoUrl || '' });
    setEditingId(student.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if(!confirm("¿Borrar alumno?")) return;
    try { await deleteDoc(doc(db, "students", id)); toast.success("Borrado"); } 
    catch (e) { toast.error(e.message); }
  };

  return (
    <div style={{ paddingBottom: '20px' }}>
      
      {/* BOTÓN PARA MOSTRAR/OCULTAR EXCEL (Ahorra espacio) */}
      <button 
        onClick={() => setShowExcel(!showExcel)}
        style={{width: '100%', padding: '10px', marginBottom: '15px', background: '#e9ecef', border: 'none', borderRadius: '8px', color: '#495057', display:'flex', justifyContent:'center', gap:'8px', alignItems:'center'}}
      >
        <Upload size={16}/> {showExcel ? 'Ocultar Carga Masiva' : 'Importar desde Excel'}
      </button>

      {showExcel && (
        <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '15px', border: '1px dashed #ccc' }}>
          <p style={{fontSize: '12px', color: '#666', marginTop:0}}>Sube tu archivo .xlsx aquí:</p>
          <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} style={{width: '100%'}} />
        </div>
      )}

      {/* FORMULARIO PRINCIPAL */}
      <div style={{ background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{marginTop: 0, display:'flex', alignItems:'center', gap:'8px', fontSize: '16px'}}>
          {editingId ? <Edit2 size={18}/> : <UserPlus size={18}/>} 
          {editingId ? 'Editando Alumno' : 'Nuevo Alumno'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Nombre */}
          <input name="name" placeholder="Nombre Completo" value={formData.name} onChange={handleChange} required 
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', width: '100%' }} />
          
          {/* GRID 1: Fecha y ID */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{fontSize: '11px', color: '#666'}}>Fecha Nac.</label>
              <input name="birthDate" type="date" value={formData.birthDate} onChange={handleChange} 
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
            </div>
            <div>
              <label style={{fontSize: '11px', color: '#666'}}>Matrícula</label>
              <input name="studentId" placeholder="ID" value={formData.studentId} onChange={handleChange} 
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
            </div>
          </div>

          {/* GRID 2: Grado, Sección, Lista */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <select name="grade" value={formData.grade} onChange={handleChange} 
               style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white' }}>
               {['1ro','2do','3ro','4to','5to','6to'].map(o => <option key={o}>{o}</option>)}
            </select>
            <select name="section" value={formData.section} onChange={handleChange} 
               style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', background: 'white' }}>
               {['A','B','C','D','E'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <input name="listNumber" type="number" placeholder="#" value={formData.listNumber} onChange={handleChange} 
               style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
          </div>

          {/* Botones de Acción */}
          <div style={{display: 'flex', gap: '10px', marginTop: '5px'}}>
            {editingId && (
              <button type="button" onClick={() => {setEditingId(null); setFormData({name:'', level:'Primaria', shift:'Matutina', grade:'4to', section:'A', listNumber:'', studentId:'', birthDate:''})}} 
                style={{ padding: '12px', flex: 1, background: '#f3f4f6', border: 'none', borderRadius: '8px', color: '#333' }}>
                Cancelar
              </button>
            )}
            <button type="submit" disabled={loading} 
              style={{ padding: '12px', flex: 2, backgroundColor: editingId ? '#f59e0b' : '#007bff', color: 'white', border: 'none', borderRadius: '8px', fontWeight:'bold', fontSize:'16px' }}>
              {loading ? '...' : (editingId ? 'Actualizar' : 'Guardar')}
            </button>
          </div>
        </form>
      </div>

      {/* LISTA COMPACTA DE ALUMNOS */}
      <h4 style={{margin: '20px 0 10px 0', color: '#666', fontSize: '14px'}}>📋 Mis Alumnos ({myStudents.length})</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {myStudents.map(s => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'white', borderRadius: '8px', borderLeft: `4px solid ${s.section === 'A' ? '#3b82f6' : '#10b981'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{display:'flex', flexDirection:'column'}}>
              <span style={{fontWeight: 'bold', fontSize: '14px'}}>{s.name}</span>
              <span style={{fontSize: '12px', color: '#666'}}>
                {s.grade} {s.section} &bull; #{s.listNumber} &bull; {s.shift}
              </span>
            </div>
            <div style={{display:'flex', gap:'15px'}}>
              <button onClick={() => handleEdit(s)} style={{background:'none', border:'none', padding:0, color:'#f59e0b'}}><Edit2 size={18}/></button>
              <button onClick={() => handleDelete(s.id)} style={{background:'none', border:'none', padding:0, color:'#ef4444'}}><Trash2 size={18}/></button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}