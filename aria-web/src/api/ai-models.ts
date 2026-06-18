import apiClient from './client';

export interface AIModel {
  id: string;
  name: string;
  version: string;
  architecture: string | null;
  onnx_path: string;
  is_active: boolean;
  input_shape: string | null;
  output_classes: string[] | null;
  accuracy: number | null;
  created_at: string;
  deployed_at: string | null;
}

export interface AIModelListResponse {
  total: number;
  items: AIModel[];
}

export interface AIModelActivateResponse {
  success: boolean;
  model_id: string;
  name: string;
  version: string;
  is_active: boolean;
  message: string;
}

export const aiModelsApi = {
  list: async (onlyActive: boolean = false): Promise<AIModelListResponse> => {
    const response = await apiClient.get('/ai-models', { params: { only_active: onlyActive } });
    return response.data;
  },

  getActiveByName: async (name: string): Promise<AIModel> => {
    const response = await apiClient.get(`/ai-models/active/${name}`);
    return response.data;
  },

  activate: async (modelId: string): Promise<AIModelActivateResponse> => {
    const response = await apiClient.post(`/ai-models/${modelId}/activate`);
    return response.data;
  },
};