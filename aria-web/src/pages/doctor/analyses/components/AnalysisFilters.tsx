import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { AnalysisFilters as FiltersType } from '@/types/analysis';

interface AnalysisFiltersProps {
  filters: FiltersType;
  onFilterChange: (filters: FiltersType) => void;
  onClear: () => void;
  total?: number;
}

const urgencyOptions = [
  { value: 'all', label: 'Toutes' },
  { value: 'CRITIQUE', label: 'Critique' },
  { value: 'ÉLEVÉ', label: 'Élevé' },
  { value: 'MOYEN', label: 'Moyen' },
  { value: 'FAIBLE', label: 'Faible' },
  { value: 'NORMAL', label: 'Normal' },
];

const statusOptions = [
  { value: 'all', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'processing', label: 'En cours' },
  { value: 'completed', label: 'Terminé' },
  { value: 'error', label: 'Erreur' },
];

const modelOptions = [
  { value: 'all', label: 'Tous' },
  { value: 'chexpert', label: 'Thorax (CheXpert)' },
  { value: 'mura', label: 'Membre (MURA)' },
];

export const AnalysisFilters: React.FC<AnalysisFiltersProps> = ({
  filters,
  onFilterChange,
  onClear,
  total,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (key: keyof FiltersType, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some(v => v && v !== 'all');

  return (
    <div className="space-y-4">
      {/* Barre de filtres (toujours visible) */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-xl text-gray-300 hover:bg-gray-700/50 transition-colors"
        >
          <Filter size={16} />
          <span className="text-sm font-medium">Filtres</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
          )}
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <X size={14} />
            Effacer
          </button>
        )}

        {total !== undefined && (
          <span className="ml-auto text-sm text-gray-400">
            {total} analyse{total > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Panneau de filtres */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 bg-gray-800/50 border border-gray-700/50 rounded-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Statut */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Statut
                  </label>
                  <select
                    value={filters.status || 'all'}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Urgence */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Urgence
                  </label>
                  <select
                    value={filters.urgency || 'all'}
                    onChange={(e) => handleChange('urgency', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {urgencyOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type de modèle */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Type d'analyse
                  </label>
                  <select
                    value={filters.model_type || 'all'}
                    onChange={(e) => handleChange('model_type', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {modelOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Période */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Période
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={filters.date_from || ''}
                      onChange={(e) => handleChange('date_from', e.target.value)}
                      className="w-1/2 px-2 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      type="date"
                      value={filters.date_to || ''}
                      onChange={(e) => handleChange('date_to', e.target.value)}
                      className="w-1/2 px-2 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};