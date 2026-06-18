import { useState, useEffect, useCallback } from 'react';
import { reportsApi } from '@/api/reports';
import { Report } from '@/types/report';
import toast from 'react-hot-toast';

interface UseReportsListReturn {
  reports: Report[];
  total: number;
  page: number;
  pages: number;
  perPage: number;
  isLoading: boolean;
  searchQuery: string;
  filters: {
    urgency?: string;
    date_from?: string;
    date_to?: string;
  };
  setSearchQuery: (query: string) => void;
  setFilters: (filters: any) => void;
  goToPage: (page: number) => void;
  refresh: () => void;
}

export const useReportsList = (): UseReportsListReturn => {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{ urgency?: string; date_from?: string; date_to?: string }>({});

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await reportsApi.list(
        page,
        perPage,
        searchQuery || undefined,
        filters.urgency,
        filters.date_from,
        filters.date_to
      );
      setReports(response.reports || []);
      setTotal(response.total || 0);
      setPages(response.pages || 1);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Erreur lors du chargement des rapports');
      setReports([]);
      setTotal(0);
      setPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, searchQuery, filters]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= pages) {
      setPage(newPage);
    }
  };

  return {
    reports,
    total,
    page,
    pages,
    perPage,
    isLoading,
    searchQuery,
    filters,
    setSearchQuery,
    setFilters,
    goToPage,
    refresh: loadReports,
  };
};