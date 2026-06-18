import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePatients } from '@/hooks/usePatients';
import { PatientTable } from './components/PatientTable';
import { PatientSearch } from './components/PatientSearch';
import { PatientForm } from './PatientForm';
import { Pagination } from '@/components/UI/Pagination';
import { Card } from '@/components/UI/Card';
import { Modal } from '@/components/UI/Modal';
import { Patient, PatientCreate } from '@/types/patient';

export const PatientsList: React.FC = () => {
  const navigate = useNavigate();
  const {
    patients,
    total,
    page,
    pages,
    perPage,
    isLoading,
    searchQuery,
    createPatient,
    updatePatient,
    deletePatient,
    searchPatients,
    goToPage,
  } = usePatients();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);

  const handleAdd = () => {
    setModalMode('create');
    setSelectedPatient(null);
    setModalOpen(true);
  };

  const handleEdit = (patient: Patient) => {
    setModalMode('edit');
    setSelectedPatient(patient);
    setModalOpen(true);
  };

  const handleView = (patient: Patient) => {
    navigate(`/doctor/patients/${patient.id}`);
  };

  const handleDeleteClick = (patient: Patient) => {
    setPatientToDelete(patient);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (patientToDelete) {
      const success = await deletePatient(patientToDelete.id);
      if (success) {
        setDeleteConfirmOpen(false);
        setPatientToDelete(null);
      }
    }
  };

  const handleSubmit = async (data: PatientCreate) => {
    let success = false;
    if (modalMode === 'create') {
      const result = await createPatient(data);
      success = !!result;
    } else if (selectedPatient) {
      const result = await updatePatient(selectedPatient.id, data);
      success = !!result;
    }
    if (success) {
      setModalOpen(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-white">Patients</h1>
        <p className="text-gray-400 mt-1">Gérez votre liste de patients</p>
      </div>

      {/* Barre de recherche */}
      <PatientSearch
        value={searchQuery}
        onChange={searchPatients}
        onAdd={handleAdd}
        total={total}
        isLoading={isLoading}
      />

      {/* Tableau des patients */}
      <Card>
        <PatientTable
          patients={patients}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
          isLoading={isLoading}
        />
        {!isLoading && patients.length > 0 && (
          <Pagination
            current={page}
            total={pages}
            perPage={perPage}
            onPageChange={goToPage}
            totalItems={total}
          />
        )}
      </Card>

      {/* Modal de création/édition */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'create' ? 'Nouveau patient' : 'Modifier le patient'}
      >
        <PatientForm
          initialData={selectedPatient || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          isLoading={isLoading}
          mode={modalMode}
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
              {patientToDelete?.first_name} {patientToDelete?.last_name}
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
              onClick={confirmDelete}
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