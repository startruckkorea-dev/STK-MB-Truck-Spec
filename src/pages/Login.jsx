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

function LockIcon() {
  return (
    <svg
      className="w-5 h-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GooglePlusIcon() {
  return (
    <span className="font-serif italic font-bold text-xl leading-none shrink-0" aria-hidden="true">
      g<sup className="text-sm not-italic">+</sup>
    </span>
  );
}

/** 로그인 버튼 — 색으로 채운 가로 꽉 찬 버튼 (아이콘 + 문구) */
function LoginButton({ icon, title, busy, disabled, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full h-12 flex items-center justify-center gap-2.5 rounded-md text-white text-base font-bold shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {icon}
      <span>{busy ? '연결 중...' : title}</span>
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

        {/* 로그인 카드 — 버튼 2개 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-3">
          {/* 1) HYOSUNG — 사내 앱 등록 */}
          <LoginButton
            icon={<LockIcon />}
            title="Hyosung M365 계정으로 로그인"
            busy={pending === 'internal'}
            disabled={!!pending}
            onClick={() => handleMicrosoftLogin('internal')}
            className="bg-[#0B5AA6] hover:bg-[#094C8C]"
          />

          {/* 2) Google — STK-Sales-Freelancer 앱 등록 (gmail / startruck.kr 게스트) */}
          <LoginButton
            icon={<GooglePlusIcon />}
            title="Google 계정으로 로그인"
            busy={pending === 'agent'}
            disabled={!!pending}
            onClick={() => handleMicrosoftLogin('agent')}
            className="bg-[#4A8AF4] hover:bg-[#3A78E0]"
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
