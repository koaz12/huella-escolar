// src/components/SyncStatus.jsx
import { useState, useEffect } from 'react';
import { dbLocal, getPendingUploads, deletePendingUpload } from '../db';
import { supabase } from '../supabase';
import { RefreshCw, CloudOff, CheckCircle, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

export function SyncStatus() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const updateCount = async () => {
      const count = await dbLocal.pendingUploads.count();
      setPendingCount(count);
    };

    const interval = setInterval(updateCount, 5000);
    updateCount();

    const handleOnline = () => { setIsOnline(true); syncNow(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncNow = async () => {
    if (isSyncing || !navigator.onLine) return;

    const items = await getPendingUploads();
    if (items.length === 0) return;

    setIsSyncing(true);
    const toastId = toast.loading(`Sincronizando ${items.length} evidencias...`);

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || 'anon';

    try {
      let successCount = 0;

      for (const item of items) {
        try {
          const fileName = `${userId}/${item.timestamp}_${item.file.name}`;
          const { error: uploadError } = await supabase.storage.from('evidencias').upload(fileName, item.file);
          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage.from('evidencias').getPublicUrl(fileName);
          const downloadURL = publicUrlData.publicUrl;

          const finalData = {
            teacher_id: userId,
            activity_name: item.metadata.activityName,
            comment: item.metadata.comment,
            performance: item.metadata.performance || null,
            file_url: downloadURL,
            file_type: item.file.type.startsWith('video/') ? 'video' : 'image',
            period: item.metadata.period,
            grade_tag: item.metadata.grade,
            section_tag: item.metadata.section,
            level_tag: item.metadata.level,
            tags: item.metadata.tags || [],
            capture_date: new Date(item.metadata.date || Date.now()).toISOString()
          };

          const { data: insertedEvidence, error: insertError } = await supabase
            .from('evidences').insert(finalData).select().single();

          if (insertError) throw insertError;

          if (item.metadata.studentIds?.length > 0) {
            const mappings = item.metadata.studentIds.map(stId => ({
              evidence_id: insertedEvidence.id,
              student_id: stId
            }));
            await supabase.from('evidence_students').insert(mappings);
          }

          await deletePendingUpload(item.id);
          successCount++;

        } catch (err) {
          console.error('Error subiendo item:', err);
        }
      }

      if (successCount > 0) {
        toast.success(`¡${successCount} evidencias subidas!`, { id: toastId });
        setPendingCount(prev => prev - successCount);
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3000);
      } else {
        toast.error('Error de sincronización', { id: toastId });
      }
    } catch (error) {
      console.error('Error crítico sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (pendingCount === 0 && !justSynced) return null;

  // Just synced success state
  if (justSynced && pendingCount === 0) return (
    <div className="mb-4 flex items-center gap-2.5 px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl animate-fade-in">
      <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">¡Sincronización completada!</span>
    </div>
  );

  return (
    <div className={`mb-4 px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 animate-fade-in ${
      isOnline
        ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20'
        : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isOnline ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-amber-100 dark:bg-amber-500/20'
        }`}>
          {isSyncing
            ? <RefreshCw size={16} className="text-blue-600 dark:text-blue-400 animate-spin" />
            : isOnline
              ? <Upload size={16} className="text-blue-600 dark:text-blue-400" />
              : <CloudOff size={16} className="text-amber-600 dark:text-amber-400" />
          }
        </div>
        <div>
          <div className={`font-bold text-sm ${isOnline ? 'text-blue-800 dark:text-blue-200' : 'text-amber-800 dark:text-amber-200'}`}>
            {isSyncing ? 'Subiendo a la nube...' : isOnline ? 'Listo para sincronizar' : 'Sin conexión'}
          </div>
          <div className={`text-xs ${isOnline ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {pendingCount} {pendingCount === 1 ? 'archivo pendiente' : 'archivos pendientes'}
          </div>
        </div>
      </div>

      {isOnline && !isSyncing && (
        <button
          onClick={syncNow}
          className="shrink-0 px-3 py-1.5 rounded-xl border-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
        >
          <Upload size={12} /> Subir
        </button>
      )}
    </div>
  );
}