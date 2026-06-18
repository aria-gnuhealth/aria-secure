import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Analysis } from '@/types/analysis';
import { Activity, ChevronRight, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface PatientAnalysesProps {
  analyses: Analysis[];
  isLoading?: boolean;
}

export const PatientAnalyses: React.FC<PatientAnalysesProps> = ({
  analyses,
  isLoading = false,
}) => {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      error: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock className="w-4 h-4" />,
      processing: <Activity className="w-4 h-4 animate-spin" />,
      completed: <CheckCircle className="w-4 h-4" />,
      error: <AlertCircle className="w-4 h-4" />,
    };
    return icons[status] || <Activity className="w-4 h-4" />;
  };

  const getUrgencyBadge = (urgency: string | undefined) => {
    if (!urgency) return null;
    const colors: Record<string, string> = {
      critical: 'bg-red-500/20 text-red-400 border-red-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      low: 'bg-green-500/20 text-green-400 border-green-500/30',
      normal: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[urgency.toLowerCase()] || colors.normal}`}>
        {urgency.toUpperCase()}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="text-center py-12 border border-gray-700/50 rounded-xl">
        <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">Aucune analyse pour ce patient</p>
        <p className="text-gray-500 text-sm mt-1">Commencez par faire une analyse</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {analyses.map((analysis, index) => (
        <motion.div
          key={analysis.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => navigate(`/doctor/analysis/${analysis.id}`)}
          className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl border border-gray-700/50 hover:border-gray-600 cursor-pointer transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${getStatusColor(analysis.status)}`}>
              {getStatusIcon(analysis.status)}
            </div>
            <div>
              <p className="text-white font-medium">
                Analyse du {new Date(analysis.created_at).toLocaleDateString('fr-FR')}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(analysis.status)}`}>
                  {analysis.status}
                </span>
                {getUrgencyBadge(analysis.urgency_level)}
                {analysis.confidence_score && (
                  <span className="text-xs text-gray-400">
                    Score: {(analysis.confidence_score * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.div>
      ))}
    </div>
  );
};