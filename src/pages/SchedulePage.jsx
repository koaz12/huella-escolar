import { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, ChevronLeft, ChevronRight, BookOpen, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
const DAY_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const COLORS = [
    { bg: 'bg-blue-500',   light: 'bg-blue-50 dark:bg-blue-500/15',   text: 'text-blue-700 dark:text-blue-300',   border: 'border-blue-300 dark:border-blue-500/30' },
    { bg: 'bg-purple-500', light: 'bg-purple-50 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-500/30' },
    { bg: 'bg-emerald-500',light: 'bg-emerald-50 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-500/30' },
    { bg: 'bg-amber-500',  light: 'bg-amber-50 dark:bg-amber-500/15',  text: 'text-amber-700 dark:text-amber-300',  border: 'border-amber-300 dark:border-amber-500/30' },
    { bg: 'bg-rose-500',   light: 'bg-rose-50 dark:bg-rose-500/15',   text: 'text-rose-700 dark:text-rose-300',   border: 'border-rose-300 dark:border-rose-500/30' },
    { bg: 'bg-cyan-500',   light: 'bg-cyan-50 dark:bg-cyan-500/15',   text: 'text-cyan-700 dark:text-cyan-300',   border: 'border-cyan-300 dark:border-cyan-500/30' },
];

const DEFAULT_BLOCK = { subject: '', grade: '', section: '', shift: 'Matutina', startTime: '08:00', endTime: '09:00', colorIdx: 0 };

function timeToMins(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

export function SchedulePage() {
    const [selectedDay, setSelectedDay] = useState(() => {
        const d = new Date().getDay(); // 0=Sun,1=Mon...
        return d >= 1 && d <= 5 ? d - 1 : 0;
    });
    const [schedule, setSchedule] = useState(() => {
        const saved = localStorage.getItem('weekSchedule');
        if (saved) return JSON.parse(saved);
        return { 0: [], 1: [], 2: [], 3: [], 4: [] };
    });
    const [showModal, setShowModal] = useState(false);
    const [newBlock, setNewBlock] = useState({ ...DEFAULT_BLOCK });

    const save = (next) => {
        setSchedule(next);
        localStorage.setItem('weekSchedule', JSON.stringify(next));
    };

    const addBlock = () => {
        if (!newBlock.subject || !newBlock.grade) return toast.error('Materia y grado requeridos');
        if (timeToMins(newBlock.startTime) >= timeToMins(newBlock.endTime)) return toast.error('La hora de inicio debe ser menor al fin');
        const updated = { ...schedule, [selectedDay]: [...(schedule[selectedDay] || []), { ...newBlock, id: Date.now() }] };
        // sort by start time
        updated[selectedDay].sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime));
        save(updated);
        setNewBlock({ ...DEFAULT_BLOCK });
        setShowModal(false);
        toast.success('Bloque agregado ✅');
    };

    const removeBlock = (id) => {
        const updated = { ...schedule, [selectedDay]: schedule[selectedDay].filter(b => b.id !== id) };
        save(updated);
    };

    const blocks = (schedule[selectedDay] || []);

    return (
        <div className="pb-28 flex flex-col gap-4">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                        <BookOpen size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 m-0">Mi Horario</h2>
                        <p className="text-[10px] text-slate-400 m-0">La app auto-llena el contexto al capturar según la hora actual</p>
                    </div>
                </div>
            </div>

            {/* Day selector */}
            <div className="flex gap-1.5">
                {DAYS.map((d, i) => {
                    const isToday = new Date().getDay() - 1 === i;
                    return (
                        <button key={i} onClick={() => setSelectedDay(i)}
                            className={`flex-1 py-2.5 rounded-xl flex flex-col items-center gap-0.5 border-none cursor-pointer transition-all ${
                                selectedDay === i
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-blue-300'
                            }`}>
                            <span className="text-[10px] font-bold uppercase">{d}</span>
                            {isToday && <div className={`w-1 h-1 rounded-full ${selectedDay === i ? 'bg-white' : 'bg-blue-500'}`} />}
                        </button>
                    );
                })}
            </div>

            {/* Day blocks */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{DAY_FULL[selectedDay]}</span>
                    <span className="text-xs text-slate-400">{blocks.length} {blocks.length === 1 ? 'clase' : 'clases'}</span>
                </div>

                {blocks.length === 0 ? (
                    <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
                        <Clock size={32} className="opacity-30" />
                        <p className="text-xs font-medium">Sin clases este día</p>
                        <p className="text-[10px] text-slate-300">Toca + para agregar una clase</p>
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-slate-100 dark:divide-white/5">
                        {blocks.map(b => {
                            const c = COLORS[b.colorIdx ?? 0];
                            return (
                                <div key={b.id} className={`flex items-center gap-3 px-4 py-3 ${c.light}`}>
                                    <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${c.bg}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-sm ${c.text} truncate`}>{b.subject}</div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{b.grade}{b.section ? ` · ${b.section}` : ''} · {b.shift}</div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <Clock size={10} /> {b.startTime}–{b.endTime}
                                        </div>
                                        <button onClick={() => removeBlock(b.id)} className="w-6 h-6 bg-transparent border-none cursor-pointer rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center text-slate-300 hover:text-rose-400 transition-colors">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Quick summary for other days */}
            <div className="grid grid-cols-2 gap-2">
                {DAYS.map((d, i) => {
                    if (i === selectedDay) return null;
                    const dayBlocks = schedule[i] || [];
                    return (
                        <button key={i} onClick={() => setSelectedDay(i)}
                            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 p-3 text-left cursor-pointer hover:border-blue-300 transition-colors">
                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">{d}</div>
                            {dayBlocks.length === 0
                                ? <div className="text-[10px] text-slate-300">Sin clases</div>
                                : dayBlocks.slice(0, 2).map((b, bi) => {
                                    const c = COLORS[b.colorIdx ?? 0];
                                    return (
                                        <div key={bi} className="text-[10px] font-semibold truncate" style={{color: ''}}><span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${c.bg}`} />{b.subject}</div>
                                    );
                                })
                            }
                            {dayBlocks.length > 2 && <div className="text-[10px] text-slate-400">+{dayBlocks.length - 2} más</div>}
                        </button>
                    );
                })}
            </div>

            {/* FAB */}
            <button onClick={() => setShowModal(true)}
                className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white border-none shadow-xl shadow-blue-500/30 flex items-center justify-center cursor-pointer transition-all z-50">
                <Plus size={24} />
            </button>

            {/* Add Block Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[3000] flex items-end">
                    <div className="bg-white dark:bg-slate-900 rounded-t-3xl w-full p-5 flex flex-col gap-4">
                        <div className="w-10 h-1 bg-slate-200 dark:bg-white/20 rounded-full mx-auto" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 m-0">Agregar Clase — {DAY_FULL[selectedDay]}</h3>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Materia / Actividad</label>
                                <input value={newBlock.subject} onChange={e => setNewBlock({...newBlock, subject: e.target.value})}
                                    placeholder="Ej. Lengua Española" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Grado</label>
                                <input value={newBlock.grade} onChange={e => setNewBlock({...newBlock, grade: e.target.value})}
                                    placeholder="Ej. 4to" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Sección</label>
                                <input value={newBlock.section} onChange={e => setNewBlock({...newBlock, section: e.target.value})}
                                    placeholder="Ej. A" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Inicio</label>
                                <input type="time" value={newBlock.startTime} onChange={e => setNewBlock({...newBlock, startTime: e.target.value})}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Fin</label>
                                <input type="time" value={newBlock.endTime} onChange={e => setNewBlock({...newBlock, endTime: e.target.value})}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Tanda</label>
                                <div className="flex gap-2">
                                    {['Matutina','Vespertina'].map(s => (
                                        <button key={s} type="button" onClick={() => setNewBlock({...newBlock, shift: s})}
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold border-none cursor-pointer transition-all ${newBlock.shift === s ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
                                            {s === 'Matutina' ? '🌅 Matutina' : '🌇 Vespertina'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Color</label>
                                <div className="flex gap-2">
                                    {COLORS.map((c, i) => (
                                        <button key={i} type="button" onClick={() => setNewBlock({...newBlock, colorIdx: i})}
                                            className={`w-7 h-7 rounded-full cursor-pointer border-2 transition-all ${c.bg} ${newBlock.colorIdx === i ? 'border-slate-800 scale-110' : 'border-transparent'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-slate-600 dark:text-slate-300 font-bold text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={addBlock} className="flex-1 py-3 rounded-xl border-none bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
                                <Save size={15} /> Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
