// src/pages/Onboarding.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { School, User, KeyRound, ArrowRight, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

export function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(null); // 'personal', 'center', 'join'
  
  // States for Center Registration
  const [centerName, setCenterName] = useState('');
  const [centerCity, setCenterCity] = useState('');

  // States for Joining
  const [inviteCode, setInviteCode] = useState('');

  const handleCreatePersonalSpace = async () => {
    setLoading(true);
    const toastId = toast.loading('Creando tu espacio personal...');
    try {
      // 1. Create a "Personal School"
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .insert({ name: `Espacio de ${user.user_metadata?.full_name || 'Profesor'}`, city: 'Personal' })
        .select()
        .single();
        
      if (schoolError) throw schoolError;

      // 2. Link teacher to this school as admin
      const { error: teacherError } = await supabase
        .from('teachers')
        .update({ school_id: school.id, role: 'admin' })
        .eq('id', user.id);

      if (teacherError) throw teacherError;

      toast.success('¡Espacio creado!', { id: toastId });
      window.location.reload(); // Reload to refresh auth context state
    } catch (error) {
      toast.error(error.message, { id: toastId });
      setLoading(false);
    }
  };

  const handleCreateCenter = async (e) => {
    e.preventDefault();
    if (!centerName) return toast.error('El nombre es requerido');
    
    setLoading(true);
    const toastId = toast.loading('Registrando Centro Educativo...');
    try {
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .insert({ name: centerName, city: centerCity })
        .select()
        .single();
        
      if (schoolError) throw schoolError;

      const { error: teacherError } = await supabase
        .from('teachers')
        .update({ school_id: school.id, role: 'principal' })
        .eq('id', user.id);

      if (teacherError) throw teacherError;

      toast.success('¡Centro Educativo Registrado!', { id: toastId });
      window.location.reload();
    } catch (error) {
      toast.error(error.message, { id: toastId });
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    const code = inviteCode.trim();
    if (!code) return toast.error('Ingresa el código de invitación');
    setLoading(true);
    const toastId = toast.loading('Verificando código...');
    try {
      // Validate that the school exists
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id, name')
        .eq('id', code)
        .single();

      if (schoolError || !school) {
        toast.error('Código inválido. Verifica que sea correcto.', { id: toastId });
        setLoading(false);
        return;
      }

      // Link teacher to this school as a regular teacher
      const { error: teacherError } = await supabase
        .from('teachers')
        .update({ school_id: school.id, role: 'teacher' })
        .eq('id', user.id);

      if (teacherError) throw teacherError;

      toast.success(`¡Te uniste a ${school.name}!`, { id: toastId });
      window.location.reload();
    } catch (error) {
      toast.error(error.message || 'Error al unirse', { id: toastId });
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] bg-[#0f172a] font-sans flex flex-col items-center justify-center p-6 overflow-hidden text-slate-200">
      
      {/* Animated Mesh Gradient Background (same as Login) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/20 rounded-full blur-[100px] animate-blob"></div>
      <div className="absolute top-[20%] right-[10%] w-[40vw] h-[40vw] bg-purple-600/20 rounded-full blur-[80px] animate-blob animation-delay-4000"></div>

      <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] rounded-3xl p-8 animate-fade-in-up">
        
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-8 gap-3">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center shadow-lg mb-2">
            <Activity size={32} className="text-blue-400" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 tracking-tight m-0 mb-2">
              Configura tu Entorno
            </h1>
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              ¿Cómo vas a utilizar Huella Escolar el día de hoy, {user.user_metadata?.full_name?.split(' ')[0] || 'Docente'}?
            </p>
          </div>
        </div>

        {/* Mode Selection */}
        {!mode && (
          <div className="flex flex-col gap-4">
            <button onClick={() => handleCreatePersonalSpace()} disabled={loading} className="group relative w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 shadow-[0_4px_16px_0_rgba(31,38,135,0.1)] rounded-2xl transition-all duration-300 flex items-center gap-4 text-left cursor-pointer overflow-hidden backdrop-blur-md">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
                <User size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-100 m-0">Soy Docente Independiente</h3>
                <p className="text-xs text-slate-400 font-medium m-0 mt-1">Crear un espacio privado solo para mí.</p>
              </div>
              <ArrowRight className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>

            <button onClick={() => setMode('center')} disabled={loading} className="group relative w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 shadow-[0_4px_16px_0_rgba(31,38,135,0.1)] rounded-2xl transition-all duration-300 flex items-center gap-4 text-left cursor-pointer overflow-hidden backdrop-blur-md">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors shrink-0">
                <School size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-100 m-0">Registrar Centro Educativo</h3>
                <p className="text-xs text-slate-400 font-medium m-0 mt-1">Para directores o coordinadores.</p>
              </div>
              <ArrowRight className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>

            <button onClick={() => setMode('join')} disabled={loading} className="group relative w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 shadow-[0_4px_16px_0_rgba(31,38,135,0.1)] rounded-2xl transition-all duration-300 flex items-center gap-4 text-left cursor-pointer overflow-hidden backdrop-blur-md">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors shrink-0">
                <KeyRound size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-100 m-0">Tengo un Código</h3>
                <p className="text-xs text-slate-400 font-medium m-0 mt-1">Unirme a un colegio ya existente.</p>
              </div>
              <ArrowRight className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        )}

        {/* Center Registration Mode */}
        {mode === 'center' && (
          <form onSubmit={handleCreateCenter} className="animate-fade-in flex flex-col gap-5">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Nombre del Centro Institucional</label>
              <input 
                autoFocus
                type="text" 
                value={centerName} 
                onChange={e => setCenterName(e.target.value)} 
                placeholder="Ej: Unidad Educativa San Francisco"
                className="w-full p-3.5 rounded-xl border border-white/20 bg-white/5 text-slate-100 placeholder:text-slate-500 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all font-medium shadow-inner"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Ciudad <span className="text-slate-600">(Opcional)</span></label>
              <input 
                type="text" 
                value={centerCity} 
                onChange={e => setCenterCity(e.target.value)} 
                placeholder="Ej: Quito"
                className="w-full p-3.5 rounded-xl border border-white/20 bg-white/5 text-slate-100 placeholder:text-slate-500 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all font-medium shadow-inner"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setMode(null)} className="flex-1 p-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-bold transition-all backdrop-blur-sm cursor-pointer child:cursor-pointer">Atrás</button>
              <button type="submit" disabled={loading} className="flex-[2] p-3.5 rounded-xl border border-transparent bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold transition-all shadow-lg cursor-pointer">
                {loading ? 'Procesando...' : 'Crear Centro'}
              </button>
            </div>
          </form>
        )}

        {/* Join by Code Mode */}
        {mode === 'join' && (
          <div className="animate-fade-in flex flex-col gap-5">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block text-center">Código de Invitación</label>
              <input 
                autoFocus
                type="text" 
                value={inviteCode} 
                onChange={e => setInviteCode(e.target.value)} 
                placeholder="A8F9-KL2P"
                className="w-full p-4 rounded-xl border border-white/20 bg-white/5 text-slate-100 placeholder:text-slate-600 backdrop-blur-sm focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all font-mono text-center text-2xl tracking-[0.2em] shadow-inner uppercase font-bold"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setMode(null)} className="flex-1 p-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-bold transition-all backdrop-blur-sm cursor-pointer">Atrás</button>
              <button type="button" onClick={handleJoinByCode} disabled={!inviteCode || loading} className="flex-[2] p-3.5 rounded-xl border border-transparent bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white font-bold transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:grayscale">
                {loading ? 'Verificando...' : 'Unirse al Centro'}
              </button>
            </div>
          </div>
        )}

      </div>
        <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 10s infinite alternate; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}
