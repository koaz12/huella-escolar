// src/components/StudentForm.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { 
  UserPlus, Edit2, Trash2, FileSpreadsheet, Download, X, 
  Save, Search, Filter, Calendar, User, Folder 
} from 'lucide-react';

import { useStudents } from '../hooks/useStudents';
import { SchoolFilters } from './UI/SchoolFilters';
import { LEVELS, SHIFTS, GRADES, SECTIONS, DEFAULT_FILTERS } from '../utils/constants';
import { StudentService } from '../services/studentService';

// UI KIT
import { Button } from './UI/Button';
import { Input, Select } from './UI/FormElements';
import { Card } from './UI/Card';

export function StudentForm() {
  const navigate = useNavigate();
  const { students: myStudents } = useStudents();

  // Estados Datos
  const [formData, setFormData] = useState({ 
    name: '', studentId: '', level: 'Primaria', shift: 'Matutina', 
    grade: '4to', section: 'A', listNumber: '', birthDate: '' 
  });
  
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Filtros Vista
  const [viewFilters, setViewFilters] = useState(DEFAULT_FILTERS);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados Excel
  const [showExcel, setShowExcel] = useState(false);
  const [excelPreview, setExcelPreview] = useState([]);
  const [bulkConfig, setBulkConfig] = useState({ level: '', shift: '', grade: '', section: '' });

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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return toast.error("Inicia sesión");
    if (Number(formData.listNumber) < 1) return toast.error("El número de lista debe ser 1 o mayor");
    
    setLoading(true);
    const toastId = toast.loading("Procesando...");

    try {
      if (formData.studentId) {
          const isDuplicate = await StudentService.checkDuplicateId(formData.studentId, session.user.id, editingId);
          if (isDuplicate) { toast.error(`⛔ El ID "${formData.studentId}" ya existe.`, { id: toastId }); setLoading(false); return; }
      }

      let photoUrl = formData.photoUrl;
      if (photoFile) {
        const fileName = `${session.user.id}/${Date.now()}_${photoFile.name}`;
        const { error: uploadError } = await supabase.storage.from('perfiles_alumnos').upload(fileName, photoFile);
        if (!uploadError) {
             photoUrl = supabase.storage.from('perfiles_alumnos').getPublicUrl(fileName).data.publicUrl;
        }
      }

      const studentData = { ...formData, photoUrl };

      if (editingId) {
        await StudentService.update(editingId, studentData);
        toast.success("Alumno actualizado", { id: toastId });
        setEditingId(null);
      } else {
        await StudentService.create(studentData, session.user.id, session.user.email);
        toast.success(`Alumno #${formData.listNumber} creado`, { id: toastId });
      }

      setFormData(prev => ({ ...prev, name: '', studentId: '', birthDate: '' }));
      setPhotoFile(null);
      document.getElementById('photoInput').value = "";

    } catch (error) { toast.error(`Error: ${error.message}`, { id: toastId }); } finally { setLoading(false); }
  };

  // --- EXCEL ---
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
        { Nombre: "Juan Perez", ID: "1001", Numero: 1, Nivel: "Primaria", Tanda: "Matutina", Grado: "4to", Seccion: "A" }, 
        { Nombre: "Maria Lopez", ID: "1002", Numero: 2, Nivel: "Primaria", Tanda: "Matutina", Grado: "4to", Seccion: "A" }
    ]);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setLoading(true);
      const toastId = toast.loading("Guardando Excel...");
      try {
        const promises = excelPreview.map(row => {
            const data = {
                name: row.Nombre || row.name || "Sin Nombre",
                studentId: String(row.ID || row.studentId || ""),
                listNumber: Number(row.Numero || row.listNumber || 0),
                level: bulkConfig.level || row.Nivel || 'Primaria',
                shift: bulkConfig.shift || row.Tanda || 'Matutina',
                grade: bulkConfig.grade || row.Grado || '4to',
                section: bulkConfig.section || row.Seccion || row.Sección || 'A',
                photoUrl: ''
            };
            return StudentService.create(data, session.user.id, session.user.email);
        });
        await Promise.all(promises);
        toast.success("Carga masiva completada", { id: toastId });
        setExcelPreview([]); setShowExcel(false);
        setBulkConfig({ level: '', shift: '', grade: '', section: '' });
      } catch (e) { toast.error(e.message, { id: toastId }); } finally { setLoading(false); }
  };

  // --- ACCIONES ---
  const handleEdit = (s) => { 
    setFormData({ ...s, photoUrl: s.photoUrl }); 
    setEditingId(s.id); setShowExcel(false); window.scrollTo({top:0, behavior:'smooth'}); 
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
    <div className="pb-20">
      
      <div className="mb-4">
        <button 
            onClick={() => {setShowExcel(!showExcel); setEditingId(null);}} 
            className={`w-full py-3 rounded-xl border-none font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${showExcel ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20' : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/20'}`}
        >
          {showExcel ? <X size={16}/> : <FileSpreadsheet size={16}/>} 
          {showExcel ? 'Cancelar Carga' : 'Carga Masiva (Excel)'}
        </button>
      </div>

      {/* MÓDULO EXCEL */}
      {showExcel && (
        <Card title="Carga Masiva desde Excel" icon={FileSpreadsheet}>
           <div className="text-xs text-secondary mb-4 italic">
               Configuración opcional para forzar datos. Si se deja vacío, se lee del Excel.
           </div>
           
           <div className="grid grid-cols-2 gap-2 mb-2">
              <Select label="Nivel (Opcional)" value={bulkConfig.level} onChange={(e)=>setBulkConfig({...bulkConfig, level: e.target.value})}>
                  <option value="">-- Usar del Excel --</option>
                  {LEVELS.map(o=><option key={o}>{o}</option>)}
              </Select>
              <Select label="Tanda (Opcional)" value={bulkConfig.shift} onChange={(e)=>setBulkConfig({...bulkConfig, shift: e.target.value})}>
                  <option value="">-- Usar del Excel --</option>
                  {SHIFTS.map(o=><option key={o}>{o}</option>)}
              </Select>
           </div>

           <div className="grid grid-cols-2 gap-2 mb-4">
              <Select label="Grado (Opcional)" value={bulkConfig.grade} onChange={(e)=>setBulkConfig({...bulkConfig, grade: e.target.value})}>
                  <option value="">-- Usar del Excel --</option>
                  {GRADES.map(o=><option key={o}>{o}</option>)}
              </Select>
              <Select label="Sección (Opcional)" value={bulkConfig.section} onChange={(e)=>setBulkConfig({...bulkConfig, section: e.target.value})}>
                  <option value="">-- Usar del Excel --</option>
                  {SECTIONS.map(o=><option key={o}>{o}</option>)}
              </Select>
           </div>
           
           <div className="flex gap-2 mb-4">
              <label className="btn btn-primary flex-1 text-sm">
                  <FileSpreadsheet size={16}/> Subir Archivo
                  <input type="file" accept=".xlsx, .xls" hidden onChange={handleExcelRead} />
              </label>

              <button className="btn btn-secondary flex-1" onClick={downloadTemplate}><Download size={16}/> Plantilla</button>
           </div>
           
           {excelPreview.length > 0 && (
               <button onClick={saveExcelData} disabled={loading} className="btn btn-success w-full">
                   <Save size={18}/> Guardar {excelPreview.length} alumnos
               </button>
           )}
        </Card>
      )}

      {/* FORMULARIO MANUAL */}
      {!showExcel && (
        <Card 
          title={editingId ? 'Editar Alumno' : 'Nuevo Alumno'} 
          icon={editingId ? Edit2 : UserPlus}
          actions={editingId && <button className="btn btn-secondary" onClick={()=>{setEditingId(null); setFormData({name:'', studentId:'', level:'Primaria', shift:'Matutina', grade:'4to', section:'A', listNumber:'', birthDate:''});}}>Cancelar</button>}
        >
           <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex gap-2">
                  <div className="flex-[2]"><Input label="Nombre Completo" name="name" placeholder="Ej: Juan Perez" value={formData.name} onChange={handleChange} required /></div>
                  <div className="flex-1"><Input label="Matrícula / ID" name="studentId" placeholder="Opcional" value={formData.studentId} onChange={handleChange} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                  <Select label="Nivel" name="level" value={formData.level} onChange={handleChange}>{LEVELS.map(o=><option key={o}>{o}</option>)}</Select>
                  <Select label="Tanda" name="shift" value={formData.shift} onChange={handleChange}>{SHIFTS.map(o=><option key={o}>{o}</option>)}</Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                  <Select label="Grado" name="grade" value={formData.grade} onChange={handleChange}>{GRADES.map(o=><option key={o}>{o}</option>)}</Select>
                  <Select label="Sección" name="section" value={formData.section} onChange={handleChange}>{SECTIONS.map(o=><option key={o}>{o}</option>)}</Select>
                  <Input label="# Lista" name="listNumber" type="number" min="1" value={formData.listNumber} onChange={handleChange}/>
              </div>
              <div className="flex gap-2 items-center mb-4">
                  <div className="flex-1"><Input label="Fecha Nacimiento" type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} /></div>
                  <div className="flex-1 pt-[1.35rem]"><input id="photoInput" type="file" accept="image/*" onChange={handleFileChange} className="text-xs w-full"/></div>
              </div>
              <button type="submit" disabled={loading} className={`w-full py-3.5 rounded-xl border-none font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-[0.98] ${editingId ? 'bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-500/20' : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-blue-500/20'}`}>
                  {loading ? 'Guardando...' : (editingId ? <><Save size={16}/> Actualizar Datos</> : <><UserPlus size={16}/> Registrar Alumno</>)}
              </button>
           </form>
        </Card>
      )}

      {/* FILTROS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 mb-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5 uppercase tracking-widest"><Filter size={12}/> Filtrar Lista</div>
          <div className="mb-3">
              <SchoolFilters filters={viewFilters} onChange={setViewFilters} showAllOption={true} layout="grid" />
          </div>
          <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              <input placeholder="Buscar por nombre o ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"/>
          </div>
      </div>

      {/* LISTA */}
      <div className="flex flex-col gap-2">
         <div className="text-[11px] text-slate-400 font-medium text-right mb-1">{filteredStudents.length} alumnos encontrados</div>
         {filteredStudents.length === 0 ? (
             <div className="text-center py-12 text-slate-400">
                 <User size={40} className="mx-auto mb-3 opacity-30" />
                 <p className="text-sm font-medium">No hay resultados.</p>
             </div>
         ) : 
             paginatedStudents.map(s => (
               <div key={s.id} className={`p-3 bg-white dark:bg-slate-900 rounded-2xl flex justify-between items-center shadow-sm border border-slate-200 dark:border-white/10 border-l-4 ${s.photoUrl ? 'border-l-emerald-400' : 'border-l-slate-200 dark:border-l-white/10'}`}>
                  <div className="flex gap-3 items-center">
                     <div className="relative shrink-0">
                         {s.photoUrl ? <img src={s.photoUrl} className="w-11 h-11 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm"/> : <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center"><User size={20} className="text-slate-400"/></div>}
                         <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-bold shadow">{s.listNumber}</div>
                     </div>
                     <div>
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{s.name}</div>
                        <div className="text-[11px] text-slate-400 flex gap-1.5 flex-wrap mt-0.5">
                           <span className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md font-semibold">{s.grade} {s.section}</span>
                           {s.studentId && <span className="text-slate-400">ID: {s.studentId}</span>}
                        </div>
                        {s.birthDate && <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1"><Calendar size={9}/> {s.birthDate}</div>}
                     </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                     <button onClick={() => navigate('/gallery', { state: { studentId: s.id } })} className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none flex items-center justify-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"><Folder size={14}/></button>
                     <button onClick={() => handleEdit(s)} className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-none flex items-center justify-center cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"><Edit2 size={14}/></button>
                     <button onClick={() => handleDelete(s.id)} className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-none flex items-center justify-center cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"><Trash2 size={14}/></button>
                  </div>
               </div>
             ))
         }
      </div>
      
      {filteredStudents.length > itemsPerPage && (
          <div className="flex justify-center items-center gap-4 mt-5">
              <button className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-semibold cursor-pointer disabled:opacity-40 hover:bg-slate-50 transition-colors" disabled={currentPage===1} onClick={()=>setCurrentPage(c=>c-1)}>Anterior</button>
              <span className="text-xs font-bold text-slate-400">Página {currentPage}</span>
              <button className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-sm font-semibold cursor-pointer disabled:opacity-40 hover:bg-slate-50 transition-colors" disabled={paginatedStudents.length < itemsPerPage} onClick={()=>setCurrentPage(c=>c+1)}>Siguiente</button>
          </div>
      )}
    </div>
  );
}