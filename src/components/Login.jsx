// src/components/Login.jsx
import { useState } from 'react';
import { Activity, ShieldCheck, Zap, CloudOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { login } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await login();
    } catch (error) {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 overflow-hidden bg-[#0f172a] font-sans">
      
      {/* Animated Mesh Gradient Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/30 rounded-full blur-[100px] animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-purple-600/30 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
      <div className="absolute top-[20%] right-[10%] w-[40vw] h-[40vw] bg-indigo-500/20 rounded-full blur-[80px] animate-blob animation-delay-4000"></div>

      {/* Main Glassmorphic Container */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-8 animate-fade-in-up">
        
        {/* Logo Section */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] animate-float">
            <Activity size={40} className="text-blue-400" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="m-0 text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 tracking-tight">
              Huella Escolar
            </h1>
            <p className="mt-2 text-sm text-slate-300 font-medium max-w-[250px] leading-relaxed">
              El entorno inteligente para la gestión de tus evidencias educativas.
            </p>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="flex flex-wrap justify-center gap-2 mt-2 w-full">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-semibold text-slate-200 backdrop-blur-md shadow-sm">
                <ShieldCheck size={14} className="text-emerald-400"/> Privado
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-semibold text-slate-200 backdrop-blur-md shadow-sm">
                <Zap size={14} className="text-amber-400"/> Rápido
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-semibold text-slate-200 backdrop-blur-md shadow-sm">
                <CloudOff size={14} className="text-rose-400"/> Offline
            </span>
        </div>

        {/* Action Section */}
        <div className="w-full mt-4">
          <button 
            onClick={handleLogin} 
            disabled={isLoggingIn} 
            className="group relative w-full flex items-center justify-center gap-3 p-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-white text-sm font-bold cursor-pointer backdrop-blur-lg shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 overflow-hidden"
          >
            {/* Glossy overlay effect built-in to hover state via bg-white/20 */}
            
            {isLoggingIn ? (
               <div className="w-5 h-5 border-2 border-slate-300/30 border-t-white rounded-full animate-spin"></div>
            ) : (
               <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shrink-0">
                 <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
               </div>
            )}
            <span className="group-hover:translate-x-1 transition-transform duration-300">
              {isLoggingIn ? 'Iniciando sesión...' : 'Continuar con Google'}
            </span>
          </button>
        </div>

        <p className="text-center text-[10px] text-slate-500 font-medium tracking-wide">
          SaaS V2.0 • BY ERICK MORETA
        </p>

      </div>

      <style>{`
        @keyframes float { 
          0%, 100% { transform: translateY(0px) rotate(0deg); } 
          50% { transform: translateY(-12px) rotate(2deg); } 
        } 
        .animate-float { animation: float 4s ease-in-out infinite; }
        
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 10s infinite alternate; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}