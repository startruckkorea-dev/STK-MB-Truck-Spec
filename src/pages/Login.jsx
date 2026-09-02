import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signInWithMicrosoft } from '../lib/msal';

/**
 * MSAL 오류 → 사용자에게 보여줄 안내 문구.
 * AADSTS 코드별로 원인이 분명한 것은 한국어로 풀어 준다.
 */
function loginErrorMessage(err, appKey) {
  const detail = String(err?.errorMessage || err?.message || '');
  const code = err?.errorCode || 'unknown';
  const appName = appKey === 'agent' ? '세일즈 에이전트' : 'STK 소속';

  // 앱 등록에 '할당 필요=예' 인데 계정이 할당되지 않음
  if (detail.includes('AADSTS50105')) {
    return `이 계정은 ${appName} 로그인에 사용할 수 없습니다. 관리자가 Entra 엔터프라이즈 앱 > 사용자 및 그룹에 계정을 할당해야 합니다. (AADSTS50105)`;
  }
  // 리디렉션 URI 미등록
  if (detail.includes('AADSTS50011')) {
    return `앱 등록에 이 주소의 리디렉션 URI 가 없습니다. 관리자에게 문의하세요. (AADSTS50011)`;
  }
  // 테넌트에 없는 계정
  if (detail.includes('AADSTS50020') || detail.includes('AADSTS700016')) {
    return `이 조직에 등록되지 않은 계정입니다. 관리자에게 초대(게스트 등록)를 요청하세요.`;
  }
  return `Microsoft 365 로그인 중 오류가 발생했습니다. (${code})`;
}

function MsLogo() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

export default function Login() {
  // 진행 중인 로그인 경로 ('internal' | 'agent' | null)
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // 이미 인증된 상태면 모델 목록으로
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/models', { replace: true });
    }
  }, [authLoading, user, navigate]);

  async function handleMicrosoftLogin(appKey) {
    setError('');
    setPending(appKey);
    try {
      await signInWithMicrosoft(appKey);
      navigate('/models', { replace: true });
    } catch (err) {
      if (err?.errorCode !== 'user_cancelled') {
        setError(loginErrorMessage(err, appKey));
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 font-noto">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <img
            src="/mb-trucks-logo.png"
            alt="Mercedes-Benz Trucks"
            className="h-12 w-auto mx-auto mb-4"
          />
          <h1 className="font-barlow font-bold text-2xl text-gray-900 tracking-wide">
            메르세데스-벤츠 트럭
          </h1>
          <p className="text-gray-500 text-sm mt-1">모델 정보</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-5">
          {/* STK 소속 — 사내 앱 등록 */}
          <button
            type="button"
            onClick={() => handleMicrosoftLogin('internal')}
            disabled={!!pending}
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition disabled:opacity-60"
          >
            <MsLogo />
            {pending === 'internal' ? '연결 중...' : 'STK 소속 — Microsoft 365 계정으로 로그인'}
          </button>

          {/* 구분선 */}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-[11px] text-gray-400">또는</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          {/* 세일즈 에이전트 — STK-Sales-Freelancer 앱 등록 */}
          <button
            type="button"
            onClick={() => handleMicrosoftLogin('agent')}
            disabled={!!pending}
            className="w-full flex flex-col items-center gap-1 py-3 rounded-lg text-sm font-medium text-white bg-mb-blue hover:bg-mb-blue-dark transition disabled:opacity-60"
          >
            <span className="flex items-center justify-center gap-2">
              <MsLogo />
              {pending === 'agent' ? '연결 중...' : '세일즈 에이전트 로그인'}
            </span>
            <span className="text-[11px] font-normal text-white/80">
              gmail.com / startruck.kr 계정
            </span>
          </button>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          스타트럭코리아
        </p>
      </div>
    </div>
  );
}
