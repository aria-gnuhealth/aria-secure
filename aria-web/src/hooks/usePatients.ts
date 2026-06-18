import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { patientsApi } from '@/api/patients';
import { Patient, PatientCreate, PatientUpdate } from '@/types/patient';
import toast from 'react-hot-toast';

export const usePatients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadPatients = useCallback(
    async (pageNum: number, query: string) => {
      setIsLoading(true);

      try {
        const trimmedQuery = query.trim();
        
        // ⚠️ Ne faire la recherche que si >= 2 caractères
        if (trimmedQuery.length >= 2) {
          const results = await patientsApi.search(trimmedQuery);
          setPatients(results);
          setTotal(results.length);
          setPages(1);
        } else {
          // Sinon, charger la liste normale
          const response = await patientsApi.list(pageNum, perPage);
          setPatients(response.items);
          setTotal(response.total);
          setPages(response.pages);
        }
      } catch (error: unknown) {
        console.error(error);
        toast.error('Erreur lors du chargement des patients');
      } finally {
        setIsLoading(false);
      }
    },
    [perPage]
  );

  useEffect(() => {
    void loadPatients(page, searchQuery);
  }, [page, searchQuery, loadPatients]);

  const createPatient = async (data: PatientCreate): Promise<Patient | null> => {
    try {
      const patient = await patientsApi.create(data);
      toast.success('Patient créé avec succès');
      await loadPatients(page, searchQuery);
      return patient;
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail ?? 'Erreur lors de la création'
        : 'Erreur lors de la création';
      toast.error(message);
      return null;
    }
  };

  const updatePatient = async (id: string, data: PatientUpdate): Promise<Patient | null> => {
    try {
      const patient = await patientsApi.update(id, data);
      toast.success('Patient modifié avec succès');
      await loadPatients(page, searchQuery);
      return patient;
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail ?? 'Erreur lors de la modification'
        : 'Erreur lors de la modification';
      toast.error(message);
      return null;
    }
  };

  const deletePatient = async (id: string): Promise<boolean> => {
    try {
      await patientsApi.delete(id);
      toast.success('Patient supprimé avec succès');
      await loadPatients(page, searchQuery);
      return true;
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail ?? 'Erreur lors de la suppression'
        : 'Erreur lors de la suppression';
      toast.error(message);
      return false;
    }
  };

  const searchPatients = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const goToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= pages) {
      setPage(pageNum);
    }
  };

  return {
    patients,
    total,
    page,
    pages,
    perPage,
    isLoading,
    searchQuery,
    loadPatients,
    createPatient,
    updatePatient,
    deletePatient,
    searchPatients,
    goToPage,
  };
};