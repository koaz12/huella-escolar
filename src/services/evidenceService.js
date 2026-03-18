// src/services/evidenceService.js
import { supabase } from '../supabase';

const COLLECTION_NAME = 'evidences';
const BUCKET_NAME = 'evidencias';

export const EvidenceService = {

  // 1. Subir archivo y Crear documento (Todo en uno)
  uploadAndCreate: async (file, data, userId) => {
    // A. Subir imagen/video a Storage
    const fileName = `${userId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file);
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    const downloadURL = publicUrlData.publicUrl;

    // B. Guardar en PostgreSQL
    const docData = {
      teacher_id: userId,
      activity_name: data.activityName,
      comment: data.comment,
      performance: data.performance || null,
      file_url: downloadURL,
      file_type: file.type.startsWith('video/') ? 'video' : 'image',
      period: data.period,
      grade_tag: data.grade,
      section_tag: data.section,
      level_tag: data.level,
      tags: data.tags || [],
      capture_date: data.date.toISOString(),
    };

    const { data: insertedEvidence, error: insertError } = await supabase
      .from(COLLECTION_NAME)
      .insert(docData)
      .select()
      .single();

    if (insertError) throw insertError;

    // C. Mapping
    if (data.studentIds && data.studentIds.length > 0) {
        const mappings = data.studentIds.map(stId => ({
            evidence_id: insertedEvidence.id,
            student_id: stId
        }));
        await supabase.from('evidence_students').insert(mappings);
    }

    return insertedEvidence;
  },

  // 2. Solo Crear documento (Para cuando ya tienes la URL o es offline sync)
  createDoc: async (data) => {
    const { data: inserted, error } = await supabase.from(COLLECTION_NAME).insert(data).select().single();
    // No manejamos evidence_students aqui por simplicidad de offline (se ajustaria luego si se requiere)
    if (error) throw error;
    return inserted;
  },

  // 3. Actualizar datos (comentarios, tags, semáforo)
  update: async (id, data) => {
    const payload = {};
    if (data.activityName !== undefined) payload.activity_name = data.activityName;
    if (data.comment !== undefined) payload.comment = data.comment;
    if (data.performance !== undefined) payload.performance = data.performance;
    
    // Make sure we have payload keys
    let updated;
    if (Object.keys(payload).length > 0) {
        const { data: u, error } = await supabase.from(COLLECTION_NAME).update(payload).eq('id', id).select().single();
        if (error) throw error;
        updated = u;
    }
    
    // update mapping if studentIds changed
    if (data.studentIds) {
        await supabase.from('evidence_students').delete().eq('evidence_id', id);
        if (data.studentIds.length > 0) {
             const mappings = data.studentIds.map(stId => ({ evidence_id: id, student_id: stId }));
             await supabase.from('evidence_students').insert(mappings);
        }
    }
    
    return updated || true;
  },

  // 4. Borrar (Elimina de BD y de la Nube)
  delete: async (id, fileUrl) => {
    if (fileUrl) {
      try {
        const urlObj = new URL(fileUrl);
        const pathParts = urlObj.pathname.split(`/${BUCKET_NAME}/`);
        if (pathParts.length > 1) {
            const path = pathParts[1];
            await supabase.storage.from(BUCKET_NAME).remove([path]);
        }
      } catch (e) {
        console.warn("Storage delete failed", e);
      }
    }
    const { error } = await supabase.from(COLLECTION_NAME).delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 5. Toggle Favorito
  toggleFavorite: async (id, currentStatus) => {
    const { data, error } = await supabase.from(COLLECTION_NAME).update({ is_favorite: !currentStatus }).eq('id', id);
    if (error) throw error;
    return data;
  }
};