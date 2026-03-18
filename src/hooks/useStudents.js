// src/hooks/useStudents.js
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import toast from 'react-hot-toast';
import { StudentService } from '../services/studentService';

export function useStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let subscription = null;

    const fetchStudents = async (userId) => {
        try {
            const { data, error } = await supabase.from('students').select('*').eq('teacher_id', userId);
            if (error) throw error;
            
             data.sort((a, b) => {
              if (a.grade_name !== b.grade_name) return (a.grade_name || '').localeCompare(b.grade_name || '');
              if (a.section_name !== b.section_name) return (a.section_name || '').localeCompare(b.section_name || '');
              return (Number(a.list_number) || 0) - (Number(b.list_number) || 0);
            });
            
            const mapped = data.map(s => ({
                id: s.id,
                name: s.name,
                studentId: s.student_id,
                level: s.level_name,
                shift: s.shift_name,
                grade: s.grade_name,
                section: s.section_name,
                listNumber: s.list_number,
                birthDate: s.birth_date,
                photoUrl: s.photo_url
            }));
            
            setStudents(mapped);
            setLoading(false);
        } catch (e) {
            setError(e);
            setLoading(false);
        }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
         fetchStudents(session.user.id);
         
         subscription = supabase.channel('students_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'students', filter: `teacher_id=eq.${session.user.id}` }, payload => {
                fetchStudents(session.user.id);
            })
            .subscribe();
            
      } else {
        setStudents([]);
        setLoading(false);
        if (subscription) supabase.removeChannel(subscription);
      }
    });

    return () => {
        authListener?.subscription.unsubscribe();
        if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  const addStudent = async (studentData) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      try {
          await StudentService.create(studentData, session.user.id, session.user.email);
          toast.success("Alumno agregado");
      } catch (e) {
          toast.error("Error al agregar");
      }
  };

  const updateStudent = async (id, data) => {
     try {
          await StudentService.update(id, data);
          toast.success("Alumno actualizado");
      } catch (e) {
          toast.error("Error al actualizar");
      }
  };

  const deleteStudent = async (id) => {
      if (!confirm("¿Eliminar alumno? Se perderá su asociación a las evidencias.")) return;
       try {
          await StudentService.delete(id);
          toast.success("Alumno eliminado");
      } catch (e) {
          toast.error("Error al eliminar");
      }
  };

  return { students, loading, error, addStudent, updateStudent, deleteStudent };
}