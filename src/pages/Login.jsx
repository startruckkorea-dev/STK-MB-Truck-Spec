import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signInWithMicrosoft } from '../lib/msal';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // 이미 인증된 상태면 모델 목록으로
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/models', { replace: true });
    }
  }, [authLoading, user, navigate]);

  async function handleMicrosoftLogin() {
    setError('');
    setLoading(true);
    try {
      await signInWithMicrosoft();
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
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 font-noto">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <img
            src="/MB_Star_Logo_black.png"
            alt="Mercedes-Benz Star"
            className="h-16 w-auto mx-auto mb-4"
          />
          <h1 className="font-barlow font-bold text-2xl text-gray-900 tracking-wide">
            메르세데스-벤츠 트럭
          </h1>
          <p className="text-gray-500 text-sm mt-1">사양 소개</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-5">
          <div className="text-center space-y-1">
            <p className="font-medium text-gray-800">사내 계정으로 로그인</p>
            <p className="text-xs text-gray-500">
              Microsoft 365 계정으로 접속하세요.
            </p>
          </div>

          <button
            type="button"
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 23 23" aria-hidden="true">
              <rect x="1" y="1" width="10" height="10" fill="#F25022" />
              <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
              <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
              <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
            </svg>
            {loading ? '연결 중...' : 'Microsoft 365 계정으로 로그인'}
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
