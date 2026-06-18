import React from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface UrgencyBadgeProps {
  urgency: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const urgencyConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  CRITIQUE: {
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'CRITIQUE',
  },
  ÉLEVÉ: {
    color: 'text-orange-400',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/30',
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'ÉLEVÉ',
  },
  MOYEN: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/30',
    icon: <AlertCircle className="w-4 h-4" />,
    label: 'MOYEN',
  },
  FAIBLE: {
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    border: 'border-green-500/30',
    icon: <Info className="w-4 h-4" />,
    label: 'FAIBLE',
  },
  NORMAL: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/30',
    icon: <CheckCircle className="w-4 h-4" />,
    label: 'NORMAL',
  },
};

export const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({
  urgency,
  size = 'md',
  showLabel = true,
}) => {
  const config = urgencyConfig[urgency] || urgencyConfig.NORMAL;
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <div className={`
      inline-flex items-center gap-1.5 rounded-full border font-medium
      ${config.bg} ${config.border} ${config.color} ${sizeClasses[size]}
    `}>
      {config.icon}
      {showLabel && <span>{config.label}</span>}
    </div>
  );
};