import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn, profile } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      // profile 로드 후 리다이렉트는 App.jsx의 라우트 가드가 처리
      navigate('/models', { replace: true });
    } catch (err) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
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

        {/* 로그인 폼 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue focus:border-transparent transition"
                placeholder="example@mercedes-benz.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              size="lg"
              className="w-full"
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Mercedes-Benz Trucks Korea — 사내 전용
        </p>
      </div>
    </div>
  );
}
