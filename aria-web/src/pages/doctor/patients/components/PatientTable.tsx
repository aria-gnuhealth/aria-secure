import React from 'react';
import { motion } from 'framer-motion';
import { Patient } from '@/types/patient';
import { Edit2, Trash2, Eye, User, Calendar, Phone } from 'lucide-react';

interface PatientTableProps {
  patients: Patient[];
  onView: (patient: Patient) => void;
  onEdit: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
  isLoading?: boolean;
}

export const PatientTable: React.FC<PatientTableProps> = ({
  patients,
  onView,
  onEdit,
  onDelete,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">Aucun patient trouvé</p>
        <p className="text-gray-500 text-sm mt-1">Commencez par ajouter un nouveau patient</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700/50">
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">
              Patient
            </th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4 hidden md:table-cell">
              Date de naissance
            </th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4 hidden lg:table-cell">
              Téléphone
            </th>
            <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4 hidden xl:table-cell">
              Dossier
            </th>
            <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wider py-3 px-4">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/30">
          {patients.map((patient, index) => (
            <motion.tr
              key={patient.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="hover:bg-gray-700/20 transition-colors group cursor-pointer"
              onClick={() => onView(patient)}
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-medium text-sm ${
                    patient.gender === 'M' 
                      ? 'bg-gradient-to-br from-blue-500 to-blue-700' 
                      : patient.gender === 'F'
                      ? 'bg-gradient-to-br from-pink-500 to-pink-700'
                      : 'bg-gradient-to-br from-gray-500 to-gray-700'
                  }`}>
                    {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {patient.first_name} {patient.last_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {patient.gender === 'M' ? 'Homme' : patient.gender === 'F' ? 'Femme' : 'Autre'}
                    </p>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 hidden md:table-cell">
                <div className="flex items-center gap-2 text-gray-300">
                  <Calendar size={14} className="text-gray-500" />
                  <span className="text-sm">
                    {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString('fr-FR') : 'Non renseignée'}
                  </span>
                </div>
              </td>
              <td className="py-3 px-4 hidden lg:table-cell">
                <div className="flex items-center gap-2 text-gray-300">
                  <Phone size={14} className="text-gray-500" />
                  <span className="text-sm">{patient.phone || 'Non renseigné'}</span>
                </div>
              </td>
              <td className="py-3 px-4 hidden xl:table-cell">
                <span className="text-sm text-gray-400 font-mono">
                  {patient.medical_record_number}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onView(patient); }}
                    className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
                    title="Voir"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(patient); }}
                    className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-primary-400"
                    title="Modifier"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(patient); }}
                    className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-gray-400 hover:text-red-400"
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};