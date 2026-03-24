// src/App.jsx
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import {
    Camera, Users, Image as ImageIcon, LogOut, CloudOff, Moon, Sun,
    Settings as SettingsIcon, ShieldAlert, BarChart2, House, CalendarDays,
    UserCircle, ChevronRight, X
} from 'lucide-react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

import { Login } from './components/Login';
import { CaptureForm } from './components/CaptureForm';
import { SyncStatus } from './components/SyncStatus';
import { StudentForm } from './components/StudentForm';
import { EvidenceList } from './components/EvidenceList';
import { Settings } from './pages/Settings';
import { StudentProfile } from './pages/StudentProfile';
import { Onboarding } from './pages/Onboarding';
import { AdminDashboard } from './pages/AdminDashboard';
import { StatsPage } from './pages/StatsPage';
import { SchedulePage } from './pages/SchedulePage';
import { Home } from './pages/Home';
import { useAuth } from './context/AuthContext';

function App() {
  const { user, userProfile, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [darkMode, setDarkMode] = useState(() => {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    return isDark;
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleLogout = async () => {
    if (confirm('¿Cerrar sesión?')) {
      setShowProfileMenu(false);
      await logout();
    }
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Docente';
  const roleLabel =
    userProfile?.role === 'admin' ? 'Administrador' :
    userProfile?.role === 'principal' ? 'Director' : 'Docente';

  if (!user) return <Login />;
  if (userProfile === undefined)
    return <div className="h-[100dvh] w-full flex items-center justify-center bg-primary text-secondary">Cargando perfil...</div>;
  if (userProfile && !userProfile.school_id) return <Onboarding />;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative transition-colors duration-300 bg-slate-50 dark:bg-[#0b1120]">
      <Toaster position="top-center" toastOptions={{ className: 'bg-card text-primary' }} />

      {/* ── HEADER ── */}
      <div className="fixed top-0 left-0 right-0 flex justify-between items-center px-5 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-md">
            <Camera size={16} className="text-white" />
          </div>
          <div>
            <h2 className="m-0 text-lg font-extrabold text-slate-800 dark:text-white tracking-tight leading-none">Huella Escolar</h2>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Hola, {firstName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-full border border-slate-200 dark:border-white/10">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full hover:bg-white dark:hover:bg-white/10 transition-colors text-slate-600 dark:text-slate-300"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="w-px h-5 bg-slate-300 dark:bg-white/10 mx-1" />
          {/* Profile icon opens bottom sheet */}
          <button
            onClick={() => setShowProfileMenu(true)}
            className="p-2 rounded-full hover:bg-white dark:hover:bg-white/10 transition-colors text-slate-600 dark:text-slate-300"
          >
            <UserCircle size={22} />
          </button>
        </div>
      </div>

      {/* ── OFFLINE BAR ── */}
      {!isOnline && (
        <div className="bg-gradient-to-r from-rose-500 to-orange-500 text-white p-2.5 text-center text-xs font-bold flex items-center justify-center gap-2 flex-shrink-0 animate-fade-in shadow-inner">
          <CloudOff size={16} /> <span>Modo Offline Activado. Guardando localmente.</span>
        </div>
      )}

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pt-[85px] pb-24 relative">
        <div className="container max-w-2xl mx-auto">
          {isOnline && <SyncStatus />}
          <Routes>
            <Route path="/"           element={<Navigate to="/home" replace />} />
            <Route path="/home"       element={<Home />} />
            <Route path="/capture"    element={<CaptureForm />} />
            <Route path="/students"   element={<StudentForm />} />
            <Route path="/gallery"    element={<EvidenceList />} />
            <Route path="/stats"      element={<StatsPage />} />
            <Route path="/schedule"   element={<SchedulePage />} />
            <Route path="/settings"   element={<Settings />} />
            <Route path="/student/:id" element={<StudentProfile />} />
            <Route path="/admin"      element={<AdminDashboard />} />
          </Routes>
        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-2" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="pointer-events-auto flex items-center justify-around bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-b-0 border-slate-200 dark:border-white/10 rounded-t-2xl shadow-[0_-4px_24px_0_rgba(31,38,135,0.07)] dark:shadow-[0_-4px_24px_0_rgba(0,0,0,0.5)] w-full max-w-md p-2 mx-auto gap-1">
          <NavButton icon={<House size={22} />}        label="Inicio"   active={location.pathname === '/home'}     onClick={() => navigate('/home')} />
          <NavButton icon={<Camera size={22} />}       label="Captura"  active={location.pathname === '/capture'}  onClick={() => navigate('/capture')} />
          <NavButton icon={<ImageIcon size={22} />}    label="Galería"  active={location.pathname === '/gallery'}  onClick={() => navigate('/gallery')} />
          <NavButton icon={<CalendarDays size={22} />} label="Horario"  active={location.pathname === '/schedule'} onClick={() => navigate('/schedule')} />
          <NavButton icon={<Users size={22} />}        label="Alumnos"  active={location.pathname === '/students'} onClick={() => navigate('/students')} />
          {(userProfile?.role === 'admin' || userProfile?.role === 'principal') && (
            <NavButton icon={<ShieldAlert size={22} />} label="Admin" active={location.pathname === '/admin'} onClick={() => navigate('/admin')} />
          )}
        </div>
      </div>

      {/* ── PROFILE BOTTOM SHEET ── */}
      {showProfileMenu && (
        <div className="fixed inset-0 z-[200] flex items-end" onClick={() => setShowProfileMenu(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl p-5 pb-10 flex flex-col gap-2"
            style={{ animation: 'slideUp 0.25s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            {/* drag handle */}
            <div className="w-10 h-1 bg-slate-200 dark:bg-white/20 rounded-full mx-auto mb-2" />

            {/* Account info card */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl mb-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow shrink-0">
                <UserCircle size={26} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-sm text-slate-800 dark:text-slate-100 truncate">
                  {user?.user_metadata?.full_name || firstName}
                </div>
                <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
                <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                  {roleLabel}
                </span>
              </div>
              <button onClick={() => setShowProfileMenu(false)} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer shrink-0">
                <X size={16} />
              </button>
            </div>

            <ProfileMenuItem
              icon={<SettingsIcon size={18} />}
              label="Ajustes"
              sub="Configuración y preferencias"
              color="text-slate-600 dark:text-slate-300"
              bg="bg-slate-100 dark:bg-white/5"
              onClick={() => { navigate('/settings'); setShowProfileMenu(false); }}
            />
            <ProfileMenuItem
              icon={<BarChart2 size={18} />}
              label="Estadísticas"
              sub="Ver progreso y métricas"
              color="text-orange-600 dark:text-orange-400"
              bg="bg-orange-50 dark:bg-orange-500/10"
              onClick={() => { navigate('/stats'); setShowProfileMenu(false); }}
            />
            {(userProfile?.role === 'admin' || userProfile?.role === 'principal') && (
              <ProfileMenuItem
                icon={<ShieldAlert size={18} />}
                label="Panel Admin"
                sub="Gestión de escuela"
                color="text-purple-600 dark:text-purple-400"
                bg="bg-purple-50 dark:bg-purple-500/10"
                onClick={() => { navigate('/admin'); setShowProfileMenu(false); }}
              />
            )}

            <div className="h-px bg-slate-100 dark:bg-white/10 my-1" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border-none cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
                <LogOut size={17} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <div className="font-bold text-sm text-rose-600 dark:text-rose-400">Cerrar sesión</div>
                <div className="text-[10px] text-rose-400">Salir de tu cuenta</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileMenuItem({ icon, label, sub, color, bg, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full p-3.5 rounded-2xl bg-transparent border-none cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
    >
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <span className={color}>{icon}</span>
      </div>
      <div className="flex-1">
        <div className={`font-bold text-sm ${color}`}>{label}</div>
        <div className="text-[10px] text-slate-400">{sub}</div>
      </div>
      <ChevronRight size={14} className="text-slate-300 shrink-0" />
    </button>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 flex flex-col items-center justify-center py-2.5 border-none bg-transparent cursor-pointer transition-all duration-300 rounded-xl overflow-hidden group ${
        active
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
      }`}
    >
      {active && <div className="absolute inset-0 bg-blue-50 dark:bg-blue-500/10 rounded-xl" />}
      <div className="relative z-10 transition-transform duration-300 group-active:scale-95">{icon}</div>
      <span className={`relative z-10 text-[10px] mt-1 transition-all ${active ? 'font-extrabold opacity-100' : 'font-medium opacity-80'}`}>{label}</span>
    </button>
  );
}

export default App;