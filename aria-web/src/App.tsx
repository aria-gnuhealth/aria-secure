import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { Layout } from '@/components/Layout/Layout';
import { Dashboard } from '@/pages/doctor/Dashboard';
import { RoleRedirect } from '@/components/Layout/RoleRedirect';
import { useAuthStore } from '@/stores/authStore';
import { PatientsList } from '@/pages/doctor/patients/PatientsList';
import { PatientDetail } from '@/pages/doctor/patients/PatientDetail';
import { NewAnalysis } from '@/pages/doctor/analyses/NewAnalysis';
import { AnalysisResult } from '@/pages/doctor/analyses/AnalysisResult';
import { AnalysesList } from '@/pages/doctor/analyses/AnalysesList';
import { ReportGenerator } from '@/pages/doctor/reports/ReportGenerator';
import { ReportsList } from '@/pages/doctor/reports/ReportsList';

// Composant de redirection vers le bon dashboard
const DashboardRedirect: React.FC = () => {
  const { user } = useAuthStore();
  
  if (user?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  } else if (user?.role === 'radiologist') {
    return <Navigate to="/radiologist/dashboard" replace />;
  } else {
    return <Navigate to="/doctor/dashboard" replace />;
  }
};

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Pages publiques */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Dashboard selon le rôle */}
        <Route
          path="/doctor/*"
          element={
            <RoleRedirect allowedRoles={['doctor']}>
              <Layout />
            </RoleRedirect>
          }
        >
          <Route index element={<Navigate to="/doctor/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          {/* Autres routes docteur */}
          <Route path="settings" element={<div>Paramètres (à venir)</div>} />
          <Route path="patients" element={<PatientsList />} />
          <Route path="patients/:id" element={<PatientDetail />} />
          <Route path="patients/:patientId/new-analysis" element={<NewAnalysis />} />
          <Route path="analyses" element={<AnalysesList />} />
          <Route path="analysis/:analysisId" element={<AnalysisResult />} />
          <Route path="reports" element={<ReportsList />} />
          <Route path="reports/new/:analysisId" element={<ReportGenerator />} />

        </Route>

        {/* Routes pour le radiologue */}
        <Route
          path="/radiologist/*"
          element={
            <RoleRedirect allowedRoles={['radiologist']}>
              <Layout />
            </RoleRedirect>
          }
        >
          <Route index element={<Navigate to="/radiologist/dashboard" replace />} />
          <Route path="dashboard" element={<div>Dashboard Radiologue (à venir)</div>} />
          <Route path="patients" element={<div>Liste des patients (à venir)</div>} />
          <Route path="analyses" element={<div>Validation des analyses (à venir)</div>} />
        </Route>

        {/* Routes pour l'administrateur */}
        <Route
          path="/admin/*"
          element={
            <RoleRedirect allowedRoles={['admin']}>
              <Layout />
            </RoleRedirect>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<div>Dashboard Admin (à venir)</div>} />
          <Route path="models" element={<div>Gestion des modèles IA (à venir)</div>} />
          <Route path="audit" element={<div>Logs d\'audit (à venir)</div>} />
          <Route path="users" element={<div>Gestion des utilisateurs (à venir)</div>} />
        </Route>

        {/* Redirection racine */}
        <Route path="/" element={<DashboardRedirect />} />
        <Route path="/dashboard" element={<DashboardRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;