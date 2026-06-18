import apiClient from './client';
import { Patient, PatientCreate, PatientUpdate, PatientListResponse } from '@/types/patient';

export interface PatientStatsResponse {
  total_patients: number;
  gender_distribution: {
    male: number;
    female: number;
    other: number;
  };
  patients_with_analyses: number;
  percentage_with_analyses: number;
}

export const patientsApi = {
  list: async (page: number = 1, perPage: number = 20): Promise<PatientListResponse> => {
    const response = await apiClient.get('/patients', { params: { page, per_page: perPage } });
    return response.data;
  },

  // ⚠️ SEULE MODIFICATION : supprimer "limit" car le backend ne l'accepte pas
  search: async (query: string): Promise<Patient[]> => {
    const response = await apiClient.get('/patients/search', { params: { q: query } });
    return response.data;
  },

  getById: async (id: string): Promise<Patient> => {
    const response = await apiClient.get(`/patients/${id}`);
    return response.data;
  },

  create: async (data: PatientCreate): Promise<Patient> => {
    const response = await apiClient.post('/patients', data);
    return response.data;
  },

  update: async (id: string, data: PatientUpdate): Promise<Patient> => {
    const response = await apiClient.put(`/patients/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/patients/${id}`);
  },

  getStats: async (): Promise<PatientStatsResponse> => {
    const response = await apiClient.get('/patients/stats/summary');
    return response.data;
  },
};