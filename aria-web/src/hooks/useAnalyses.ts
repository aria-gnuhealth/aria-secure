import { useState, useCallback } from 'react';
import { analysesApi } from '@/api/analyses';
import { imagesApi } from '@/api/images';
import { 
  CheXpertResult, 
  MURAResult, 
  AnalysisResult, 
  AnalysisResultResponse,
  CheXpertFindingResponse,
  MURAResponse,
  CheXpertFinding
} from '@/types/analysis';
import toast from 'react-hot-toast';

export const useAnalysis = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [cheXpertResult, setCheXpertResult] = useState<CheXpertResult | null>(null);
  const [muraResult, setMuraResult] = useState<MURAResult | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisResultResponse | null>(null);

  const analyzeChest = useCallback(async (imageId: string): Promise<CheXpertResult | null> => {
    setIsLoading(true);
    try {
      const response = await analysesApi.analyzeChest(imageId);
      setMuraResult(null);
      setCheXpertResult(response);
      toast.success('Analyse thoracique terminée');
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'analyse';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const analyzeFracture = useCallback(async (imageId: string, threshold: number = 0.5): Promise<MURAResult | null> => {
    setIsLoading(true);
    try {
      const response = await analysesApi.analyzeFracture(imageId, threshold);
      setCheXpertResult(null);
      setMuraResult(response);
      toast.success('Analyse de fracture terminée');
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'analyse';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ⚠️ CORRECTION : getResult avec typage précis
  const getResult = useCallback(async (analysisId: string): Promise<AnalysisResult | null> => {
    setIsLoading(true);
    try {
      const response = await analysesApi.getResult(analysisId);
      
      setAnalysisStatus(response);
      
      if (response.status !== 'completed') {
        toast.success(`Analyse en cours (${response.status})`);
        return null;
      }

      setCheXpertResult(null);
      setMuraResult(null);

      // ⚠️ Vérifier si response.results est un tableau (CheXpert)
      if (response.model?.name === 'CheXpert' && Array.isArray(response.results)) {
        const findingsData = response.results as CheXpertFindingResponse[];
        
        // Construire le résultat CheXpert
        const detectedFindings = findingsData.filter((f) => f.detected);
        
        const urgencyOrder = ['CRITIQUE', 'ÉLEVÉ', 'MOYEN', 'FAIBLE', 'INFO', 'NORMAL'];
        let globalUrgency = 'NORMAL';
        for (const f of detectedFindings) {
          const currentIndex = urgencyOrder.indexOf(f.urgency);
          const globalIndex = urgencyOrder.indexOf(globalUrgency);
          if (currentIndex < globalIndex) {
            globalUrgency = f.urgency;
          }
        }

        const isNormal = detectedFindings.length === 0 || 
                         detectedFindings.every((f) => f.urgency === 'INFO' || f.urgency === 'NORMAL');

        const findings: CheXpertFinding[] = findingsData.map((f) => ({
          pathology: f.pathology,
          probability: f.probability,
          percentage: f.percentage,
          detected: f.detected,
          urgency: f.urgency,
          color: f.color
        }));

        const model = response.model || { 
          id: '', 
          name: 'CheXpert', 
          version: '1.0', 
          architecture: 'DenseNet121' 
        };

        const cheXpertData: CheXpertResult = {
          success: true,
          model_type: 'chexpert',
          analysis_id: response.analysis_id,
          image_id: response.image_id,
          patient_id: response.patient_id,
          model: {
            name: model.name,
            version: model.version,
            architecture: model.architecture
          },
          inference_ms: 0,
          is_normal: isNormal,
          global_urgency: globalUrgency,
          confidence_score: response.confidence_score || 0,
          findings: findings,
          detected_pathologies: detectedFindings.map((f) => f.pathology),
          heatmap_url: response.heatmap_url
        };
        
        setCheXpertResult(cheXpertData);
        return cheXpertData;
      } 
      
      // ⚠️ Vérifier si c'est MURA (response.results est un objet)
      if (response.model?.name === 'MURA' && response.results && !Array.isArray(response.results)) {
        const results = response.results as MURAResponse;
        
        const model = response.model || { 
          id: '', 
          name: 'MURA', 
          version: '1.0', 
          architecture: 'EfficientNetV2-S' 
        };

        const muraData: MURAResult = {
          success: true,
          model_type: 'mura',
          analysis_id: response.analysis_id,
          image_id: response.image_id,
          patient_id: response.patient_id,
          model: {
            name: model.name,
            version: model.version,
            architecture: model.architecture
          },
          inference_ms: results.inference_ms,
          diagnostic: results.diagnostic,
          probability: results.probability,
          percentage: results.percentage,
          is_normal: results.is_normal,
          is_fracture: results.is_abnormal,
          urgency: results.urgency,
          confidence: results.confidence,
          recommandation: results.recommandation,
          heatmap_url: response.heatmap_url || results.heatmap_url,
          logit: results.logit,
          urgency_color: results.urgency_color,
          threshold_used: results.threshold_used
        };
        
        setMuraResult(muraData);
        return muraData;
      }

      console.warn('Type de résultat inconnu:', response);
      return null;

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la récupération';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadAndAnalyze = useCallback(async (
    patientId: string,
    file: File,
    type: 'chest' | 'fracture',
    threshold: number = 0.5,
    bodyPart?: string
  ): Promise<AnalysisResult | null> => {
    setIsLoading(true);
    try {
      const imageResponse = await imagesApi.upload(patientId, file, bodyPart);
      toast.success('Image uploadée avec succès');

      let analysisResult: AnalysisResult | null = null;
      if (type === 'chest') {
        analysisResult = await analysesApi.analyzeChest(imageResponse.id);
        setCheXpertResult(analysisResult);
        setMuraResult(null);
      } else {
        analysisResult = await analysesApi.analyzeFracture(imageResponse.id, threshold);
        setMuraResult(analysisResult);
        setCheXpertResult(null);
      }
      
      toast.success('Analyse terminée avec succès');
      return analysisResult;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'analyse';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetResults = useCallback(() => {
    setCheXpertResult(null);
    setMuraResult(null);
    setAnalysisStatus(null);
  }, []);

  return {
    isLoading,
    cheXpertResult,
    muraResult,
    analysisStatus,
    analyzeChest,
    analyzeFracture,
    getResult,
    uploadAndAnalyze,
    resetResults,
  };
};