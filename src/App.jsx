import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { ProtectedRoute, PublicRoute } from './components/auth/RouteGuards';
import { AuthPage } from './components/auth/AuthPage';
import { ProfileSettingsPage } from './components/profile/ProfileSettingsPage';
import { Sidebar } from './components/sidebar/Sidebar';
import { TaskListPanel } from './components/task-list/TaskListPanel';
import { TaskDetailPanel } from './components/task-detail/TaskDetailPanel';
import { TaskDelegationMap } from './components/delegation-map/TaskDelegationMap';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ProfileSettingsModal } from './components/profile/ProfileSettingsModal';
import { CreateListModal } from './components/sidebar/CreateListModal';
import { CreateTeamModal } from './components/sidebar/CreateTeamModal';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { Toaster } from 'react-hot-toast';

// ─────────────────────────────────────────────────
// Main Dashboard Layout (authenticated users only)
// ─────────────────────────────────────────────────
const DashboardLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState('tasks'); // 'tasks' | 'map' | 'admin'
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState(null);
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#18181c] font-sans antialiased text-slate-100 selection:bg-blue-600 selection:text-white">
      
      {/* 1. Left Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onOpenAuth={() => {}}
        onOpenProfile={() => setIsProfileOpen(true)}
        activeView={activeView}
        setActiveView={setActiveView}
        onEditTeam={(team) => {
          setTeamToEdit(team);
          setIsCreateTeamOpen(true);
        }}
        deferredPrompt={deferredPrompt}
        onInstallPWA={handleInstallPWA}
      />

      {/* 2. Main Content Area */}
      {activeView === 'tasks' ? (
        <>
          <TaskListPanel
            onOpenCreateList={() => setIsCreateListOpen(true)}
            onOpenCreateTeam={() => setIsCreateTeamOpen(true)}
          />
          <TaskDetailPanel />
        </>
      ) : activeView === 'map' ? (
        <TaskDelegationMap />
      ) : (
        <AdminDashboard />
      )}

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      {/* Modals & Dialogs */}
      <ProfileSettingsModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <CreateListModal isOpen={isCreateListOpen} onClose={() => setIsCreateListOpen(false)} />
      <CreateTeamModal 
        isOpen={isCreateTeamOpen} 
        onClose={() => {
          setIsCreateTeamOpen(false);
          setTeamToEdit(null);
        }} 
        teamToEdit={teamToEdit} 
      />
    </div>
  );
};

// ─────────────────────────────────────────────────
// App Router
// ─────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TaskProvider>
          
          <Routes>
            {/* Public Routes: Auth Pages */}
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <AuthPage initialMode="login" />
                </PublicRoute>
              } 
            />
            <Route 
              path="/signup" 
              element={
                <PublicRoute>
                  <AuthPage initialMode="signup" />
                </PublicRoute>
              } 
            />

            {/* Protected Routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/settings/profile" 
              element={
                <ProtectedRoute>
                  <ProfileSettingsPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requiredRole="manager">
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Real-time Toast Notification Provider (always visible) */}
          <Toaster 
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#1f1f23',
                color: '#fff',
                border: '1px solid #334155',
                borderRadius: '12px',
                fontSize: '13px'
              }
            }}
          />

        </TaskProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
