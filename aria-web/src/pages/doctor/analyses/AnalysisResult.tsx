import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Clock, FileText, AlertCircle, Activity, CheckCircle } from 'lucide-react';
import { useAnalysis } from '../../../hooks/useAnalyses';
import { UrgencyBadge } from './components/UrgencyBadge';
import { AnnotatedImage } from './components/AnnotatedImage';
import { FindingsList } from './components/FindingsList';
import { Card } from '@/components/UI/Card';
import { Button } from '@/components/UI/Button';
import { CheXpertResult, MURAResult } from '@/types/analysis';
import toast from 'react-hot-toast';

export const AnalysisResult: React.FC = () => {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const { isLoading, cheXpertResult, muraResult, getResult } = useAnalysis();
  const [fetching, setFetching] = useState(true);

  // Le résultat est soit cheXpertResult soit muraResult
  const result = cheXpertResult || muraResult;

  // Type guard pour savoir si c'est un résultat CheXpert
  const isCheXpert = (r: CheXpertResult | MURAResult | null): r is CheXpertResult => {
    return r !== null && 'global_urgency' in r;
  };

  // Type guard pour savoir si c'est un résultat MURA
  const isMURA = (r: CheXpertResult | MURAResult | null): r is MURAResult => {
    return r !== null && 'diagnostic' in r;
  };

  useEffect(() => {
    const fetchResult = async () => {
      if (analysisId) {
        console.log('Fetching result for analysis ID:', analysisId);
        setFetching(true);
        const data = await getResult(analysisId);
        console.log('Result after fetching:', data);
        setFetching(false);
      }
    };
    fetchResult();
  }, [analysisId, getResult]);

  // Générer l'URL de l'image annotée
  const getImageUrl = () => {
    if (!result?.heatmap_url) return null;
    if (result.heatmap_url.startsWith('http')) return result.heatmap_url;
    return `http://localhost:8000${result.heatmap_url}`;
  };

  const handleGenerateReport = () => {
    toast.success('Génération du rapport en cours...');
    navigate(`/doctor/reports/new/${analysisId}`);
  };

  const handleNewAnalysis = () => {
    if (result?.patient_id) {
      navigate(`/doctor/patients/${result.patient_id}/new-analysis`);
    }
  };

  // Récupérer l'urgence
  const getUrgency = () => {
    if (!result) return 'NORMAL';
    if (isCheXpert(result)) {
      return result.global_urgency;
    }
    if (isMURA(result)) {
      return result.urgency;
    }
    return 'NORMAL';
  };

  // Récupérer la confiance
  const getConfidence = () => {
    if (!result) return 0;
    if (isCheXpert(result)) {
      return result.confidence_score * 100;
    }
    if (isMURA(result)) {
      return result.confidence;
    }
    return 0;
  };

  // Récupérer le nom du modèle
  const getModelName = () => {
    if (!result) return 'Inconnu';
    if (result.model && typeof result.model === 'object') {
      return result.model.name || 'Inconnu';
    }
    if (typeof result.model === 'string') {
      return result.model;
    }
    return 'Inconnu';
  };

  // Récupérer la version du modèle
  const getModelVersion = () => {
    if (!result) return '1.0';
    if (result.model && typeof result.model === 'object') {
      return result.model.version || '1.0';
    }
    return '1.0';
  };

  if (isLoading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Chargement des résultats...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-gray-500" />
        </div>
        <h2 className="text-xl font-semibold text-white">Résultat non trouvé</h2>
        <p className="text-gray-400 mt-2">L'analyse que vous recherchez n'existe pas ou n'est pas encore terminée.</p>
        <button
          onClick={() => navigate('/doctor/dashboard')}
          className="mt-4 text-primary-400 hover:text-primary-300 transition-colors"
        >
          Retourner au tableau de bord
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/doctor/patients/${result.patient_id}`)}
            className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Résultats de l'analyse</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-400">
                ID: {result.analysis_id?.slice(0, 8) || 'N/A'}
              </span>
              <span className="text-xs text-gray-500">
                {getModelName()} v{getModelVersion()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleGenerateReport}
            className="flex items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white"
          >
            <FileText size={18} />
            Générer un rapport
          </Button>
          <Button
            onClick={handleNewAnalysis}
            variant="outline"
            className="flex items-center gap-2 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <Activity size={18} />
            Nouvelle analyse
          </Button>
        </div>
      </div>

      {/* Grille principale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image annotée */}
        <div className="lg:col-span-2">
          <Card title="Image annotée">
            <AnnotatedImage
              imageUrl={getImageUrl() || ''}
              alt="Radiographie annotée"
              isLoading={isLoading}
            />
          </Card>
        </div>

        {/* Panneau de résultats */}
        <div className="space-y-6">
          {/* Résumé */}
          <Card title="Résumé">
            <div className="space-y-4">
              {/* Urgence */}
              <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <span className="text-gray-400 text-sm">Urgence</span>
                <UrgencyBadge urgency={getUrgency()} size="lg" />
              </div>

              {/* Confiance */}
              <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <span className="text-gray-400 text-sm">Confiance</span>
                <span className="text-white font-medium">
                  {getConfidence().toFixed(1)}%
                </span>
              </div>

              {/* Probabilité (MURA uniquement) */}
              {isMURA(result) && (
                <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                  <span className="text-gray-400 text-sm">Probabilité</span>
                  <span className="text-white font-medium">
                    {result.percentage || `${(result.probability * 100).toFixed(1)}%`}
                  </span>
                </div>
              )}

              {/* Temps d'inférence */}
              <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <span className="text-gray-400 text-sm">Temps d'analyse</span>
                <span className="text-white font-medium">
                  {result.inference_ms} ms
                </span>
              </div>

              {/* Statut */}
              <div className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <span className="text-gray-400 text-sm">Statut</span>
                <span className={`font-medium ${result.is_normal ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.is_normal ? '✅ Normal' : '⚠️ Anomalie détectée'}
                </span>
              </div>
            </div>
          </Card>

          {/* Diagnostic (MURA) */}
          {isMURA(result) && (
            <Card title="Diagnostic">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-700/50">
                  <div className={`p-2 rounded-lg ${result.is_fracture ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
                    {result.is_fracture ? (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">{result.diagnostic}</p>
                    <p className="text-sm text-gray-400">{result.recommandation}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Pathologies (CheXpert) */}
          {isCheXpert(result) && (
            <Card title="Pathologies détectées">
              <FindingsList findings={result.findings} />
            </Card>
          )}
        </div>
      </div>

      {/* Actions supplémentaires */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary-400" />
            <div>
              <p className="text-sm text-gray-400">Date d'analyse</p>
              <p className="text-white font-medium">
                {new Date().toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary-400" />
            <div>
              <p className="text-sm text-gray-400">Modèle utilisé</p>
              <p className="text-white font-medium">{getModelName()}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary-400" />
            <div>
              <p className="text-sm text-gray-400">Rapport</p>
              <button
                onClick={handleGenerateReport}
                className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
              >
                Générer un rapport PDF →
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};