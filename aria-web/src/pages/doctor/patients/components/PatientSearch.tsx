import React from 'react';
import { motion } from 'framer-motion';
import { Search, X, UserPlus } from 'lucide-react';
import { Button } from '@/components/UI/Button';

interface PatientSearchProps {
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  total?: number;
  isLoading?: boolean;  // ⚠️ AJOUTER CETTE LIGNE
}

export const PatientSearch: React.FC<PatientSearchProps> = ({
  value,
  onChange,
  onAdd,
  total,
  isLoading = false,  // ⚠️ AJOUTER CETTE LIGNE AVEC VALEUR PAR DÉFAUT
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6"
    >
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Rechercher un patient (nom, prénom, n° dossier)..."
          className="w-full pl-10 pr-10 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        {total !== undefined && !isLoading && (
          <span className="text-sm text-gray-400 whitespace-nowrap">
            {total} patient{total > 1 ? 's' : ''}
          </span>
        )}
        {isLoading && (
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        )}
        <Button
          onClick={onAdd}
          className="flex items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white whitespace-nowrap"
        >
          <UserPlus size={18} />
          Nouveau patient
        </Button>
      </div>
    </motion.div>
  );
};