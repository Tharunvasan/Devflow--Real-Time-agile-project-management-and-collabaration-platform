import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectOverviewPage } from './pages/ProjectOverviewPage';
import { KanbanBoardPage } from './pages/KanbanBoardPage';
import { SprintPage } from './pages/SprintPage';
import { IssuesPage } from './pages/IssuesPage';
import { RepositoryPage } from './pages/RepositoryPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { IssueDetailPage } from './pages/IssueDetailPage';
import { AllTasksPage } from './pages/AllTasksPage';
import { AllIssuesPage } from './pages/AllIssuesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <LoadingSpinner fullPage text="Loading..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Auth route wrapper (redirect if already logged in)
const AuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner fullPage text="Loading..." />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    {/* Public */}
    <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
    <Route path="/register" element={<AuthRoute><RegisterPage /></AuthRoute>} />

    {/* Protected */}
    <Route path="/" element={<ProtectedRoute><AppLayout><Navigate to="/dashboard" replace /></AppLayout></ProtectedRoute>} />

    <Route path="/dashboard" element={
      <ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>
    } />
    <Route path="/projects" element={
      <ProtectedRoute><AppLayout><ProjectsPage /></AppLayout></ProtectedRoute>
    } />

    {/* Project with nested routes */}
    <Route path="/projects/:id" element={
      <ProtectedRoute><AppLayout><ProjectDetailPage /></AppLayout></ProtectedRoute>
    }>
      <Route index element={<ProjectOverviewPage />} />
      <Route path="board" element={<KanbanBoardPage />} />
      <Route path="sprints" element={<SprintPage />} />
      <Route path="issues" element={<IssuesPage />} />
      <Route path="code" element={<RepositoryPage />} />
    </Route>

    <Route path="/tasks" element={
      <ProtectedRoute><AppLayout><AllTasksPage /></AppLayout></ProtectedRoute>
    } />
    <Route path="/tasks/:id" element={
      <ProtectedRoute><AppLayout><TaskDetailPage /></AppLayout></ProtectedRoute>
    } />
    <Route path="/issues" element={
      <ProtectedRoute><AppLayout><AllIssuesPage /></AppLayout></ProtectedRoute>
    } />
    <Route path="/issues/:id" element={
      <ProtectedRoute><AppLayout><IssueDetailPage /></AppLayout></ProtectedRoute>
    } />
    <Route path="/notifications" element={
      <ProtectedRoute><AppLayout><NotificationsPage /></AppLayout></ProtectedRoute>
    } />
    <Route path="/profile" element={
      <ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>
    } />
    <Route path="/admin/users" element={
      <ProtectedRoute roles={['ADMIN']}><AppLayout><AdminUsersPage /></AppLayout></ProtectedRoute>
    } />

    {/* Catch all */}
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#f1f5f9',
                border: '1px solid #334155',
                borderRadius: '10px',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#f1f5f9' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' } },
              duration: 3000,
            }}
          />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
