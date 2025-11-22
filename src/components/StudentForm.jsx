// src/components/StudentForm.jsx
import { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  writeBatch, getDocs, query, where 
} from 'firebase/firestore'; // Quitamos onSnapshot y query de aquí porque los usa el hook
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { 
  UserPlus, Edit2, Trash2, FileSpreadsheet, Download, X, 
  Save, Search, Filter, Calendar, User, Folder 
} from 'lucide-react';

// 1. IMPORTAMOS EL HOOK
import { useStudents } from '../hooks/useStudents';

export function StudentForm({ onNavigate }) {
  // --- 2. USAMOS EL HOOK (Adiós a 30 líneas de código repetido) ---
  // Renombramos 'students' a 'myStudents' para no romper tu lógica existente
  const { students: myStudents, loading: loadingStudents } = useStudents();

  // --- ESTADOS LOCALES ---
  const [formData, setFormData] = useState({ 
    name: '', studentId: '', level: 'Primaria', shift: 'Matutina', 
    grade: '4to', section: 'A', listNumber: '', birthDate: '' 
  });
  
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(false); // Loading para guardar
  const [editingId, setEditingId] = useState(null);
  
  // Filtros de VISTA
  const [viewFilters, setViewFilters] = useState({
      level: 'Todos', shift: 'Todos', grade: 'Todos', section: 'Todos'
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Estados Excel
  const [showExcel, setShowExcel] = useState(false);
  const [excelPreview, setExcelPreview] = useState([]);
  const [bulkConfig, setBulkConfig] = useState({ level: 'Primaria', shift: 'Matutina', grade: '4to', section: 'A' });

  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // (EL USEEFFECT GIGANTE DE CARGA QUE HABÍA AQUÍ, YA NO EXISTE) 😎

  // --- AUTOCOMPLETADO # LISTA ---
  useEffect(() => {
      if (editingId) return;
      // Usamos myStudents que ahora viene del Hook
      const existing = myStudents.filter(s => s.grade === formData.grade && s.section === formData.section);
      if (existing.length > 0) {
          const maxNum = Math.max(...existing.map(s => Number(s.listNumber) || 0));
          setFormData(prev => ({ ...prev, listNumber: maxNum + 1 }));
      } else {
          setFormData(prev => ({ ...prev, listNumber: 1 }));
      }
  }, [formData.grade, formData.section, myStudents, editingId]);

  // --- HANDLERS ---
  const checkDuplicateId = async (studentId) => {
    if (!studentId) return false;
    const q = query(collection(db, "students"), where("teacherId", "==", auth.currentUser.uid), where("studentId", "==", studentId));
    const snapshot = await getDocs(q);
    if (editingId && snapshot.docs.length > 0) {
        if (snapshot.docs[0].id === editingId) return false; 
    }
    return !snapshot.empty; 
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleFileChange = (e) => { if (e.target.files[0]) setPhotoFile(e.target.files[0]); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return toast.error("Inicia sesión");
    if (Number(formData.listNumber) < 1) return toast.error("El número de lista debe ser 1 o mayor");
    
    setLoading(true);
    const toastId = toast.loading("Procesando...");

    try {
      if (formData.studentId) {
          const isDuplicate = await checkDuplicateId(formData.studentId);
          if (isDuplicate) {
              toast.error(`⛔ El ID "${formData.studentId}" ya existe.`, { id: toastId });
              setLoading(false);
              return;
          }
      }

      let photoUrl = formData.photoUrl || '';
      if (photoFile) {
        const storageRef = ref(storage, `perfiles_alumnos/${auth.currentUser.uid}/${Date.now()}_${photoFile.name}`);
        const snapshot = await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(snapshot.ref);
      }

      const dataToSave = {
        ...formData,
        listNumber: Number(formData.listNumber),
        photoUrl,
        teacherId: auth.currentUser.uid, 
        updatedAt: new Date()
      };

      if (editingId) {
        await updateDoc(doc(db, "students", editingId), dataToSave);
        toast.success("Alumno actualizado", { id: toastId });
        setEditingId(null);
      } else {
        await addDoc(collection(db, "students"), { ...dataToSave, createdAt: new Date() });
        toast.success(`Alumno #${dataToSave.listNumber} creado`, { id: toastId });
      }

      setFormData(prev => ({ ...prev, name: '', studentId: '', birthDate: '' }));
      setPhotoFile(null);
      document.getElementById('photoInput').value = "";

    } catch (error) { 
        console.error(error);
        toast.error(`Error: ${error.message}`, { id: toastId }); 
    } finally { setLoading(false); }
  };

  // --- EXCEL Y DELETE ---
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ Nombre: "Juan Perez", ID: "1001", Numero: 1 }, { Nombre: "Maria Lopez", ID: "1002", Numero: 2 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Alumnos.xlsx");
  };
  const handleExcelRead = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      setExcelPreview(data);
      toast.success(`${data.length} filas detectadas.`);
    };
    reader.readAsBinaryString(file);
  };
  const saveExcelData = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
        const batch = writeBatch(db);
        excelPreview.forEach((row) => {
          const docRef = doc(collection(db, "students"));
          batch.set(docRef, {
            name: row.Nombre || row.name || "Sin Nombre",
            studentId: String(row.ID || row.studentId || ""),
            listNumber: Number(row.Numero || row.listNumber || 0),
            grade: bulkConfig.grade, section: bulkConfig.section, level: bulkConfig.level, shift: bulkConfig.shift,
            teacherId: auth.currentUser.uid, createdAt: new Date(), photoUrl: ''
          });
        });
        await batch.commit();
        toast.success("Carga masiva completada");
        setExcelPreview([]); setShowExcel(false);
      } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  const handleEdit = (s) => { 
    setFormData({
        name: s.name, studentId: s.studentId || '', 
        level: s.level || 'Primaria', shift: s.shift || 'Matutina',
        grade: s.grade, section: s.section, listNumber: s.listNumber, 
        birthDate: s.birthDate || '', photoUrl: s.photoUrl
    }); 
    setEditingId(s.id); setShowExcel(false); window.scrollTo({top:0, behavior:'smooth'}); 
  };
  const handleDelete = async (id) => { 
    if(confirm("¿Seguro que deseas borrar este alumno?")) {
        try { await deleteDoc(doc(db,"students",id)); toast.success("Borrado"); } 
        catch(e) { toast.error(e.message); }
    }
  };

  const filteredStudents = myStudents.filter(s => {
      const matchText = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.studentId && s.studentId.includes(searchTerm));
      const matchLevel = viewFilters.level === 'Todos' || s.level === viewFilters.level;
      const matchShift = viewFilters.shift === 'Todos' || s.shift === viewFilters.shift;
      const matchGrade = viewFilters.grade === 'Todos' || s.grade === viewFilters.grade;
      const matchSection = viewFilters.section === 'Todos' || s.section === viewFilters.section;
      return matchText && matchLevel && matchShift && matchGrade && matchSection;
  });
  
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div style={{ paddingBottom: '80px' }}>
      
      <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
        <button onClick={() => {setShowExcel(!showExcel); setEditingId(null);}} style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: showExcel ? '#ef4444':'#10b981', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
          {showExcel ? <X size={18}/> : <FileSpreadsheet size={18}/>} {showExcel ? 'Cancelar' : 'Carga Masiva'}
        </button>
      </div>

      {showExcel && (
        <div style={{background:'white', padding:'15px', borderRadius:'12px', marginBottom:'20px', border: '2px solid #10b981'}}>
           <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom: '15px'}}>
              <select value={bulkConfig.grade} onChange={(e)=>setBulkConfig({...bulkConfig, grade: e.target.value})} style={inputStyle}>{['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}</select>
              <select value={bulkConfig.section} onChange={(e)=>setBulkConfig({...bulkConfig, section: e.target.value})} style={inputStyle}>{['A','B','C','D','E'].map(o=><option key={o}>{o}</option>)}</select>
           </div>
           <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
              <button onClick={downloadTemplate} style={{...btnSecondaryStyle, flex:1}}><Download size={16}/> Plantilla</button>
              <label style={{...btnSecondaryStyle, flex:1, background: '#3b82f6', color: 'white', cursor: 'pointer'}}><FileSpreadsheet size={16}/> Subir .xlsx<input type="file" accept=".xlsx, .xls" hidden onChange={handleExcelRead} /></label>
           </div>
           {excelPreview.length > 0 && <button onClick={saveExcelData} disabled={loading} style={{width: '100%', padding: '10px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold'}}>Guardar {excelPreview.length} alumnos</button>}
        </div>
      )}

      {!showExcel && (
        <div style={{background:'white', padding:'15px', borderRadius:'12px', marginBottom:'20px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
           <h3 style={{marginTop:0, display:'flex', alignItems:'center', gap:'8px', fontSize:'16px'}}>
             {editingId ? <Edit2 size={18} color="#f59e0b"/> : <UserPlus size={18} color="#3b82f6"/>}
             {editingId ? 'Editar Datos' : 'Registrar Alumno'}
           </h3>
           <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              <div style={{display:'flex', gap:'8px'}}>
                  <input name="name" placeholder="Nombre Completo" value={formData.name} onChange={handleChange} required style={{...inputStyle, flex:2}}/>
                  <input name="studentId" placeholder="ID / Matrícula" value={formData.studentId} onChange={handleChange} style={{...inputStyle, flex:1}}/>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
                  <div style={{position:'relative'}}><label style={labelStyle}>Nivel</label><select name="level" value={formData.level} onChange={handleChange} style={inputStyle}><option>Primaria</option><option>Secundaria</option></select></div>
                  <div style={{position:'relative'}}><label style={labelStyle}>Tanda</label><select name="shift" value={formData.shift} onChange={handleChange} style={inputStyle}><option>Matutina</option><option>Vespertina</option><option>Extendida</option></select></div>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px'}}>
                  <div style={{position:'relative'}}><label style={labelStyle}>Grado</label><select name="grade" value={formData.grade} onChange={handleChange} style={inputStyle}>{['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}</select></div>
                  <div style={{position:'relative'}}><label style={labelStyle}>Sección</label><select name="section" value={formData.section} onChange={handleChange} style={inputStyle}>{['A','B','C','D','E'].map(o=><option key={o}>{o}</option>)}</select></div>
                  <div style={{position:'relative'}}><label style={labelStyle}># Lista</label><input name="listNumber" type="number" min="1" placeholder="#" value={formData.listNumber} onChange={handleChange} style={inputStyle}/></div>
              </div>
              <div style={{display:'flex', gap:'8px', alignItems:'end'}}>
                  <div style={{flex:1, position:'relative'}}><label style={labelStyle}>Fecha Nac.</label><input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} style={inputStyle} /></div>
                  <div style={{flex:1}}><input id="photoInput" type="file" accept="image/*" onChange={handleFileChange} style={{fontSize: '10px'}}/></div>
              </div>
              <div style={{display: 'flex', gap: '10px', marginTop:'5px'}}>
                  {editingId && <button type="button" onClick={()=>{setEditingId(null); setFormData({name:'', studentId:'', level:'Primaria', shift:'Matutina', grade:'4to', section:'A', listNumber:'', birthDate:''});}} style={{padding:'10px', background:'#9ca3af', color:'white', border:'none', borderRadius:'8px', flex: 1}}>Cancelar</button>}
                  <button type="submit" disabled={loading} style={{padding:'10px', background: editingId?'#f59e0b':'#3b82f6', color:'white', border:'none', borderRadius:'8px', fontWeight:'bold', flex: 2}}>{loading ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar')}</button>
              </div>
           </form>
        </div>
      )}

      <div style={{background:'#f8fafc', padding:'10px', borderRadius:'8px', border:'1px solid #e2e8f0', marginBottom:'15px'}}>
          <div style={{fontSize:'11px', fontWeight:'bold', color:'#64748b', marginBottom:'5px', display:'flex', alignItems:'center', gap:'5px'}}><Filter size={12}/> Filtrar Lista:</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'5px', marginBottom:'8px'}}>
              <select value={viewFilters.level} onChange={e=>setViewFilters({...viewFilters, level:e.target.value})} style={filterSelectStyle}><option>Todos</option><option>Primaria</option><option>Secundaria</option></select>
              <select value={viewFilters.shift} onChange={e=>setViewFilters({...viewFilters, shift:e.target.value})} style={filterSelectStyle}><option>Todos</option><option>Matutina</option><option>Vespertina</option></select>
              <select value={viewFilters.grade} onChange={e=>setViewFilters({...viewFilters, grade:e.target.value})} style={filterSelectStyle}><option>Todos</option>{['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}</select>
              <select value={viewFilters.section} onChange={e=>setViewFilters({...viewFilters, section:e.target.value})} style={filterSelectStyle}><option>Todos</option>{['A','B','C','D','E'].map(o=><option key={o}>{o}</option>)}</select>
          </div>
          <div style={{position:'relative'}}>
              <Search size={14} style={{position:'absolute', left:'8px', top:'8px', color:'#94a3b8'}}/>
              <input placeholder="Buscar por nombre o ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{width:'100%', padding:'6px 6px 6px 28px', borderRadius:'6px', border:'1px solid #cbd5e1', fontSize:'13px', boxSizing:'border-box'}}/>
          </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
         <div style={{fontSize:'12px', color:'#666', textAlign:'right'}}>{filteredStudents.length} alumnos encontrados</div>
         {filteredStudents.length === 0 ? <p style={{textAlign: 'center', color: '#999', padding:'20px'}}>No hay resultados.</p> : 
             paginatedStudents.map(s => (
               <div key={s.id} style={{padding:'10px', background:'white', borderRadius:'8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', borderLeft: `4px solid ${s.photoUrl ? '#10b981' : '#cbd5e1'}`}}>
                  <div style={{display:'flex', gap:'12px', alignItems:'center'}}>
                     <div style={{position:'relative'}}>
                         {s.photoUrl ? <img src={s.photoUrl} style={{width:'45px', height:'45px', borderRadius:'50%', objectFit:'cover', border:'1px solid #eee'}}/> : <div style={{width:'45px', height:'45px', borderRadius:'50%', background:'#f1f5f9', display:'grid', placeItems:'center'}}><User size={20} color="#94a3b8"/></div>}
                         <div style={{position:'absolute', bottom:'-2px', right:'-2px', background:'#3b82f6', color:'white', width:'18px', height:'18px', borderRadius:'50%', fontSize:'10px', display:'grid', placeItems:'center', fontWeight:'bold'}}>{s.listNumber}</div>
                     </div>
                     <div>
                        <div style={{fontWeight: '600', color: '#333', fontSize:'15px'}}>{s.name}</div>
                        <div style={{fontSize: '12px', color: '#666', display:'flex', gap:'5px', flexWrap:'wrap'}}>
                           <span style={{background:'#eff6ff', color:'#1d4ed8', padding:'1px 4px', borderRadius:'4px'}}>{s.grade} {s.section}</span>
                           {s.studentId && <span style={{color:'#666'}}>• ID:{s.studentId}</span>}
                        </div>
                        {s.birthDate && <div style={{fontSize:'11px', color:'#999', display:'flex', alignItems:'center', gap:'3px'}}><Calendar size={10}/> {s.birthDate}</div>}
                     </div>
                  </div>
                  <div style={{display: 'flex', gap: '5px'}}>
                     <button onClick={() => onNavigate && onNavigate('gallery', s.id)} style={{background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius:'6px', padding:'6px', cursor: 'pointer'}} title="Ver Portafolio"><Folder size={16} color="#2563eb"/></button>
                     <button onClick={() => handleEdit(s)} style={{background: '#fffbeb', border: '1px solid #fde68a', borderRadius:'6px', padding:'6px', cursor: 'pointer'}}><Edit2 size={16} color="#d97706"/></button>
                     <button onClick={() => handleDelete(s.id)} style={{background: '#fef2f2', border: '1px solid #fecaca', borderRadius:'6px', padding:'6px', cursor: 'pointer'}}><Trash2 size={16} color="#dc2626"/></button>
                  </div>
               </div>
             ))
         }
      </div>
      
      {filteredStudents.length > itemsPerPage && (
          <div style={{display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '15px'}}>
              <button disabled={currentPage===1} onClick={()=>setCurrentPage(c=>c-1)} style={btnSecondaryStyle}>Anterior</button>
              <span style={{alignSelf:'center'}}>Pag {currentPage}</span>
              <button disabled={paginatedStudents.length < itemsPerPage} onClick={()=>setCurrentPage(c=>c+1)} style={btnSecondaryStyle}>Siguiente</button>
          </div>
      )}
    </div>
  );
}

const inputStyle = { padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', width: '100%', boxSizing: 'border-box', fontSize:'13px' };
const filterSelectStyle = { padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', width:'100%' };
const labelStyle = { fontSize: '10px', fontWeight: 'bold', color: '#6b7280', position:'absolute', top:'-6px', left:'5px', background:'white', padding:'0 2px' };
const btnSecondaryStyle = { padding: '8px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center', fontSize:'12px' };