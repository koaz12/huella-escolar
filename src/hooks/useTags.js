import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import toast from 'react-hot-toast';

export function useTags() {
    const [availableTags, setAvailableTags] = useState([]);
    const [loadingTags, setLoadingTags] = useState(true);

    useEffect(() => {
        let subscription = null;
        
        const fetchTags = async (userId) => {
            const { data, error } = await supabase.from('teacher_tags').select('name').eq('teacher_id', userId);
            if (error) {
                console.error(error);
            } else {
                if (data.length === 0) {
                     const defaults = ['Importante', 'Tarea', 'Examen', 'Conducta', 'Participación'].map(t => ({
                         teacher_id: userId,
                         name: t
                     }));
                     await supabase.from('teacher_tags').insert(defaults);
                     setAvailableTags(['Importante', 'Tarea', 'Examen', 'Conducta', 'Participación']);
                } else {
                    setAvailableTags(data.map(d => d.name));
                }
            }
            setLoadingTags(false);
        };

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                fetchTags(session.user.id);
                subscription = supabase.channel('tags_channel')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_tags', filter: `teacher_id=eq.${session.user.id}` }, payload => {
                        fetchTags(session.user.id);
                    })
                    .subscribe();
            } else {
                setAvailableTags([]);
                setLoadingTags(false);
                if (subscription) supabase.removeChannel(subscription);
            }
        });

        return () => {
            authListener?.subscription.unsubscribe();
            if (subscription) supabase.removeChannel(subscription);
        };
    }, []);

    const addTag = async (newTag) => {
        if (!newTag.trim()) return;
        const tag = newTag.trim();
        if (availableTags.includes(tag)) return toast.error('La etiqueta ya existe');
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        try {
            const { error } = await supabase.from('teacher_tags').insert({ teacher_id: session.user.id, name: tag });
            if (error) throw error;
            toast.success('Etiqueta creada');
        } catch (error) {
            console.error("Error adding tag:", error);
            toast.error('Error al crear etiqueta');
        }
    };

    const deleteTag = async (tagToDelete) => {
        if (!confirm(`¿Eliminar etiqueta "${tagToDelete}"?`)) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        try {
            const { error } = await supabase.from('teacher_tags').delete().eq('teacher_id', session.user.id).eq('name', tagToDelete);
            if (error) throw error;
            toast.success('Etiqueta eliminada');
        } catch (error) {
            console.error("Error deleting tag:", error);
            toast.error('Error al eliminar etiqueta');
        }
    };

    return { availableTags, loadingTags, addTag, deleteTag };
}
