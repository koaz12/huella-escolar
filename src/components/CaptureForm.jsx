import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
    FolderPlus, Film, X, Camera, Check,
    Calendar, Clock,
    Smile, Meh, Frown, Lock, Unlock, Image as ImageIcon,
    GraduationCap, School, Smartphone, ChevronDown, ChevronUp, Video
} from 'lucide-react';

import { useCamera } from '../hooks/useCamera';
import { useStudents } from '../hooks/useStudents';
import { useCaptureForm } from '../hooks/useCaptureForm';
import { useTags } from '../hooks/useTags';
import { useFolders } from '../hooks/useFolders';

import { CameraOverlay } from './CameraOverlay';
import { StudentSelector } from './StudentSelector';

// ─── Section wrapper with a numbered step badge ───────────────────────────────
function Section({ step, title, children, collapsible = false, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
            <div
                className={`flex items-center gap-3 px-4 py-3 ${collapsible ? 'cursor-pointer select-none' : ''}`}
                onClick={collapsible ? () => setOpen(o => !o) : undefined}
            >
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-extrabold text-white">{step}</span>
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex-1">{title}</span>
                {collapsible && (
                    open
                        ? <ChevronUp size={15} className="text-slate-400" />
                        : <ChevronDown size={15} className="text-slate-400" />
                )}
            </div>
            {(!collapsible || open) && (
                <div className="px-4 pb-4 pt-0">{children}</div>
            )}
        </div>
    );
}

