import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * 접근 권한이 없을 때(읽기 실패 / 미등록 사용자) 콘텐츠 대신 보여주는 전체 화면 안내.
 * 로그인 자체는 되어 있으므로, 로그아웃·재시도만 제공한다.
 */
export default function AccessNotice() {
  const { accessStatus, profile, signOut, recheckAccess } = useAuth();
  const navigate = useNavigate();

  const isError = accessStatus === 'error';

  const title = isError ? '권한 정보를 불러오지 못했습니다' : '접근 권한이 없습니다';
  const message = isError
    ? '접근권한 목록(Access_List) 파일을 읽지 못했습니다. 네트워크 상태를 확인하고 다시 시도하거나, 파일 접근 권한을 관리자에게 문의해 주세요.'
    : '회사 계정 로그인은 완료되었으나, 이 앱을 사용할 권한이 부여되지 않았습니다. 관리자(상품기획팀)에게 권한 요청을 문의해 주세요.';

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 font-noto">
      <div className="w-full max-w-sm text-center">
        <img
          src="/mb-trucks-logo.png"
          alt="Mercedes-Benz Trucks"
          className="h-10 w-auto mx-auto mb-6"
        />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-4">
          <div
            className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
              isError ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <h1 className="font-bold text-lg text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
          {profile?.email && (
            <p className="text-xs text-gray-400 break-all">로그인 계정: {profile.email}</p>
          )}
          <div className="pt-2 space-y-2">
            {isError && (
              <button
                type="button"
                onClick={recheckAccess}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-mb-blue hover:bg-mb-blue-dark transition"
              >
                다시 시도
              </button>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
