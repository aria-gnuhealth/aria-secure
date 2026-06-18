import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getUrgencyColor = (urgency: string): string => {
  const colors: Record<string, string> = {
    CRITIQUE: 'bg-red-500 text-white',
    ÉLEVÉ: 'bg-orange-500 text-white',
    MOYEN: 'bg-yellow-500 text-white',
    FAIBLE: 'bg-green-500 text-white',
    NORMAL: 'bg-emerald-500 text-white',
  };
  return colors[urgency] || 'bg-gray-500 text-white';
};

export const getUrgencyBadge = (urgency: string): string => {
  const badges: Record<string, string> = {
    CRITIQUE: '🔴 URGENCE CRITIQUE',
    ÉLEVÉ: '🟠 URGENCE ÉLEVÉE',
    MOYEN: '🟡 URGENCE MOYENNE',
    FAIBLE: '🟢 URGENCE FAIBLE',
    NORMAL: '✅ EXAMEN NORMAL',
  };
  return badges[urgency] || urgency;
};