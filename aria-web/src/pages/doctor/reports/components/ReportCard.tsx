import React from 'react';
import { motion } from 'framer-motion';
import { Report } from '@/types/report';
import { FileText, Calendar, User, Activity } from 'lucide-react';
import { ReportActions } from './ReportActions';

interface ReportCardProps {
  report: Report;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  onView?: (id: string) => void;
}

export const ReportCard: React.FC<ReportCardProps> = ({
  report,
  onDownload,
  onDelete,
  onView,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl hover:border-gray-600 transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="p-3 bg-primary-500/10 rounded-lg">
            <FileText className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <p className="font-medium text-white">
              Rapport d'analyse
            </p>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {formatDate(report.generated_at)}
              </span>
              {report.analysis?.patient_name && (
                <span className="flex items-center gap-1">
                  <User size={12} />
                  {report.analysis.patient_name}
                </span>
              )}
              {report.analysis?.model_name && (
                <span className="flex items-center gap-1">
                  <Activity size={12} />
                  {report.analysis.model_name}
                </span>
              )}
            </div>
          </div>
        </div>
        <ReportActions
          reportId={report.id}
          onDownload={onDownload}
          onDelete={onDelete}
          onView={onView}
        />
      </div>
    </motion.div>
  );
};