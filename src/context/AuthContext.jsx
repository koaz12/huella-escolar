// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
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
  const [loading, setLoading] = useState(true);

  // Función Login
  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('¡Bienvenido!');
    } catch (error) {
      console.error(error);
      toast.error('Error al iniciar sesión');
    }
  };

  // Función Logout
  const logout = async () => {
    try {
      await signOut(auth);
      toast.success('Sesión cerrada');
    } catch (error) {
      toast.error('Error al salir');
    }
  };

  // Escuchar cambios de sesión (UNA SOLA VEZ PARA TODA LA APP)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}