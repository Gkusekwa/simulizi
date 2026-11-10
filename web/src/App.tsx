import { lazy, ReactNode, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const WorkPage = lazy(() => import('./pages/WorkPage').then((m) => ({ default: m.WorkPage })));
const ReaderPage = lazy(() => import('./pages/ReaderPage').then((m) => ({ default: m.ReaderPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then((m) => ({ default: m.SignupPage })));
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const StudioPage = lazy(() => import('./pages/studio/StudioPage').then((m) => ({ default: m.StudioPage })));
const WorkEditorPage = lazy(() => import('./pages/studio/WorkEditorPage').then((m) => ({ default: m.WorkEditorPage })));
const PartEditorPage = lazy(() => import('./pages/studio/PartEditorPage').then((m) => ({ default: m.PartEditorPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })));

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Loading() {
  const { t } = useTranslation();
  return <p className="muted" style={{ padding: '2rem' }}>{t('common.loading')}</p>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="w/:slug" element={<WorkPage />} />
              <Route path="w/:slug/:position" element={<ReaderPage />} />
              <Route path="@:handle" element={<ProfilePage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="library" element={<Protected><LibraryPage /></Protected>} />
              <Route path="notifications" element={<Protected><NotificationsPage /></Protected>} />
              <Route path="settings" element={<Protected><SettingsPage /></Protected>} />
              <Route path="studio" element={<Protected><StudioPage /></Protected>} />
              <Route path="studio/works/:id" element={<Protected><WorkEditorPage /></Protected>} />
              <Route path="studio/parts/:id" element={<Protected><PartEditorPage /></Protected>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
