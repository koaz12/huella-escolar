// src/hooks/useFolders.js
//
// LÓGICA DE CARPETAS — cómo funciona:
// ─────────────────────────────────────────────────────────────────────────────
// Una "carpeta" es un TEMPLATE guardado en localStorage con metadata
// (nombre, período, nivel, tanda, grado, sección).
//
// El vínculo con las evidencias se hace por NOMBRE:
//   1. Al capturar → el docente selecciona una carpeta → el formulario usa su
//      nombre como "activityName" de la evidencia guardada en Supabase.
//   2. En la Galería → las evidencias se agrupan por "activityName".
//      Si existe una carpeta con ese mismo nombre, aparece como chip selectable.
//      Tocar el chip filtra la galería para mostrar solo esas evidencias.
//
// Resumen: Carpeta (localStorage) → nombre → activityName (Supabase evidence)
// ─────────────────────────────────────────────────────────────────────────────

const KEY = 'huellaFolders';

export function useFolders() {
    const load = () => {
        try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
        catch { return []; }
    };

    const save = (folders) => localStorage.setItem(KEY, JSON.stringify(folders));

    const getFolders = () => load();

    const createFolder = ({ name, period, level, shift, grade, section }) => {
        if (!name?.trim()) throw new Error('El nombre de la carpeta es requerido');
        const all = load();
        if (all.some(f => f.name.trim().toLowerCase() === name.trim().toLowerCase())) {
            throw new Error('Ya existe una carpeta con ese nombre');
        }
        const folder = {
            id: `folder_${Date.now()}`,
            name: name.trim(),
            period: period || 'P1',
            level: level || '',
            shift: shift || '',
            grade: grade || '',
            section: section || '',
            createdAt: new Date().toISOString(),
        };
        save([...all, folder]);
        return folder;
    };

    const updateFolder = (id, changes) => {
        const all = load();
        const updated = all.map(f => f.id === id ? { ...f, ...changes } : f);
        save(updated);
        return updated.find(f => f.id === id);
    };

    const deleteFolder = (id) => save(load().filter(f => f.id !== id));

    return { getFolders, createFolder, updateFolder, deleteFolder };
}
