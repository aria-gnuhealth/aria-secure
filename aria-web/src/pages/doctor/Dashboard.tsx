import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import {
  Users,
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Plus,
  ArrowUpRight
} from 'lucide-react';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';

// Types pour les statistiques
interface Stats {
  totalPatients: number;
  totalAnalyses: number;
  urgentCases: number;
  normalCases: number;
}

interface RecentAnalysis {
  id: string;
  patient: string;
  date: string;
  urgency: string;
  status: 'completed' | 'pending' | 'processing';
  score: number;
}

// Cartes statistiques
const StatsCards: React.FC<{ stats: Stats }> = ({ stats }) => {
  const cards = [
    {
      label: 'Patients',
      value: stats.totalPatients,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
    },
    {
      label: 'Analyses',
      value: stats.totalAnalyses,
      icon: Activity,
      color: 'from-purple-500 to-purple-600',
      bg: 'bg-purple-50',
      text: 'text-purple-600',
    },
    {
      label: 'Cas urgents',
      value: stats.urgentCases,
      icon: AlertTriangle,
      color: 'from-red-500 to-red-600',
      bg: 'bg-red-50',
      text: 'text-red-600',
    },
    {
      label: 'Examens normaux',
      value: stats.normalCases,
      icon: CheckCircle,
      color: 'from-green-500 to-green-600',
      bg: 'bg-green-50',
      text: 'text-green-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{card.label}</p>
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 + index * 0.1, type: 'spring' }}
                  className="text-3xl font-bold text-gray-900 mt-1"
                >
                  {card.value}
                </motion.p>
              </div>
              <div className={`p-3 rounded-xl ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.text}`} />
              </div>
            </div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.8 }}
              className="mt-4 h-1 bg-gradient-to-r rounded-full"
              style={{ background: `linear-gradient(to right, ${card.color})` }}
            />
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

// Analyses récentes
const RecentAnalyses: React.FC<{ analyses: RecentAnalysis[] }> = ({ analyses }) => {
  const navigate = useNavigate();

  const getUrgencyColor = (urgency: string) => {
    const colors: Record<string, string> = {
      CRITIQUE: 'bg-red-500',
      ÉLEVÉ: 'bg-orange-500',
      MOYEN: 'bg-yellow-500',
      FAIBLE: 'bg-green-500',
      NORMAL: 'bg-emerald-500',
    };
    return colors[urgency] || 'bg-gray-500';
  };

  const getStatusBadge = (status: RecentAnalysis['status']) => {
    const badges: Record<string, { label: string; color: string }> = {
      completed: { label: 'Terminé', color: 'bg-green-100 text-green-700' },
      pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
      processing: { label: 'En cours', color: 'bg-blue-100 text-blue-700' },
    };
    return badges[status] || badges.pending;
  };

  return (
    <Card title="Analyses récentes">
      <div className="space-y-3">
        {analyses.map((analysis, index) => {
          const status = getStatusBadge(analysis.status);
          return (
            <motion.div
              key={analysis.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => navigate(`/doctor/analysis/${analysis.id}`)}
              className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-2 h-12 rounded-full ${getUrgencyColor(analysis.urgency)}`} />
                <div>
                  <p className="font-medium text-gray-800">{analysis.patient}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500">{analysis.date}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                    {analysis.status === 'completed' && (
                      <span className="text-xs text-gray-500">
                        Score: {(analysis.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
};

// Page Dashboard
export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [ref] = useInView({ triggerOnce: true });
  const [stats] = useState<Stats>({
    totalPatients: 128,
    totalAnalyses: 45,
    urgentCases: 8,
    normalCases: 37,
  });

  const [recentAnalyses] = useState<RecentAnalysis[]>([
    {
      id: '1',
      patient: 'Jean Dupont',
      date: '12/06/2025 14:30',
      urgency: 'ÉLEVÉ',
      status: 'completed',
      score: 0.87,
    },
    {
      id: '2',
      patient: 'Marie Kamga',
      date: '12/06/2025 13:15',
      urgency: 'MOYEN',
      status: 'processing',
      score: 0,
    },
    {
      id: '3',
      patient: 'Pierre Nkam',
      date: '12/06/2025 11:45',
      urgency: 'NORMAL',
      status: 'completed',
      score: 0.12,
    },
    {
      id: '4',
      patient: 'Sophie Bello',
      date: '12/06/2025 10:00',
      urgency: 'CRITIQUE',
      status: 'pending',
      score: 0,
    },
    {
      id: '5',
      patient: 'Lucien Tchoua',
      date: '11/06/2025 16:20',
      urgency: 'FAIBLE',
      status: 'completed',
      score: 0.34,
    },
  ]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
      ref={ref}
    >
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-gray-900">Bonjour, Docteur 👋</h1>
          <p className="text-gray-500 mt-1">Voici le résumé de votre activité</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex gap-3"
        >
          <Button
            variant="outline"
            onClick={() => navigate('/doctor/patients')}
            className="flex items-center gap-2"
          >
            <Users size={18} />
            Mes patients
          </Button>
          <Button
            onClick={() => navigate('/doctor/patients')}
            className="flex items-center gap-2"
          >
            <Plus size={18} />
            Nouvelle analyse
          </Button>
        </motion.div>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Grille du tableau de bord */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analyses récentes */}
        <div className="lg:col-span-2">
          <RecentAnalyses analyses={recentAnalyses} />
        </div>

        {/* Panneau de droite */}
        <div className="space-y-6">
          {/* Patients rapides */}
          <Card title="Patients récents">
            <div className="space-y-3">
              {['Jean Dupont', 'Marie Kamga', 'Pierre Nkam', 'Sophie Bello'].map((name, i) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate('/doctor/patients')}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                    {name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{name}</p>
                    <p className="text-xs text-gray-500">Dernière visite: 12/06/2025</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-400" />
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Activité récente */}
          <Card title="Activité">
            <div className="space-y-3">
              {[
                { label: 'Nouveaux patients', value: 12, trend: '+8%' },
                { label: 'Analyses aujourd\'hui', value: 7, trend: '+2%' },
                { label: 'Temps moyen d\'analyse', value: '3.2s', trend: '-12%' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                >
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{item.value}</span>
                    <span className="text-xs text-green-600 flex items-center gap-0.5">
                      <ArrowUpRight size={12} />
                      {item.trend}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};