import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import { saveOffline } from '../db';
import { EvidenceService } from '../services/evidenceService';
import { DEFAULT_FILTERS } from '../utils/constants';

export function useCaptureForm() {
  const [captureContext, setCaptureContext] = useState('class');
  const [activity, setActivity] = useState('');
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState([]);
  const [performance, setPerformance] = useState('');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const [allActivities, setAllActivities] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [keepData, setKeepData] = useState(false);

  const [selectedStudents, setSelectedStudents] = useState([]);

  // Filtros
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem('captureFilters');
    return saved ? JSON.parse(saved) : DEFAULT_FILTERS;
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Periodo Académico — persisted in localStorage so Settings and CaptureForm share the same value
  const [currentPeriod, setCurrentPeriodState] = useState(
    () => localStorage.getItem('currentPeriod') || 'P1'
  );
  const setCurrentPeriod = (p) => {
    localStorage.setItem('currentPeriod', p);
    setCurrentPeriodState(p);
  };

  // Carga de historial de actividades
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
         // get history
         const { data: evs } = await supabase.from('evidences').select('activity_name').eq('teacher_id', session.user.id).order('capture_date', { ascending: false }).limit(100);
         if (evs) {
            const namesSet = new Set();
            evs.forEach(doc => { if(doc.activity_name) namesSet.add(doc.activity_name) });
            setAllActivities(Array.from(namesSet));
            setRecentActivities(Array.from(namesSet).slice(0, 5));
         }
      }
    });
    return () => authListener?.subscription.unsubscribe();
  }, []);

  useEffect(() => { localStorage.setItem('captureFilters', JSON.stringify(filters)); }, [filters]);

  // Schedule Brain: auto-fill context based on current day + time
  useEffect(() => {
    const raw = localStorage.getItem('weekSchedule');
    if (!raw) return;
    try {
      const schedule = JSON.parse(raw);
      const dayIndex = new Date().getDay() - 1; // Mon=0 … Fri=4
      if (dayIndex < 0 || dayIndex > 4) return; // weekend
      const blocks = schedule[dayIndex] || [];
      if (blocks.length === 0) return;
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const toMins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const current = blocks.find(b => nowMins >= toMins(b.startTime) && nowMins <= toMins(b.endTime));
      if (!current) return;
      // Auto-fill only if form is empty (don't overwrite user edits)
      setActivity(prev => prev || current.subject || '');
      handleFilterChange('grade', current.grade || 'Todos');
      handleFilterChange('section', current.section || 'Todos');
      handleFilterChange('shift', current.shift || 'Todos');
      toast(`📚 Auto: ${current.subject} · ${current.grade}${current.section ? ' ' + current.section : ''}`, {
        icon: '🗓️', duration: 3000,
        style: { fontSize: '0.75rem', fontWeight: '600' }
      });
    } catch (e) { /* ignore parse errors */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleActivityChange = (e) => {
    const val = e.target.value;
    setActivity(val);
    if (val.length > 1) {
      const matches = allActivities.filter(a => a.toLowerCase().includes(val.toLowerCase()));
      setSuggestions(matches);
    } else { setSuggestions([]); }
  };

  const selectActivity = (name) => { setActivity(name); setSuggestions([]); };

  const toggleTag = (tag) => { if (tags.includes(tag)) setTags(prev => prev.filter(t => t !== tag)); else setTags(prev => [...prev, tag]); };

  const handleFilterChange = (field, value) => setFilters(prev => ({ ...prev, [field]: value }));

  const handleFilesChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;
    const validFiles = [];
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
    selectedFiles.forEach(file => {
      if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE) toast.error(`Video pesado ignorado.`);
      else validFiles.push(file);
    });
    setFiles(prev => [...prev, ...validFiles]);
    e.target.value = "";
  };

  const removeFile = (index) => setFiles(prev => prev.filter((_, i) => i !== index));

  const saveEvidence = async (e) => {
    e.preventDefault();
    if (files.length === 0 || !activity) return toast.error("Falta foto/video o actividad");
    setLoading(true);
    const loadingToast = toast.loading(`Subiendo ${files.length} archivos...`);
    
    // get user id
    const { data: { session } } = await supabase.auth.getSession();
    if(!session?.user) {
        toast.error("Unauthenticated");
        setLoading(false);
        return;
    }

    try {
      const now = new Date();
      const [year, month, day] = customDate.split('-').map(Number);
      const finalDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes());

      let count = 0;
      for (const file of files) {
        count++;
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
          try {
            // useWebWorker:false — Web Workers fail silently in Vite production builds
            const compressionPromise = imageCompression(file, {
              maxSizeMB: 0.8,
              maxWidthOrHeight: 1280,
              useWebWorker: false,
            });
            // 15s timeout so a failed compression never blocks the upload
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 15000)
            );
            fileToUpload = await Promise.race([compressionPromise, timeoutPromise]);
          } catch (err) {
            console.warn('Image compression skipped:', err.message);
            fileToUpload = file; // use original file if compression fails
          }
        }

        const isSchoolMode = captureContext === 'school';

        const docData = {
          activityName: activity,
          comment: comment,
          studentIds: selectedStudents,
          date: finalDate, // Date object
          grade: isSchoolMode ? 'General' : (filters.grade === 'Todos' ? 'Varios' : filters.grade),
          section: isSchoolMode ? 'General' : (filters.section === 'Todos' ? 'Varios' : filters.section),
          level: isSchoolMode ? 'Institucional' : filters.level,
          tags: [...tags, isSchoolMode ? 'Evento Escolar' : 'Clase'],
          performance: performance,
          period: currentPeriod
        };

        if (!navigator.onLine) {
          await saveOffline(fileToUpload, docData);
        } else {
          await EvidenceService.uploadAndCreate(fileToUpload, docData, session.user.id);
        }
      }
      toast.success("¡Guardado!", { id: loadingToast });
      if (keepData) { setFiles([]); setSelectedStudents([]); }
      else { setActivity(''); setComment(''); setPerformance(''); setFiles([]); setSelectedStudents([]); setTags([]); }
    } catch (error) { toast.error("Error: " + error.message, { id: loadingToast }); } finally { setLoading(false); }
  };

  return {
    captureContext, setCaptureContext,
    activity, setActivity, handleActivityChange, selectActivity,
    comment, setComment,
    tags, toggleTag,
    performance, setPerformance,
    customDate, setCustomDate,
    files, setFiles, handleFilesChange, removeFile,
    loading,
    previewFile, setPreviewFile,
    allActivities, suggestions, setSuggestions, recentActivities,
    keepData, setKeepData,
    selectedStudents, setSelectedStudents,
    filters, handleFilterChange,
    searchTerm, setSearchTerm,
    saveEvidence,
    currentPeriod,
    setCurrentPeriod
  };
}
