import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AnalysisListItem } from '@/types/analysis';
import { AnalysisStatusBadge } from './AnalysisStatusBadge';
import { UrgencyBadge } from './UrgencyBadge';
import { Eye, FileText, Calendar, Activity, Image as ImageIcon } from 'lucide-react';

interface AnalysisTableProps {
  analyses: AnalysisListItem[];
  isLoading?: boolean;
  onView: (analysis: AnalysisListItem) => void;
}

export const AnalysisTable: React.FC<AnalysisTableProps> = ({
  analyses,
  isLoading = false,
  onView,
}) => {
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">Aucune analyse trouvée</p>
        <p className="text-gray-500 text-sm mt-1">Ajustez vos filtres ou effectuez une nouvelle analyse</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700/50">
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">
              Patient
            </th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4 hidden md:table-cell">
              Type
            </th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">
              Statut
            </th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4 hidden lg:table-cell">
              Urgence
            </th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4 hidden xl:table-cell">
              Score
            </th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4 hidden sm:table-cell">
              Date
            </th>
            <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/30">
          {analyses.map((analysis, index) => (
            <motion.tr
              key={analysis.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="hover:bg-gray-700/20 transition-colors group cursor-pointer"
              onClick={() => onView(analysis)}
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium text-xs">
                    {analysis.patient_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">
                      {analysis.patient_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {analysis.patient_id.slice(0, 8)}
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 hidden md:table-cell">
                <span className="text-sm text-gray-300">
                  {analysis.model_name || 'Inconnu'}
                </span>
              </td>
              <td className="py-3 px-4">
                <AnalysisStatusBadge status={analysis.status} />
              </td>
              <td className="py-3 px-4 hidden lg:table-cell">
                {analysis.urgency_level ? (
                  <UrgencyBadge urgency={analysis.urgency_level} size="sm" />
                ) : (
                  <span className="text-xs text-gray-500">—</span>
                )}
              </td>
              <td className="py-3 px-4 hidden xl:table-cell">
                {analysis.confidence_score !== undefined && analysis.confidence_score !== null ? (
                  <span className="text-sm text-gray-300">
                    {(analysis.confidence_score * 100).toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">—</span>
                )}
              </td>
              <td className="py-3 px-4 hidden sm:table-cell">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Calendar size={14} />
                  {formatDate(analysis.created_at)}
                </div>
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  {analysis.has_heatmap && (
                    <span className="p-1 rounded text-gray-500" title="Image annotée disponible">
                      <ImageIcon size={14} />
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onView(analysis); }}
                    className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
                    title="Voir les résultats"
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};