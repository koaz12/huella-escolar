import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { ArrowLeft, Star, Film, Smile, Meh, Frown, FileDown } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import { exportStudentPDF } from '../services/pdfExportService';
import toast from 'react-hot-toast';

export function StudentProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [student, setStudent] = useState(null);
    const [evidences, setEvidences] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: studentData, error: studentError } = await supabase
                    .from('students').select('*').eq('id', id).single();
                if (studentError) throw studentError;

                if (studentData) {
                    setStudent({
                        id: studentData.id,
                        name: studentData.name,
                        grade: studentData.grade_name || studentData.grade,
                        section: studentData.section_name || studentData.section,
                        listNumber: studentData.list_number || studentData.listNumber,
                        photoUrl: studentData.photo_url,
                    });

                    const { data: evsData, error: evsError } = await supabase
                        .from('evidences')
                        .select('*, evidence_students!inner(student_id)')
                        .eq('evidence_students.student_id', id)
                        .order('capture_date', { ascending: false });

                    if (evsError) throw evsError;

                    setEvidences(evsData.map(doc => ({
                        id: doc.id,
                        activityName: doc.activity_name,
                        fileUrl: doc.file_url,
                        fileType: doc.file_type,
                        isFavorite: doc.is_favorite,
                        date: new Date(doc.capture_date).toISOString(),
                        performance: doc.performance,
                        comment: doc.comment,
                        tags: doc.tags || [],
                    })));
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) return (
        <div className="flex flex-col gap-3 animate-pulse p-1">
            <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            <div className="grid grid-cols-3 gap-2">
                {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>)}
            </div>
            <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        </div>
    );

    if (!student) return (
        <div className="flex flex-col items-center justify-center p-10 text-slate-400 gap-3">
            <p className="text-base font-semibold">Alumno no encontrado</p>
            <button onClick={() => navigate(-1)} className="text-sm text-blue-500 border-none bg-transparent cursor-pointer">← Volver</button>
        </div>
    );

    const total = evidences.length;
    const logrado = evidences.filter(e => e.performance === 'logrado').length;
    const proceso = evidences.filter(e => e.performance === 'proceso').length;
    const apoyo = evidences.filter(e => e.performance === 'apoyo').length;

    const perfConfig = {
        logrado: { icon: Smile, bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', label: 'Logrado' },
        proceso: { icon: Meh, bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', label: 'Proceso' },
        apoyo:   { icon: Frown, bg: 'bg-rose-50 dark:bg-rose-500/10',   text: 'text-rose-600 dark:text-rose-400',   label: 'Apoyo'   },
    };

    const handleExportPDF = async () => {
        if (exporting) return;
        setExporting(true);
        const toastId = toast.loading('Generando PDF...');
        try {
            await exportStudentPDF(student, evidences);
            toast.success('PDF descargado', { id: toastId });
        } catch (err) {
            console.error('PDF error:', err);
            toast.error('Error al generar PDF', { id: toastId });
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="pb-20 flex flex-col gap-4">

            {/* HEADER */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 border-none flex items-center justify-center cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors shrink-0">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {student.photoUrl
                        ? <img src={student.photoUrl} className="w-11 h-11 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm shrink-0" />
                        : <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 font-bold text-lg">{student.name?.[0]}</div>
                    }
                    <div className="min-w-0">
                        <h2 className="m-0 text-base font-bold text-slate-800 dark:text-slate-100 truncate">{student.name}</h2>
                        <span className="text-[11px] text-slate-400">{student.grade} {student.section} · N° {student.listNumber}</span>
                    </div>
                </div>
                {/* PDF Export button */}
                <button
                    onClick={handleExportPDF}
                    disabled={exporting || evidences.length === 0}
                    title="Descargar portafolio PDF"
                    className={`w-9 h-9 rounded-xl border-none flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                        exporting
                            ? 'bg-slate-100 dark:bg-white/10 text-slate-300 cursor-wait'
                            : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95'
                    }`}
                >
                    <FileDown size={18} className={exporting ? 'animate-bounce' : ''} />
                </button>
            </div>

            {/* STATS */}
            <div className="grid grid-cols-3 gap-2">
                {[
                    { count: logrado, perf: 'logrado' },
                    { count: proceso, perf: 'proceso' },
                    { count: apoyo,   perf: 'apoyo'   },
                ].map(({ count, perf }) => {
                    const cfg = perfConfig[perf];
                    const Icon = cfg.icon;
                    return (
                        <div key={perf} className={`${cfg.bg} rounded-2xl p-3 flex flex-col items-center gap-1 border border-transparent`}>
                            <Icon size={20} className={cfg.text} />
                            <div className={`text-2xl font-bold ${cfg.text}`}>{count}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{cfg.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* PROGRESS BAR */}
            {total > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-3 shadow-sm">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                        <span>Distribución de desempeño</span>
                        <span>{total} evidencias</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden flex">
                        {logrado > 0 && <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(logrado / total) * 100}%` }} />}
                        {proceso > 0 && <div className="h-full bg-amber-400 transition-all" style={{ width: `${(proceso / total) * 100}%` }} />}
                        {apoyo > 0   && <div className="h-full bg-rose-400 transition-all" style={{ width: `${(apoyo / total) * 100}%` }} />}
                    </div>
                </div>
            )}

            {/* TIMELINE */}
            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 m-0 uppercase tracking-widest">Historial ({total})</h3>
            <div className="flex flex-col gap-3">
                {evidences.map(ev => {
                    const cfg = perfConfig[ev.performance];
                    const Icon = cfg?.icon;
                    return (
                        <div key={ev.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-3 flex gap-3 shadow-sm">
                            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-800 relative">
                                {ev.fileUrl?.includes('.mp4') || ev.fileType === 'video' ? (
                                    <>
                                        <video src={ev.fileUrl} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                            <Film size={18} className="text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <img src={ev.fileUrl} className="w-full h-full object-cover" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-1 mb-0.5">
                                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{ev.activityName}</div>
                                    {ev.isFavorite && <Star size={13} className="text-amber-400 fill-amber-400 shrink-0 mt-0.5" />}
                                </div>
                                <div className="text-[10px] text-slate-400 mb-1.5">{formatDate(ev.date)}</div>
                                {ev.performance && cfg && (
                                    <div className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.bg} ${cfg.text}`}>
                                        {Icon && <Icon size={10} />} {cfg.label}
                                    </div>
                                )}
                                {ev.tags?.length > 0 && (
                                    <div className="flex gap-1 flex-wrap mt-1.5">
                                        {ev.tags.map(tag => (
                                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 font-medium">{tag}</span>
                                        ))}
                                    </div>
                                )}
                                {ev.comment && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic line-clamp-2">"{ev.comment}"</div>}
                            </div>
                        </div>
                    );
                })}
                {evidences.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <div className="text-4xl mb-3">📂</div>
                        <p className="text-sm font-medium">No hay evidencias registradas para este alumno.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
