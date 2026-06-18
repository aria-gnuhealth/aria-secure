import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAnalysesList } from '@/hooks/useAnalysesList';
import { AnalysisTable } from './components/AnalysisTable';
import { AnalysisFilters } from './components/AnalysisFilters';
import { AnalysisSearchBar } from './components/AnalysisSearchBar';
import { Pagination } from '@/components/UI/Pagination';
import { Card } from '@/components/UI/Card';
import { Button } from '@/components/UI/Button';
import { RefreshCw, Plus } from 'lucide-react';

export const AnalysesList: React.FC = () => {
  const navigate = useNavigate();
  const {
    analyses,
    total,
    page,
    pages,
    perPage,
    isLoading,
    filters,
    searchQuery,
    setSearchQuery,
    setFilters,
    goToPage,
    refresh,
  } = useAnalysesList();

  const handleView = (analysis: any) => {
    navigate(`/doctor/analysis/${analysis.id}`);
  };

  const handleNewAnalysis = () => {
    navigate('/doctor/patients');
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analyses</h1>
          <p className="text-gray-400 mt-1">Consultez l'historique complet des analyses</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={refresh}
            variant="outline"
            className="flex items-center gap-2 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Rafraîchir
          </Button>
          <Button
            onClick={handleNewAnalysis}
            className="flex items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white"
          >
            <Plus size={18} />
            Nouvelle analyse
          </Button>
        </div>
      </div>

      {/* Recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-4">
        <AnalysisSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </div>

      <AnalysisFilters
        filters={filters}
        onFilterChange={setFilters}
        onClear={handleClearFilters}
        total={total}
      />

      {/* Tableau */}
      <Card>
        <AnalysisTable
          analyses={analyses}
          isLoading={isLoading}
          onView={handleView}
        />
        {!isLoading && analyses.length > 0 && (
          <Pagination
            current={page}
            total={pages}
            perPage={perPage}
            onPageChange={goToPage}
            totalItems={total}
          />
        )}
      </Card>
    </motion.div>
  );
};