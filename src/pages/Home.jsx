// src/pages/Home.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { useStudents } from '../hooks/useStudents';
import {
    Camera, Image as ImageIcon, Users, BarChart2,
    TrendingUp, Clock, Star, Smile, Meh, Frown,
    ChevronRight, Play, BookOpen
} from 'lucide-react';
import { formatDate } from '../utils/formatters';

export function Home() {
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();
    const { students } = useStudents();

    const [recentEvidences, setRecentEvidences] = useState([]);
    const [todayCount, setTodayCount] = useState(0);
    const [weekCount, setWeekCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const firstName = user?.user_metadata?.full_name?.split(' ')[0]
        || user?.email?.split('@')[0]
        || 'Docente';

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();

            const [{ data: recent }, { count: today }, { count: week }] = await Promise.all([
                supabase
                    .from('evidences')
                    .select('id, activity_name, performance, file_url, file_type, capture_date')
                    .eq('teacher_id', session.user.id)
                    .order('capture_date', { ascending: false })
                    .limit(4),
                supabase
                    .from('evidences')
                    .select('id', { count: 'exact', head: true })
                    .eq('teacher_id', session.user.id)
                    .gte('capture_date', todayStart),
                supabase
                    .from('evidences')
                    .select('id', { count: 'exact', head: true })
                    .eq('teacher_id', session.user.id)
                    .gte('capture_date', weekStart),
            ]);

            setRecentEvidences(recent || []);
            setTodayCount(today || 0);
            setWeekCount(week || 0);
            setLoading(false);
        };
        load();
    }, []);

    const perfConfig = {
        logrado: { icon: Smile, cls: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
        proceso:  { icon: Meh,   cls: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-500/10'  },
        apoyo:    { icon: Frown, cls: 'text-rose-500',   bg: 'bg-rose-50 dark:bg-rose-500/10'   },
    };

    const quickActions = [
        { icon: Camera,    label: 'Capturar',   sub: 'Nueva evidencia', path: '/capture',  gradient: 'from-blue-500 to-indigo-600' },
        { icon: ImageIcon, label: 'Galería',    sub: 'Ver evidencias',  path: '/gallery',  gradient: 'from-purple-500 to-pink-600' },
        { icon: Users,     label: 'Alumnos',    sub: 'Gestionar lista', path: '/students', gradient: 'from-emerald-500 to-teal-600' },
        { icon: BarChart2, label: 'Estadísticas', sub: 'Ver progreso',  path: '/stats',    gradient: 'from-orange-500 to-rose-600'  },
    ];

    return (
        <div className="pb-20 flex flex-col gap-5">

            {/* GREETING HEADER */}
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 shadow-lg shadow-blue-500/20">
                {/* decorative circles */}
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full" />
                <div className="absolute -bottom-8 -left-3 w-24 h-24 bg-white/5 rounded-full" />
                <div className="relative z-10">
                    <p className="text-blue-200 text-sm font-medium mb-0.5">{greeting},</p>
                    <h1 className="text-2xl font-extrabold text-white m-0 mb-3">{firstName} 👋</h1>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-white">{loading ? '—' : todayCount}</span>
                            <span className="text-[11px] text-blue-200 font-medium">hoy</span>
                        </div>
                        <div className="w-px h-10 bg-white/20" />
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-white">{loading ? '—' : weekCount}</span>
                            <span className="text-[11px] text-blue-200 font-medium">esta semana</span>
                        </div>
                        <div className="w-px h-10 bg-white/20" />
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-white">{students.length}</span>
                            <span className="text-[11px] text-blue-200 font-medium">alumnos</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* QUICK ACTIONS */}
            <div>
                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Accesos rápidos</h2>
                <div className="grid grid-cols-2 gap-3">
                    {quickActions.map(({ icon: Icon, label, sub, path, gradient }) => (
                        <button
                            key={path}
                            onClick={() => navigate(path)}
                            className={`flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-md active:scale-95 transition-all cursor-pointer border-none text-left`}
                        >
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                                <Icon size={20} />
                            </div>
                            <div>
                                <div className="font-bold text-sm">{label}</div>
                                <div className="text-[10px] text-white/70">{sub}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* RECENT EVIDENCES */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest m-0">Recientes</h2>
                    <button
                        onClick={() => navigate('/gallery')}
                        className="text-[11px] font-bold text-blue-500 hover:text-blue-600 bg-transparent border-none cursor-pointer flex items-center gap-1"
                    >
                        Ver todas <ChevronRight size={12} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col gap-2 animate-pulse">
                        {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl" />)}
                    </div>
                ) : recentEvidences.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">Aún no hay evidencias.<br />¡Captura la primera hoy!</p>
                        <button
                            onClick={() => navigate('/capture')}
                            className="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold border-none cursor-pointer transition-colors flex items-center gap-2 mx-auto"
                        >
                            <Camera size={15} /> Capturar ahora
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {recentEvidences.map(ev => {
                            const perf = perfConfig[ev.performance];
                            const IconPerf = perf?.icon;
                            return (
                                <button
                                    key={ev.id}
                                    onClick={() => navigate('/gallery')}
                                    className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-sm hover:border-slate-300 dark:hover:border-white/20 transition-all cursor-pointer text-left w-full"
                                >
                                    {/* Thumbnail */}
                                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
                                        {ev.file_type !== 'video' && ev.file_url ? (
                                            <img src={ev.file_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Play size={16} className="text-slate-400" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                                            {ev.activity_name || 'Sin nombre'}
                                        </div>
                                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                            <Clock size={10} />
                                            {ev.capture_date ? new Date(ev.capture_date).toLocaleDateString('es-DO', { month: 'short', day: 'numeric' }) : '—'}
                                        </div>
                                    </div>

                                    {perf && (
                                        <div className={`w-7 h-7 rounded-lg ${perf.bg} flex items-center justify-center shrink-0`}>
                                            <IconPerf size={14} className={perf.cls} />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

        </div>
    );
}
