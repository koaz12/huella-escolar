// src/services/studentService.js
import { supabase } from '../supabase';

const TABLE_NAME = 'students';

export const StudentService = {
  
  // Crear nuevo alumno
  create: async (studentData, userId, userEmail) => {
    const dataToSave = {
      teacher_id: userId,
      school_id: studentData.schoolId || null,
      student_id: studentData.studentId || null,
      name: studentData.name,
      level_name: studentData.level,
      shift_name: studentData.shift,
      grade_name: studentData.grade,
      section_name: studentData.section,
      list_number: Number(studentData.listNumber) || 0,
      birth_date: studentData.birthDate || null,
      photo_url: studentData.photoUrl || null
    };
    
    const { data, error } = await supabase.from(TABLE_NAME).insert(dataToSave).select().single();
    if (error) throw error;
    return data;
  },

  // Actualizar alumno existente
  update: async (id, studentData) => {
    const dataToUpdate = {
      name: studentData.name,
      level_name: studentData.level,
      shift_name: studentData.shift,
      grade_name: studentData.grade,
      section_name: studentData.section,
      list_number: Number(studentData.listNumber) || 0,
      birth_date: studentData.birthDate || null,
      updated_at: new Date().toISOString()
    };
    if (studentData.photoUrl !== undefined) dataToUpdate.photo_url = studentData.photoUrl;
    
    const { data, error } = await supabase.from(TABLE_NAME).update(dataToUpdate).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Borrar alumno
  delete: async (id) => {
    const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // Verificar duplicados (ID Estudiante)
  checkDuplicateId: async (studentId, userId, excludeId = null) => {
    if (!studentId) return false;
    
    let query = supabase.from(TABLE_NAME).select('id').eq('teacher_id', userId).eq('student_id', studentId);
    
    const { data, error } = await query;
    if (error) throw error;
    
    if (data.length > 0 && excludeId) {
      if (data[0].id === excludeId) return false;
    }
    return data.length > 0;
  }
};