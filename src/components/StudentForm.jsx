// src/components/StudentForm.jsx
import { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload, UserPlus, Edit2, Trash2, FileSpreadsheet, Download, Save, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export function StudentForm() {
  // --- ESTADOS ---
  const [formData, setFormData] = useState({
    name: '', studentId: '', level: 'Primaria', shift: 'Matutina',
    grade: '4to', section: 'A', listNumber: '', birthDate: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [myStudents, setMyStudents] = useState([]);
  
  // Estados para Excel y Configuración Masiva
  const [showExcel, setShowExcel] = useState(false);
  const [excelPreview, setExcelPreview] = useState([]);
  const [bulkConfig, setBulkConfig] = useState({
    level: 'Primaria', shift: 'Matutina', grade: '4to', section: 'A'
  });

  // Estados para Buscador y Paginación
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- CARGAR ALUMNOS ---
  useEffect(() => {
    if (!auth.currentUser) return;
    const userEmail = auth.currentUser.email;
    const q = query(collection(db, "students"), orderBy("grade"), orderBy("section"), orderBy("listNumber")); 
    const unsubscribe = onSnapshot(q, (qs) => {
      const arr = [];
      qs.forEach(doc => {
        if(doc.data().teacherEmail === userEmail) arr.push({ id: doc.id, ...doc.data() });
      });
      setMyStudents(arr);
    });
    return () => unsubscribe();
  }, []);

  // Lógica de Filtrado y Paginación
  const filteredStudents = myStudents.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.studentId.includes(searchTerm)
  );
  
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  // --- MANEJADORES ---
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleBulkChange = (e) => setBulkConfig({ ...bulkConfig, [e.target.name]: e.target.value });
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

  // --- EXCEL ---
  const downloadTemplate = () => {
    const templateData = [
      { Nombre: "Juan Perez", ID: "A001", Numero: 1, FechaNacimiento: "2015-05-20" },
      { Nombre: "Maria Lopez", ID: "A002", Numero: 2, FechaNacimiento: "2015-08-10" }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Alumnos.xlsx");
    toast.success("Plantilla descargada");
  };

  const handleExcelRead = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      setExcelPreview(data);
      toast.success(`${data.length} alumnos leídos.`);
    };
    reader.readAsBinaryString(file);
  };

  const saveExcelData = async () => {
    if (excelPreview.length === 0) return;
    setLoading(true);
    const toastId = toast.loading(`Subiendo ${excelPreview.length} alumnos a ${bulkConfig.grade} ${bulkConfig.section}...`);
    
    try {
      for (const row of excelPreview) {
        await addDoc(collection(db, "students"), {
          name: row.Nombre || 'Sin Nombre',
          studentId: row.ID || '',
          listNumber: Number(row.Numero) || 0,
          birthDate: row.FechaNacimiento || '',
          // AQUÍ APLICAMOS LA CONFIGURACIÓN GLOBAL ELEGIDA EN LA APP
          level: bulkConfig.level,
          shift: bulkConfig.shift,
          grade: bulkConfig.grade,
          section: bulkConfig.section,
          photoUrl: '',
          teacherId: auth.currentUser.uid,
          teacherEmail: auth.currentUser.email,
          createdAt: new Date()
        });
      }
      toast.success(`¡Importación completada!`, { id: toastId });
      setExcelPreview([]);
      setShowExcel(false);
    } catch (error) {
      toast.error("Error en carga masiva", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (student) => {
    setFormData({ ...student, photoUrl: student.photoUrl || '' });
    setEditingId(student.id);
    setShowExcel(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if(!confirm("¿Borrar alumno?")) return;
    try { await deleteDoc(doc(db, "students", id)); toast.success("Borrado"); } catch (e) { toast.error(e.message); }
  };

  return (
    <div style={{ paddingBottom: '20px' }}>
      
      {/* --- BARRA DE ACCIONES --- */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
        <button onClick={() => {setShowExcel(!showExcel); setEditingId(null);}}
          style={{flex: 1, padding: '12px', background: showExcel ? '#e9ecef' : '#fff', border: '1px solid #ccc', borderRadius: '8px', display:'flex', justifyContent:'center', alignItems:'center', gap:'8px', fontWeight: '500'}}>
          {showExcel ? <X size={18}/> : <FileSpreadsheet size={18}/>} {showExcel ? 'Cerrar' : 'Importar Excel'}
        </button>
      </div>

      {/* --- MÓDULO DE CARGA MASIVA --- */}
      {showExcel && (
        <div style={{ padding: '15px', background: 'white', borderRadius: '12px', marginBottom: '20px', border: '2px solid #3b82f6' }}>
          <h4 style={{marginTop:0, color: '#1e40af'}}>1. Configura el Grupo</h4>
          <p style={{fontSize:'13px', color:'#666'}}>Todos los alumnos del Excel se guardarán con estos datos:</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <select name="level" value={bulkConfig.level} onChange={handleBulkChange} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>
              <option value="Primaria">Primaria</option><option value="Secundaria">Secundaria</option>
            </select>
            <select name="shift" value={bulkConfig.shift} onChange={handleBulkChange} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>
              <option value="Matutina">Matutina</option><option value="Vespertina">Vespertina</option><option value="Extendida">Extendida</option>
            </select>
            <select name="grade" value={bulkConfig.grade} onChange={handleBulkChange} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>
               {['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}
            </select>
            <select name="section" value={bulkConfig.section} onChange={handleBulkChange} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>
               {['A','B','C','D','E'].map(l=><option key={l}>{l}</option>)}
            </select>
          </div>

          <h4 style={{marginTop:0, color: '#1e40af'}}>2. Selecciona el Archivo</h4>
          <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
            <button onClick={downloadTemplate} style={{background:'#eff6ff', color:'#2563eb', border:'1px dashed #2563eb', padding:'10px', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'}}>
              <Download size={16}/> Descargar Plantilla Simple
            </button>
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelRead} style={{marginTop:'10px'}} />
          </div>

          {excelPreview.length > 0 && (
            <button onClick={saveExcelData} disabled={loading}
              style={{width: '100%', marginTop: '15px', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold'}}>
              {loading ? 'Guardando...' : `💾 Guardar ${excelPreview.length} Alumnos`}
            </button>
          )}
        </div>
      )}

      {/* --- FORMULARIO MANUAL --- */}
      {!showExcel && (
        <div style={{ background: 'white', padding: '15px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
          <h3 style={{marginTop:0, fontSize:'16px', display:'flex', alignItems:'center', gap:'8px'}}>
            {editingId ? <Edit2 size={18}/> : <UserPlus size={18}/>} {editingId ? 'Editar' : 'Nuevo Alumno'}
          </h3>
          <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'10px'}}>
            <input name="name" placeholder="Nombre Completo" value={formData.name} onChange={handleChange} required style={{padding:'10px', borderRadius:'6px', border:'1px solid #ddd', width:'100%'}}/>
            
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
               <input name="birthDate" type="date" value={formData.birthDate} onChange={handleChange} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ddd'}}/>
               <input name="studentId" placeholder="Matrícula" value={formData.studentId} onChange={handleChange} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ddd'}}/>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
               <select name="level" value={formData.level} onChange={handleChange} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ddd', background:'white'}}>
                  <option value="Primaria">Primaria</option><option value="Secundaria">Secundaria</option>
               </select>
               <select name="shift" value={formData.shift} onChange={handleChange} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ddd', background:'white'}}>
                  <option value="Matutina">Matutina</option><option value="Vespertina">Vespertina</option><option value="Extendida">Extendida</option>
               </select>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px'}}>
               <select name="grade" value={formData.grade} onChange={handleChange} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ddd', background:'white'}}>
                  {['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}
               </select>
               <select name="section" value={formData.section} onChange={handleChange} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ddd', background:'white'}}>
                  {['A','B','C','D','E'].map(l=><option key={l}>{l}</option>)}
               </select>
               <input name="listNumber" type="number" placeholder="#" value={formData.listNumber} onChange={handleChange} style={{padding:'8px', borderRadius:'6px', border:'1px solid #ddd'}}/>
            </div>

            <div style={{display: 'flex', gap: '10px', marginTop: '5px'}}>
               {editingId && <button type="button" onClick={() => {setEditingId(null); setFormData({name:'', level:'Primaria', shift:'Matutina', grade:'4to', section:'A', listNumber:'', studentId:'', birthDate:''})}} style={{flex:1, padding:'10px', border:'none', borderRadius:'6px', background:'#f1f5f9'}}>Cancelar</button>}
               <button type="submit" disabled={loading} style={{flex:2, padding:'10px', border:'none', borderRadius:'6px', background: editingId ? '#f59e0b':'#007bff', color:'white', fontWeight:'bold'}}>{loading?'...':(editingId?'Actualizar':'Guardar')}</button>
            </div>
          </form>
        </div>
      )}

      {/* --- LISTA CON BUSCADOR Y PAGINACIÓN --- */}
      {!showExcel && (
        <>
          <div style={{marginBottom:'10px', display:'flex', gap:'10px'}}>
            <div style={{position:'relative', flex:1}}>
               <Search size={16} style={{position:'absolute', left:'10px', top:'10px', color:'#94a3b8'}}/>
               <input placeholder="Buscar alumno..." value={searchTerm} onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} style={{width:'100%', padding:'8px 8px 8px 35px', borderRadius:'8px', border:'1px solid #cbd5e1'}}/>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {paginatedStudents.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'white', borderRadius: '8px', borderLeft: `4px solid ${s.shift === 'Matutina' ? '#f59e0b' : '#3b82f6'}`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div style={{display:'flex', flexDirection:'column'}}>
                  <span style={{fontWeight: 'bold', fontSize: '14px', color: '#334155'}}>{s.name}</span>
                  <span style={{fontSize: '12px', color: '#64748b'}}>
                    {s.level.substring(0,4)}. {s.grade} {s.section} &bull; #{s.listNumber} &bull; {s.shift.substring(0,3)}
                  </span>
                </div>
                <div style={{display:'flex', gap:'15px'}}>
                  <button onClick={() => handleEdit(s)} style={{background:'none', border:'none', padding:0, color:'#64748b'}}><Edit2 size={18}/></button>
                  <button onClick={() => handleDelete(s.id)} style={{background:'none', border:'none', padding:0, color:'#ef4444'}}><Trash2 size={18}/></button>
                </div>
              </div>
            ))}
            {paginatedStudents.length === 0 && <p style={{textAlign:'center', color:'#999', fontSize:'14px'}}>No se encontraron alumnos.</p>}
          </div>

          {/* CONTROLES DE PAGINACIÓN */}
          {totalPages > 1 && (
            <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'15px', marginTop:'20px'}}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} style={{background:'white', border:'1px solid #ccc', padding:'5px 10px', borderRadius:'6px', disabled:{opacity:0.5}}}><ChevronLeft size={20}/></button>
              <span style={{fontSize:'14px'}}>Pág {currentPage} de {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} style={{background:'white', border:'1px solid #ccc', padding:'5px 10px', borderRadius:'6px'}}><ChevronRight size={20}/></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}