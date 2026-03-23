import { useRef, useState, useEffect } from 'react';
import { RefreshCw, Zap, ZoomIn, Check, Video, Square, Users } from 'lucide-react';
import { formatTime } from '../utils/formatters';

// Single student avatar chip for the camera panel
function StudentChip({ student, selected, onToggle }) {
    const initials = student.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return (
        <button
            type="button"
            onClick={() => onToggle(student.id)}
            className={`flex flex-col items-center gap-1 p-1 rounded-xl border-none bg-transparent cursor-pointer transition-all active:scale-95 ${selected ? 'opacity-100 scale-105' : 'opacity-60 hover:opacity-90'}`}
        >
            <div className={`relative w-11 h-11 rounded-full overflow-hidden shrink-0 flex items-center justify-center border-2 transition-all ${selected ? 'border-emerald-400 shadow-lg shadow-emerald-500/30' : 'border-white/30'}`}>
                {student.photo_url
                    ? <img src={student.photo_url} className="w-full h-full object-cover" />
                    : <div className={`w-full h-full flex items-center justify-center text-xs font-extrabold ${selected ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white'}`}>{initials}</div>
                }
                {selected && (
                    <div className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center">
                        <Check size={16} className="text-white drop-shadow" />
                    </div>
                )}
            </div>
            <span className="text-[8px] font-bold text-white/80 leading-tight text-center max-w-[44px] truncate">
                {student.name.split(' ')[0]}
            </span>
        </button>
    );
}

