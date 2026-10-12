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
import { CalendarView } from './components/calendar/CalendarView';
import { EisenhowerMatrix } from './components/matrix/EisenhowerMatrix';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ProfileSettingsModal } from './components/profile/ProfileSettingsModal';
import { CreateListModal } from './components/sidebar/CreateListModal';
import { CreateTeamModal } from './components/sidebar/CreateTeamModal';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { ClickFeedbackProvider } from './components/common/ClickFeedback';
import toast, { Toaster, ToastBar, useToasterStore } from 'react-hot-toast';

// ─────────────────────────────────────────────────
// Auto Toast Limit Manager (limits active toasts to max 3)
// ─────────────────────────────────────────────────
const ToastLimitManager = ({ limit = 3 }) => {
  const { toasts } = useToasterStore();

  React.useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .filter((_, i) => i >= limit)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts, limit]);

  return null;
};

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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-[#18181c] font-sans antialiased text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white">
      
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
      ) : activeView === 'matrix' ? (
        <>
          <EisenhowerMatrix />
          <TaskDetailPanel />
        </>
      ) : activeView === 'calendar' ? (
        <CalendarView />
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

import { NotificationProvider } from './context/NotificationContext';

export default function App() {
  return (
    <BrowserRouter>
      <ClickFeedbackProvider>
        <AuthProvider>
          <TaskProvider>
            <NotificationProvider>
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

            {/* Real-time Toast Notification Provider (Anti-spam with auto-limit, interactive dismiss, and clean styling) */}
            <ToastLimitManager limit={3} />
            <Toaster 
              position="bottom-right"
              gutter={8}
              toastOptions={{
                duration: 2500,
                className: '!bg-white/95 dark:!bg-[#1c1d22]/95 !backdrop-blur-md !text-slate-800 dark:!text-slate-100 !border !border-slate-200/80 dark:!border-slate-700/80 !shadow-2xl !rounded-xl !text-xs !font-medium !p-2.5',
                success: {
                  duration: 2500,
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#ffffff',
                  },
                },
                error: {
                  duration: 3500,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#ffffff',
                  },
                },
              }}
            >
              {(t) => (
                <ToastBar toast={t} style={{ ...t.style, padding: '8px 12px' }}>
                  {({ icon, message }) => (
                    <div 
                      onClick={() => toast.dismiss(t.id)}
                      className="flex items-center gap-2 cursor-pointer w-full select-none"
                      title="Click to dismiss"
                    >
                      {icon}
                      <div className="flex-1 text-xs font-medium leading-tight">{message}</div>
                      {t.type !== 'loading' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.dismiss(t.id);
                          }}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 ml-1 rounded transition-colors text-xs opacity-70 hover:opacity-100"
                          title="Close notification"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </ToastBar>
              )}
            </Toaster>

            </NotificationProvider>
          </TaskProvider>
        </AuthProvider>
      </ClickFeedbackProvider>
    </BrowserRouter>
  );
}
