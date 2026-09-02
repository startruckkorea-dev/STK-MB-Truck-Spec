import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signInWithMicrosoft } from '../lib/msal';

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
        setError(
          'Microsoft 365 로그인 중 오류가 발생했습니다. (' +
            (err?.errorCode || err?.message || 'unknown') +
            ')',
        );
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
          <div className="text-center space-y-1">
            <p className="font-medium text-gray-800">사내 계정으로 로그인</p>
            <p className="text-xs text-gray-500">
              Microsoft 365 계정으로 접속하세요.
            </p>
          </div>

          {/* 정직원 — 사내 앱 등록 */}
          <button
            type="button"
            onClick={() => handleMicrosoftLogin('internal')}
            disabled={!!pending}
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition disabled:opacity-60"
          >
            <MsLogo />
            {pending === 'internal' ? '연결 중...' : '정직원 — Microsoft 365 계정으로 로그인'}
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
          Mercedes-Benz Trucks Korea — 사내 전용
        </p>
      </div>
    </div>
  );
}
