import apiClient from './client';

// Types pour les images
export interface Image {
  id: string;
  patient_id: string;
  format: string;
  raw_data_path: string;
  anonymized_path: string | null;
  acquisition_date: string | null;
  body_part: string | null;
  metadata_json: Record<string, unknown> | null;
}

export interface ImageUploadResponse {
  id: string;
  patient_id: string;
  format: string;
  raw_data_path: string;
  url: string;
  acquisition_date: string | null;
  body_part: string | null;
}

export interface ImageUrlResponse {
  url: string;
  expires_in: number;
  object_path: string;
}

export interface ImageListResponse {
  items: Image[];
  total: number;
  page: number;
  per_page: number;
}

export const imagesApi = {
  upload: async (patientId: string, file: File, bodyPart?: string): Promise<ImageUploadResponse> => {
    const formData = new FormData();
    formData.append('patient_id', patientId);
    formData.append('image', file);
    if (bodyPart) {
      formData.append('body_part', bodyPart);
    }
    
    const response = await apiClient.post('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getUrl: async (imageId: string, expiryMinutes: number = 60): Promise<ImageUrlResponse> => {
    const response = await apiClient.get(`/images/${imageId}/url`, {
      params: { expiry_minutes: expiryMinutes },
    });
    return response.data;
  },

  download: async (imageId: string): Promise<Blob> => {
    const response = await apiClient.get(`/images/${imageId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  listByPatient: async (patientId: string, page: number = 1, perPage: number = 20): Promise<ImageListResponse> => {
    const response = await apiClient.get(`/patients/${patientId}/images`, {
      params: { page, per_page: perPage },
    });
    return response.data;
  },

  delete: async (imageId: string): Promise<void> => {
    await apiClient.delete(`/images/${imageId}`);
  },
};