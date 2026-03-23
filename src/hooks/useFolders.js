// src/hooks/useFolders.js
// Carpetas manuales con metadata: nombre, período, nivel, tanda, grado, sección
// Guardadas en localStorage, sin necesidad de migración en DB.
// La "carpeta" se materializa como el activityName al capturar.

const KEY = 'huellaFolders';

export function useFolders() {
    const load = () => {
        try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
        catch { return []; }
    };

    const save = (folders) => {
        localStorage.setItem(KEY, JSON.stringify(folders));
    };

    const getFolders = () => load();

    const createFolder = ({ name, period, level, shift, grade, section }) => {
        if (!name) throw new Error('El nombre de la carpeta es requerido');
        const folders = load();
        const id = `folder_${Date.now()}`;
        const newFolder = { id, name, period: period || 'P1', level: level || '', shift: shift || '', grade: grade || '', section: section || '', createdAt: new Date().toISOString() };
        save([...folders, newFolder]);
        return newFolder;
    };

    const deleteFolder = (id) => {
        save(load().filter(f => f.id !== id));
    };

    return { getFolders, createFolder, deleteFolder };
}
