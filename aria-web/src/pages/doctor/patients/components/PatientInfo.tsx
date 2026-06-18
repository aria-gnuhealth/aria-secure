import React from 'react';
import { motion } from 'framer-motion';
import { Patient } from '@/types/patient';
import { 
  User, 
  Calendar, 
  Phone, 
  MapPin, 
  Hash, 
  Clock
} from 'lucide-react';

interface PatientInfoProps {
  patient: Patient;
}

export const PatientInfo: React.FC<PatientInfoProps> = ({ patient }) => {
  const infoItems = [
    { icon: Hash, label: 'Numéro de dossier', value: patient.medical_record_number },
    { icon: Calendar, label: 'Date de naissance', value: patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString('fr-FR') : 'Non renseignée' },
    { icon: User, label: 'Sexe', value: patient.gender === 'M' ? 'Masculin' : patient.gender === 'F' ? 'Féminin' : 'Non renseigné' },
    { icon: Phone, label: 'Téléphone', value: patient.phone || 'Non renseigné' },
    { icon: MapPin, label: 'Adresse', value: patient.address || 'Non renseignée' },
    { icon: Clock, label: 'Date d\'inscription', value: new Date(patient.created_at).toLocaleDateString('fr-FR') },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6"
    >
      <div className="flex items-start gap-6">
        {/* Avatar */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white ${
          patient.gender === 'M' 
            ? 'bg-gradient-to-br from-blue-500 to-blue-700' 
            : patient.gender === 'F'
            ? 'bg-gradient-to-br from-pink-500 to-pink-700'
            : 'bg-gradient-to-br from-gray-500 to-gray-700'
        }`}>
          {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
        </div>

        {/* Nom */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">
            {patient.first_name} {patient.last_name}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Patient depuis le {new Date(patient.created_at).toLocaleDateString('fr-FR')}
          </p>
        </div>
      </div>

      {/* Grille d'informations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {infoItems.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-xl border border-gray-700/30"
          >
            <item.icon className="w-4 h-4 text-primary-400" />
            <div>
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-sm text-white font-medium">{item.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};