export function CameraOverlay({
    isCameraOpen, videoRef, canvasRef, facingMode, toggleFacingMode, toggleFlash, flashOn,
    zoom, handleZoom, zoomCap, stopCamera,
    onCapturePhoto, onCaptureVideo, files,
    // Smart camera props
    students = [], selectedStudents = [], onToggleStudent
}) {
    const [cameraMode, setCameraMode] = useState('photo');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showStudents, setShowStudents] = useState(true);
    const timerRef = useRef(null);

    const handleStartRecording = () => {
        setIsRecording(true);
        onCaptureVideo.start();
        timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    };

    const handleStopRecording = () => {
        setIsRecording(false);
        onCaptureVideo.stop();
        clearInterval(timerRef.current);
        setRecordingTime(0);
    };

    useEffect(() => {
        return () => clearInterval(timerRef.current);
    }, []);

    if (!isCameraOpen) return null;

    const btnGlass = 'w-11 h-11 rounded-full border border-white/20 bg-white/15 backdrop-blur-md text-white flex items-center justify-center cursor-pointer transition-all hover:bg-white/25 active:scale-95';

    return (
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col select-none">

            {/* VIDEO */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* TOP BAR */}
            <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center px-5 pt-10 pb-6 bg-gradient-to-b from-black/70 via-black/20 to-transparent">
                <div className="flex gap-3">
                    <button onClick={toggleFacingMode} className={btnGlass} title="Girar cámara">
                        <RefreshCw size={18} />
                    </button>
                    <button onClick={toggleFlash} className={`${btnGlass} ${flashOn ? 'bg-amber-400/30 border-amber-400/60 text-amber-300' : ''}`} title="Flash">
                        <Zap size={18} fill={flashOn ? 'currentColor' : 'none'} />
                    </button>
                </div>

                {/* Recording indicator */}
                {isRecording && (
                    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-red-500/30 rounded-full px-3 py-1.5">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-white font-bold text-sm tabular-nums">{formatTime(recordingTime)}</span>
                    </div>
                )}

                {/* Toggle student panel */}
                {students.length > 0 && (
                    <button onClick={() => setShowStudents(s => !s)}
                        className={`${btnGlass} ${selectedStudents.length > 0 ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-300' : ''}`}
                        title="Alumnos">
                        <Users size={18} />
                        {selectedStudents.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                                {selectedStudents.length}
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* STUDENT PANEL — right side vertical strip */}
            {students.length > 0 && showStudents && (
                <div className="absolute top-28 right-2 bottom-48 z-20 flex flex-col gap-1 overflow-y-auto no-scrollbar">
                    <div className="flex flex-col gap-1.5 px-1">
                        {students.map(s => (
                            <StudentChip
                                key={s.id}
                                student={s}
                                selected={selectedStudents.includes(s.id)}
                                onToggle={onToggleStudent}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* BOTTOM CONTROLS */}
            <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-4 px-6 pb-10 pt-6 bg-gradient-to-t from-black/80 via-black/30 to-transparent">

                {/* Zoom slider */}
                {zoomCap && (
                    <div className="flex items-center gap-3">
                        <ZoomIn size={16} className="text-white/60 shrink-0" />
                        <input
                            type="range"
                            min={zoomCap.min}
                            max={zoomCap.max}
                            step={zoomCap.step}
                            value={zoom}
                            onChange={handleZoom}
                            className="w-full h-1 accent-white cursor-pointer"
                        />
                        <span className="text-[11px] text-white/60 font-mono w-8 shrink-0">{zoom}x</span>
                    </div>
                )}

                {/* Selected count badge */}
                {selectedStudents.length > 0 && (
                    <div className="flex justify-center">
                        <div className="bg-emerald-500/30 backdrop-blur-md border border-emerald-400/40 rounded-full px-3 py-1 text-emerald-300 text-[11px] font-bold">
                            ✓ {selectedStudents.length} alumno{selectedStudents.length !== 1 ? 's' : ''} seleccionado{selectedStudents.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                )}

                {/* Main controls row */}
                <div className="flex items-center justify-between">

                    {/* Done button */}
                    <button onClick={stopCamera} className="flex flex-col items-center gap-1 cursor-pointer">
                        <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-colors ${files.length > 0 ? 'border-emerald-400 bg-emerald-400/20' : 'border-white/30 bg-white/10'}`}>
                            <Check size={20} className={files.length > 0 ? 'text-emerald-400' : 'text-white/50'} />
                        </div>
                        <span className="text-[10px] text-white/60 font-semibold">
                            {files.length > 0 ? `Listo (${files.length})` : 'Listo'}
                        </span>
                    </button>

                    {/* Shutter */}
                    <div className="flex flex-col items-center gap-3">
                        {cameraMode === 'photo' ? (
                            <button onClick={onCapturePhoto}
                                className="w-20 h-20 rounded-full bg-white border-4 border-white/30 flex items-center justify-center p-0 cursor-pointer active:scale-95 transition-transform shadow-lg shadow-black/50">
                                <div className="w-[66px] h-[66px] rounded-full border-2 border-black/10 bg-white" />
                            </button>
                        ) : (
                            <button
                                onClick={isRecording ? handleStopRecording : handleStartRecording}
                                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center p-0 cursor-pointer active:scale-95 transition-all shadow-lg shadow-black/50 ${
                                    isRecording ? 'border-white/30 bg-white' : 'border-red-400/50 bg-red-500'
                                }`}>
                                {isRecording
                                    ? <Square size={28} fill="red" className="text-red-500" />
                                    : <div className="w-[66px] h-[66px] rounded-full border-2 border-white/30" />}
                            </button>
                        )}

                        {/* Mode switcher */}
                        <div className="flex items-center bg-black/30 backdrop-blur-md border border-white/10 rounded-full p-1">
                            <button onClick={() => !isRecording && setCameraMode('photo')} disabled={isRecording}
                                className={`px-4 py-1.5 rounded-full border-none text-xs font-bold cursor-pointer transition-all ${cameraMode === 'photo' ? 'bg-white text-black shadow-sm' : 'bg-transparent text-white/70 hover:text-white'}`}>
                                Foto
                            </button>
                            <button onClick={() => !isRecording && setCameraMode('video')} disabled={isRecording}
                                className={`px-4 py-1.5 rounded-full border-none text-xs font-bold cursor-pointer transition-all ${cameraMode === 'video' ? 'bg-white text-black shadow-sm' : 'bg-transparent text-white/70 hover:text-white'}`}>
                                Video
                            </button>
                        </div>
                    </div>

                    {/* Last captured thumbnail */}
                    {files.length > 0 ? (
                        <div className="w-11 h-11 rounded-xl overflow-hidden border-2 border-white/40 shadow-lg cursor-pointer">
                            {files[files.length - 1].type.startsWith('video/') ? (
                                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                    <Video size={18} className="text-white" />
                                </div>
                            ) : (
                                <img src={URL.createObjectURL(files[files.length - 1])} className="w-full h-full object-cover" />
                            )}
                        </div>
                    ) : (
                        <div className="w-11 h-11 rounded-xl border border-white/20 bg-white/5" />
                    )}
                </div>
            </div>
        </div>
    );
}
