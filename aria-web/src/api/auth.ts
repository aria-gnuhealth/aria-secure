import apiClient from './client';
import { LoginRequest, LoginResponse, RegisterResponse, User } from '@/types/auth';

// Type pour la réponse de vérification email
export interface VerifyEmailResponse {
  message: string;
  success: boolean;
}

// Type pour la réponse de renvoi vérification
export interface ResendVerificationResponse {
  message: string;
  success: boolean;
}

// Type pour l'inscription
export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: 'doctor' | 'radiologist' | 'nurse' | 'admin' | 'auditor';
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', data.email);
    formData.append('password', data.password);
    
    const response = await apiClient.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data;
  },

  register: async (data: RegisterData): Promise<RegisterResponse> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  verifyEmail: async (token: string): Promise<VerifyEmailResponse> => {
    const response = await apiClient.get(`/auth/verify-email/${token}`);
    return response.data;
  },

  resendVerification: async (email: string): Promise<ResendVerificationResponse> => {
    const response = await apiClient.post('/auth/resend-verification', { email });
    return response.data;
  },
};