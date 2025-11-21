// src/components/StudentForm.jsx
import { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  query, onSnapshot, where, getDocs, writeBatch 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { UserPlus, Edit2, Trash2, FileSpreadsheet, Download, X, Save, Search, AlertCircle } from 'lucide-react';

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
  
  // Estados para Excel
  const [showExcel, setShowExcel] = useState(false);
  const [excelPreview, setExcelPreview] = useState([]);
  const [bulkConfig, setBulkConfig] = useState({ level: 'Primaria', shift: 'Matutina', grade: '4to', section: 'A' });

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- 1. CARGA DE DATOS ---
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(collection(db, "students"), where("teacherId", "==", user.uid));
        
        const unsubscribeSnapshot = onSnapshot(q, (qs) => {
          const arr = [];
          qs.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));

          // Ordenar: Grado -> Sección -> Número de lista
          arr.sort((a, b) => {
            if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
            if (a.section !== b.section) return a.section.localeCompare(b.section);
            return (Number(a.listNumber) || 0) - (Number(b.listNumber) || 0);
          });
          setMyStudents(arr);
        });
        return () => unsubscribeSnapshot();
      } else {
        setMyStudents([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // --- VALIDACIÓN DE DUPLICADOS ---
  const checkDuplicateId = async (studentId) => {
    // Si no puso ID, no validamos (asumimos que puede haber alumnos sin ID manual)
    if (!studentId) return false;

    // Buscamos si existe algun alumno con ese studentId Y que sea de este profesor
    const q = query(
        collection(db, "students"), 
        where("teacherId", "==", auth.currentUser.uid),
        where("studentId", "==", studentId)
    );
    const snapshot = await getDocs(q);
    
    // Si estamos editando, ignoramos si el duplicado soy yo mismo
    if (editingId && snapshot.docs.length > 0) {
        const foundDoc = snapshot.docs[0];
        if (foundDoc.id === editingId) return false; // Soy yo mismo
    }

    return !snapshot.empty; // Retorna TRUE si ya existe (es duplicado)
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleFileChange = (e) => { if (e.target.files[0]) setPhotoFile(e.target.files[0]); };

  // --- GUARDADO (CON PROTECCIÓN) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return toast.error("Debes iniciar sesión");
    
    setLoading(true);
    const toastId = toast.loading("Verificando datos...");

    try {
      // 1. Verificar Duplicado
      if (formData.studentId) {
          const isDuplicate = await checkDuplicateId(formData.studentId);
          if (isDuplicate) {
              toast.error(`⛔ El ID "${formData.studentId}" ya existe.`, { id: toastId });
              setLoading(false);
              return; // DETENER PROCESO
          }
      }

      let photoUrl = formData.photoUrl || '';
      if (photoFile) {
        toast.loading("Subiendo foto...", { id: toastId });
        const storageRef = ref(storage, `perfiles_alumnos/${auth.currentUser.uid}/${Date.now()}_${photoFile.name}`);
        const snapshot = await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(snapshot.ref);
      }

      const dataToSave = {
        ...formData,
        listNumber: Number(formData.listNumber) || 0,
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
      document.getElementById('photoInput').value = "";

    } catch (error) { 
        console.error(error);
        toast.error(`Error: ${error.message}`, { id: toastId }); 
    } finally { 
        setLoading(false); 
    }
  };

  // --- EXCEL Y OTROS ---
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
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      setExcelPreview(data);
      toast.success(`${data.length} filas detectadas.`);
    };
    reader.readAsBinaryString(file);
  };

  const saveExcelData = async () => {
    if (!auth.currentUser) return;
    if (excelPreview.length === 0) return;
    setLoading(true);
    const toastId = toast.loading(`Guardando...`);

    try {
      const batch = writeBatch(db);
      excelPreview.forEach((row) => {
        const docRef = doc(collection(db, "students"));
        const studentData = {
          name: row.Nombre || row.name || "Sin Nombre",
          studentId: String(row.ID || row.studentId || ""),
          listNumber: Number(row.Numero || row.listNumber || 0),
          grade: bulkConfig.grade, section: bulkConfig.section, level: bulkConfig.level, shift: bulkConfig.shift,
          teacherId: auth.currentUser.uid, teacherEmail: auth.currentUser.email, createdAt: new Date(), photoUrl: ''
        };
        batch.set(docRef, studentData);
      });
      await batch.commit();
      toast.success("Carga masiva completada", { id: toastId });
      setExcelPreview([]); setShowExcel(false);
    } catch (error) { toast.error("Error: " + error.message, { id: toastId }); } finally { setLoading(false); }
  };

  const handleEdit = (s) => { 
    setFormData({
        name: s.name, studentId: s.studentId || '', level: s.level || 'Primaria', shift: s.shift || 'Matutina',
        grade: s.grade, section: s.section, listNumber: s.listNumber, photoUrl: s.photoUrl
    }); 
    setEditingId(s.id); setShowExcel(false); window.scrollTo({top:0, behavior:'smooth'}); 
  };

  const handleDelete = async (id) => { 
    if(confirm("¿Seguro que deseas borrar este alumno? Sus evidencias NO se borrarán.")) {
        try { await deleteDoc(doc(db,"students",id)); toast.success("Borrado"); } 
        catch(e) { toast.error(e.message); }
    }
  };

  const filteredStudents = myStudents.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.studentId && s.studentId.includes(searchTerm)));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- RENDER ---
  return (
    <div style={{ paddingBottom: '80px' }}>
      
      {/* BOTÓN TOGGLE EXCEL */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
        <button onClick={() => {setShowExcel(!showExcel); setEditingId(null);}} style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: showExcel ? '#ef4444':'#10b981', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>
          {showExcel ? <X size={18}/> : <FileSpreadsheet size={18}/>} {showExcel ? 'Cancelar' : 'Carga Masiva Excel'}
        </button>
      </div>

      {/* MÓDULO EXCEL */}
      {showExcel && (
        <div style={{background:'white', padding:'15px', borderRadius:'12px', marginBottom:'20px', border: '2px solid #10b981'}}>
           <h4 style={{margin: '0 0 10px 0', color: '#059669'}}>1. Configurar Excel</h4>
           <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom: '15px'}}>
              <select value={bulkConfig.grade} onChange={(e)=>setBulkConfig({...bulkConfig, grade: e.target.value})} style={inputStyle}>{['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}</select>
              <select value={bulkConfig.section} onChange={(e)=>setBulkConfig({...bulkConfig, section: e.target.value})} style={inputStyle}>{['A','B','C','D','E'].map(o=><option key={o}>{o}</option>)}</select>
           </div>
           <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
              <button onClick={downloadTemplate} style={{...btnSecondaryStyle, flex:1}}><Download size={16}/> Plantilla</button>
              <label style={{...btnSecondaryStyle, flex:1, background: '#3b82f6', color: 'white', cursor: 'pointer'}}><FileSpreadsheet size={16}/> Subir .xlsx<input type="file" accept=".xlsx, .xls" hidden onChange={handleExcelRead} /></label>
           </div>
           {excelPreview.length > 0 && <button onClick={saveExcelData} disabled={loading} style={{width: '100%', padding: '12px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold'}}><Save size={18}/> Guardar {excelPreview.length} alumnos</button>}
        </div>
      )}

      {/* FORMULARIO MANUAL */}
      {!showExcel && (
        <div style={{background:'white', padding:'15px', borderRadius:'12px', marginBottom:'20px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
           <h3 style={{marginTop:0, display:'flex', alignItems:'center', gap:'8px'}}>
             {editingId ? <Edit2 size={20} color="#f59e0b"/> : <UserPlus size={20} color="#3b82f6"/>}
             {editingId ? 'Editar Alumno' : 'Nuevo Alumno'}
           </h3>
           <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'12px'}}>
              <input name="name" placeholder="Nombre Completo" value={formData.name} onChange={handleChange} required style={inputStyle}/>
              <input name="studentId" placeholder="Matrícula / ID (Opcional)" value={formData.studentId} onChange={handleChange} style={inputStyle}/>
              
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px'}}>
                  <select name="grade" value={formData.grade} onChange={handleChange} style={inputStyle}>{['1ro','2do','3ro','4to','5to','6to'].map(o=><option key={o}>{o}</option>)}</select>
                  <select name="section" value={formData.section} onChange={handleChange} style={inputStyle}>{['A','B','C','D','E'].map(o=><option key={o}>{o}</option>)}</select>
                  <input name="listNumber" type="number" placeholder="#" value={formData.listNumber} onChange={handleChange} style={inputStyle}/>
              </div>
              
              <div style={{display:'flex', gap:'5px', alignItems:'center'}}>
                 <input id="photoInput" type="file" accept="image/*" onChange={handleFileChange} style={{fontSize: '11px'}}/>
              </div>

              <div style={{display: 'flex', gap: '10px'}}>
                  {editingId && <button type="button" onClick={()=>{setEditingId(null); setFormData({name:'', studentId:'', level:'Primaria', shift:'Matutina', grade:'4to', section:'A', listNumber:''});}} style={{padding:'12px', background:'#9ca3af', color:'white', border:'none', borderRadius:'8px', flex: 1}}>Cancelar</button>}
                  <button type="submit" disabled={loading} style={{padding:'12px', background: editingId?'#f59e0b':'#3b82f6', color:'white', border:'none', borderRadius:'8px', fontWeight:'bold', flex: 2}}>
                      {loading ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar')}
                  </button>
              </div>
           </form>
        </div>
      )}

      {/* LISTADO DE ALUMNOS */}
      <div style={{marginBottom: '10px', display: 'flex', gap: '10px'}}>
         <div style={{position:'relative', flex:1}}>
             <Search size={16} style={{position:'absolute', left:'10px', top:'10px', color:'#999'}}/>
             <input placeholder="Buscar alumno..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{...inputStyle, paddingLeft:'30px'}}/>
         </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
         {paginatedStudents.length === 0 ? <p style={{textAlign: 'center', color: '#999'}}>No hay alumnos.</p> : 
             paginatedStudents.map(s => (
               <div key={s.id} style={{padding:'12px', background:'white', borderLeft:'4px solid #3b82f6', borderRadius:'6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
                  <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                     {s.photoUrl ? <img src={s.photoUrl} style={{width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover'}}/> : <div style={{width:'40px', height:'40px', borderRadius:'50%', background:'#eee', display:'grid', placeItems:'center', fontSize:'10px'}}>Sin Foto</div>}
                     <div>
                        <div style={{fontWeight: 'bold', color: '#333'}}>{s.name}</div>
                        <div style={{fontSize: '12px', color: '#666'}}>{s.grade} {s.section} • N° {s.listNumber} {s.studentId && `• ID: ${s.studentId}`}</div>
                     </div>
                  </div>
                  <div style={{display: 'flex', gap: '8px'}}>
                     <button onClick={() => handleEdit(s)} style={{background: 'none', border: 'none', cursor: 'pointer'}}><Edit2 size={18} color="#f59e0b"/></button>
                     <button onClick={() => handleDelete(s.id)} style={{background: 'none', border: 'none', cursor: 'pointer'}}><Trash2 size={18} color="#ef4444"/></button>
                  </div>
               </div>
             ))
         }
      </div>

      {/* Paginación */}
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

const inputStyle = { padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box' };
const btnSecondaryStyle = { padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' };