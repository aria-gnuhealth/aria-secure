// ============================================================
// Types pour les analyses CheXpert (Thorax)
// ============================================================
export interface CheXpertFinding {
  pathology: string;
  probability: number;
  percentage: string;
  detected: boolean;
  urgency: string;
  color?: string;
}

export interface CheXpertResult {
  success: boolean;
  model_type: 'chexpert';
  analysis_id: string;
  image_id: string;
  patient_id: string;
  model: {
    name: string;
    version: string;
    architecture: string;
  };
  inference_ms: number;
  is_normal: boolean;
  global_urgency: string;
  confidence_score: number;
  findings: CheXpertFinding[];
  detected_pathologies: string[];
  heatmap_url?: string;
}

// ============================================================
// Type pour les résultats CheXpert bruts du backend
// ============================================================
export interface CheXpertFindingResponse {
  pathology: string;
  probability: number;
  percentage: string;
  detected: boolean;
  urgency: string;
  color: string;
  threshold: number;
}

// ============================================================
// Types pour les analyses MURA (Fracture)
// ============================================================
export interface MURAResult {
  success: boolean;
  model_type: 'mura';
  analysis_id: string;
  image_id: string;
  patient_id: string;
  model: {
    name: string;
    version: string;
    architecture: string;
  };
  inference_ms: number;
  diagnostic: string;
  probability: number;
  percentage: string;
  is_normal: boolean;
  is_fracture: boolean;
  urgency: string;
  confidence: number;
  recommandation: string;
  heatmap_url?: string;
  logit?: number;
  urgency_color?: string;
  threshold_used?: number;
}

// ============================================================
// Type pour les résultats MURA bruts du backend
// ============================================================
export interface MURAResponse {
  success: boolean;
  model: string;
  inference_ms: number;
  logit: number;
  probability: number;
  percentage: string;
  diagnostic: string;
  is_abnormal: boolean;
  is_normal: boolean;
  urgency: string;
  urgency_color: string;
  confidence: number;
  recommandation: string;
  threshold_used: number;
  heatmap_url?: string;
}

// ============================================================
// Type union
// ============================================================
export type AnalysisResult = CheXpertResult | MURAResult;

// ============================================================
// Type pour la réponse de l'API getResult
// ============================================================
export interface AnalysisResultResponse {
  success: boolean;
  analysis_id: string;
  image_id: string;
  patient_id: string;
  model: {
    id: string;
    name: string;
    version: string;
    architecture: string;
  } | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  created_at: string;
  completed_at: string | null;
  confidence_score: number | null;
  urgency_level: string | null;
  findings: {
    pathology: string;
    probability: number;
  }[];
  results: CheXpertFindingResponse[] | MURAResponse | null;
  error_message: string | null;
  heatmap_url?: string;
}

// ============================================================
// Type guards
// ============================================================
export function isCheXpertResult(result: AnalysisResult): result is CheXpertResult {
  return result.model_type === 'chexpert';
}

export function isMURAResult(result: AnalysisResult): result is MURAResult {
  return result.model_type === 'mura';
}

export interface Analysis {
  id: string;
  patient_id: string;
  image_id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  confidence_score?: number;
  urgency_level?: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
  model_name?: string;
  findings?: {
    pathology: string;
    probability: number;
  }[];
}

export interface AnalysisListResponse {
  success: boolean;
  patient_id: string;
  total: number;
  page: number;
  per_page: number;
  analyses: Analysis[];
}

export interface NewAnalysisRequest {
  patient_id: string;
  image_id: string;
  type: 'chest' | 'fracture';
  threshold?: number;
}

// Ajouter ce type à la fin du fichier

export interface ImageAnalysesResponse {
  success: boolean;
  image_id: string;
  patient_id: string;
  total: number;
  analyses: {
    analysis_id: string;
    model_name: string | null;
    status: string;
    created_at: string;
    completed_at: string | null;
    confidence_score: number | null;
    urgency_level: string | null;
    has_error: boolean;
  }[];
}

// Ajouter ces types

export interface AnalysisFilters {
  patient_id?: string;
  model_type?: 'chexpert' | 'mura' | 'all';
  urgency?: 'CRITIQUE' | 'ÉLEVÉ' | 'MOYEN' | 'FAIBLE' | 'NORMAL' | 'all';
  status?: 'pending' | 'processing' | 'completed' | 'error' | 'all';
  date_from?: string;
  date_to?: string;
}

export interface AnalysisListItem {
  id: string;
  patient_name: string;
  patient_id: string;
  model_name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  urgency_level?: string;
  confidence_score?: number;
  created_at: string;
  completed_at?: string;
  has_heatmap: boolean;
}

export interface AnalysesListResponse {
  success: boolean;
  total: number;
  page: number;
  per_page: number;
  pages: number;
  analyses: AnalysisListItem[];
}