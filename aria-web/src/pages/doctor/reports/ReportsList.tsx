import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useReportsList } from '@/hooks/useReportsList';
import { useReports } from '@/hooks/useReports';
import { Card } from '@/components/UI/Card';
import { Pagination } from '@/components/UI/Pagination';
import { Button } from '@/components/UI/Button';
import {
  FileText,
  Search,
  X,
  RefreshCw,
  Calendar,
  Activity,
  ChevronRight,
  Download,
  Trash2,
  Filter
} from 'lucide-react';

export const ReportsList: React.FC = () => {
  const navigate = useNavigate();
  const {
    reports,
    total,
    page,
    pages,
    perPage,
    isLoading,
    searchQuery,
    filters,
    setSearchQuery,
    setFilters,
    goToPage,
    refresh,
  } = useReportsList();

  const { downloadReport, deleteReport } = useReports();
  const [showFilters, setShowFilters] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getUrgencyColor = (urgency: string) => {
    const colors: Record<string, string> = {
      CRITIQUE: 'bg-red-500/20 text-red-400 border-red-500/30',
      ÉLEVÉ: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      MOYEN: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      FAIBLE: 'bg-green-500/20 text-green-400 border-green-500/30',
      NORMAL: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    };
    return colors[urgency] || colors.NORMAL;
  };

  const handleDownload = async (reportId: string) => {
    await downloadReport(reportId);
  };

  const handleDelete = async (reportId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce rapport ?')) {
      const success = await deleteReport(reportId);
      if (success) {
        refresh();
      }
    }
  };

  const handleViewAnalysis = (analysisId: string) => {
    navigate(`/doctor/analysis/${analysisId}`);
  };

  const urgencyOptions = [
    { value: 'all', label: 'Toutes' },
    { value: 'CRITIQUE', label: 'Critique' },
    { value: 'ÉLEVÉ', label: 'Élevé' },
    { value: 'MOYEN', label: 'Moyen' },
    { value: 'FAIBLE', label: 'Faible' },
    { value: 'NORMAL', label: 'Normal' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Rapports</h1>
          <p className="text-gray-400 mt-1">Consultez tous vos rapports générés</p>
        </div>
        <Button
          onClick={refresh}
          variant="outline"
          className="flex items-center gap-2 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          Rafraîchir
        </Button>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par patient ou ID analyse..."
            className="w-full pl-10 pr-10 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-gray-300 hover:bg-gray-700/50 transition-colors"
        >
          <Filter size={18} />
          <span className="text-sm">Filtres</span>
          {filters.urgency && filters.urgency !== 'all' && (
            <span className="w-2 h-2 bg-primary-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Panneau de filtres */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-400 font-medium">Urgence</label>
                <select
                  value={filters.urgency || 'all'}
                  onChange={(e) => setFilters({ ...filters, urgency: e.target.value === 'all' ? undefined : e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm"
                >
                  {urgencyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium">Date début</label>
                <input
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => setFilters({ ...filters, date_from: e.target.value || undefined })}
                  className="w-full mt-1 px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium">Date fin</label>
                <input
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => setFilters({ ...filters, date_to: e.target.value || undefined })}
                  className="w-full mt-1 px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setFilters({})}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Effacer les filtres
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Liste des rapports */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Aucun rapport trouvé</p>
            <p className="text-gray-500 text-sm mt-1">Générez un rapport depuis une analyse</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {reports.map((report, index) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl hover:border-gray-600 transition-all group"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-3 bg-primary-500/10 rounded-lg flex-shrink-0">
                        <FileText className="w-5 h-5 text-primary-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="font-medium text-white truncate">
                            {report.analysis?.patient_name || 'Patient inconnu'}
                          </p>
                          {report.analysis?.urgency_level && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${getUrgencyColor(report.analysis.urgency_level)}`}>
                              {report.analysis.urgency_level}
                            </span>
                          )}
                          {report.analysis?.is_normal !== undefined && (
                            <span className={`text-xs ${report.analysis.is_normal ? 'text-emerald-400' : 'text-orange-400'}`}>
                              {report.analysis.is_normal ? '✅ Normal' : '⚠️ Anomalie'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(report.generated_at)}
                          </span>
                          {report.analysis?.model_name && (
                            <span className="flex items-center gap-1">
                              <Activity size={12} />
                              {report.analysis.model_name}
                            </span>
                          )}
                          {report.analysis?.confidence_score !== undefined && (
                            <span className="flex items-center gap-1">
                              Score: {(report.analysis.confidence_score * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleDownload(report.id)}
                        className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-primary-400"
                        title="Télécharger"
                      >
                        <Download size={18} />
                      </button>
                      <button
                        onClick={() => handleViewAnalysis(report.analysis_id)}
                        className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
                        title="Voir l'analyse"
                      >
                        <ChevronRight size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-gray-400 hover:text-red-400"
                        title="Supprimer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {total > perPage && (
              <Pagination
                current={page}
                total={pages}
                perPage={perPage}
                onPageChange={goToPage}
                totalItems={total}
              />
            )}
          </>
        )}
      </Card>
    </motion.div>
  );
};