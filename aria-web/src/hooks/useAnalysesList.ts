import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/api/client';
import { AnalysisListItem, AnalysisFilters } from '@/types/analysis';
import toast from 'react-hot-toast';

interface UseAnalysesListReturn {
  analyses: AnalysisListItem[];
  total: number;
  page: number;
  pages: number;
  perPage: number;
  isLoading: boolean;
  filters: AnalysisFilters;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: AnalysisFilters) => void;
  goToPage: (page: number) => void;
  refresh: () => void;
}

export const useAnalysesList = (): UseAnalysesListReturn => {
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<AnalysisFilters>({});

  const loadAnalyses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page,
        per_page: perPage,
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      if (filters.patient_id) {
        params.patient_id = filters.patient_id;
      }
      if (filters.model_type && filters.model_type !== 'all') {
        params.model_type = filters.model_type;
      }
      if (filters.urgency && filters.urgency !== 'all') {
        params.urgency = filters.urgency;
      }
      if (filters.status && filters.status !== 'all') {
        params.status = filters.status;
      }
      if (filters.date_from) {
        params.date_from = filters.date_from;
      }
      if (filters.date_to) {
        params.date_to = filters.date_to;
      }

      const response = await apiClient.get('/analyses', { params });
      
      setAnalyses(response.data.analyses || []);
      setTotal(response.data.total || 0);
      setPages(response.data.pages || 1);
    } catch (error) {
      console.error('Error loading analyses:', error);
      toast.error('Erreur lors du chargement des analyses');
      setAnalyses([]);
      setTotal(0);
      setPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, searchQuery, filters]);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= pages) {
      setPage(newPage);
    }
  };

  return {
    analyses,
    total,
    page,
    pages,
    perPage,
    isLoading,
    filters,
    searchQuery,
    setSearchQuery,
    setFilters,
    goToPage,
    refresh: loadAnalyses,
  };
};