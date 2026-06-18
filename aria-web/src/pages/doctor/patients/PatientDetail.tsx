import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit2, Trash2, Plus, Activity } from 'lucide-react';
import { usePatient } from '@/hooks/usePatient';
import { usePatients } from '@/hooks/usePatients';
import { PatientInfo } from './components/PatientInfo';
import { PatientStats } from './components/PatientStats';
import { PatientAnalyses } from './components/PatientAnalyses';
import { PatientForm } from './PatientForm';
import { Modal } from '@/components/UI/Modal';
import { Card } from '@/components/UI/Card';
import { Button } from '@/components/UI/Button';

export const PatientDetail: React.FC = () => {
  const navigate = useNavigate();
  const { patient, analyses, isLoading, refresh } = usePatient();
  const { deletePatient } = usePatients();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Statistiques
  const totalAnalyses = analyses.length;
  const criticalCount = analyses.filter(a => a.urgency_level === 'CRITIQUE' || a.urgency_level === 'critical').length;
  const normalCount = analyses.filter(a => a.urgency_level === 'NORMAL' || a.urgency_level === 'normal').length;
  const pendingCount = analyses.filter(a => a.status === 'pending').length;

  const handleEdit = () => {
    setEditModalOpen(true);
  };

  const handleDelete = async () => {
    if (patient) {
      const success = await deletePatient(patient.id);
      if (success) {
        setDeleteConfirmOpen(false);
        navigate('/doctor/patients');
      }
    }
  };

  const handleNewAnalysis = () => {
    if (patient) {
      navigate(`/doctor/patients/${patient.id}/new-analysis`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Chargement du patient...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8 text-gray-500" />
        </div>
        <h2 className="text-xl font-semibold text-white">Patient non trouvé</h2>
        <p className="text-gray-400 mt-2">Le patient que vous recherchez n'existe pas.</p>
        <button
          onClick={() => navigate('/doctor/patients')}
          className="mt-4 text-primary-400 hover:text-primary-300 transition-colors"
        >
          Retourner à la liste des patients
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* En-tête avec navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/doctor/patients')}
            className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {patient.first_name} {patient.last_name}
            </h1>
            <p className="text-gray-400 text-sm">
              Détails du patient
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleNewAnalysis}
            className="flex items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white"
          >
            <Plus size={18} />
            Nouvelle analyse
          </Button>
          <Button
            onClick={handleEdit}
            variant="outline"
            className="flex items-center gap-2 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <Edit2 size={18} />
            Modifier
          </Button>
          <Button
            onClick={() => setDeleteConfirmOpen(true)}
            variant="danger"
            className="flex items-center gap-2"
          >
            <Trash2 size={18} />
            Supprimer
          </Button>
        </div>
      </div>

      {/* Informations du patient */}
      <PatientInfo patient={patient} />

      {/* Statistiques */}
      <PatientStats
        totalAnalyses={totalAnalyses}
        criticalCount={criticalCount}
        normalCount={normalCount}
        pendingCount={pendingCount}
      />

      {/* Analyses du patient */}
      <Card title="Historique des analyses">
        <PatientAnalyses analyses={analyses} isLoading={isLoading} />
      </Card>

      {/* Modal d'édition */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Modifier le patient"
      >
        <PatientForm
          initialData={patient}
          onSubmit={async (data) => {
            // Mise à jour du patient
            const { updatePatient } = usePatients();
            const result = await updatePatient(patient.id, data);
            if (result) {
              setEditModalOpen(false);
              await refresh();
            }
          }}
          onCancel={() => setEditModalOpen(false)}
          isLoading={isLoading}
          mode="edit"
        />
      </Modal>

      {/* Modal de confirmation de suppression */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Êtes-vous sûr de vouloir supprimer le patient{' '}
            <span className="text-white font-medium">
              {patient.first_name} {patient.last_name}
            </span>
            {' ?'}
          </p>
          <p className="text-gray-500 text-sm">
            Cette action est irréversible et supprimera toutes les données associées.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setDeleteConfirmOpen(false)}
              className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Supprimer
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};