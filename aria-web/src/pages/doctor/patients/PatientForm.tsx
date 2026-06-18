import React, { useState } from 'react';
import { Patient, PatientCreate } from '@/types/patient';
import { User, Phone, Calendar, MapPin, Hash } from 'lucide-react';

interface PatientFormProps {
  initialData?: Patient;
  onSubmit: (data: PatientCreate) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  mode: 'create' | 'edit';
}

// Fonction pour initialiser le formulaire
const getInitialFormData = (initialData?: Patient): PatientCreate => {
  if (initialData) {
    return {
      medical_record_number: initialData.medical_record_number || '',
      first_name: initialData.first_name || '',
      last_name: initialData.last_name || '',
      date_of_birth: initialData.date_of_birth?.split('T')[0] || '',
      gender: initialData.gender as 'M' | 'F' | 'O' | undefined,
      phone: initialData.phone || '',
      address: initialData.address || '',
    };
  }
  return {
    medical_record_number: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: undefined,
    phone: '',
    address: '',
  };
};

export const PatientForm: React.FC<PatientFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  mode,
}) => {
  const [formData, setFormData] = useState<PatientCreate>(() => getInitialFormData(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.medical_record_number) {
      newErrors.medical_record_number = 'Le numéro de dossier est requis';
    }
    if (!formData.first_name) {
      newErrors.first_name = 'Le prénom est requis';
    }
    if (!formData.last_name) {
      newErrors.last_name = 'Le nom est requis';
    }
    if (formData.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(formData.date_of_birth)) {
      newErrors.date_of_birth = 'Format invalide (YYYY-MM-DD)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Numéro de dossier */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Numéro de dossier <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              name="medical_record_number"
              value={formData.medical_record_number}
              onChange={handleChange}
              className={`w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border ${
                errors.medical_record_number ? 'border-red-500' : 'border-gray-600'
              } rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
              placeholder="MRN-001"
            />
          </div>
          {errors.medical_record_number && (
            <p className="text-red-400 text-xs mt-1">{errors.medical_record_number}</p>
          )}
        </div>

        {/* Prénom */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Prénom <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className={`w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border ${
                errors.first_name ? 'border-red-500' : 'border-gray-600'
              } rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
              placeholder="Jean"
            />
          </div>
          {errors.first_name && (
            <p className="text-red-400 text-xs mt-1">{errors.first_name}</p>
          )}
        </div>

        {/* Nom */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Nom <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className={`w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border ${
                errors.last_name ? 'border-red-500' : 'border-gray-600'
              } rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
              placeholder="Dupont"
            />
          </div>
          {errors.last_name && (
            <p className="text-red-400 text-xs mt-1">{errors.last_name}</p>
          )}
        </div>

        {/* Sexe */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Sexe</label>
          <select
            name="gender"
            value={formData.gender || ''}
            onChange={handleChange}
            className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none"
          >
            <option value="">Non renseigné</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
            <option value="O">Autre</option>
          </select>
        </div>

        {/* Date de naissance */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Date de naissance</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              name="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={handleChange}
              className={`w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border ${
                errors.date_of_birth ? 'border-red-500' : 'border-gray-600'
              } rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
            />
          </div>
          {errors.date_of_birth && (
            <p className="text-red-400 text-xs mt-1">{errors.date_of_birth}</p>
          )}
        </div>

        {/* Téléphone */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Téléphone</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              placeholder="+237 6XX XXX XXX"
            />
          </div>
        </div>

        {/* Adresse */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Adresse</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={2}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
              placeholder="Adresse du patient"
            />
          </div>
        </div>
      </div>

      {/* Boutons */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-700/50">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-lg font-medium shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {mode === 'create' ? 'Création...' : 'Modification...'}
            </span>
          ) : (
            mode === 'create' ? 'Créer le patient' : 'Modifier le patient'
          )}
        </button>
      </div>
    </form>
  );
};