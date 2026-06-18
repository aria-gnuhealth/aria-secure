import React from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';

interface AnalysisSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const AnalysisSearchBar: React.FC<AnalysisSearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Rechercher par patient ou ID d\'analyse...',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex-1"
    >
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
    </motion.div>
  );
};