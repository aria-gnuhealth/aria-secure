import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import {
  Users,
  Activity,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Clock,
  ChevronRight,
  Plus,
  Search,
  ArrowUpRight,
  Sparkles,
  Calendar,
  Stethoscope,
  FileText,
  Bell,
  UserPlus
} from 'lucide-react';
import { Card } from '@/components/UI/Card';
import { Button } from '@/components/UI/Button';

// Types
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
  type: string;
}

interface RecentPatient {
  id: string;
  name: string;
  lastVisit: string;
  age: number;
  gender: 'M' | 'F';
}

// Cartes statistiques
const StatsCards: React.FC<{ stats: Stats }> = ({ stats }) => {
  const cards = [
    {
      label: 'Patients',
      value: stats.totalPatients,
      icon: Users,
      change: '+12%',
      color: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
    },
    {
      label: 'Analyses',
      value: stats.totalAnalyses,
      icon: Activity,
      change: '+8%',
      color: 'from-purple-500 to-purple-600',
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
    },
    {
      label: 'Cas urgents',
      value: stats.urgentCases,
      icon: AlertTriangle,
      change: '-3%',
      color: 'from-red-500 to-red-600',
      bg: 'bg-red-500/10',
      text: 'text-red-400',
    },
    {
      label: 'Examens normaux',
      value: stats.normalCases,
      icon: CheckCircle,
      change: '+5%',
      color: 'from-green-500 to-green-600',
      bg: 'bg-green-500/10',
      text: 'text-green-400',
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
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-400 font-medium">
                  {card.label}
                </p>
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 + index * 0.1, type: 'spring' }}
                  className="text-3xl font-bold text-white mt-1"
                >
                  {card.value}
                </motion.p>
                <span className={`text-xs font-medium ${card.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                  {card.change} vs mois dernier
                </span>
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
          </div>
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
      completed: { label: 'Terminé', color: 'bg-green-500/20 text-green-400' },
      pending: { label: 'En attente', color: 'bg-yellow-500/20 text-yellow-400' },
      processing: { label: 'En cours', color: 'bg-blue-500/20 text-blue-400' },
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
              className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-700/30 cursor-pointer transition-colors group border border-transparent hover:border-gray-700"
            >
              <div className="flex items-center gap-4">
                <div className={`w-1.5 h-12 rounded-full ${getUrgencyColor(analysis.urgency)}`} />
                <div>
                  <p className="font-medium text-white">{analysis.patient}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-400">{analysis.date}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                    {analysis.status === 'completed' && (
                      <span className="text-xs text-gray-400">
                        Score: {(analysis.score * 100).toFixed(0)}%
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {analysis.type}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
};

// Patients récents
const RecentPatients: React.FC<{ patients: RecentPatient[] }> = ({ patients }) => {
  const navigate = useNavigate();

  return (
    <Card title="Patients récents">
      <div className="space-y-3">
        {patients.map((patient, i) => (
          <motion.div
            key={patient.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => navigate(`/doctor/patients/${patient.id}`)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-700/30 cursor-pointer transition-colors border border-transparent hover:border-gray-700"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${
              patient.gender === 'M' 
                ? 'bg-gradient-to-br from-blue-500 to-blue-700' 
                : 'bg-gradient-to-br from-pink-500 to-pink-700'
            }`}>
              {patient.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">{patient.name}</p>
              <p className="text-xs text-gray-400">
                {patient.age} ans · Dernière visite: {patient.lastVisit}
              </p>
            </div>
            <ChevronRight size={16} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

// Activité récente
const ActivityStats: React.FC = () => {
  const activities = [
    { label: 'Nouveaux patients', value: 12, trend: '+8%', icon: UserPlus },
    { label: 'Analyses aujourd\'hui', value: 7, trend: '+2%', icon: Activity },
    { label: 'Temps moyen d\'analyse', value: '3.2s', trend: '-12%', icon: Clock },
    { label: 'Rapports générés', value: 24, trend: '+15%', icon: FileText },
  ];

  return (
    <Card title="Activité">
      <div className="space-y-3">
        {activities.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="flex items-center justify-between p-3 bg-gray-700/30 rounded-xl border border-gray-700/50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-500/10 rounded-lg">
                <item.icon size={16} className="text-primary-400" />
              </div>
              <span className="text-sm text-gray-400">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{item.value}</span>
              <span className={`text-xs font-medium flex items-center gap-0.5 ${
                item.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'
              }`}>
                <ArrowUpRight size={12} className={item.trend.startsWith('-') ? 'rotate-90' : ''} />
                {item.trend}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

// Dashboard principal
export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [ref, inView] = useInView({ triggerOnce: true });

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
      type: 'Thorax',
    },
    {
      id: '2',
      patient: 'Marie Kamga',
      date: '12/06/2025 13:15',
      urgency: 'MOYEN',
      status: 'processing',
      score: 0,
      type: 'Membre',
    },
    {
      id: '3',
      patient: 'Pierre Nkam',
      date: '12/06/2025 11:45',
      urgency: 'NORMAL',
      status: 'completed',
      score: 0.12,
      type: 'Thorax',
    },
    {
      id: '4',
      patient: 'Sophie Bello',
      date: '12/06/2025 10:00',
      urgency: 'CRITIQUE',
      status: 'pending',
      score: 0,
      type: 'Thorax',
    },
    {
      id: '5',
      patient: 'Lucien Tchoua',
      date: '11/06/2025 16:20',
      urgency: 'FAIBLE',
      status: 'completed',
      score: 0.34,
      type: 'Membre',
    },
  ]);

  const [recentPatients] = useState<RecentPatient[]>([
    { id: '1', name: 'Jean Dupont', lastVisit: '12/06/2025', age: 45, gender: 'M' },
    { id: '2', name: 'Marie Kamga', lastVisit: '12/06/2025', age: 32, gender: 'F' },
    { id: '3', name: 'Pierre Nkam', lastVisit: '11/06/2025', age: 58, gender: 'M' },
    { id: '4', name: 'Sophie Bello', lastVisit: '10/06/2025', age: 27, gender: 'F' },
    { id: '5', name: 'Lucien Tchoua', lastVisit: '09/06/2025', age: 63, gender: 'M' },
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
          <h1 className="text-3xl font-bold text-white">
            Bonjour, Docteur 👋
          </h1>
          <p className="text-gray-400 mt-1">
            Voici le résumé de votre activité aujourd'hui
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex gap-3 flex-wrap"
        >
          <Button
            variant="outline"
            onClick={() => navigate('/doctor/patients')}
            className="flex items-center gap-2 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <Users size={18} />
            Mes patients
          </Button>
          <Button
            onClick={() => navigate('/doctor/patients')}
            className="flex items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
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
          <RecentPatients patients={recentPatients} />
          <ActivityStats />
        </div>
      </div>

      {/* Alertes d'urgence */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-red-950/30 border border-red-800/50 text-red-300 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <div>
            <p className="font-semibold">Cas critique</p>
            <p className="text-sm text-red-300/70">1 patient nécessite une attention immédiate</p>
          </div>
        </div>
        <div className="bg-orange-950/30 border border-orange-800/50 text-orange-300 px-4 py-3 rounded-xl flex items-center gap-3">
          <Bell className="w-5 h-5 text-orange-400" />
          <div>
            <p className="font-semibold">En attente de validation</p>
            <p className="text-sm text-orange-300/70">3 analyses en attente de validation</p>
          </div>
        </div>
        <div className="bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 px-4 py-3 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="font-semibold">Tout va bien</p>
            <p className="text-sm text-emerald-300/70">Aucune anomalie critique récente</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};