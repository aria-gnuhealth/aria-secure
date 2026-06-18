import apiClient from './client';
import { ReportsListResponse, GenerateReportResponse, AnalysisReportsResponse } from '@/types/report';

export const reportsApi = {
  // ⚠️ Nouveau: Lister tous les rapports de l'utilisateur
  list: async (
    page: number = 1,
    perPage: number = 20,
    search?: string,
    urgency?: string,
    date_from?: string,
    date_to?: string
  ): Promise<ReportsListResponse> => {
    const response = await apiClient.get<ReportsListResponse>('/reports', {
      params: {
        page,
        per_page: perPage,
        search,
        urgency,
        date_from,
        date_to
      }
    });
    return response.data;
  },

  // Générer un rapport pour une analyse
  generate: async (analysisId: string, regenerate: boolean = false): Promise<GenerateReportResponse> => {
    const response = await apiClient.post<GenerateReportResponse>(
      `/reports/analysis/${analysisId}`,
      null,
      { params: { regenerate } }
    );
    return response.data;
  },

  // Télécharger un rapport
  download: async (reportId: string): Promise<Blob> => {
    const response = await apiClient.get(`/reports/${reportId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Lister les rapports d'une analyse
  listByAnalysis: async (analysisId: string): Promise<AnalysisReportsResponse> => {
    const response = await apiClient.get<AnalysisReportsResponse>(
      `/reports/analysis/${analysisId}/reports`
    );
    return response.data;
  },

  // Supprimer un rapport
  delete: async (reportId: string): Promise<void> => {
    await apiClient.delete(`/reports/${reportId}`);
  },
};