import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Bone, Check } from 'lucide-react';

interface AnalysisType {
  id: 'chest' | 'fracture';
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

interface AnalysisTypeSelectorProps {
  selected: 'chest' | 'fracture';
  onChange: (type: 'chest' | 'fracture') => void;
}

const types: AnalysisType[] = [
  {
    id: 'chest',
    label: 'Thorax',
    icon: <Activity className="w-6 h-6" />,
    description: 'Analyse pulmonaire (14 pathologies)',
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'fracture',
    label: 'Membre',
    icon: <Bone className="w-6 h-6" />,
    description: 'Détection de fractures',
    color: 'from-purple-500 to-purple-600',
  },
];

export const AnalysisTypeSelector: React.FC<AnalysisTypeSelectorProps> = ({
  selected,
  onChange,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {types.map((type) => (
        <motion.button
          key={type.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChange(type.id)}
          className={`
            relative p-4 rounded-xl border-2 transition-all duration-300
            ${selected === type.id 
              ? `border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/20` 
              : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
            }
          `}
        >
          <div className="flex items-center gap-4">
            <div className={`
              p-3 rounded-xl bg-gradient-to-r ${type.color}
              ${selected === type.id ? 'shadow-lg shadow-primary-500/30' : 'opacity-70'}
            `}>
              {type.icon}
            </div>
            <div className="text-left">
              <p className={`font-semibold ${selected === type.id ? 'text-white' : 'text-gray-400'}`}>
                {type.label}
              </p>
              <p className={`text-xs ${selected === type.id ? 'text-gray-300' : 'text-gray-500'}`}>
                {type.description}
              </p>
            </div>
          </div>
          {selected === type.id && (
            <div className="absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}
        </motion.button>
      ))}
    </div>
  );
};