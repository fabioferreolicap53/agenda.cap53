import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Calendar from './pages/Calendar';
import CreateEvent from './pages/CreateEvent';
import Reports from './pages/Reports';
import Mensagens from './pages/Mensagens';
import Login from './pages/Login';
import Requests from './pages/Requests';
import MyInvolvement from './pages/MyInvolvement';
import AlmacManagement from './pages/AlmacManagement';
import InformaticsManagement from './pages/InformaticsManagement';
import TransportManagement from './pages/TransportManagement';
import LocationManagement from './pages/LocationManagement';
import TeamManagement from './pages/TeamManagement';
import VerifyEmail from './pages/VerifyEmail';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import Header from './components/Header';
import { AuthProvider, useAuth, UserRole } from './components/AuthContext';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full bg-white p-8 text-center">
          <div className="bg-red-50 p-6 rounded-xl border border-red-200 max-w-2xl">
            <span className="material-symbols-outlined text-red-500 text-5xl mb-4">error</span>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Algo deu errado</h1>
            <p className="text-gray-600 mb-4">A aplicação encontrou um erro inesperado.</p>
            <div className="bg-gray-900 text-red-400 p-4 rounded-lg text-left overflow-auto max-h-48 mb-6 font-mono text-xs">
              {this.state.error?.toString()}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-hover transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: UserRole[] }> = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role as UserRole)) {
    return <Navigate to="/calendar" replace />;
  }

  return <>{children}</>;
};

const LayoutContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = location.pathname === '/login';

  console.log('LayoutContent render:', { loading, hasUser: !!user, isAuthPage, path: location.pathname });

  React.useEffect(() => {
    if (!loading && !user && !isAuthPage) {
      console.log('Redirecting to login...');
      navigate('/login');
    }
  }, [user, loading, isAuthPage, navigate]);

  if (loading) {
    console.log('Rendering loading spinner...');
    return (
      <div className="flex items-center justify-center h-screen w-full bg-white text-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm animate-pulse">Carregando aplicação...</p>
        </div>
      </div>
    );
  }

  if (isAuthPage) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-white">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header />
        <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-5">
          {children}
        </div>
      </main>
      <RightSidebar />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <LayoutContent>
            <Routes>
              <Route path="/" element={<Navigate to="/calendar" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/verify-email/:token" element={<VerifyEmail />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/create-event" element={<ProtectedRoute roles={['ADMIN', 'USER', 'CE']}><CreateEvent /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute roles={['ADMIN']}><Reports /></ProtectedRoute>} />
              <Route path="/chat" element={<Mensagens />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/meu-envolvimento" element={<ProtectedRoute roles={['ADMIN', 'USER', 'CE']}><MyInvolvement /></ProtectedRoute>} />
              <Route path="/almoxarifado" element={<ProtectedRoute roles={['ADMIN', 'ALMC']}><AlmacManagement /></ProtectedRoute>} />
              <Route path="/informatica" element={<ProtectedRoute roles={['ADMIN', 'DCA']}><InformaticsManagement /></ProtectedRoute>} />
              <Route path="/transporte" element={<ProtectedRoute roles={['ADMIN', 'TRA']}><TransportManagement /></ProtectedRoute>} />
              <Route path="/locais" element={<ProtectedRoute roles={['ADMIN', 'CE']}><LocationManagement /></ProtectedRoute>} />
              <Route path="/equipe" element={<TeamManagement />} />
            </Routes>
          </LayoutContent>
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;