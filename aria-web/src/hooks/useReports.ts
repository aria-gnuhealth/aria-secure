import { useState, useCallback } from 'react';
import { reportsApi } from '@/api/reports';
import { Report, GenerateReportResponse } from '@/types/report';
import toast from 'react-hot-toast';

export const useReports = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);

  // Générer un rapport
  const generateReport = useCallback(async (
    analysisId: string,
    regenerate: boolean = false
  ): Promise<GenerateReportResponse | null> => {
    setIsLoading(true);
    try {
      const response = await reportsApi.generate(analysisId, regenerate);
      toast.success(response.message || 'Rapport généré avec succès');
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la génération';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Télécharger un rapport
  const downloadReport = useCallback(async (reportId: string): Promise<Blob | null> => {
    setIsLoading(true);
    try {
      const blob = await reportsApi.download(reportId);
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport_ARIA_${reportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Rapport téléchargé avec succès');
      return blob;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors du téléchargement';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Charger les rapports d'une analyse
  const loadReports = useCallback(async (analysisId: string) => {
    setIsLoading(true);
    try {
      const response = await reportsApi.listByAnalysis(analysisId);
      setReports(response.reports || []);
      setTotal(response.total || 0);
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors du chargement';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Supprimer un rapport
  const deleteReport = useCallback(async (reportId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await reportsApi.delete(reportId);
      toast.success('Rapport supprimé avec succès');
      // Mettre à jour la liste
      setReports(prev => prev.filter(r => r.id !== reportId));
      setTotal(prev => prev - 1);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la suppression';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    reports,
    total,
    generateReport,
    downloadReport,
    loadReports,
    deleteReport,
  };
};