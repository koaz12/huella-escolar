// src/pages/AdminDashboard.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { Users, School, ShieldAlert, Copy, Check, User, Crown, BookOpen, BarChart2 } from 'lucide-react';
import { Card } from '../components/UI/Card';
import toast from 'react-hot-toast';

export function AdminDashboard() {
  const { userProfile } = useAuth();
  const [schoolData, setSchoolData] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ students: 0, evidences: 0 });

  useEffect(() => {
    if (!userProfile?.school_id) { setLoading(false); return; }

    const fetchDashboardData = async () => {
      try {
        const { data: school } = await supabase
          .from('schools')
          .select('*')
          .eq('id', userProfile.school_id)
          .single();
        setSchoolData(school);

        const { data: staff } = await supabase
          .from('teachers')
          .select('*')
          .eq('school_id', userProfile.school_id);
        setTeachers(staff || []);

        // School-wide stats
        const teacherIds = (staff || []).map(t => t.id);
        if (teacherIds.length > 0) {
          const { count: evCount } = await supabase
            .from('evidences')
            .select('id', { count: 'exact', head: true })
            .in('teacher_id', teacherIds);

          const { count: stuCount } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .in('teacher_id', teacherIds);

          setStats({ students: stuCount || 0, evidences: evCount || 0 });
        }
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [userProfile]);

  const copyInviteCode = () => {
    navigator.clipboard.writeText(userProfile.school_id);
    setCopied(true);
    toast.success('Código copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!userProfile) return null;

  if (userProfile.role !== 'admin' && userProfile.role !== 'principal') {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
          <ShieldAlert size={40} className="text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0">Acceso Restringido</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs m-0">
          Esta sección es exclusiva para directores y administradores del Centro Educativo.
        </p>
        <div className="mt-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-bold text-slate-400 uppercase tracking-widest">
          Rol actual: {userProfile.role || 'docente'}
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
      <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
    </div>
  );

  return (
    <div className="pb-20 flex flex-col gap-4">

      {/* SCHOOL HEADER */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 flex items-center gap-4 shadow-lg shadow-blue-500/20">
        <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0">
          <School size={28} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white m-0 mb-0.5 truncate">
            {schoolData?.name || 'Centro Educativo'}
          </h1>
          <p className="text-sm text-blue-200 m-0 truncate">{schoolData?.city || 'Portal Administrativo'}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end">
          <Crown size={18} className="text-amber-300 mb-1" />
          <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">{userProfile.role}</span>
        </div>
      </div>

      {/* SCHOOL STATS */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Docentes',   value: teachers.length, icon: Users,     color: 'blue' },
          { label: 'Alumnos',    value: stats.students,  icon: User,      color: 'indigo' },
          { label: 'Evidencias', value: stats.evidences, icon: BookOpen,  color: 'violet' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`bg-${color}-50 dark:bg-${color}-500/10 border border-${color}-100 dark:border-${color}-500/20 rounded-2xl p-3.5 text-center`}>
            <Icon size={18} className={`mx-auto mb-1.5 text-${color}-500 dark:text-${color}-400`} />
            <div className={`text-2xl font-extrabold text-${color}-700 dark:text-${color}-300`}>{value}</div>
            <div className="text-[10px] font-medium text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* INVITE SECTION */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Invitar Docentes</h3>
        <p className="text-xs text-slate-400 mb-3">Comparte este código para que otros docentes se unan a tu centro.</p>
        <button
          onClick={copyInviteCode}
          className="w-full flex items-center justify-between gap-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-xl text-slate-700 dark:text-slate-300 font-mono text-xs hover:border-blue-400 transition-colors cursor-pointer"
        >
          <span className="truncate opacity-60">{userProfile.school_id}</span>
          <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${copied ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-200 dark:bg-white/10'}`}>
            {copied ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} className="text-slate-500" />}
          </div>
        </button>
      </div>

      {/* TEACHERS LIST */}
      <Card title={`Equipo Docente (${teachers.length})`} icon={Users}>
        <div className="flex flex-col gap-2">
          {teachers.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aún no hay docentes vinculados.</p>
            </div>
          )}
          {teachers.map(t => (
            <div key={t.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${t.id === userProfile.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${t.id === userProfile.id ? 'border-blue-300 dark:border-blue-500 bg-blue-100 dark:bg-blue-500/20' : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800'}`}>
                  <User size={17} className={t.id === userProfile.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {t.full_name || 'Docente'}
                    {t.id === userProfile.id && <span className="ml-1.5 text-[9px] font-bold text-blue-500 uppercase tracking-wider">Tú</span>}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[160px]">{t.email || t.id}</div>
                </div>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide ${t.role === 'admin' || t.role === 'principal' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>
                {t.role || 'docente'}
              </span>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}
