import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
    FolderPlus, Film, X, Camera, Check,
    Calendar, Clock,
    Smile, Meh, Frown, Lock, Unlock, Image as ImageIcon,
    GraduationCap, School, Smartphone
} from 'lucide-react';

import { useCamera } from '../hooks/useCamera';
import { useStudents } from '../hooks/useStudents';
import { useCaptureForm } from '../hooks/useCaptureForm';
import { useTags } from '../hooks/useTags';

// UI KIT
import { Button } from './UI/Button';
import { Input } from './UI/FormElements';
import { Card } from './UI/Card';

// New Components
import { CameraOverlay } from './CameraOverlay';
import { StudentSelector } from './StudentSelector';

export function CaptureForm() {
    const { students } = useStudents();

    // 1. Hook de Cámara
    const {
        isCameraOpen, videoRef, startCamera, stopCamera,
        toggleFacingMode, toggleFlash, handleZoom, zoom, zoomCap, flashOn, facingMode,
        cameraStream
    } = useCamera();

    // 2. Hook de Formulario
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
        currentPeriod
    } = useCaptureForm();

    // Tags Hook
    const { availableTags, addTag, deleteTag } = useTags();
    const [newTagInput, setNewTagInput] = useState('');
    const [isAddingTag, setIsAddingTag] = useState(false);

    // Refs Inputs Nativos
    const nativeVideoInputRef = useRef(null);
    const nativePhotoInputRef = useRef(null);
    const canvasRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    // --- Lógica de Captura (que requiere refs locales) ---
    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        // Espejo si es frontal
        if (facingMode === 'user') { context.translate(canvas.width, 0); context.scale(-1, 1); }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (!blob) return;
            const fileName = `capture_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
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
                const fileName = `video_${Date.now()}.mp4`;
                const file = new File([blob], fileName, { type: 'video/mp4' });
                if (file.size > 50 * 1024 * 1024) toast.error("Video muy pesado. Descartado.");
                else { setFiles(prev => [...prev, file]); toast.success("Guardado", { icon: '🎥' }); }
            };
            mediaRecorder.start();
        } catch (e) { toast.error("Error al grabar: " + e.message); }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    const openNativeVideo = () => { if (nativeVideoInputRef.current) nativeVideoInputRef.current.click(); };
    const openNativePhoto = () => { if (nativePhotoInputRef.current) nativePhotoInputRef.current.click(); };

    const perfBtnClass = 'flex-1 py-2.5 rounded-xl border-2 flex flex-col items-center gap-1 text-[11px] font-bold cursor-pointer transition-all';
    const getPerfClass = (perfMode) => {
        if (performance === perfMode) {
            if (perfMode === 'logrado') return 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300';
            if (perfMode === 'proceso') return 'border-amber-400 bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300';
            if (perfMode === 'apoyo') return 'border-rose-400 bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300';
        }
        return 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-400 hover:border-slate-300 dark:hover:border-white/20';
    };

    return (
        <div className="pb-5">

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
            />

            <Card title="Nueva Evidencia" icon={Camera} actions={
                <div className="relative">
                    <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)} className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-xs text-slate-700 dark:text-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
            }>
                {/* TABS CONTEXTO */}
                <div className="flex gap-1.5 mb-5 p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                    <button type="button" onClick={() => setCaptureContext('class')} className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all duration-200 border-none ${captureContext === 'class' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        <GraduationCap size={15} /> Clase
                    </button>
                    <button type="button" onClick={() => setCaptureContext('school')} className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all duration-200 border-none ${captureContext === 'school' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        <School size={15} /> Evento
                    </button>
                    <div className="flex items-center justify-center px-3 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/20">
                        {currentPeriod}
                    </div>
                </div>

                <form onSubmit={saveEvidence} className="flex flex-col gap-4">

                    {/* ACTIVIDAD */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                            {captureContext === 'class' ? 'Actividad / Tema' : 'Nombre del Evento'}
                        </label>

                        {recentActivities.length > 0 && (
                            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
                                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-600 text-[10px] whitespace-nowrap shrink-0"><Clock size={10} /> Recientes:</div>
                                {recentActivities.map((act, i) => (
                                    <button key={i} type="button" onClick={() => setActivity(act)} className={`text-[10px] px-2.5 py-1 rounded-full border whitespace-nowrap cursor-pointer transition-colors ${activity === act ? 'bg-blue-100 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'}`}>{act}</button>
                                ))}
                            </div>
                        )}
                        <input value={activity} onChange={handleActivityChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" placeholder="Escribe aquí..." onBlur={() => setTimeout(() => setSuggestions([]), 200)} />
                        {suggestions.length > 0 && (
                            <ul className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl z-50 list-none p-1 m-0 shadow-xl max-h-40 overflow-y-auto">
                                {suggestions.map((sug, i) => (<li key={i} onClick={() => selectActivity(sug)} className="px-3 py-2.5 rounded-lg cursor-pointer text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 font-medium">{sug}</li>))}
                            </ul>
                        )}

                        {/* TAGS SECTION */}
                        <div className="flex gap-1.5 flex-wrap mt-2.5">
                            {availableTags.map(tag => (
                                <button key={tag} type="button" onClick={() => toggleTag(tag)} onContextMenu={(e) => { e.preventDefault(); deleteTag(tag); }} className={`text-[10px] px-2.5 py-1 rounded-full border cursor-pointer flex items-center gap-1 transition-all ${tags.includes(tag) ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold' : 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                                    {tags.includes(tag) && <Check size={9} />} {tag}
                                </button>
                            ))}
                            {isAddingTag ? (
                                <div className="flex items-center">
                                    <input
                                        autoFocus
                                        value={newTagInput}
                                        onChange={(e) => setNewTagInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(newTagInput); setNewTagInput(''); setIsAddingTag(false); } }}
                                        onBlur={() => { if (newTagInput) addTag(newTagInput); setNewTagInput(''); setIsAddingTag(false); }}
                                        className="text-[10px] px-2.5 py-1 rounded-full border border-blue-400 w-16 focus:outline-none bg-white dark:bg-slate-800"
                                    />
                                </div>
                            ) : (
                                <button type="button" onClick={() => setIsAddingTag(true)} className="text-[10px] px-2.5 py-1 rounded-full border border-dashed border-slate-300 dark:border-white/10 bg-transparent text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors">+ Tag</button>
                            )}
                        </div>
                    </div>

                    <input type="file" accept="video/*" capture="environment" ref={nativeVideoInputRef} onChange={handleFilesChange} className="hidden" />
                    <input type="file" accept="image/*" capture="environment" ref={nativePhotoInputRef} onChange={handleFilesChange} className="hidden" />

                    <div className="grid grid-cols-4 gap-2">
                        <button type="button" onClick={() => startCamera('photo')} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors cursor-pointer">
                            <Camera size={20} /><span className="text-[9px] font-bold uppercase">Web</span>
                        </button>
                        <button type="button" onClick={openNativePhoto} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors cursor-pointer">
                            <ImageIcon size={20} /><span className="text-[9px] font-bold uppercase">Foto</span>
                        </button>
                        <button type="button" onClick={openNativeVideo} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-none hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors cursor-pointer">
                            <Smartphone size={20} /><span className="text-[9px] font-bold uppercase">Video</span>
                        </button>
                        <label className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer">
                            <FolderPlus size={20} /><span className="text-[9px] font-bold uppercase">Galería</span>
                            <input type="file" multiple accept="image/*,video/*" onChange={handleFilesChange} className="hidden" />
                        </label>
                    </div>

                    {files.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 mb-3 no-scrollbar">
                            {files.map((f, i) => (
                                <div key={i} onClick={() => setPreviewFile(f)} className="relative min-w-[70px] h-[70px] rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shrink-0 bg-slate-200 dark:bg-slate-800 cursor-zoom-in">
                                    {f.type.startsWith('video/') ? <Film size={24} className="absolute top-[22px] left-[22px] text-slate-400" /> : <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />}
                                    <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="absolute top-0 right-0 bg-black/60 text-white border-none w-5 h-5 grid place-items-center cursor-pointer hover:bg-rose-600 transition-colors rounded-bl-lg"><X size={12} /></button>
                                </div>
                            ))}
                        </div>
                    )}

                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentarios..." rows={2} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-none" />

                    {/* SECCIÓN ALUMNOS */}
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

                    {/* EVALUACIÓN Y GUARDAR */}
                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/10">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Evaluación</label>
                        <div className="flex gap-2 mb-4">
                            <button type="button" onClick={() => setPerformance('logrado')} className={`${perfBtnClass} ${getPerfClass('logrado')}`}><Smile size={18}/> Logrado</button>
                            <button type="button" onClick={() => setPerformance('proceso')} className={`${perfBtnClass} ${getPerfClass('proceso')}`}><Meh size={18}/> Proceso</button>
                            <button type="button" onClick={() => setPerformance('apoyo')} className={`${perfBtnClass} ${getPerfClass('apoyo')}`}><Frown size={18}/> Apoyo</button>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Adjuntando <strong className="text-slate-700 dark:text-slate-200">{files.length} archivos</strong></div>
                            <button type="button" onClick={() => setKeepData(!keepData)} className={`flex items-center gap-1 text-[11px] border-none bg-transparent cursor-pointer font-bold ${keepData ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}>{keepData ? <Lock size={13} /> : <Unlock size={13} />} {keepData ? 'Mantener' : 'Limpiar'}</button>
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl border-none bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-sm cursor-pointer shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]">{loading ? 'Guardando...' : '💾 Guardar Evidencia'}</button>
                    </div>
                </form>
            </Card>

            {previewFile && (
                <div className="fixed inset-0 bg-black/90 z-[10000] flex items-center justify-center p-5">
                    <button onClick={() => setPreviewFile(null)} className="absolute top-5 right-5 bg-white/20 text-white border-none p-2.5 rounded-full cursor-pointer hover:bg-white/30 transition-colors"><X /></button>
                    {previewFile.type.startsWith('video/') ? <video src={URL.createObjectURL(previewFile)} controls className="max-w-full max-h-[80vh] rounded-lg" /> : <img src={URL.createObjectURL(previewFile)} className="max-w-full max-h-[80vh] object-contain rounded-lg" />}
                </div>
            )}
        </div>
    );
}