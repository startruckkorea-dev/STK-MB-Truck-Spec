import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ROLE_LABEL = { admin: '관리자', staff: '본사직원', sales: '영업직원' };
const ROLE_BADGE_CLS = {
  admin: 'bg-mb-blue text-white',
  staff: 'bg-green-100 text-green-700',
  sales: 'bg-gray-100 text-gray-600',
};

export default function Layout({ children }) {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

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
                src="/MB_Star_Logo_black.png"
                alt="MB Star"
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
              {isAdmin && (
                <>
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
                  <NavLink
                    to="/admin/users"
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-mb-blue text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`
                    }
                  >
                    사용자
                  </NavLink>
                </>
              )}
            </nav>

            {/* 우측: 사용자 + 로그아웃 (데스크톱) + 햄버거 (모바일) */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-gray-500 hidden sm:block truncate max-w-[120px]">
                {profile?.name || profile?.role}
              </span>
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
              {isAdmin && (
                <>
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
                  <NavLink
                    to="/admin/users"
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-mb-blue text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    사용자
                  </NavLink>
                </>
              )}
              <div className="border-t border-gray-100 pt-2 mt-1">
                <div className="px-3 py-1 text-xs text-gray-400">
                  {profile?.name || profile?.role}
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

      {/* ── 본문 ── */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