export function CaptureForm() {
    const { students } = useStudents();

    // Hook de Cámara
    const {
        isCameraOpen, videoRef, startCamera, stopCamera,
        toggleFacingMode, toggleFlash, handleZoom, zoom, zoomCap, flashOn, facingMode,
        cameraStream
    } = useCamera();

    // Hook de Formulario
    const {
        captureContext, setCaptureContext,
        activity, setActivity, handleActivityChange, selectActivity,
        comment, setComment,
        tags, toggleTag,
        performance, setPerformance,
        customDate, setCustomDate,
        files, setFiles, handleFilesChange, removeFile,
        loading,
        previewFile, setPreviewFile,
        suggestions, setSuggestions, recentActivities,
        keepData, setKeepData,
        selectedStudents, setSelectedStudents,
        filters, handleFilterChange,
        searchTerm, setSearchTerm,
        saveEvidence,
        currentPeriod,
        setCurrentPeriod
    } = useCaptureForm();

    const { availableTags, addTag, deleteTag } = useTags();
    const { getFolders, createFolder, deleteFolder } = useFolders();
    const [folders, setFolders] = useState(() => getFolders());
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFolder, setNewFolder] = useState({ name: '', period: localStorage.getItem('currentPeriod') || 'P1', level: 'Primario', shift: 'Matutina', grade: '', section: '' });
    const [newTagInput, setNewTagInput] = useState('');
    const [isAddingTag, setIsAddingTag] = useState(false);

    const nativeVideoInputRef = useRef(null);
    const nativePhotoInputRef = useRef(null);
    const canvasRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (facingMode === 'user') { context.translate(canvas.width, 0); context.scale(-1, 1); }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (!blob) return;
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            setFiles(prev => [...prev, file]);
            toast.success("Capturado", { duration: 1000, icon: '📸' });
        }, 'image/jpeg', 0.85);
    };

    const startRecording = () => {
        if (!cameraStream) return;
        chunksRef.current = [];
        try {
            const options = { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1500000 };
            const mediaRecorder = new MediaRecorder(cameraStream, MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined);
            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
                const file = new File([blob], `video_${Date.now()}.mp4`, { type: 'video/mp4' });
                if (file.size > 50 * 1024 * 1024) toast.error("Video muy pesado. Descartado.");
                else { setFiles(prev => [...prev, file]); toast.success("Guardado", { icon: '🎥' }); }
            };
            mediaRecorder.start();
        } catch (e) { toast.error("Error al grabar: " + e.message); }
    };
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive')
            mediaRecorderRef.current.stop();
    };
    const openNativeVideo = () => nativeVideoInputRef.current?.click();
    const openNativePhoto = () => nativePhotoInputRef.current?.click();

    const perfBtnClass = 'flex-1 py-3 rounded-xl border-2 flex flex-col items-center gap-1.5 text-[11px] font-bold cursor-pointer transition-all';
    const getPerfClass = (perfMode) => {
        if (performance === perfMode) {
            if (perfMode === 'logrado') return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 scale-[1.03]';
            if (perfMode === 'proceso') return 'border-amber-400 bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 scale-[1.03]';
            if (perfMode === 'apoyo') return 'border-rose-400 bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 scale-[1.03]';
        }
        return 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-400 hover:border-slate-300 dark:hover:border-white/20';
    };

    return (
        <div className="pb-24 flex flex-col gap-3">

            {/* Full-screen camera overlay */}
            <CameraOverlay
                isCameraOpen={isCameraOpen}
                videoRef={videoRef}
                canvasRef={canvasRef}
                facingMode={facingMode}
                toggleFacingMode={toggleFacingMode}
                toggleFlash={toggleFlash}
                flashOn={flashOn}
                zoom={zoom}
                handleZoom={handleZoom}
                zoomCap={zoomCap}
                stopCamera={stopCamera}
                onCapturePhoto={capturePhoto}
                onCaptureVideo={{ start: startRecording, stop: stopRecording }}
                files={files}
                students={students}
                selectedStudents={selectedStudents}
                onToggleStudent={(id) => setSelectedStudents(prev =>
                    prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
                )}
            />

            {/* Hidden native inputs */}
            <input type="file" accept="video/*" capture="environment" ref={nativeVideoInputRef} onChange={handleFilesChange} className="hidden" />
            <input type="file" accept="image/*" capture="environment" ref={nativePhotoInputRef} onChange={handleFilesChange} className="hidden" />

            <form onSubmit={saveEvidence} className="flex flex-col gap-3">

                {/* ── STEP 1: CONTEXTO + FECHA ─────────────────────── */}
                <Section step="1" title="Contexto">
                    {/* Folder picker */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">📁 Carpeta</span>
                            <button type="button" onClick={() => setShowFolderModal(true)}
                                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-lg border-none cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">+ Nueva</button>
                        </div>
                        {folders.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic text-center py-2">Sin carpetas — crea una con "+ Nueva"</p>
                        ) : (
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                {folders.map(f => (
                                    <button key={f.id} type="button" onClick={() => {
                                        setActivity(f.name);
                                        if (f.period) setCurrentPeriod(f.period);
                                        if (f.grade) handleFilterChange('grade', f.grade);
                                        if (f.section) handleFilterChange('section', f.section);
                                        if (f.shift) handleFilterChange('shift', f.shift);
                                    }}
                                        className="shrink-0 flex flex-col items-start px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-left cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all active:scale-95">
                                        <span className="text-[11px] font-extrabold text-blue-700 dark:text-blue-300 max-w-[100px] truncate">{f.name}</span>
                                        <span className="text-[9px] text-slate-400 font-medium">{f.period} · {f.level || '-'} · {f.grade || 'Todos'}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Context tabs */}
                    <div className="flex gap-1.5 mb-4 p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                        <button type="button" onClick={() => setCaptureContext('class')}
                            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all duration-200 border-none ${captureContext === 'class' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            <GraduationCap size={15} /> Clase
                        </button>
                        <button type="button" onClick={() => setCaptureContext('school')}
                            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all duration-200 border-none ${captureContext === 'school' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            <School size={15} /> Evento
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const periods = ['P1', 'P2', 'P3', 'P4'];
                                const next = periods[(periods.indexOf(currentPeriod) + 1) % periods.length];
                                setCurrentPeriod(next);
                            }}
                            title="Cambiar período"
                            className="flex items-center justify-center px-3 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap gap-1"
                        >
                            {currentPeriod} ↻
                        </button>
                    </div>

                    {/* Date picker */}
                    <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-700 dark:text-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                    </div>
                </Section>

                {/* ── STEP 2: CAPTURA ──────────────────────────────── */}
                <Section step="2" title={`Archivos${files.length > 0 ? ` · ${files.length}` : ''}`}>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        {/* PRIMARY: Web camera with student panel */}
                        <button type="button" onClick={() => startCamera('photo')}
                            className="col-span-3 flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white border-none shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-blue-600 active:scale-[0.98] transition-all cursor-pointer">
                            <Camera size={24} className="shrink-0" />
                            <div className="text-left">
                                <div className="text-sm font-extrabold leading-tight">📸 Cámara con Alumnos</div>
                                <div className="text-[10px] opacity-80 font-medium">Selecciona alumnos mientras capturas</div>
                            </div>
                        </button>
                        {/* Native fallbacks */}
                        <button type="button" onClick={openNativePhoto}
                            className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer">
                            <ImageIcon size={20} />
                            <span className="text-[9px] font-bold uppercase">📷 Foto</span>
                            <span className="text-[8px] text-slate-400 font-medium">nativa</span>
                        </button>
                        <button type="button" onClick={openNativeVideo}
                            className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer">
                            <Video size={20} />
                            <span className="text-[9px] font-bold uppercase">🎥 Video</span>
                            <span className="text-[8px] text-slate-400 font-medium">nativo</span>
                        </button>
                        <label className="flex flex-col items-center gap-1.5 p-3.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer">
                            <FolderPlus size={20} />
                            <span className="text-[9px] font-bold uppercase">📁 Archivo</span>
                            <span className="text-[8px] text-slate-400 font-medium">galería</span>
                            <input type="file" multiple accept="image/*,video/*" onChange={handleFilesChange} className="hidden" />
                        </label>
                    </div>

                    {files.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {files.map((f, i) => (
                                <div key={i} onClick={() => setPreviewFile(f)} className="relative min-w-[72px] h-[72px] rounded-xl overflow-hidden border-2 border-slate-200 dark:border-white/10 shrink-0 bg-slate-200 dark:bg-slate-800 cursor-zoom-in">
                                    {f.type.startsWith('video/') ? <Film size={24} className="absolute top-[22px] left-[22px] text-slate-400" /> : <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />}
                                    <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="absolute top-0 right-0 bg-black/60 text-white border-none w-5 h-5 grid place-items-center cursor-pointer hover:bg-rose-600 transition-colors rounded-bl-lg"><X size={11} /></button>
                                </div>
                            ))}
                        </div>
                    )}

                    {files.length === 0 && (
                        <div className="text-center py-3 text-slate-400 dark:text-slate-600 text-xs">
                            Ningún archivo aún — usa los botones de arriba
                        </div>
                    )}
                </Section>

                {/* ── STEP 3: ACTIVIDAD + TAGS ─────────────────────── */}
                <Section step="3" title="Actividad y etiquetas">
                    {/* Recent pills */}
                    {recentActivities.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
                            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-600 text-[10px] whitespace-nowrap shrink-0"><Clock size={10} /> Recientes:</div>
                            {recentActivities.map((act, i) => (
                                <button key={i} type="button" onClick={() => setActivity(act)}
                                    className={`text-[10px] px-2.5 py-1 rounded-full border whitespace-nowrap cursor-pointer transition-colors ${activity === act ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                                    {act}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Activity input with autocomplete */}
                    <div className="relative mb-3">
                        <input value={activity} onChange={handleActivityChange}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                            placeholder={captureContext === 'class' ? 'Actividad / Tema...' : 'Nombre del evento...'}
                            onBlur={() => setTimeout(() => setSuggestions([]), 200)} />
                        {suggestions.length > 0 && (
                            <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl z-50 list-none p-1 m-0 shadow-xl max-h-40 overflow-y-auto">
                                {suggestions.map((sug, i) => <li key={i} onClick={() => selectActivity(sug)} className="px-3 py-2.5 rounded-lg cursor-pointer text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 font-medium">{sug}</li>)}
                            </ul>
                        )}
                    </div>

                    {/* Tags */}
                    <div className="flex gap-1.5 flex-wrap">
                        {availableTags.map(tag => (
                            <button key={tag} type="button" onClick={() => toggleTag(tag)} onContextMenu={(e) => { e.preventDefault(); deleteTag(tag); }}
                                className={`text-[10px] px-2.5 py-1 rounded-full border cursor-pointer flex items-center gap-1 transition-all ${tags.includes(tag) ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold' : 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                                {tags.includes(tag) && <Check size={9} />} {tag}
                            </button>
                        ))}
                        {isAddingTag ? (
                            <input autoFocus value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(newTagInput); setNewTagInput(''); setIsAddingTag(false); } }}
                                onBlur={() => { if (newTagInput) addTag(newTagInput); setNewTagInput(''); setIsAddingTag(false); }}
                                className="text-[10px] px-2.5 py-1 rounded-full border border-blue-400 w-20 focus:outline-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200" />
                        ) : (
                            <button type="button" onClick={() => setIsAddingTag(true)} className="text-[10px] px-2.5 py-1 rounded-full border border-dashed border-slate-300 dark:border-white/10 bg-transparent text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">+ Tag</button>
                        )}
                    </div>

                    {/* Comment */}
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                        placeholder="Comentarios opcionales..." rows={2}
                        className="w-full mt-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-none" />
                </Section>

                {/* ── STEP 4: ALUMNOS ─────────────────────────────── */}
                <Section step="4" title={`Alumnos${selectedStudents.length > 0 ? ` · ${selectedStudents.length} seleccionados` : ''}`} collapsible defaultOpen>
                    <StudentSelector
                        students={students}
                        selectedStudents={selectedStudents}
                        setSelectedStudents={setSelectedStudents}
                        filters={filters}
                        handleFilterChange={handleFilterChange}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        captureContext={captureContext}
                    />
                </Section>

                {/* ── STEP 5: EVALUACIÓN + GUARDAR ────────────────── */}
                <Section step="5" title="Evaluación y guardar">
                    <div className="flex gap-2 mb-4">
                        <button type="button" onClick={() => setPerformance('logrado')} className={`${perfBtnClass} ${getPerfClass('logrado')}`}><Smile size={20} />Logrado</button>
                        <button type="button" onClick={() => setPerformance('proceso')} className={`${perfBtnClass} ${getPerfClass('proceso')}`}><Meh size={20} />Proceso</button>
                        <button type="button" onClick={() => setPerformance('apoyo')} className={`${perfBtnClass} ${getPerfClass('apoyo')}`}><Frown size={20} />Apoyo</button>
                    </div>

                    <div className="flex justify-between items-center mb-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            <strong className="text-slate-700 dark:text-slate-200">{files.length}</strong> {files.length === 1 ? 'archivo' : 'archivos'} · <strong className="text-slate-700 dark:text-slate-200">{selectedStudents.length}</strong> {selectedStudents.length === 1 ? 'alumno' : 'alumnos'}
                        </div>
                        <button type="button" onClick={() => setKeepData(!keepData)}
                            className={`flex items-center gap-1 text-[11px] border-none bg-transparent cursor-pointer font-bold ${keepData ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}>
                            {keepData ? <Lock size={13} /> : <Unlock size={13} />} {keepData ? 'Mantener datos' : 'Limpiar al guardar'}
                        </button>
                    </div>

                    <button type="submit" disabled={loading}
                        className="w-full py-4 rounded-xl border-none bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-60 text-white font-bold text-base cursor-pointer shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]">
                        {loading ? '⏳ Guardando...' : '💾 Guardar Evidencia'}
                    </button>
                </Section>
            </form>

            {/* File preview modal */}
            {previewFile && (
                <div className="fixed inset-0 bg-black/90 z-[10000] flex items-center justify-center p-5">
                    <button onClick={() => setPreviewFile(null)} className="absolute top-5 right-5 bg-white/20 text-white border-none p-2.5 rounded-full cursor-pointer hover:bg-white/30 transition-colors"><X /></button>
                    {previewFile.type.startsWith('video/') ? <video src={URL.createObjectURL(previewFile)} controls className="max-w-full max-h-[80vh] rounded-lg" /> : <img src={URL.createObjectURL(previewFile)} className="max-w-full max-h-[80vh] object-contain rounded-lg" />}
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
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold border-none cursor-pointer transition-all ${newFolder.period === p ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
                                            {p}
                                        </button>
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
                                    const updated = getFolders();
                                    setFolders(updated);
                                    // Auto-select this folder
                                    setActivity(f.name);
                                    if (f.period) setCurrentPeriod(f.period);
                                    if (f.grade) handleFilterChange('grade', f.grade);
                                    if (f.section) handleFilterChange('section', f.section);
                                    if (f.shift) handleFilterChange('shift', f.shift);
                                    setShowFolderModal(false);
                                    setNewFolder({ name: '', period: localStorage.getItem('currentPeriod') || 'P1', level: 'Primario', shift: 'Matutina', grade: '', section: '' });
                                    toast.success('📁 Carpeta creada y seleccionada');
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
    );
}