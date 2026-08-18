import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LangToggle from './ui/LangToggle';

const ROLE_LABEL = {
  admin: '관리자',
  'staff-a': '본사직원A',
  'staff-b': '본사직원B',
  staff: '본사직원', // 구버전 호환
  sales: '영업직원',
};
const ROLE_BADGE_CLS = {
  admin: 'bg-mb-blue text-white',
  'staff-a': 'bg-green-100 text-green-700',
  'staff-b': 'bg-green-100 text-green-700',
  staff: 'bg-green-100 text-green-700',
  sales: 'bg-gray-100 text-gray-600',
};
// 역할별 사용자 매뉴얼 (권한에 맞는 매뉴얼만 노출 — 알 수 없는 역할은 최소 권한 매뉴얼로 폴백)
const MANUAL_BY_ROLE = {
  admin: '/manuals/manual-admin.html',
  'staff-a': '/manuals/manual-staff-a.html',
  'staff-b': '/manuals/manual-staff-b-sales.html',
  staff: '/manuals/manual-staff-b-sales.html',
  sales: '/manuals/manual-staff-b-sales.html',
};

export default function Layout({ children }) {
  const { profile, isAdmin, canViewDict, isBootstrap, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const manualUrl = MANUAL_BY_ROLE[profile?.role] || '/manuals/manual-staff-b-sales.html';

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-white font-noto">
      {/* ── 상단 네비게이션 ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12 sm:h-14">
            {/* 좌측: 로고 + 제목 */}
            <Link to="/models" className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img
                src="/mb-trucks-logo.png"
                alt="Mercedes-Benz Trucks"
                className="h-6 sm:h-7 w-auto flex-shrink-0"
              />
              <span className="font-noto font-bold text-base sm:text-lg text-gray-900 leading-none whitespace-nowrap">
                메르세데스-벤츠 트럭 모델 정보
              </span>
            </Link>

            {/* 데스크톱 메뉴 (sm 이상) */}
            <nav className="hidden sm:flex items-center gap-1">
              <NavLink
                to="/models"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-mb-blue text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                모델 목록
              </NavLink>
              <NavLink
                to="/colors"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-mb-blue text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                색상코드
              </NavLink>
              {isAdmin && (
                <NavLink
                  to="/admin/models"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-mb-blue text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  모델 관리
                </NavLink>
              )}
              {canViewDict && (
                <NavLink
                  to="/admin/dict"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-mb-blue text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  코드 사전
                </NavLink>
              )}
              <a
                href={manualUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                사용자매뉴얼
              </a>
            </nav>

            {/* 우측: 언어 토글 + 사용자 + 로그아웃 (데스크톱) + 햄버거 (모바일) */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="hidden sm:block">
                <LangToggle />
              </div>
              <div className="hidden sm:flex items-center gap-1.5 min-w-0">
                <span className="text-xs text-gray-500 truncate max-w-[120px]">
                  {profile?.name || profile?.email}
                </span>
                {profile?.role && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${
                      ROLE_BADGE_CLS[profile.role] || ROLE_BADGE_CLS.sales
                    }`}
                  >
                    {ROLE_LABEL[profile.role] || profile.role}
                  </span>
                )}
              </div>
              <button
                onClick={handleSignOut}
                className="hidden sm:block px-3 py-1.5 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                로그아웃
              </button>
              {/* 모바일 햄버거 */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="sm:hidden p-2 -mr-1 rounded text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="메뉴"
              >
                {menuOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 모바일 드롭다운 메뉴 */}
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white shadow-lg">
            <nav className="px-3 py-2 space-y-1">
              <NavLink
                to="/models"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-mb-blue text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                모델 목록
              </NavLink>
              <NavLink
                to="/colors"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-mb-blue text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                색상코드
              </NavLink>
              {isAdmin && (
                <NavLink
                  to="/admin/models"
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-mb-blue text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  모델 관리
                </NavLink>
              )}
              {canViewDict && (
                <NavLink
                  to="/admin/dict"
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-mb-blue text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  코드 사전
                </NavLink>
              )}
              <a
                href={manualUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                사용자매뉴얼
              </a>
              <div className="border-t border-gray-100 pt-2 mt-1">
                <div className="px-3 py-2">
                  <LangToggle />
                </div>
                <div className="px-3 py-1 flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 truncate">
                    {profile?.name || profile?.email}
                  </span>
                  {profile?.role && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none ${
                        ROLE_BADGE_CLS[profile.role] || ROLE_BADGE_CLS.sales
                      }`}
                    >
                      {ROLE_LABEL[profile.role] || profile.role}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setMenuOpen(false); handleSignOut(); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  로그아웃
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ── 부트스트랩 경고 (접근권한 목록이 비어 임시 관리자일 때) ── */}
      {isBootstrap && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-xs text-amber-800 leading-relaxed">
              접근권한 목록(<span className="font-semibold">Access_List</span>)이 비어 있어
              임시로 <span className="font-semibold">관리자</span> 권한이 부여되었습니다.
              SharePoint <span className="font-semibold">Access</span> 폴더의 권한 파일(G=이메일, H=권한)을 설정해 주세요.
            </p>
          </div>
        </div>
      )}

      {/* ── 본문 ── */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
