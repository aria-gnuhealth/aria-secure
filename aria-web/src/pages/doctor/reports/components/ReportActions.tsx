import React from 'react';
import { motion } from 'framer-motion';
import { Download, Trash2, ExternalLink } from 'lucide-react';

interface ReportActionsProps {
  reportId: string;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  onView?: (id: string) => void;
}

export const ReportActions: React.FC<ReportActionsProps> = ({
  reportId,
  onDownload,
  onDelete,
  onView,
}) => {
  return (
    <div className="flex items-center gap-1">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => { e.stopPropagation(); onDownload(reportId); }}
        className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-primary-400"
        title="Télécharger"
      >
        <Download size={16} />
      </motion.button>
      {onView && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); onView(reportId); }}
          className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
          title="Voir"
        >
          <ExternalLink size={16} />
        </motion.button>
      )}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => { e.stopPropagation(); onDelete(reportId); }}
        className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-gray-400 hover:text-red-400"
        title="Supprimer"
      >
        <Trash2 size={16} />
      </motion.button>
    </div>
  );
};