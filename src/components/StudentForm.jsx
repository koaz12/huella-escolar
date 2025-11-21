// src/components/StudentForm.jsx
import { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { UserPlus, Edit2, Trash2, FileSpreadsheet, Download, Save, X, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

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
  
  // ESTADOS PARA EXCEL
  const [showExcel, setShowExcel] = useState(false);
  const [excelPreview, setExcelPreview] = useState([]);
  
  // CONFIGURACIÓN MASIVA (Si están vacíos, se leen del Excel)
  const [bulkConfig, setBulkConfig] = useState({
    level: '',   // Vacío = Leer del Excel
    shift: '',   // Vacío = Leer del Excel
    grade: '',   // Vacío = Leer del Excel
    section: ''  // Vacío = Leer del Excel
  });

  // ESTADOS PARA BUSCADOR Y PAGINACIÓN
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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

  // --- LÓGICA DE FILTRADO Y PAGINACIÓN ---
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

  // --- FUNCIONES EXCEL ---
  const downloadTemplate = () => {
    // Plantilla COMPLETA pero VACÍA
    // Incluye todas las columnas por si el usuario quiere usarlas
    const templateData = [
      { 
        Nombre: "", 
        ID: "", 
        Numero: "", 
        FechaNacimiento: "", 
        Nivel: "",    // Opcional si se selecciona arriba
        Tanda: "",    // Opcional si se selecciona arriba
        Grado: "",    // Opcional si se selecciona arriba
        Seccion: ""   // Opcional si se selecciona arriba
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Alumnos_Vacia.xlsx");
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
      toast.success(`${data.length} filas encontradas.`);
    };
    reader.readAsBinaryString(file);
  };

  const saveExcelData = async () => {
    if (excelPreview.length === 0) return;
    setLoading(true);
    const toastId = toast.loading(`Procesando ${excelPreview.length} alumnos...`);
    
    try {
      for (const row of excelPreview) {
        // LÓGICA INTELIGENTE:
        // Si hay algo seleccionado en el selector global (bulkConfig), úsalo.
        // Si no (está vacío), busca en la columna del Excel.
        // Si no está en ninguno, usa un valor por defecto.
        
        const finalLevel = bulkConfig.level || row.Nivel || 'Primaria';
        const finalShift = bulkConfig.shift || row.Tanda || 'Matutina';
        const finalGrade = bulkConfig.grade || row.Grado || '1ro';
        const finalSection = bulkConfig.section || row.Seccion || 'A';

        // Ignorar filas vacías
        if (!row.Nombre) continue;

        await addDoc(collection(db, "students"), {
          name: row.Nombre,
          studentId: row.ID || '',
          listNumber: Number(row.Numero) || 0,
          birthDate: row.FechaNacimiento || '',
          level: finalLevel,
          shift: finalShift,
          grade: finalGrade,
          section: finalSection,
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
      console.error(error);
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
      
      {/* BOTÓN IMPORTAR/CERRAR */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
        <button onClick={() => {setShowExcel(!showExcel); setEditingId(null);}}
          style={{flex: 1, padding: '12px', background: showExcel ? '#3b82f6' : '#fff', border: showExcel ? 'none' : '1px solid #ccc', borderRadius: '8px', display:'flex', justifyContent:'center', alignItems:'center', gap:'8px', fontWeight: '500', color: showExcel ? 'white' : '#333'}}>
          {showExcel ? <X size={18}/> : <FileSpreadsheet size={18}/>} {showExcel ? 'Cerrar Modo Masivo' : 'Importar Excel (Masivo)'}
        </button>
      </div>

      {/* --- MÓDULO DE CARGA MASIVA (EXCEL) --- */}
      {showExcel && (
        <div style={{ padding: '15px', background: 'white', borderRadius: '12px', marginBottom: '20px', border: '2px solid #3b82f6' }}>
          <h4 style={{marginTop:0, color: '#1e40af', display:'flex', alignItems:'center', gap:'5px'}}><Filter size={18}/> Configuración de Carga</h4>
          <p style={{fontSize:'13px', color:'#666', marginTop:0, lineHeight: '1.4'}}>
            Selecciona los datos para <strong>TODOS</strong> los alumnos.<br/>
            <em>Deja la opción en <strong>"Leer del Excel"</strong> si prefieres usar las columnas de tu archivo.</em>
          </p>
          
          {/* SELECTORES GLOBALES INTELIGENTES */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            
            <div>
              <label style={{fontSize:'11px', fontWeight:'bold'}}>Nivel</label>
              <select name="level" value={bulkConfig.level} onChange={handleBulkChange} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>
                <option value="">-- Leer del Excel --</option>
                <option value="Primaria">Primaria</option><option value="Secundaria">Secundaria</option>
              </select>
            </div>

            <div>
              <label style={{fontSize:'11px', fontWeight:'bold'}}>Tanda</label>
              <select name="shift" value={bulkConfig.shift} onChange={handleBulkChange} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>
                <option value="">-- Leer del Excel --</option>
                <option value="Matutina">Matutina</option><option value="Vespertina">Vespertina</option><option value="Extendida">Extendida</option>
              </select>
            </div>

            <div>
              <label style={{fontSize:'11px', fontWeight:'bold'}}>Grado</label>
              <select name="grade" value={bulkConfig.grade} onChange={handleBulkChange} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>
                 <option value="">-- Leer del Excel --</option>
                 {['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label style={{fontSize:'11px', fontWeight:'bold'}}>Sección</label>
              <select name="section" value={bulkConfig.section} onChange={handleBulkChange} style={{width:'100%', padding:'8px', borderRadius:'6px', border:'1px solid #ccc'}}>
                 <option value="">-- Leer del Excel --</option>
                 {['A','B','C','D','E'].map(l=><option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <hr style={{border:'0', borderTop:'1px solid #eee', margin:'15px 0'}}/>

          <h4 style={{marginTop:'0', color: '#1e40af'}}>Archivo</h4>
          <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
            <button onClick={downloadTemplate} style={{background:'#eff6ff', color:'#2563eb', border:'1px dashed #2563eb', padding:'12px', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', fontWeight:'bold'}}>
              <Download size={18}/> Descargar Plantilla Vacía
            </button>
            
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelRead} style={{marginTop:'10px'}} />
          </div>

          {excelPreview.length > 0 && (
            <button onClick={saveExcelData} disabled={loading}
              style={{width: '100%', marginTop: '15px', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize:'16px'}}>
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
          <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
            
            {/* Nombre */}
            <div>
               <label style={{fontSize:'12px', fontWeight:'bold', color:'#444'}}>Nombre Completo</label>
               <input name="name" placeholder="Ej: Juan Pérez" value={formData.name} onChange={handleChange} required style={{width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'16px', marginTop:'4px'}}/>
            </div>
            
            {/* DATOS PERSONALES */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
               <div>
                 <label style={{fontSize:'12px', fontWeight:'bold', color:'#444'}}>Nacimiento</label>
                 <input name="birthDate" type="date" value={formData.birthDate} onChange={handleChange} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd', background:'white', marginTop:'4px'}}/>
               </div>
               <div>
                 <label style={{fontSize:'12px', fontWeight:'bold', color:'#444'}}>Matrícula / ID</label>
                 <input name="studentId" placeholder="ID" value={formData.studentId} onChange={handleChange} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd', marginTop:'4px'}}/>
               </div>
            </div>

            {/* NIVEL Y TANDA (Ahora bien visibles) */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', background:'#f8f9fa', padding:'10px', borderRadius:'8px'}}>
               <div>
                  <label style={{fontSize:'12px', fontWeight:'bold', color:'#444'}}>Nivel</label>
                  <select name="level" value={formData.level} onChange={handleChange} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd', background:'white', marginTop:'4px'}}>
                     <option value="Primaria">Primaria</option><option value="Secundaria">Secundaria</option>
                  </select>
               </div>
               <div>
                  <label style={{fontSize:'12px', fontWeight:'bold', color:'#444'}}>Tanda</label>
                  <select name="shift" value={formData.shift} onChange={handleChange} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd', background:'white', marginTop:'4px'}}>
                     <option value="Matutina">Matutina</option><option value="Vespertina">Vespertina</option><option value="Extendida">Extendida</option>
                  </select>
               </div>
            </div>

            {/* GRADO SECCIÓN LISTA */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px'}}>
               <div>
                  <label style={{fontSize:'12px', fontWeight:'bold', color:'#444'}}>Grado</label>
                  <select name="grade" value={formData.grade} onChange={handleChange} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd', background:'white', marginTop:'4px'}}>
                     {['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}
                  </select>
               </div>
               <div>
                  <label style={{fontSize:'12px', fontWeight:'bold', color:'#444'}}>Sección</label>
                  <select name="section" value={formData.section} onChange={handleChange} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd', background:'white', marginTop:'4px'}}>
                     {['A','B','C','D','E'].map(l=><option key={l}>{l}</option>)}
                  </select>
               </div>
               <div>
                  <label style={{fontSize:'12px', fontWeight:'bold', color:'#444'}}># Lista</label>
                  <input name="listNumber" type="number" placeholder="#" value={formData.listNumber} onChange={handleChange} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd', marginTop:'4px'}}/>
               </div>
            </div>
            
            <div>
              <label style={{fontSize:'12px', fontWeight:'bold', color:'#444'}}>Foto (Opcional)</label>
              <input type="file" accept="image/*" onChange={handleFileChange} style={{marginTop:'4px'}}/>
            </div>

            <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
               {editingId && <button type="button" onClick={() => {setEditingId(null); setFormData({name:'', level:'Primaria', shift:'Matutina', grade:'4to', section:'A', listNumber:'', studentId:'', birthDate:''})}} style={{flex:1, padding:'12px', border:'none', borderRadius:'8px', background:'#f1f5f9'}}>Cancelar</button>}
               <button type="submit" disabled={loading} style={{flex:2, padding:'12px', border:'none', borderRadius:'8px', background: editingId ? '#f59e0b':'#007bff', color:'white', fontWeight:'bold', fontSize:'16px'}}>{loading?'...':(editingId?'Actualizar':'Guardar')}</button>
            </div>
          </form>
        </div>
      )}

      {/* --- LISTA DE ALUMNOS --- */}
      {!showExcel && (
        <>
          <div style={{marginBottom:'15px', position:'relative'}}>
             <Search size={18} style={{position:'absolute', left:'12px', top:'12px', color:'#94a3b8'}}/>
             <input 
               placeholder="Buscar alumno..." 
               value={searchTerm} 
               onChange={e => {setSearchTerm(e.target.value); setCurrentPage(1);}} 
               style={{width:'100%', padding:'10px 10px 10px 40px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'16px'}}
             />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {paginatedStudents.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'white', borderRadius: '8px', borderLeft: `4px solid ${s.shift === 'Matutina' ? '#f59e0b' : '#3b82f6'}`, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                   <div style={{width:35, height:35, borderRadius:'50%', background: s.photoUrl ? 'transparent' : '#e2e8f0', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center'}}>
                      {s.photoUrl ? <img src={s.photoUrl} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <span style={{fontSize:'12px', fontWeight:'bold', color:'#64748b'}}>{s.grade}</span>}
                   </div>
                   <div style={{display:'flex', flexDirection:'column'}}>
                    <span style={{fontWeight: 'bold', fontSize: '14px', color: '#334155'}}>{s.name}</span>
                    <span style={{fontSize: '12px', color: '#64748b'}}>
                      {s.level.substring(0,1)}. {s.grade} {s.section} &bull; #{s.listNumber} &bull; {s.shift.substring(0,3)}
                    </span>
                   </div>
                </div>
                <div style={{display:'flex', gap:'15px'}}>
                  <button onClick={() => handleEdit(s)} style={{background:'none', border:'none', padding:0, color:'#64748b'}}><Edit2 size={18}/></button>
                  <button onClick={() => handleDelete(s.id)} style={{background:'none', border:'none', padding:0, color:'#ef4444'}}><Trash2 size={18}/></button>
                </div>
              </div>
            ))}
            {paginatedStudents.length === 0 && <p style={{textAlign:'center', color:'#999', fontSize:'14px'}}>No hay alumnos.</p>}
          </div>

          {totalPages > 1 && (
            <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'15px', marginTop:'20px'}}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} style={{background:'white', border:'1px solid #ccc', padding:'8px 12px', borderRadius:'6px', opacity: currentPage===1 ? 0.5 : 1}}><ChevronLeft size={20}/></button>
              <span style={{fontSize:'14px', color:'#666'}}>Página {currentPage} de {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} style={{background:'white', border:'1px solid #ccc', padding:'8px 12px', borderRadius:'6px', opacity: currentPage===totalPages ? 0.5 : 1}}><ChevronRight size={20}/></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}