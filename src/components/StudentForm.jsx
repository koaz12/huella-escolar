import { useState, useEffect } from 'react';
import { storage, auth } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import { 
  UserPlus, Edit2, Trash2, Download, X, Save, Search, Filter, Calendar, User, Folder 
} from 'lucide-react';

import { useStudents } from '../hooks/useStudents';
import { SchoolFilters } from './UI/SchoolFilters';
import { LEVELS, SHIFTS, GRADES, SECTIONS, DEFAULT_FILTERS } from '../utils/constants';
import { StudentService } from '../services/studentService';

// --- IMPORTAMOS EL UI KIT ---
import { Button } from './UI/Button';
import { Input, Select } from './UI/FormElements';
import { Card } from './UI/Card';

export function StudentForm({ onNavigate }) {
  const { students: myStudents } = useStudents();
  const [formData, setFormData] = useState({ name: '', studentId: '', level: 'Primaria', shift: 'Matutina', grade: '4to', section: 'A', listNumber: '', birthDate: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewFilters, setViewFilters] = useState(DEFAULT_FILTERS);
  const [searchTerm, setSearchTerm] = useState('');
  
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // --- AUTOCOMPLETADO ---
  useEffect(() => {
      if (editingId) return;
      const existing = myStudents.filter(s => s.grade === formData.grade && s.section === formData.section);
      if (existing.length > 0) {
          const maxNum = Math.max(...existing.map(s => Number(s.listNumber) || 0));
          setFormData(prev => ({ ...prev, listNumber: maxNum + 1 }));
      } else {
          setFormData(prev => ({ ...prev, listNumber: 1 }));
      }
  }, [formData.grade, formData.section, myStudents, editingId]);

  // --- HANDLERS ---
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
          const isDuplicate = await StudentService.checkDuplicateId(formData.studentId, auth.currentUser.uid, editingId);
          if (isDuplicate) { toast.error(`⛔ El ID "${formData.studentId}" ya existe.`, { id: toastId }); setLoading(false); return; }
      }

      let photoUrl = formData.photoUrl;
      if (photoFile) {
        const storageRef = ref(storage, `perfiles_alumnos/${auth.currentUser.uid}/${Date.now()}_${photoFile.name}`);
        const snapshot = await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(snapshot.ref);
      }

      const studentData = { ...formData, photoUrl };

      if (editingId) {
        await StudentService.update(editingId, studentData);
        toast.success("Alumno actualizado", { id: toastId });
        setEditingId(null);
      } else {
        await StudentService.create(studentData, auth.currentUser.uid, auth.currentUser.email);
        toast.success(`Alumno #${formData.listNumber} creado`, { id: toastId });
      }

      setFormData(prev => ({ ...prev, name: '', studentId: '', birthDate: '' }));
      setPhotoFile(null);
      document.getElementById('photoInput').value = "";

    } catch (error) { toast.error(`Error: ${error.message}`, { id: toastId }); } finally { setLoading(false); }
  };

  const handleEdit = (s) => { 
    setFormData({ ...s, photoUrl: s.photoUrl }); 
    setEditingId(s.id); window.scrollTo({top:0, behavior:'smooth'}); 
  };

  const handleDelete = async (id) => { 
    if(confirm("¿Seguro que deseas borrar este alumno?")) {
        try { await StudentService.delete(id); toast.success("Borrado"); } catch(e) { toast.error(e.message); }
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
      
      {/* FORMULARIO USANDO UI KIT */}
      <Card 
        title={editingId ? 'Editar Alumno' : 'Nuevo Alumno'} 
        icon={editingId ? Edit2 : UserPlus}
        actions={editingId && <Button variant="secondary" onClick={()=>{setEditingId(null); setFormData({name:'', studentId:'', level:'Primaria', shift:'Matutina', grade:'4to', section:'A', listNumber:'', birthDate:''});}} style={{width:'auto', padding:'5px 10px'}}>Cancelar</Button>}
      >
           <form onSubmit={handleSubmit}>
              <div style={{display:'flex', gap:'10px'}}>
                  <div style={{flex:2}}><Input label="Nombre Completo" name="name" placeholder="Ej: Juan Perez" value={formData.name} onChange={handleChange} required /></div>
                  <div style={{flex:1}}><Input label="Matrícula / ID" name="studentId" placeholder="Opcional" value={formData.studentId} onChange={handleChange} /></div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                  <Select label="Nivel" name="level" value={formData.level} onChange={handleChange}>{LEVELS.map(o=><option key={o}>{o}</option>)}</Select>
                  <Select label="Tanda" name="shift" value={formData.shift} onChange={handleChange}>{SHIFTS.map(o=><option key={o}>{o}</option>)}</Select>
              </div>
              
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px'}}>
                  <Select label="Grado" name="grade" value={formData.grade} onChange={handleChange}>{GRADES.map(o=><option key={o}>{o}</option>)}</Select>
                  <Select label="Sección" name="section" value={formData.section} onChange={handleChange}>{SECTIONS.map(o=><option key={o}>{o}</option>)}</Select>
                  <Input label="# Lista" name="listNumber" type="number" min="1" value={formData.listNumber} onChange={handleChange}/>
              </div>

              <div style={{display:'flex', gap:'10px', alignItems:'center', marginBottom:'15px'}}>
                  <div style={{flex:1}}><Input label="Fecha Nacimiento" type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} /></div>
                  <div style={{flex:1, paddingTop:'15px'}}><input id="photoInput" type="file" accept="image/*" onChange={handleFileChange} style={{fontSize: '12px'}}/></div>
              </div>

              <Button type="submit" disabled={loading} variant={editingId ? 'secondary' : 'primary'}>
                  {loading ? 'Guardando...' : (editingId ? <><Save size={18}/> Actualizar Datos</> : <><UserPlus size={18}/> Registrar Alumno</>)}
              </Button>
           </form>
      </Card>

      {/* BARRA DE FILTROS */}
      <div style={{background:'#f8fafc', padding:'15px', borderRadius:'16px', border:'1px solid #e2e8f0', marginBottom:'15px'}}>
          <div style={{fontSize:'12px', fontWeight:'bold', color:'#64748b', marginBottom:'10px', display:'flex', alignItems:'center', gap:'5px'}}><Filter size={14}/> Filtrar Lista:</div>
          <div style={{marginBottom:'10px'}}>
              <SchoolFilters filters={viewFilters} onChange={setViewFilters} showAllOption={true} layout="grid" />
          </div>
          <div style={{position:'relative'}}>
              <Search size={16} style={{position:'absolute', left:'10px', top:'10px', color:'#9ca3af'}}/>
              <input placeholder="Buscar por nombre o ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{width:'100%', padding:'10px 10px 10px 35px', borderRadius:'8px', border:'1px solid #cbd5e1', fontSize:'14px', boxSizing:'border-box', outline:'none'}}/>
          </div>
      </div>

      {/* LISTA DE ALUMNOS */}
      <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
         <div style={{fontSize:'12px', color:'#666', textAlign:'right'}}>{filteredStudents.length} alumnos encontrados</div>
         
         {filteredStudents.length === 0 ? <p style={{textAlign: 'center', color: '#999', padding:'20px'}}>No hay resultados.</p> : 
             paginatedStudents.map(s => (
               <div key={s.id} style={{padding:'12px', background:'white', borderRadius:'12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: `4px solid ${s.photoUrl ? '#10b981' : '#cbd5e1'}`}}>
                  <div style={{display:'flex', gap:'12px', alignItems:'center'}}>
                     <div style={{position:'relative'}}>
                         {s.photoUrl ? <img src={s.photoUrl} style={{width:'45px', height:'45px', borderRadius:'50%', objectFit:'cover', border:'1px solid #eee'}}/> : <div style={{width:'45px', height:'45px', borderRadius:'50%', background:'#f1f5f9', display:'grid', placeItems:'center'}}><User size={20} color="#94a3b8"/></div>}
                         <div style={{position:'absolute', bottom:'-2px', right:'-2px', background:'#2563eb', color:'white', width:'20px', height:'20px', borderRadius:'50%', fontSize:'11px', display:'grid', placeItems:'center', fontWeight:'bold'}}>{s.listNumber}</div>
                     </div>
                     <div>
                        <div style={{fontWeight: '600', color: '#1e293b', fontSize:'15px'}}>{s.name}</div>
                        <div style={{fontSize: '12px', color: '#64748b', display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'2px'}}>
                           <span style={{background:'#eff6ff', color:'#2563eb', padding:'2px 6px', borderRadius:'4px', fontWeight:'500'}}>{s.grade} {s.section}</span>
                           {s.studentId && <span style={{color:'#94a3b8'}}>ID: {s.studentId}</span>}
                        </div>
                        {s.birthDate && <div style={{fontSize:'11px', color:'#94a3b8', display:'flex', alignItems:'center', gap:'3px', marginTop:'2px'}}><Calendar size={10}/> {s.birthDate}</div>}
                     </div>
                  </div>
                  
                  <div style={{display: 'flex', gap: '8px'}}>
                     {/* Botones de Acción más limpios */}
                     <button onClick={() => navigate('/gallery', { state: { studentId: s.id } })} style={{background: '#eff6ff', border: 'none', borderRadius:'8px', padding:'8px', cursor: 'pointer', color:'#2563eb'}}><Folder size={18}/></button>
                     <button onClick={() => handleEdit(s)} style={{background: '#fffbeb', border: 'none', borderRadius:'8px', padding:'8px', cursor: 'pointer', color:'#d97706'}}><Edit2 size={18}/></button>
                     <button onClick={() => handleDelete(s.id)} style={{background: '#fef2f2', border: 'none', borderRadius:'8px', padding:'8px', cursor: 'pointer', color:'#dc2626'}}><Trash2 size={18}/></button>
                  </div>
               </div>
             ))
         }
      </div>
      
      {/* Paginación */}
      {filteredStudents.length > itemsPerPage && (
          <div style={{display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px'}}>
              <Button variant="secondary" disabled={currentPage===1} onClick={()=>setCurrentPage(c=>c-1)} style={{width:'auto'}}>Anterior</Button>
              <span style={{alignSelf:'center', fontSize:'14px', color:'#666'}}>Página {currentPage}</span>
              <Button variant="secondary" disabled={paginatedStudents.length < itemsPerPage} onClick={()=>setCurrentPage(c=>c+1)} style={{width:'auto'}}>Siguiente</Button>
          </div>
      )}
    </div>
  );
}