import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { useAnalysis } from '../../../hooks/useAnalyses';
import { AnalysisTypeSelector } from './components/AnalysisTypeSelector';
import { ImageUploader } from './components/ImageUploader';
import { Card } from '@/components/UI/Card';
import { Button } from '@/components/UI/Button';

export const NewAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  const { isLoading, uploadAndAnalyze } = useAnalysis();

  const [analysisType, setAnalysisType] = useState<'chest' | 'fracture'>('chest');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleImageSelect = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleImageRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !patientId) return;
    
    const result = await uploadAndAnalyze(
      patientId,
      selectedFile,
      analysisType,
      0.5,
      analysisType === 'chest' ? 'thorax' : 'membre'
    );

    if (result) {
      navigate(`/doctor/analysis/${result.analysis_id}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/doctor/patients/${patientId}`)}
          className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Nouvelle analyse</h1>
          <p className="text-gray-400 text-sm">
            Sélectionnez le type d'analyse et chargez une radiographie
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panneau principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sélection du type */}
          <Card title="Type d'analyse">
            <AnalysisTypeSelector
              selected={analysisType}
              onChange={setAnalysisType}
            />
          </Card>

          {/* Upload d'image */}
          <Card title="Image radiographique">
            <ImageUploader
              onImageSelect={handleImageSelect}
              onImageRemove={handleImageRemove}
              selectedImage={selectedFile}
              previewUrl={previewUrl}
              isLoading={isLoading}
            />
          </Card>
        </div>

        {/* Panneau latéral */}
        <div className="space-y-6">
          <Card title="Résumé">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                <span className="text-gray-400 text-sm">Type</span>
                <span className="text-white font-medium">
                  {analysisType === 'chest' ? 'Thorax' : 'Membre'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                <span className="text-gray-400 text-sm">Image</span>
                <span className="text-white font-medium">
                  {selectedFile ? '✅ Chargée' : '❌ Non chargée'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg">
                <span className="text-gray-400 text-sm">Patient</span>
                <span className="text-white font-medium">ID: {patientId?.slice(0, 8)}</span>
              </div>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!selectedFile || isLoading}
              className="w-full mt-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyse en cours...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Lancer l'analyse
                </span>
              )}
            </Button>

            {!selectedFile && (
              <div className="flex items-start gap-2 mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-400">
                  Veuillez charger une image avant de lancer l'analyse
                </p>
              </div>
            )}
          </Card>

          <Card title="Informations">
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-primary-400">•</span>
                L'analyse prend environ 3 à 5 secondes
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400">•</span>
                Les résultats sont sauvegardés automatiquement
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400">•</span>
                Vous pouvez consulter l'historique des analyses
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};