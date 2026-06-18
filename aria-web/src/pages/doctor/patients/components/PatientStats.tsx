import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';

interface PatientStatsProps {
  totalAnalyses: number;
  criticalCount: number;
  normalCount: number;
  pendingCount: number;
}

export const PatientStats: React.FC<PatientStatsProps> = ({
  totalAnalyses,
  criticalCount,
  normalCount,
  pendingCount,
}) => {
  const stats = [
    {
      label: 'Total analyses',
      value: totalAnalyses,
      icon: FileText,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Critiques',
      value: criticalCount,
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Normales',
      value: normalCount,
      icon: CheckCircle,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'En attente',
      value: pendingCount,
      icon: Clock,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.1 }}
          className={`p-4 rounded-xl border border-gray-700/50 ${stat.bg}`}
        >
          <div className="flex items-center gap-3">
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-400">{stat.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};