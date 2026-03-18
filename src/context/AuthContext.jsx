// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import toast from 'react-hot-toast';

// 1. Crear el contexto (la "nube" de datos)
const AuthContext = createContext();

// 2. Hook personalizado para usarlo fácil
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return context;
};

// 3. El Proveedor (El componente que envuelve la App)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Función Login (OAuth Google de Supabase)
  const login = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        // Opcional: Para forzar la selección de cuenta
        options: {
          queryParams: {
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
      // El toast quizás no se vea porque redirige inmediatamente.
    } catch (error) {
      console.error(error);
      toast.error('Error al iniciar sesión con Google');
    }
  };

  // Función Logout
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Sesión cerrada');
    } catch (error) {
      toast.error('Error al salir');
    }
  };

  // Escuchar cambios de sesión
  useEffect(() => {
    let isMounted = true;

    // Función para cargar perfil completo del profe
    const fetchUserProfile = async (userId) => {
      try {
        const { data, error } = await supabase.from('teachers').select('*').eq('id', userId).single();
        if (!isMounted) return;
        if (error) {
          // 500 means DB issue (missing columns, bad RLS policy), don't crash the app
          console.error('Error fetching teacher profile:', error.message, error.code);
          setUserProfile(null);
        } else {
          setUserProfile(data || null);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Unexpected error fetching profile:', err);
        setUserProfile(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Verificar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      if (session?.user) fetchUserProfile(session.user.id);
      else setLoading(false);
    });

    // Escuchar cambios futuros
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      if (session?.user) fetchUserProfile(session.user.id);
      else { setUserProfile(null); setLoading(false); }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user && userProfile !== undefined) setLoading(false);
    if (!user) setLoading(false);
  }, [user, userProfile]);

  return (
    <AuthContext.Provider value={{ user, userProfile, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}