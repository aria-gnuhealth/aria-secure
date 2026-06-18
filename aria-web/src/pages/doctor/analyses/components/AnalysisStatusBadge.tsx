import React from 'react';
import { Clock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface AnalysisStatusBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'error';
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'En attente',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  processing: {
    label: 'En cours',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  },
  completed: {
    label: 'Terminé',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  error: {
    label: 'Erreur',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
};

export const AnalysisStatusBadge: React.FC<AnalysisStatusBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const config = statusConfig[status] || statusConfig.pending;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${config.color} ${sizeClasses}`}>
      {config.icon}
      {config.label}
    </span>
  );
};