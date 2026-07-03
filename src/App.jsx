import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';

// 페이지
import Login from './pages/Login';
import Models from './pages/Models';
import ModelDetail from './pages/ModelDetail';
import Compare from './pages/Compare';
import AdminModels from './pages/admin/AdminModels';
import AdminModelEdit from './pages/admin/AdminModelEdit';
import AdminDict from './pages/admin/AdminDict';
import AccessNotice from './components/AccessNotice';

// ─── 라우트 가드 ──────────────────────────────────────────────
function RequireAuth({ children }) {
  const { user, loading, accessDenied } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  // 읽기 실패·미등록 사용자는 콘텐츠 대신 안내 화면만 표시
  if (accessDenied) return <AccessNotice />;
  return children;
}

function RequireAdmin({ children }) {
  const { user, profile, loading, accessDenied } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (accessDenied) return <AccessNotice />;
  if (profile && profile.role !== 'admin') return <Navigate to="/models" replace />;
  return children;
}

// 코드 사전: admin + 본사직원A (A는 읽기 전용). 그 외는 모델 목록으로.
function RequireDict({ children }) {
  const { user, loading, accessDenied, canViewDict } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (accessDenied) return <AccessNotice />;
  if (!canViewDict) return <Navigate to="/models" replace />;
  return children;
}

// 라우트(경로) 변경 시 항상 페이지 최상단으로 스크롤을 리셋한다.
// (모델 목록에서 스크롤을 내린 상태로 상세로 이동하면 중간부터 보이던 문제 해결)
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <img src="/mb-trucks-logo.png" alt="Mercedes-Benz Trucks" className="h-10 w-auto animate-pulse" />
        <p className="text-gray-400 text-sm">로딩 중...</p>
      </div>
    </div>
  );
}

// ─── 앱 라우팅 ────────────────────────────────────────────────
export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      {/* 비인증 */}
      <Route path="/login" element={<Login />} />

      {/* 인증 필요 */}
      <Route path="/models" element={<RequireAuth><Models /></RequireAuth>} />
      <Route path="/models/:id" element={<RequireAuth><ModelDetail /></RequireAuth>} />
      <Route path="/compare" element={<RequireAuth><Compare /></RequireAuth>} />

      {/* admin 전용 */}
      <Route path="/admin/models" element={<RequireAdmin><AdminModels /></RequireAdmin>} />
      <Route path="/admin/models/new" element={<RequireAdmin><AdminModelEdit /></RequireAdmin>} />
      <Route path="/admin/models/:id/edit" element={<RequireAdmin><AdminModelEdit /></RequireAdmin>} />
      <Route path="/admin/dict" element={<RequireDict><AdminDict /></RequireDict>} />

      {/* 기본 리다이렉트 */}
      <Route path="/" element={<Navigate to="/models" replace />} />
      <Route path="*" element={<Navigate to="/models" replace />} />
      </Routes>
    </>
  );
}
