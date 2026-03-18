// src/pages/StatsPage.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useStudents } from '../hooks/useStudents';
import { BarChart2, Smile, Meh, Frown, Users, BookOpen, TrendingUp } from 'lucide-react';

export function StatsPage() {
    const { students } = useStudents();
    const [evidences, setEvidences] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterPeriod, setFilterPeriod] = useState('Todos');

    useEffect(() => {
        const fetchEvidences = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const { data } = await supabase
                .from('evidences')
                .select('id, activity_name, performance, tags, capture_date, teacher_id, evidence_students(student_id)')
                .eq('teacher_id', session.user.id)
                .order('capture_date', { ascending: false });
            setEvidences(data || []);
            setLoading(false);
        };
        fetchEvidences();
    }, []);

    const filtered = filterPeriod === 'Todos'
        ? evidences
        : evidences.filter(e => e.tags?.includes(filterPeriod) || (e.period === filterPeriod));

    const total = filtered.length;
    const logrado = filtered.filter(e => e.performance === 'logrado').length;
    const proceso = filtered.filter(e => e.performance === 'proceso').length;
    const apoyo = filtered.filter(e => e.performance === 'apoyo').length;
    const sinEval = total - logrado - proceso - apoyo;

    // Students covered (appear in at least one evidence)
    const coveredIds = new Set(
        filtered.flatMap(e => e.evidence_students?.map(es => es.student_id) || [])
    );
    const coveragePercent = students.length > 0 ? Math.round((coveredIds.size / students.length) * 100) : 0;
    const uncovered = students.filter(s => !coveredIds.has(s.id));

    // Activity frequency
    const activityCounts = {};
    filtered.forEach(e => {
        const name = e.activity_name || 'Sin nombre';
        activityCounts[name] = (activityCounts[name] || 0) + 1;
    });
    const topActivities = Object.entries(activityCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    const maxCount = topActivities[0]?.[1] || 1;

    const perfBars = [
        { label: 'Logrado', count: logrado, color: 'bg-emerald-400', textColor: 'text-emerald-600 dark:text-emerald-400', light: 'bg-emerald-50 dark:bg-emerald-500/10', icon: Smile },
        { label: 'Proceso',  count: proceso,  color: 'bg-amber-400',   textColor: 'text-amber-600 dark:text-amber-400',   light: 'bg-amber-50 dark:bg-amber-500/10',   icon: Meh   },
        { label: 'Apoyo',    count: apoyo,    color: 'bg-rose-400',    textColor: 'text-rose-600 dark:text-rose-400',    light: 'bg-rose-50 dark:bg-rose-500/10',    icon: Frown  },
    ];

    if (loading) return (
        <div className="flex flex-col gap-3 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl" />)}
        </div>
    );

    return (
        <div className="pb-20 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0 flex items-center gap-2">
                    <BarChart2 size={20} className="text-blue-500" /> Estadísticas
                </h2>
                <select
                    value={filterPeriod}
                    onChange={e => setFilterPeriod(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                    <option value="Todos">Todos los períodos</option>
                    <option value="P1">Período 1</option>
                    <option value="P2">Período 2</option>
                    <option value="P3">Período 3</option>
                    <option value="P4">Período 4</option>
                </select>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                    <div className="text-3xl font-extrabold text-slate-800 dark:text-white">{total}</div>
                    <div className="text-xs text-slate-400 font-medium mt-1 flex items-center gap-1"><BookOpen size={11} /> Evidencias</div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                    <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{coveragePercent}%</div>
                    <div className="text-xs text-slate-400 font-medium mt-1 flex items-center gap-1"><Users size={11} /> Cobertura ({coveredIds.size}/{students.length})</div>
                </div>
            </div>

            {/* Coverage progress */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">Cobertura de alumnos</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-white">{coveredIds.size} / {students.length}</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden mb-3">
                    <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                            width: `${coveragePercent}%`,
                            background: coveragePercent === 100 ? '#10b981' : coveragePercent > 60 ? '#f59e0b' : '#ef4444'
                        }}
                    />
                </div>
                {uncovered.length > 0 && (
                    <div>
                        <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1.5">Sin evidencia registrada:</div>
                        <div className="flex flex-wrap gap-1.5">
                            {uncovered.slice(0, 8).map(s => (
                                <span key={s.id} className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold">{s.name}</span>
                            ))}
                            {uncovered.length > 8 && <span className="text-[10px] text-slate-400">+{uncovered.length - 8} más</span>}
                        </div>
                    </div>
                )}
            </div>

            {/* Performance breakdown */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Desempeño</div>

                {/* Progress bar */}
                {total > 0 && (
                    <div className="w-full h-4 rounded-full overflow-hidden flex mb-4 gap-0.5">
                        {logrado > 0 && <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(logrado / total) * 100}%` }} />}
                        {proceso > 0 && <div className="h-full bg-amber-400 transition-all" style={{ width: `${(proceso / total) * 100}%` }} />}
                        {apoyo > 0 &&   <div className="h-full bg-rose-400 transition-all"    style={{ width: `${(apoyo / total) * 100}%` }} />}
                        {sinEval > 0 && <div className="h-full bg-slate-200 dark:bg-white/10 transition-all" style={{ width: `${(sinEval / total) * 100}%` }} />}
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    {perfBars.map(({ label, count, color, textColor, light, icon: Icon }) => (
                        <div key={label} className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-lg ${light} flex items-center justify-center shrink-0`}>
                                <Icon size={14} className={textColor} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-semibold text-slate-600 dark:text-slate-300">{label}</span>
                                    <span className={`font-bold ${textColor}`}>{count} <span className="text-slate-400 font-normal">({total > 0 ? Math.round((count/total)*100) : 0}%)</span></span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Activities */}
            {topActivities.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                        <TrendingUp size={12} /> Actividades más registradas
                    </div>
                    <div className="flex flex-col gap-3">
                        {topActivities.map(([name, count]) => (
                            <div key={name} className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate pr-2">{name}</span>
                                        <span className="font-bold text-slate-500 shrink-0">{count}</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-400 rounded-full transition-all duration-700" style={{ width: `${(count / maxCount) * 100}%` }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {total === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Aún no hay evidencias para mostrar estadísticas.</p>
                </div>
            )}
        </div>
    );
}
