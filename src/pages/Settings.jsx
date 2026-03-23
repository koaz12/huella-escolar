import { useState, useEffect } from 'react';
import { useStudents } from '../hooks/useStudents';
import { useTags } from '../hooks/useTags';
import { supabase } from '../supabase';
import { Save, User, Users, Tag, Database, Download, Trash2, Plus, Edit2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { saveAs } from 'file-saver';

export function Settings() {
    const [activeTab, setActiveTab] = useState('general');
    const { students, addStudent, updateStudent, deleteStudent } = useStudents();
    const { availableTags, addTag, deleteTag } = useTags();

    const [profile, setProfile] = useState({ name: '', school: '', currentPeriod: localStorage.getItem('currentPeriod') || 'P1' });
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [editingStudent, setEditingStudent] = useState(null);
    const [newStudent, setNewStudent] = useState({ name: '', grade: '', section: '', listNumber: '' });
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data, error } = await supabase.from('teachers').select('*').eq('id', session.user.id).single();
                if (!error && data) {
                    setProfile({ name: data.full_name || '', school: data.school_id || '', currentPeriod: localStorage.getItem('currentPeriod') || 'P1' });
                }
            }
            setLoadingProfile(false);
        };
        fetchProfile();
    }, []);

    const saveProfile = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            await supabase.from('teachers').update({ full_name: profile.name }).eq('id', session.user.id);
            toast.success('Perfil guardado');
        } catch (e) { toast.error('Error al guardar'); }
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        if (!newStudent.name) return toast.error('Nombre requerido');
        await addStudent(newStudent);
        setNewStudent({ name: '', grade: '', section: '', listNumber: '' });
    };

    const handleUpdateStudent = async () => {
        if (!editingStudent.name) return;
        await updateStudent(editingStudent.id, {
            name: editingStudent.name, grade: editingStudent.grade,
            section: editingStudent.section, listNumber: editingStudent.listNumber
        });
        setEditingStudent(null);
    };

    const exportData = async () => {
        const data = { profile, tags: availableTags, students, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        saveAs(blob, 'huella_escolar_backup.json');
        toast.success('Copia de seguridad descargada');
    };

    const tabs = [
        { id: 'general', label: 'General', icon: User },
        { id: 'students', label: 'Alumnos', icon: Users },
        { id: 'tags', label: 'Etiquetas', icon: Tag },
        { id: 'data', label: 'Datos', icon: Database },
    ];

    const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all';
    const labelCls = 'block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5';

    return (
        <div className="pb-20 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0">Configuración</h2>

            {/* TABS */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-bold cursor-pointer border-none transition-all duration-200 ${
                            activeTab === id
                                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Icon size={13} /> {label}
                    </button>
                ))}
            </div>

            {/* GENERAL TAB */}
            {activeTab === 'general' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm flex flex-col gap-4">
                    <div>
                        <label className={labelCls}>Nombre del Docente</label>
                        <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className={inputCls} placeholder="Ej. Prof. María García" />
                    </div>
                    <div>
                        <label className={labelCls}>Periodo Académico Activo</label>
                        <select
                            value={profile.currentPeriod}
                            onChange={e => {
                                const p = e.target.value;
                                localStorage.setItem('currentPeriod', p);
                                setProfile({ ...profile, currentPeriod: p });
                                toast.success(`Período cambiado a ${p}`);
                            }}
                            className={inputCls}
                        >
                            <option value="P1">Período 1 (P1)</option>
                            <option value="P2">Período 2 (P2)</option>
                            <option value="P3">Período 3 (P3)</option>
                            <option value="P4">Período 4 (P4)</option>
                        </select>
                    </div>

                    {/* Teacher type */}
                    <div>
                        <label className={labelCls}>Tipo de Docente</label>
                        <p className="text-[10px] text-slate-400 mb-2">Esto adapta la pantalla de Horario a tu situación</p>
                        <div className="flex gap-2">
                            {[
                                { val: 'single', label: '📚 Única Materia', desc: 'Enseñas la misma asignatura todo el día' },
                                { val: 'rotativo', label: '🔄 Rotativo', desc: 'Tienes varias asignaturas o grupos distintos' }
                            ].map(opt => {
                                const teacherType = localStorage.getItem('teacherType') || 'rotativo';
                                return (
                                    <button
                                        key={opt.val}
                                        type="button"
                                        onClick={() => {
                                            localStorage.setItem('teacherType', opt.val);
                                            toast.success(`Tipo cambiado a ${opt.label}`);
                                            setProfile({ ...profile }); // trigger re-render
                                        }}
                                        className={`flex-1 p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                            teacherType === opt.val
                                                ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10'
                                                : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-0.5">{opt.label}</div>
                                        <div className="text-[10px] text-slate-400 font-medium leading-tight">{opt.desc}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <button onClick={saveProfile} className="w-full py-3.5 rounded-xl border-none bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]">
                        <Save size={16} /> Guardar Perfil
                    </button>
                </div>
            )}

            {/* STUDENTS TAB */}
            {activeTab === 'students' && (
                <div className="flex flex-col gap-3">
                    <form onSubmit={handleAddStudent} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-4 shadow-sm flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 m-0">Agregar Alumno</h3>
                        <input value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} placeholder="Nombre Completo" className={inputCls} />
                        <div className="grid grid-cols-2 gap-2">
                            <input value={newStudent.grade} onChange={e => setNewStudent({ ...newStudent, grade: e.target.value })} placeholder="Grado (ej. 4to)" className={inputCls} />
                            <input value={newStudent.section} onChange={e => setNewStudent({ ...newStudent, section: e.target.value })} placeholder="Sección (ej. A)" className={inputCls} />
                        </div>
                        <button type="submit" className="w-full py-2.5 rounded-xl border-none bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors">
                            <Plus size={15} /> Agregar
                        </button>
                    </form>

                    <div className="flex flex-col gap-2">
                        {students.map(student => (
                            <div key={student.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 p-3 flex items-center justify-between shadow-sm">
                                {editingStudent?.id === student.id ? (
                                    <div className="flex gap-1.5 flex-1 items-center">
                                        <input value={editingStudent.name} onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value })} className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100" />
                                        <input value={editingStudent.grade} onChange={e => setEditingStudent({ ...editingStudent, grade: e.target.value })} className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-sm text-center focus:outline-none bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100" />
                                        <input value={editingStudent.section} onChange={e => setEditingStudent({ ...editingStudent, section: e.target.value })} className="w-10 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-sm text-center focus:outline-none bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100" />
                                        <button onClick={handleUpdateStudent} className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none flex items-center justify-center cursor-pointer"><Check size={14} /></button>
                                        <button onClick={() => setEditingStudent(null)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 border-none flex items-center justify-center cursor-pointer"><X size={14} /></button>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{student.name}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{student.grade} {student.section}</div>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button onClick={() => setEditingStudent(student)} className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-none flex items-center justify-center cursor-pointer"><Edit2 size={13} /></button>
                                            <button onClick={() => deleteStudent(student.id)} className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-none flex items-center justify-center cursor-pointer"><Trash2 size={13} /></button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        {students.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No hay alumnos registrados aún.</div>}
                    </div>
                </div>
            )}

            {/* TAGS TAB */}
            {activeTab === 'tags' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-4 shadow-sm flex flex-col gap-4">
                    <div className="flex gap-2">
                        <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newTag.trim()) { addTag(newTag.trim()); setNewTag(''); } } }} placeholder="Nueva etiqueta..." className={`${inputCls} flex-1`} />
                        <button onClick={() => { if (newTag.trim()) { addTag(newTag.trim()); setNewTag(''); } }} className="px-4 py-2.5 rounded-xl border-none bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer transition-colors flex items-center gap-1.5 shrink-0">
                            <Plus size={14} /> Agregar
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {availableTags.map(tag => (
                            <div key={tag} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300 text-sm font-semibold">
                                <span>{tag}</span>
                                <button onClick={() => deleteTag(tag)} className="w-4 h-4 rounded-full border-none bg-blue-200 dark:bg-blue-500/30 text-blue-600 dark:text-blue-300 flex items-center justify-center cursor-pointer hover:bg-rose-100 hover:text-rose-600 transition-colors p-0"><X size={10} /></button>
                            </div>
                        ))}
                        {availableTags.length === 0 && <div className="text-sm text-slate-400 py-4 w-full text-center">No hay etiquetas. ¡Crea la primera!</div>}
                    </div>
                </div>
            )}

            {/* DATA TAB */}
            {activeTab === 'data' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-6 shadow-sm flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                        <Database size={32} className="text-slate-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 m-0 mb-1">Copia de Seguridad</h3>
                        <p className="text-slate-400 text-sm m-0 max-w-xs">Descarga un archivo JSON con tus alumnos, etiquetas y perfil. No incluye archivos multimedia.</p>
                    </div>
                    <button onClick={exportData} className="flex items-center gap-2 px-6 py-3 rounded-xl border-none bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm cursor-pointer transition-colors shadow-md shadow-emerald-500/20">
                        <Download size={16} /> Descargar Backup
                    </button>
                </div>
            )}
        </div>
    );
}
