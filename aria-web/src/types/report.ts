export interface GenerateReportResponse {
  success: boolean;
  report_id: string;
  message: string;
  download_url: string;
  regenerated?: boolean;
}

export interface AnalysisReportsResponse {
  success: boolean;
  analysis_id: string;
  total: number;
  reports: Report[];
}

export interface Report {
  id: string;
  analysis_id: string;
  generated_at: string;
  generated_by: string | null;
  download_url: string;
  analysis?: {
    patient_name: string;
    patient_id: string;
    model_name: string;
    urgency_level?: string;
    confidence_score?: number;
    created_at: string;
    is_normal: boolean;
  };
}

export interface ReportsListResponse {
  success: boolean;
  total: number;
  page: number;
  per_page: number;
  pages: number;
  reports: Report[];
}

export interface GenerateReportResponse {
  success: boolean;
  report_id: string;
  message: string;
  download_url: string;
  regenerated?: boolean;
}

export interface AnalysisReportsResponse {
  success: boolean;
  analysis_id: string;
  total: number;
  reports: Report[];
}