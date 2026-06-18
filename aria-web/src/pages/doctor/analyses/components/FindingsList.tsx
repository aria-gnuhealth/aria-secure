import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { CheXpertFinding } from '@/types/analysis';

interface FindingsListProps {
  findings: CheXpertFinding[];
  showAll?: boolean;
}

const getUrgencyColor = (urgency: string) => {
  const colors: Record<string, string> = {
    CRITIQUE: 'bg-red-500/20 border-red-500/30 text-red-400',
    ÉLEVÉ: 'bg-orange-500/20 border-orange-500/30 text-orange-400',
    MOYEN: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
    FAIBLE: 'bg-green-500/20 border-green-500/30 text-green-400',
    NORMAL: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
  };
  return colors[urgency] || colors.NORMAL;
};

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  showAll = false,
}) => {
  const displayedFindings = showAll ? findings : findings.filter(f => f.detected);
  
  if (displayedFindings.length === 0) {
    return (
      <div className="text-center py-6">
        <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
        <p className="text-emerald-400 font-medium">Aucune pathologie détectée</p>
        <p className="text-gray-400 text-sm mt-1">L'examen est normal</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayedFindings.map((finding, index) => (
        <motion.div
          key={finding.pathology}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className={`
            flex items-center justify-between p-3 rounded-lg border
            ${finding.detected ? getUrgencyColor(finding.urgency) : 'bg-gray-700/30 border-gray-600/30 text-gray-400'}
          `}
        >
          <div className="flex items-center gap-3">
            {finding.detected ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            <span className="font-medium">{finding.pathology}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{finding.percentage}</span>
            {finding.detected && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${getUrgencyColor(finding.urgency)}`}>
                {finding.urgency}
              </span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};