import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { patientsApi } from '@/api/patients';
import { analysesApi } from '@/api/analyses';
import { Patient } from '@/types/patient';
import { Analysis } from '@/types/analysis';
import toast from 'react-hot-toast';

interface UsePatientReturn {
  patient: Patient | null;
  analyses: Analysis[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const usePatient = (): UsePatientReturn => {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatient = useCallback(async () => {
    if (!id) {
      setError('ID patient manquant');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Récupérer le patient
      const patientData = await patientsApi.getById(id);
      setPatient(patientData);

      // Récupérer les analyses du patient
      const analysesData = await analysesApi.listByPatient(id);
      setAnalyses(analysesData.analyses || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement';
      setError(message);
      toast.error('Erreur lors du chargement du patient');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  return {
    patient,
    analyses,
    isLoading,
    error,
    refresh: fetchPatient,
  };
};