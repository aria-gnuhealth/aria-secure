import apiClient from './client';

export interface AuditLog {
  id: number;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  } | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  success: boolean;
  total: number;
  page: number;
  per_page: number;
  pages: number;
  logs: AuditLog[];
}

export interface AuditStatsResponse {
  success: boolean;
  period_days: number;
  since: string;
  total_logs: number;
  by_action: Record<string, number>;
  by_resource_type: Record<string, number>;
  top_users: Array<{
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    count: number;
  }>;
}

export interface AuditActionsResponse {
  success: boolean;
  actions: string[];
}

export const auditApi = {
  getLogs: async (
    page: number = 1,
    perPage: number = 50,
    filters?: {
      action?: string;
      user_id?: string;
      resource_type?: string;
      start_date?: string;
      end_date?: string;
    }
  ): Promise<AuditLogListResponse> => {
    const response = await apiClient.get('/audit/logs', {
      params: { page, per_page: perPage, ...filters },
    });
    return response.data;
  },

  getStats: async (days: number = 30): Promise<AuditStatsResponse> => {
    const response = await apiClient.get('/audit/stats', { params: { days } });
    return response.data;
  },

  getActions: async (): Promise<AuditActionsResponse> => {
    const response = await apiClient.get('/audit/actions');
    return response.data;
  },

  exportLogs: async (format: 'json' | 'csv' = 'json', startDate?: string, endDate?: string): Promise<Blob> => {
    const response = await apiClient.get('/audit/export', {
      params: { format, start_date: startDate, end_date: endDate },
      responseType: 'blob',
    });
    return response.data;
  },
};