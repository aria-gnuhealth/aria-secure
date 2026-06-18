import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { login: storeLogin, register: storeRegister, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    clearError();
    try {
      await storeLogin(email, password);
      toast.success('Connexion réussie !');
      
      // Rediriger en fonction du rôle
      const user = useAuthStore.getState().user;
      if (user?.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user?.role === 'radiologist') {
        navigate('/radiologist/dashboard');
      } else {
        navigate('/doctor/dashboard');
      }
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Email ou mot de passe incorrect';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role?: string;
  }) => {
    setIsLoading(true);
    clearError();
    try {
      await storeRegister(data);
      toast.success('Inscription réussie ! Vérifiez votre email.');
      navigate('/login');
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'inscription';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { login, register, isLoading, error };
};