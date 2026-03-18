import { Check, User, Filter, Search, Square, CheckSquare } from 'lucide-react';
import { LEVELS, SHIFTS, GRADES, SECTIONS } from '../utils/constants';

const selectCls = 'flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[11px] font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/40 cursor-pointer';

export function StudentSelector({
    students, selectedStudents, setSelectedStudents,
    filters, handleFilterChange,
    searchTerm, setSearchTerm,
    captureContext
}) {
    const visibleStudents = students.filter(student => {
        if (searchTerm !== '' && !student.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (filters.level !== 'Todos' && student.level !== filters.level) return false;
        if (filters.shift !== 'Todos' && student.shift !== filters.shift) return false;
        if (filters.grade !== 'Todos' && student.grade !== filters.grade) return false;
        if (filters.section !== 'Todos' && student.section !== filters.section) return false;
        return true;
    });

    const allVisible = visibleStudents.length > 0 && visibleStudents.every(s => selectedStudents.includes(s.id));

    const toggleSelectAll = () => {
        const visibleIds = visibleStudents.map(s => s.id);
        if (allVisible) setSelectedStudents(prev => prev.filter(id => !visibleIds.includes(id)));
        else setSelectedStudents(prev => [...new Set([...prev, ...visibleIds])]);
    };

    const toggleStudent = (id) => {
        if (selectedStudents.includes(id)) setSelectedStudents(selectedStudents.filter(s => s !== id));
        else setSelectedStudents([...selectedStudents, id]);
    };

    return (
        <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-3 mb-4">

            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Filter size={11} />
                    {captureContext === 'class' ? 'Filtrar Clase' : 'Participantes (Opcional)'}
                </div>
                {selectedStudents.length > 0 && (
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full">
                        {selectedStudents.length} seleccionados
                    </span>
                )}
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
                <select className={selectCls} value={filters.level} onChange={e => handleFilterChange('level', e.target.value)}>
                    <option value="Todos">Todos Niveles</option>
                    {LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
                <select className={selectCls} value={filters.shift} onChange={e => handleFilterChange('shift', e.target.value)}>
                    <option value="Todos">Todas Tandas</option>
                    {SHIFTS.map(s => <option key={s}>{s}</option>)}
                </select>
                <select className={selectCls} value={filters.grade} onChange={e => handleFilterChange('grade', e.target.value)}>
                    <option value="Todos">Todos Grados</option>
                    {GRADES.map(g => <option key={g}>{g}</option>)}
                </select>
                <select className={selectCls} value={filters.section} onChange={e => handleFilterChange('section', e.target.value)}>
                    <option value="Todos">Todas Sec.</option>
                    {SECTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
            </div>

            {/* Search + select all */}
            <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                        placeholder="Buscar alumno..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full py-2 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-white/10 text-[12px] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                    />
                </div>
                <button
                    type="button"
                    onClick={toggleSelectAll}
                    className={`shrink-0 px-3 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        allVisible
                            ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    }`}
                >
                    {allVisible ? <><Square size={13} /> Ninguno</> : <><CheckSquare size={13} /> Todos</>}
                </button>
            </div>

            {/* Student grid */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-1.5 max-h-[240px] overflow-y-auto">
                {visibleStudents.length === 0 && (
                    <p className="col-span-full text-center text-slate-400 text-xs py-4">No hay alumnos con estos filtros.</p>
                )}
                {visibleStudents.map(student => {
                    const isSelected = selectedStudents.includes(student.id);
                    return (
                        <div
                            key={student.id}
                            onClick={() => toggleStudent(student.id)}
                            className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all duration-100 ${
                                isSelected
                                    ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20'
                            }`}
                        >
                            <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-blue-500' : 'border-2 border-slate-300 dark:border-white/20'
                            }`}>
                                {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                            </div>
                            {student.photoUrl ? (
                                <img src={student.photoUrl} className="w-6 h-6 rounded-full object-cover shrink-0" />
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center shrink-0">
                                    <User size={12} className="text-slate-400" />
                                </div>
                            )}
                            <div className="overflow-hidden">
                                <div className={`text-[11px] font-bold truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {student.name}
                                </div>
                                <div className={`text-[9px] ${isSelected ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400'}`}>
                                    #{student.listNumber}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
