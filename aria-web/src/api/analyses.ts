import apiClient from './client';
import { 
  AnalysisListResponse, 
  AnalysisResultResponse, 
  CheXpertResult, 
  MURAResult,
  ImageAnalysesResponse
} from '@/types/analysis';

export const analysesApi = {
  listByPatient: async (
    patientId: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<AnalysisListResponse> => {
    const response = await apiClient.get<AnalysisListResponse>(
      `/patients/${patientId}/analyses`,
      { params: { page, per_page: perPage } }
    );
    return response.data;
  },

  getResult: async (analysisId: string): Promise<AnalysisResultResponse> => {
    const response = await apiClient.get<AnalysisResultResponse>(
      `/analyze/${analysisId}/result`
    );
    return response.data;
  },

  analyzeChest: async (imageId: string): Promise<CheXpertResult> => {
    const response = await apiClient.post<CheXpertResult>(
      '/analyze/chest',
      null,
      { params: { image_id: imageId } }
    );
    return response.data;
  },

  analyzeFracture: async (imageId: string, threshold: number = 0.5): Promise<MURAResult> => {
    const response = await apiClient.post<MURAResult>(
      '/analyze/fracture',
      null,
      { params: { image_id: imageId, threshold } }
    );
    return response.data;
  },

  listByImage: async (imageId: string): Promise<ImageAnalysesResponse> => {
    const response = await apiClient.get<ImageAnalysesResponse>(
      `/analyze/image/${imageId}/analyses`
    );
    return response.data;
  },
};