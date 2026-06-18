import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Download, RefreshCw, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { useReports } from '@/hooks/useReports';
import { useAnalysis } from '@/hooks/useAnalyses';
import { Card } from '@/components/UI/Card';
import { Button } from '@/components/UI/Button';

export const ReportGenerator: React.FC = () => {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();
  const { isLoading, generateReport, downloadReport, loadReports, reports } = useReports();
  const { getResult, cheXpertResult, muraResult } = useAnalysis();
  const [isGenerating, setIsGenerating] = useState(false);
  const result = cheXpertResult || muraResult;

  useEffect(() => {
    if (analysisId) {
      getResult(analysisId);
      loadReports(analysisId);
    }
  }, [analysisId]);

  const handleGenerate = async (regenerate: boolean = false) => {
    if (!analysisId) return;
    setIsGenerating(true);
    const response = await generateReport(analysisId, regenerate);
    if (response) {
      await loadReports(analysisId);
      // Si un rapport a été généré, le télécharger
      if (response.report_id) {
        await downloadReport(response.report_id);
      }
    }
    setIsGenerating(false);
  };

  const handleDownload = async (reportId: string) => {
    await downloadReport(reportId);
  };

  const handleBack = () => {
    if (result?.patient_id) {
      navigate(`/doctor/patients/${result.patient_id}`);
    } else {
      navigate('/doctor/dashboard');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Chargement...</p>
        </div>
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
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Génération de rapport</h1>
          <p className="text-gray-400 text-sm">
            Analyse {analysisId?.slice(0, 8)}...
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panneau principal */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Résumé de l'analyse">
            {result ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-700/30 rounded-lg">
                    <p className="text-xs text-gray-400">Patient</p>
                    <p className="text-white font-medium">{result.patient_id?.slice(0, 8)}</p>
                  </div>
                  <div className="p-3 bg-gray-700/30 rounded-lg">
                    <p className="text-xs text-gray-400">Modèle</p>
                    <p className="text-white font-medium">{result.model?.name || 'Inconnu'}</p>
                  </div>
                  <div className="p-3 bg-gray-700/30 rounded-lg">
                    <p className="text-xs text-gray-400">Urgence</p>
                    <p className="text-white font-medium">
                      {'global_urgency' in result ? result.global_urgency : result.urgency}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-700/30 rounded-lg">
                    <p className="text-xs text-gray-400">Confiance</p>
                    <p className="text-white font-medium">
                      {'confidence_score' in result 
                        ? `${(result.confidence_score * 100).toFixed(1)}%`
                        : `${result.confidence}%`
                      }
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">Aucun résultat d'analyse trouvé</p>
            )}
          </Card>

          <Card title="Rapports générés">
            {reports.length > 0 ? (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-primary-400" />
                      <div>
                        <p className="text-white text-sm">Rapport du {new Date(report.generated_at).toLocaleDateString('fr-FR')}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(report.generated_at).toLocaleTimeString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDownload(report.id)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                      <Download size={16} />
                      Télécharger
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Aucun rapport généré</p>
                <p className="text-gray-500 text-sm mt-1">Cliquez sur "Générer le rapport" ci-dessous</p>
              </div>
            )}
          </Card>
        </div>

        {/* Panneau latéral - Actions */}
        <div className="space-y-6">
          <Card title="Actions">
            <div className="space-y-4">
              <Button
                onClick={() => handleGenerate(false)}
                disabled={isGenerating || !result}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Génération...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <FileText size={18} />
                    Générer le rapport
                  </span>
                )}
              </Button>

              {reports.length > 0 && (
                <Button
                  onClick={() => handleGenerate(true)}
                  disabled={isGenerating}
                  variant="outline"
                  className="w-full border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
                  Régénérer le rapport
                </Button>
              )}
            </div>
          </Card>

          <Card title="Informations">
            <div className="space-y-3 text-sm text-gray-400">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
                <p>Le rapport est généré au format PDF</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <p>Il contient les résultats complets de l'analyse</p>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p>Les rapports sont sauvegardés dans le système</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};