export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'doctor' | 'radiologist' | 'nurse' | 'admin' | 'auditor';
  is_active: boolean;
  is_email_verified: boolean;
  created_at: string;
  last_login?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_email_verified: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: string;
}

export interface RegisterResponse {
  message: string;
  success: boolean;
}