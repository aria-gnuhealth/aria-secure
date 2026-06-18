export interface Patient {
  id: string;
  medical_record_number: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: 'M' | 'F' | 'O';
  phone?: string;
  address?: string;
  created_at: string;
}

export interface PatientCreate {
  medical_record_number: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: 'M' | 'F' | 'O';
  phone?: string;
  address?: string;
}

export interface PatientUpdate {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: 'M' | 'F' | 'O';
  phone?: string;
  address?: string;
}

export interface PatientListResponse {
  items: Patient[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface PatientStatsResponse {
  total_patients: number;
  gender_distribution: {
    male: number;
    female: number;
    other: number;
  };
  patients_with_analyses: number;
  percentage_with_analyses: number;
}