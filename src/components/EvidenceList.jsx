import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import {
    Trash2, Search, X, Folder, ArrowLeft,
    Edit2, Download, User, Star, PieChart, AlertTriangle, CheckCircle,
    Film, Smile, Meh, Frown, FileDown, FolderPlus, Save,
    Calendar as CalendarIcon, Grid, Layers, CheckSquare, Square, ChevronLeft, ChevronRight, Tag
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Skeleton } from './Skeleton';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { useStudents } from '../hooks/useStudents';
import { useTags } from '../hooks/useTags';
import { useFolders } from '../hooks/useFolders';
import { SchoolFilters } from './UI/SchoolFilters';
import { formatDate } from '../utils/formatters';
import { EvidenceService } from '../services/evidenceService';
import { exportStudentPDF } from '../services/pdfExportService';

export function EvidenceList() {
    const { students } = useStudents();
    const location = useLocation();
    const navigate = useNavigate();

    const initialStudentId = location.state?.studentId || '';

    const [evidences, setEvidences] = useState([]);
    const [studentsMap, setStudentsMap] = useState({});
    const [studentsList, setStudentsList] = useState([]);
    const [loading, setLoading] = useState(true);

    const [filterActivity, setFilterActivity] = useState(null);
    const [filterTag, setFilterTag] = useState('Todos');
    const [filterPeriod, setFilterPeriod] = useState('Todos'); 
    const [filterShift, setFilterShift] = useState('Todos');
    const [filterLevel, setFilterLevel] = useState('Todos');
    const [filterStudent, setFilterStudent] = useState(initialStudentId);
    const [filterPerformance, setFilterPerformance] = useState('Todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [showStats, setShowStats] = useState(false);

    const [viewMode, setViewMode] = useState('grid');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    const [inspectorItem, setInspectorItem] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [pdfExporting, setPdfExporting] = useState(false);
    const { getFolders, createFolder, updateFolder, deleteFolder } = useFolders();
    const [folders, setFolders] = useState(() => getFolders());
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFolder, setNewFolder] = useState({ name: '', period: localStorage.getItem('currentPeriod') || 'P1', level: 'Primario', shift: 'Matutina', grade: '', section: '' });
    // folderMenu: { folder } when a folder's ⋯ is tapped — shows edit/delete sheet
    const [folderMenu, setFolderMenu] = useState(null);
    const [editingFolder, setEditingFolder] = useState(null); // folder being edited
    const [editData, setEditData] = useState({ activityName: '', comment: '', studentIds: [], performance: '' });
    const [modalFilters, setModalFilters] = useState({ grade: 'Todos', section: 'Todos', level: 'Todos', shift: 'Todos' });

    const { availableTags } = useTags();

    // --- EFECTOS ---
    useEffect(() => {
        if (students.length > 0) {
            const map = {};
            const list = [];
            students.forEach(d => {
                map[d.id] = d.name;
                list.push({ id: d.id, name: d.name, grade: d.grade || '', section: d.section || '', level: d.level || '', shift: d.shift || '' });
            });
            setStudentsMap(map);
            setStudentsList(list.sort((a, b) => a.name.localeCompare(b.name)));
        }
    }, [students]);

    useEffect(() => {
        let subscription = null;
        let didLoad = false;

        // Safety timeout — if session check takes > 8s, stop the spinner
        const timeout = setTimeout(() => {
            if (!didLoad) {
                setLoading(false);
                console.warn('EvidenceList: session check timed out');
            }
        }, 8000);

        const fetchEvidences = async (userId) => {
            try {
                const { data, error } = await supabase
                    .from('evidences')
                    .select('*, evidence_students(student_id)')
                    .eq('teacher_id', userId)
                    .order('capture_date', { ascending: false });
                    
                if (error) throw error;
                
                const mappedEvs = data.map(doc => ({
                    id: doc.id,
                    teacherId: doc.teacher_id,
                    activityName: doc.activity_name,
                    comment: doc.comment,
                    fileUrl: doc.file_url,
                    fileType: doc.file_type,
                    isFavorite: doc.is_favorite,
                    date: { seconds: new Date(doc.capture_date).getTime() / 1000 },
                    captureDate: doc.capture_date,
                    performance: doc.performance,
                    period: doc.period,
                    level: doc.level_tag,
                    grade: doc.grade_tag,
                    section: doc.section_tag,
                    tags: doc.tags || [],
                    studentIds: (doc.evidence_students || []).map(m => m.student_id)
                }));
                
                mappedEvs.sort((a, b) => {
                    if (a.isFavorite && !b.isFavorite) return -1;
                    if (!a.isFavorite && b.isFavorite) return 1;
                    return new Date(b.captureDate).getTime() - new Date(a.captureDate).getTime();
                });
                
                setEvidences(mappedEvs);
            } catch (err) {
                console.error("Error fetching evidences", err);
            } finally {
                didLoad = true;
                clearTimeout(timeout);
                setLoading(false);
            }
        };

        // Fetch immediately using current session instead of waiting for auth change event
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                fetchEvidences(session.user.id);
                
                // Also subscribe to realtime updates
                subscription = supabase.channel('evidences_channel')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'evidences', filter: `teacher_id=eq.${session.user.id}` }, () => {
                        fetchEvidences(session.user.id);
                    })
                    .subscribe();
            } else {
                didLoad = true;
                clearTimeout(timeout);
                setEvidences([]);
                setLoading(false);
            }
        }).catch(() => {
            didLoad = true;
            clearTimeout(timeout);
            setLoading(false);
        });

        return () => {
            clearTimeout(timeout);
            if (subscription) supabase.removeChannel(subscription);
        };
    }, []);

    // --- HELPERS ---
    const getMissingStudents = () => {
        if (studentsList.length === 0) return [];
        const seenIds = new Set();
        evidences.forEach(ev => { if (ev.studentIds && Array.isArray(ev.studentIds)) ev.studentIds.forEach(id => seenIds.add(id)); });
        return studentsList.filter(s => !seenIds.has(s.id));
    };
    const missingStudents = getMissingStudents();
    const coveragePercent = studentsList.length > 0 ? Math.round(((studentsList.length - missingStudents.length) / studentsList.length) * 100) : 0;

    const getFilteredEvidences = () => {
        return evidences.filter(item => {
            const matchesText = item.activityName?.toLowerCase().includes(searchTerm.toLowerCase()) || (item.comment && item.comment.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesActivity = filterActivity ? item.activityName === filterActivity : true;
            const matchesTag = filterTag === 'Todos' || (item.tags && item.tags.includes(filterTag));
            const matchesPeriod = filterPeriod === 'Todos' || item.period === filterPeriod;
            const matchesStudent = filterStudent ? (item.studentIds && item.studentIds.includes(filterStudent)) : true;
            const matchesPerformance = filterPerformance === 'Todos' || item.performance === filterPerformance;
            const matchesShift = filterShift === 'Todos' || (item.tags && item.tags.some(t => t.toLowerCase().includes(filterShift.toLowerCase())));
            const matchesLevel = filterLevel === 'Todos' || (item.tags && item.tags.some(t => t.toLowerCase().includes(filterLevel.toLowerCase()))) || (item.level && item.level === filterLevel);
            return matchesText && matchesActivity && matchesStudent && matchesPerformance && matchesTag && matchesPeriod && matchesShift && matchesLevel;
        });
    };
    const filteredItems = getFilteredEvidences();

    const groupedFolders = {};
    if (!filterStudent && filterPerformance === 'Todos' && viewMode === 'grid') {
        filteredItems.forEach(item => {
            const name = item.activityName || "Sin Nombre";
            if (!groupedFolders[name]) groupedFolders[name] = [];
            groupedFolders[name].push(item);
        });
    }

    const getStudentsForEdit = () => {
        return studentsList.filter(s => {
            const matchGrade = modalFilters.grade === 'Todos' || s.grade === modalFilters.grade;
            const matchSection = modalFilters.section === 'Todos' || s.section === modalFilters.section;
            const matchLevel = modalFilters.level === 'Todos' || s.level === modalFilters.level;
            const matchShift = modalFilters.shift === 'Todos' || s.shift === modalFilters.shift;
            return matchGrade && matchSection && matchLevel && matchShift;
        });
    };

    const getPerformanceIcon = (perf) => {
        switch (perf) {
            case 'logrado': return <Smile size={16} className="text-emerald-500" />;
            case 'proceso': return <Meh size={16}  className="text-amber-500" />;
            case 'apoyo':   return <Frown size={16} className="text-rose-500" />;
            default: return null;
        }
    };
    const getPerformanceColorStr = (perf) => {
        switch (perf) {
            case 'logrado': return '#10b981';
            case 'proceso': return '#f59e0b';
            case 'apoyo':   return '#ef4444';
            default: return '#e2e8f0';
        }
    };

    // --- CALENDAR HELPERS ---
    const groupEvidencesByDate = (items) => {
        const groups = {};
        items.forEach(item => {
            const date = item.date ? new Date(item.date.seconds * 1000) : new Date();
            const today = new Date();
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

            let key = date.toLocaleDateString();
            if (date.toDateString() === today.toDateString()) key = 'Hoy';
            else if (date.toDateString() === yesterday.toDateString()) key = 'Ayer';

            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    };

    // --- ACCIONES ---
    const handleDelete = async () => {
        if (!confirm("¿Borrar esta evidencia definitivamente?")) return;
        try {
            await EvidenceService.delete(inspectorItem.id, inspectorItem.fileUrl);
            setInspectorItem(null);
            toast.success("Evidencia eliminada");
        } catch (error) { toast.error("Error borrando"); }
    };

    const toggleFavorite = async (item, e) => {
        e?.stopPropagation();
        try {
            await EvidenceService.toggleFavorite(item.id, item.isFavorite);
            if (inspectorItem?.id === item.id) setInspectorItem(prev => ({ ...prev, isFavorite: !prev.isFavorite }));
            toast.success(item.isFavorite ? "Quitado de favoritos" : "Agregado a favoritos ⭐", { duration: 1000 });
        } catch (e) { console.error(e); }
    };

    const handleUpdate = async () => {
        const toastId = toast.loading("Guardando cambios...");
        try {
            await EvidenceService.update(inspectorItem.id, {
                activityName: editData.activityName, comment: editData.comment,
                studentIds: editData.studentIds, performance: editData.performance
            });
            setInspectorItem(prev => ({ ...prev, ...editData }));
            setIsEditing(false);
            toast.success("Actualizado", { id: toastId });
        } catch (e) { toast.error("Error al guardar", { id: toastId }); }
    };

    const downloadFolderZip = async () => {
        const itemsToDownload = selectionMode && selectedIds.length > 0
            ? filteredItems.filter(i => selectedIds.includes(i.id))
            : filteredItems;

        if (itemsToDownload.length === 0) return;

        setIsDownloading(true);
        const toastId = toast.loading(`Empaquetando ${itemsToDownload.length} archivos...`);
        const zip = new JSZip();
        try {
            const promises = itemsToDownload.map(async (item, index) => {
                const response = await fetch(item.fileUrl);
                const blob = await response.blob();
                const ext = item.fileUrl.includes('.mp4') ? 'mp4' : 'jpg';
                const fileName = `${index + 1}_${item.activityName}.${ext} `;
                zip.file(fileName, blob);
            });
            await Promise.all(promises);
            const content = await zip.generateAsync({ type: "blob" });
            const zipName = filterActivity ? `${filterActivity}.zip` : `Evidencias.zip`;
            saveAs(content, zipName);
            toast.success("¡Descarga lista!", { id: toastId });
            if (selectionMode) { setSelectionMode(false); setSelectedIds([]); }
        } catch (error) { console.error(error); toast.error("Error descarga.", { id: toastId }); } finally { setIsDownloading(false); }
    };

    const handleGalleryPdfExport = async () => {
        if (pdfExporting || !filterStudent) return;
        const student = studentsList.find(s => s.id === filterStudent);
        if (!student) return;
        setPdfExporting(true);
        const toastId = toast.loading('Generando PDF...');
        try {
            const pdfEvidences = filteredItems.map(e => ({
                activityName: e.activityName,
                fileUrl: e.fileUrl,
                fileType: e.fileType,
                performance: e.performance,
                comment: e.comment,
                date: e.date,
            }));
            await exportStudentPDF(student, pdfEvidences);
            toast.success('PDF descargado', { id: toastId });
        } catch (err) {
            toast.error('Error al generar PDF', { id: toastId });
        } finally {
            setPdfExporting(false);
        }
    };

    // --- BULK ACTIONS ---
    const toggleSelection = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`¿Borrar ${selectedIds.length} evidencias seleccionadas ? `)) return;
        const toastId = toast.loading("Borrando...");
        try {
            const itemsToDelete = evidences.filter(e => selectedIds.includes(e.id));
            await Promise.all(itemsToDelete.map(item => EvidenceService.delete(item.id, item.fileUrl)));
            setSelectedIds([]);
            setSelectionMode(false);
            toast.success("Evidencias eliminadas", { id: toastId });
        } catch (e) { toast.error("Error borrando", { id: toastId }); }
    };

    // --- SLIDESHOW ---
    const handleNext = (e) => {
        e.stopPropagation();
        const currentIndex = filteredItems.findIndex(i => i.id === inspectorItem.id);
        if (currentIndex < filteredItems.length - 1) setInspectorItem(filteredItems[currentIndex + 1]);
    };

    const handlePrev = (e) => {
        e.stopPropagation();
        const currentIndex = filteredItems.findIndex(i => i.id === inspectorItem.id);
        if (currentIndex > 0) setInspectorItem(filteredItems[currentIndex - 1]);
    };

    if (loading) return (
        <div className="flex flex-col gap-3 animate-pulse">
            <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
            <div className="grid grid-cols-2 gap-3">
                {[1,2,3,4].map(i => <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>)}
            </div>
        </div>
    );

    return (
        <>

            {/* TOOLBAR */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl mb-4 shadow-sm overflow-hidden">

                {/* ROW 1 — Period pills */}
                <div className="flex gap-1 p-3 pb-2">
                    {['Todos','P1','P2','P3','P4'].map(p => (
                        <button key={p} onClick={() => setFilterPeriod(p)}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border-none cursor-pointer transition-all ${
                                filterPeriod === p ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                            }`}>{p === 'Todos' ? '📅 Todos' : p}</button>
                    ))}
                </div>

                {/* ROW 2 — Search + Alumno */}
                <div className="flex gap-2 px-3 pb-2">
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input placeholder="Buscar evidencias..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                    </div>
                    <select value={filterStudent} onChange={e => { setFilterStudent(e.target.value); setFilterActivity(null); }} className={`px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none cursor-pointer transition-colors shrink-0 ${filterStudent ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300'}`}>
                        <option value="" className="text-black">👤 Alumno...</option>
                        {studentsList.map(s => <option key={s.id} value={s.id} className="text-black">{s.name}</option>)}
                    </select>
                    {filterStudent && (
                        <button onClick={handleGalleryPdfExport} disabled={pdfExporting} title="Exportar portafolio PDF"
                            className="w-9 h-9 rounded-xl border-none flex items-center justify-center cursor-pointer transition-all bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 shrink-0">
                            <FileDown size={16} className={pdfExporting ? 'animate-bounce' : ''} />
                        </button>
                    )}
                </div>

                {/* ROW 3 — Nivel filter (scrollable) */}
                <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0 w-10">Nivel</span>
                    {[{v:'Todos',l:'Todos'},{v:'Inicial',l:'🌱 Inicial'},{v:'Primario',l:'📖 Primario'},{v:'Secundario',l:'🏫 Secund.'}].map(({v,l}) => (
                        <button key={v} onClick={() => setFilterLevel(v)}
                            className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                                filterLevel === v ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'
                            }`}>{l}</button>
                    ))}
                </div>

                {/* ROW 4 — Tanda + Desempeño + Etiqueta + Actions */}
                <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0 w-10">Tanda</span>
                    {['Todos','Matutina','Vespertina'].map(s => (
                        <button key={s} onClick={() => setFilterShift(s)}
                            className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                                filterShift === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'
                            }`}>{s === 'Todos' ? 'Todos' : s === 'Matutina' ? '🌅 Mat.' : '🌇 Vesp.'}</button>
                    ))}
                    <div className="w-px h-4 bg-slate-200 dark:bg-white/10 shrink-0" />
                    <select value={filterPerformance} onChange={e => setFilterPerformance(e.target.value)} className="shrink-0 px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer">
                        <option value="Todos">🌈 Desempeño</option>
                        <option value="logrado">🟢 Logrado</option>
                        <option value="proceso">🟡 Proceso</option>
                        <option value="apoyo">🔴 Apoyo</option>
                    </select>
                    <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="shrink-0 px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer">
                        <option value="Todos">🏷️ Etiqueta</option>
                        {availableTags.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        <div className="flex bg-slate-100 dark:bg-white/5 rounded-lg p-0.5 border border-slate-200 dark:border-white/10">
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md border-none cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'bg-transparent text-slate-400 hover:text-slate-600'}`}><Grid size={13} /></button>
                            <button onClick={() => setViewMode('calendar')} className={`p-1.5 rounded-md border-none cursor-pointer transition-all ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'bg-transparent text-slate-400 hover:text-slate-600'}`}><CalendarIcon size={13} /></button>
                        </div>
                        <button onClick={() => { setSelectionMode(!selectionMode); setSelectedIds([]); }} className={`p-1.5 rounded-lg border cursor-pointer transition-all ${selectionMode ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 hover:bg-slate-100'}`}>
                            {selectionMode ? <CheckSquare size={13} /> : <Square size={13} />}
                        </button>
                        {selectionMode && selectedIds.length > 0 && (<>
                            <button onClick={handleBulkDelete} className="p-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-lg cursor-pointer"><Trash2 size={13} /></button>
                            <button onClick={downloadFolderZip} className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-lg cursor-pointer"><Download size={13} /></button>
                        </>)}
                        {!selectionMode && (filterActivity || filterStudent) && <button onClick={downloadFolderZip} disabled={isDownloading} className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 bg-emerald-600 text-white border-none rounded-lg cursor-pointer hover:bg-emerald-700 disabled:opacity-50"><Download size={11} /> ZIP</button>}
                        <button onClick={() => setShowStats(!showStats)} className={`p-1.5 rounded-lg border cursor-pointer transition-all ${showStats ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500'}`}><PieChart size={13} /></button>
                    </div>
                </div>

                {/* ROW 5 — Carpetas saved + Nueva Carpeta button */}
                <div className="px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <Folder size={12} className="text-slate-400" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex-1">Carpetas</span>
                        <button onClick={() => setShowFolderModal(true)}
                            className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-lg border-none cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                            <FolderPlus size={11} /> Nueva
                        </button>
                    </div>
                    {folders.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic py-1">Sin carpetas — crea una con "Nueva"</p>
                    ) : (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                            {folders.map(f => (
                                <div key={f.id} className="shrink-0 flex items-stretch">
                                    {/* Main chip — tap to filter */}
                                    <button onClick={() => setFilterActivity(filterActivity === f.name ? null : f.name)}
                                        className={`flex flex-col items-start px-3 py-1.5 rounded-l-xl border-y border-l text-left cursor-pointer transition-all active:scale-95 ${
                                            filterActivity === f.name
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20'
                                        }`}>
                                        <span className={`text-[11px] font-extrabold max-w-[110px] truncate ${filterActivity === f.name ? 'text-white' : 'text-blue-700 dark:text-blue-300'}`}>📁 {f.name}</span>
                                        <span className={`text-[9px] font-medium ${filterActivity === f.name ? 'text-blue-100' : 'text-slate-400'}`}>{f.period} · {f.level || '—'} · {f.grade || 'Todo'}</span>
                                    </button>
                                    {/* ⋯ context button */}
                                    <button onClick={e => { e.stopPropagation(); setFolderMenu(f); setEditingFolder({...f}); }}
                                        className={`px-1.5 rounded-r-xl border-y border-r border-l-0 flex items-center justify-center cursor-pointer transition-all ${
                                            filterActivity === f.name
                                                ? 'bg-blue-700 border-blue-600 text-blue-100 hover:bg-blue-800'
                                                : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20'
                                        }`}>
                                        <span className="text-[14px] leading-none">⋯</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 px-3 py-2 border-t border-slate-100 dark:border-white/5 text-xs font-bold text-slate-600 dark:text-slate-300">
                    {filterStudent ? (<><span className="text-blue-600 dark:text-blue-400">👤</span> Portafolio de <span className="text-blue-600 dark:text-blue-400">{studentsMap[filterStudent]}</span></>) : filterActivity ? (<><button onClick={() => setFilterActivity(null)} className="bg-transparent border-none cursor-pointer text-slate-500 p-0 flex hover:text-slate-800 transition-colors"><ArrowLeft size={14} /></button> <span className="text-slate-500">📂</span> {filterActivity}</>) : (<><span className="text-slate-400">📂</span> Todas las Evidencias &nbsp;<span className="text-slate-400 font-normal">({filteredItems.length})</span></>)}
                </div>

                {/* Stats Panel */}
                {showStats && (
                    <div className="px-4 pb-4 border-t border-slate-100 dark:border-white/5 animate-fade-in">
                        <div className="pt-3 flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Cobertura de Alumnos</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-white">{studentsList.length - missingStudents.length}/{studentsList.length} <span className="text-slate-400 font-normal">({coveragePercent}%)</span></span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden mb-2">
                            <div className="h-full transition-all duration-700 ease-out rounded-full" style={{ width: `${coveragePercent}%`, background: coveragePercent === 100 ? '#10b981' : coveragePercent > 50 ? '#f59e0b' : '#ef4444' }}></div>
                        </div>
                        {missingStudents.length > 0 && <div className="text-[10px] text-rose-500 dark:text-rose-400 font-medium">Sin evidencia: {missingStudents.slice(0, 5).map(s => s.name).join(', ')}{missingStudents.length > 5 && ` +${missingStudents.length - 5} más`}</div>}
                    </div>
                )}
            </div>

            {/* VISTA CARPETAS (Solo en Grid Mode y sin filtros activos) */}
            {!filterActivity && !filterStudent && filterPerformance === 'Todos' && viewMode === 'grid' && (
                <div className="grid grid-cols-2 gap-2.5">
                    {Object.keys(groupedFolders).map(name => {
                        const items = groupedFolders[name];
                        const previews = items.slice(0, 3);
                        return (
                            <div key={name} onClick={() => setFilterActivity(name)} className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden cursor-pointer shadow-sm hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all">
                                {/* Filmstrip thumbnails */}
                                <div className="flex h-20 bg-slate-100 dark:bg-slate-800 overflow-hidden gap-0.5">
                                    {previews.map((ev, i) => (
                                        <div key={i} className="flex-1 overflow-hidden">
                                            {ev.fileUrl?.includes('.mp4') || ev.fileType === 'video'
                                                ? <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-700"><Film size={18} className="text-slate-400" /></div>
                                                : <img src={ev.fileUrl} className="w-full h-full object-cover" />}
                                        </div>
                                    ))}
                                    {previews.length === 0 && <div className="flex-1 flex items-center justify-center"><Folder size={28} className="text-amber-400" /></div>}
                                </div>
                                {/* Label */}
                                <div className="px-3 py-2.5 flex items-center justify-between">
                                    <div className="overflow-hidden min-w-0">
                                        <div className="font-bold text-[13px] text-slate-800 dark:text-slate-100 truncate">{name}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">{items.length} {items.length === 1 ? 'archivo' : 'archivos'}</div>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-300 shrink-0" />
                                </div>
                            </div>
                        );
                    })}
                    {Object.keys(groupedFolders).length === 0 && filteredItems.length === 0 && (
                        <div className="col-span-2 text-center py-12 text-slate-400">
                            <Folder size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">Aún no hay evidencias guardadas.</p>
                        </div>
                    )}
                </div>
            )}

            {/* VISTA GRID (Items individuales) */}
            {(filterActivity || filterStudent || filterPerformance !== 'Todos' || viewMode === 'grid') && viewMode === 'grid' && (filterActivity || filterStudent || filterPerformance !== 'Todos') && (
                <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden">
                    {filteredItems.map(item => (
                        <div key={item.id} onClick={() => {
                            if (selectionMode) toggleSelection(item.id);
                            else { setInspectorItem(item); setIsEditing(false); }
                        }} className={`aspect-square relative overflow-hidden bg-slate-200 dark:bg-slate-800 cursor-pointer rounded-xl transition-all ${selectionMode && !selectedIds.includes(item.id) ? 'opacity-50 scale-95' : 'opacity-100 hover:scale-95'}`}>
                            {/* Media */}
                            {item.fileUrl?.includes('.mp4') || item.fileType === 'video'
                                ? <video src={item.fileUrl} className="w-full h-full object-cover" />
                                : <img src={item.fileUrl} className="w-full h-full object-cover" />}
                            {/* Bottom gradient overlay with name */}
                            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none rounded-b-xl" />
                            <div className="absolute bottom-0 left-0 right-0 p-1.5 pointer-events-none">
                                <div className="text-white text-[9px] font-semibold leading-tight line-clamp-2 drop-shadow">{item.activityName}</div>
                            </div>
                            {/* Top badges */}
                            {(item.fileUrl?.includes('.mp4') || item.fileType === 'video') && <Film size={13} className="text-white absolute top-1.5 left-1.5 z-[2] drop-shadow-md" />}
                            {item.isFavorite && <Star size={12} className="text-amber-400 fill-amber-400 absolute top-1.5 right-1.5 z-[2] drop-shadow-md" />}
                            {item.performance && <div className="absolute top-1.5 left-1.5 z-[2]">{getPerformanceIcon(item.performance)}</div>}
                            {selectionMode && selectedIds.includes(item.id) && <div className="absolute inset-0 bg-blue-500/40 z-10 flex items-center justify-center rounded-xl"><CheckCircle className="text-white fill-blue-500" /></div>}
                        </div>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="col-span-3 text-center py-12 text-slate-400">
                            <p className="text-sm font-medium">No se encontraron fotos.</p>
                        </div>
                    )}
                </div>
            )}

            {/* VISTA CALENDARIO */}
            {viewMode === 'calendar' && (
                <div className="flex flex-col gap-4">
                    {Object.entries(groupEvidencesByDate(filteredItems)).map(([date, items]) => (
                        <div key={date}>
                            <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 pl-3 border-l-[3px] border-blue-500 uppercase tracking-wider">{date}</div>
                            <div className="grid grid-cols-3 gap-1.5">
                                {items.map(item => (
                                    <div key={item.id} onClick={() => {
                                        if (selectionMode) toggleSelection(item.id);
                                        else { setInspectorItem(item); setIsEditing(false); }
                                    }} className={`aspect-square relative overflow-hidden bg-slate-200 dark:bg-slate-800 cursor-pointer rounded-xl transition-all ${selectionMode && !selectedIds.includes(item.id) ? 'opacity-50 scale-95' : 'opacity-100 hover:scale-95'}`}>
                                        {(item.fileUrl.includes('.mp4') || item.fileType === 'video') && <Film size={14} className="text-white absolute top-1.5 left-1.5 z-[2] drop-shadow-md" />}
                                        {selectionMode && selectedIds.includes(item.id) && <div className="absolute inset-0 bg-blue-500/40 z-10 flex items-center justify-center rounded-xl"><CheckCircle className="text-white fill-blue-500" /></div>}
                                        {item.fileUrl.includes('.mp4') || item.fileType === 'video' ? (
                                            <video src={item.fileUrl} className="w-full h-full object-cover" />
                                        ) : <img src={item.fileUrl} className="w-full h-full object-cover" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            <CalendarIcon size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">No hay evidencias para mostrar.</p>
                        </div>
                    )}
                </div>
            )}

            {/* INSPECTOR */}
            {inspectorItem && (
                <div className="fixed inset-0 bg-black z-[2000] flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) setInspectorItem(null); }}>

                    {/* Top bar */}
                    <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                        <button onClick={() => setInspectorItem(null)} className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md text-white border-none flex items-center justify-center cursor-pointer hover:bg-white/25 transition-colors">
                            <X size={18} />
                        </button>
                        <div className="flex gap-2">
                            <button onClick={(e) => toggleFavorite(inspectorItem, e)} className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md border-none flex items-center justify-center cursor-pointer hover:bg-white/25 transition-colors">
                                <Star size={18} fill={inspectorItem.isFavorite ? 'currentColor' : 'none'} className={inspectorItem.isFavorite ? 'text-amber-400' : 'text-white'} />
                            </button>
                            <button onClick={() => {
                                setEditData({ activityName: inspectorItem.activityName, comment: inspectorItem.comment || '', studentIds: inspectorItem.studentIds || [], performance: inspectorItem.performance || '' });
                                setIsEditing(!isEditing);
                            }} className={`w-9 h-9 rounded-full border-none flex items-center justify-center cursor-pointer transition-colors ${isEditing ? 'bg-blue-500 text-white' : 'bg-white/15 backdrop-blur-md text-white hover:bg-white/25'}`}>
                                <Edit2 size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Media area */}
                    <div className="flex-1 flex items-center justify-center overflow-hidden bg-black relative">
                        <button onClick={handlePrev} className="absolute left-3 w-9 h-9 rounded-full bg-white/15 backdrop-blur-md text-white border-none z-10 flex items-center justify-center cursor-pointer hover:bg-white/25 transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                        <button onClick={handleNext} className="absolute right-3 w-9 h-9 rounded-full bg-white/15 backdrop-blur-md text-white border-none z-10 flex items-center justify-center cursor-pointer hover:bg-white/25 transition-colors">
                            <ChevronRight size={20} />
                        </button>
                        {inspectorItem.fileUrl?.includes('.mp4') || inspectorItem.fileType === 'video' ? (
                            <video src={inspectorItem.fileUrl} controls autoPlay className="max-w-full max-h-full" />
                        ) : <img src={inspectorItem.fileUrl} className="max-w-full max-h-full object-contain" />}
                    </div>

                    {/* Bottom sheet */}
                    <div className="bg-white dark:bg-slate-900 rounded-t-3xl max-h-[52vh] overflow-y-auto">
                        {!isEditing ? (
                            <div className="p-5">
                                {/* Drag indicator */}
                                <div className="w-10 h-1 bg-slate-300 dark:bg-white/20 rounded-full mx-auto mb-4"></div>

                                <div className="flex justify-between items-start gap-3 mb-2">
                                    <h3 className="m-0 text-base font-bold text-slate-800 dark:text-slate-100 flex-1">{inspectorItem.activityName}</h3>
                                    {inspectorItem.performance && (
                                        <span className={`shrink-0 flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${
                                            inspectorItem.performance === 'logrado' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
                                            inspectorItem.performance === 'proceso' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' :
                                            'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
                                        }`}>
                                            {getPerformanceIcon(inspectorItem.performance)} {inspectorItem.performance}
                                        </span>
                                    )}
                                </div>

                                <p className="text-[11px] text-slate-400 mb-3">{formatDate(inspectorItem.date)}</p>

                                {/* Meta row: period + grade/section */}
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {inspectorItem.period && (
                                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20 font-bold uppercase tracking-wide">
                                            📅 {inspectorItem.period}
                                        </span>
                                    )}
                                </div>

                                {inspectorItem.tags?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {inspectorItem.tags.map(tag => <span key={tag} className="text-[10px] bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded-md text-slate-500 dark:text-slate-400 font-medium">#{tag}</span>)}
                                    </div>
                                )}

                                {inspectorItem.studentIds?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {inspectorItem.studentIds.map(uid => (
                                            <span key={uid} onClick={() => navigate(`/student/${uid}`)} className="text-[11px] bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20 px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors font-semibold">
                                                <User size={10} /> {studentsMap[uid] || 'Desconocido'}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {inspectorItem.comment && (
                                    <div className="mt-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3 rounded-xl text-sm italic text-slate-600 dark:text-slate-300">
                                        "{inspectorItem.comment}"
                                    </div>
                                )}

                                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10 flex justify-end">
                                    <button onClick={handleDelete} className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400 bg-transparent border-none cursor-pointer hover:text-rose-700 transition-colors">
                                        <Trash2 size={13} /> Eliminar evidencia
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-5 flex flex-col gap-4">
                                <div className="w-10 h-1 bg-slate-300 dark:bg-white/20 rounded-full mx-auto mb-1"></div>

                                {/* Performance pills */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">Evaluación de Desempeño</label>
                                    <div className="flex gap-2">
                                        {[{val:'logrado', icon: Smile, color:'emerald'}, {val:'proceso', icon: Meh, color:'amber'}, {val:'apoyo', icon: Frown, color:'rose'}].map(({val, icon: Icon, color}) => (
                                            <button key={val} onClick={() => setEditData({ ...editData, performance: val })} className={`flex-1 py-2.5 rounded-xl border-2 flex flex-col items-center gap-1 cursor-pointer transition-all font-semibold text-[10px] uppercase tracking-wide ${
                                                editData.performance === val
                                                    ? `border-${color}-400 bg-${color}-50 dark:bg-${color}-500/20 text-${color}-600 dark:text-${color}-400`
                                                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-400 hover:border-slate-300'
                                            }`}>
                                                <Icon size={18} />
                                                {val}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Student filter + picker */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">Filtrar Alumnos</label>
                                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-2 mb-2">
                                        <SchoolFilters filters={modalFilters} onChange={setModalFilters} showAllOption={true} layout="grid" />
                                    </div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">Alumnos ({getStudentsForEdit().length})</label>
                                    <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-white/5">
                                        {getStudentsForEdit().map(s => {
                                            const isSelected = editData.studentIds.includes(s.id);
                                            return (
                                                <div key={s.id} onClick={() => {
                                                    const newIds = isSelected ? editData.studentIds.filter(id => id !== s.id) : [...editData.studentIds, s.id];
                                                    setEditData({ ...editData, studentIds: newIds });
                                                }} className={`p-2.5 text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                                                    isSelected ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                                                }`}>
                                                    <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-white/20'}`}>
                                                        {isSelected && <CheckCircle size={12} className="text-white" />}
                                                    </div>
                                                    <span className="font-semibold">{s.name}</span>
                                                    <span className="text-slate-400 font-normal">({s.grade} {s.section})</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Activity + comment */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Nombre de Actividad</label>
                                    <input value={editData.activityName} onChange={e => setEditData({ ...editData, activityName: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 block">Comentario</label>
                                    <textarea value={editData.comment} onChange={e => setEditData({ ...editData, comment: e.target.value })} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-none" />
                                </div>

                                <button onClick={handleUpdate} className="w-full py-3.5 rounded-xl border-none bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-sm cursor-pointer shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]">
                                    Guardar Cambios
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* New Folder Modal */}
            {showFolderModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[3000] flex items-end">
                    <div className="bg-white dark:bg-slate-900 rounded-t-3xl w-full p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
                        <div className="w-10 h-1 bg-slate-200 dark:bg-white/20 rounded-full mx-auto" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 m-0">📁 Nueva Carpeta</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Nombre de la carpeta</label>
                                <input value={newFolder.name} onChange={e => setNewFolder({...newFolder, name: e.target.value})}
                                    placeholder="Ej. Lengua Española - Ejercicios"
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Período</label>
                                <div className="flex gap-1">
                                    {['P1','P2','P3','P4'].map(p => (
                                        <button key={p} type="button" onClick={() => setNewFolder({...newFolder, period: p})}
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold border-none cursor-pointer transition-all ${newFolder.period === p ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>{p}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Tanda</label>
                                <div className="flex gap-1">
                                    {['Matutina','Vespertina'].map(s => (
                                        <button key={s} type="button" onClick={() => setNewFolder({...newFolder, shift: s})}
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold border-none cursor-pointer transition-all ${newFolder.shift === s ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
                                            {s === 'Matutina' ? '🌅' : '🌇'} {s.slice(0,3)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Nivel</label>
                                <div className="flex gap-1">
                                    {['Inicial','Primario','Secundario'].map(l => (
                                        <button key={l} type="button" onClick={() => setNewFolder({...newFolder, level: l})}
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold border-none cursor-pointer transition-all ${newFolder.level === l ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
                                            {l === 'Inicial' ? '🌱' : l === 'Primario' ? '📖' : '🏫'} {l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Grado</label>
                                <input value={newFolder.grade} onChange={e => setNewFolder({...newFolder, grade: e.target.value})}
                                    placeholder="Ej. 4to"
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Sección</label>
                                <input value={newFolder.section} onChange={e => setNewFolder({...newFolder, section: e.target.value})}
                                    placeholder="Ej. A"
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setShowFolderModal(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-slate-600 dark:text-slate-300 font-bold text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
                                Cancelar
                            </button>
                            <button type="button" onClick={() => {
                                try {
                                    const f = createFolder(newFolder);
                                    setFolders(getFolders());
                                    setFilterActivity(f.name);
                                    setShowFolderModal(false);
                                    setNewFolder({ name: '', period: localStorage.getItem('currentPeriod') || 'P1', level: 'Primario', shift: 'Matutina', grade: '', section: '' });
                                    toast.success('📁 Carpeta creada');
                                } catch(e) { toast.error(e.message); }
                            }}
                                className="flex-1 py-3 rounded-xl border-none bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer transition-colors">
                                Crear Carpeta
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* FOLDER CONTEXT SHEET — edit / delete */}
            {folderMenu && (
                <div className="fixed inset-0 z-[3001] flex items-end" onClick={() => { setFolderMenu(null); setEditingFolder(null); }}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <div className="relative w-full bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl p-5 pb-10 flex flex-col gap-3"
                        style={{ animation: 'slideUp 0.2s ease-out' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="w-10 h-1 bg-slate-200 dark:bg-white/20 rounded-full mx-auto" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 m-0">✏️ Editar Carpeta</h3>

                        {editingFolder && (<>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Nombre</label>
                                    <input value={editingFolder.name} onChange={e => setEditingFolder({...editingFolder, name: e.target.value})}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Período</label>
                                    <div className="flex gap-1">
                                        {['P1','P2','P3','P4'].map(p => (
                                            <button key={p} type="button" onClick={() => setEditingFolder({...editingFolder, period: p})}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-none cursor-pointer transition-all ${editingFolder.period === p ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>{p}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Tanda</label>
                                    <div className="flex gap-1">
                                        {['Matutina','Vespertina'].map(s => (
                                            <button key={s} type="button" onClick={() => setEditingFolder({...editingFolder, shift: s})}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-none cursor-pointer transition-all ${editingFolder.shift === s ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
                                                {s === 'Matutina' ? '🌅' : '🌇'} {s.slice(0,3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Nivel</label>
                                    <div className="flex gap-1">
                                        {['Inicial','Primario','Secundario'].map(l => (
                                            <button key={l} type="button" onClick={() => setEditingFolder({...editingFolder, level: l})}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-none cursor-pointer transition-all ${editingFolder.level === l ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
                                                {l === 'Inicial' ? '🌱' : l === 'Primario' ? '📖' : '🏫'} {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Grado</label>
                                    <input value={editingFolder.grade} onChange={e => setEditingFolder({...editingFolder, grade: e.target.value})} placeholder="Ej. 4to"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Sección</label>
                                    <input value={editingFolder.section} onChange={e => setEditingFolder({...editingFolder, section: e.target.value})} placeholder="Ej. A"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                                </div>
                            </div>

                            <div className="flex gap-2 mt-1">
                                {/* Delete */}
                                <button type="button" onClick={() => {
                                    if (!confirm(`¿Eliminar la carpeta "${folderMenu.name}"? Las evidencias no se borran.`)) return;
                                    deleteFolder(folderMenu.id);
                                    if (filterActivity === folderMenu.name) setFilterActivity(null);
                                    setFolders(getFolders());
                                    setFolderMenu(null); setEditingFolder(null);
                                    toast.success('🗑️ Carpeta eliminada');
                                }} className="px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-sm cursor-pointer hover:bg-rose-100 transition-colors">
                                    Eliminar
                                </button>
                                {/* Cancel */}
                                <button type="button" onClick={() => { setFolderMenu(null); setEditingFolder(null); }}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-slate-600 dark:text-slate-300 font-bold text-sm cursor-pointer">
                                    Cancelar
                                </button>
                                {/* Save */}
                                <button type="button" onClick={() => {
                                    try {
                                        updateFolder(folderMenu.id, editingFolder);
                                        // If currently filtered by old name, update breadcrumb
                                        if (filterActivity === folderMenu.name && editingFolder.name !== folderMenu.name) {
                                            setFilterActivity(editingFolder.name);
                                        }
                                        setFolders(getFolders());
                                        setFolderMenu(null); setEditingFolder(null);
                                        toast.success('✅ Carpeta actualizada');
                                    } catch(e) { toast.error(e.message); }
                                }} className="flex-1 py-3 rounded-xl border-none bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer transition-colors">
                                    Guardar
                                </button>
                            </div>
                        </>)}
                    </div>
                </div>
            )}
        </>
    );
}

