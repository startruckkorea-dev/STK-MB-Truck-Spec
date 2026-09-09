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
  const appName = appKey === 'agent' ? 'Google(세일즈 에이전트)' : 'HYOSUNG';

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
  return `로그인 중 오류가 발생했습니다. (${code})`;
}

function MsLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.97-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      className="w-4 h-4 text-gray-400 shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 로그인 배너 — 로고 타일 + 제목/부제 + 화살표 */
function LoginBanner({ logo, title, subtitle, busy, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-gray-300 rounded-xl text-left hover:bg-gray-50 hover:border-gray-400 transition disabled:opacity-60 disabled:hover:bg-white"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
        {logo}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-gray-900">
          {busy ? '연결 중...' : title}
        </span>
        <span className="block text-[11px] text-gray-500 mt-0.5">{subtitle}</span>
      </span>
      <Chevron />
    </button>
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

        {/* 로그인 카드 — 배너 2개 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-3">
          {/* 1) HYOSUNG — 사내 앱 등록 */}
          <LoginBanner
            logo={<MsLogo />}
            title="HYOSUNG 계정으로 로그인"
            subtitle="STK 소속 · Microsoft 365 사내 계정"
            busy={pending === 'internal'}
            disabled={!!pending}
            onClick={() => handleMicrosoftLogin('internal')}
          />

          {/* 2) Google — STK-Sales-Freelancer 앱 등록 (gmail / startruck.kr 게스트) */}
          <LoginBanner
            logo={<GoogleLogo />}
            title="Google 계정으로 로그인"
            subtitle="세일즈 에이전트 · gmail.com / startruck.kr"
            busy={pending === 'agent'}
            disabled={!!pending}
            onClick={() => handleMicrosoftLogin('agent')}
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">스타트럭코리아</p>
      </div>
    </div>
  );
}
