import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupDone, setSignupDone] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  function switchMode(next) {
    setMode(next);
    setError('');
    setSignupDone(false);
    setEmail('');
    setPassword('');
    setName('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
        navigate('/models', { replace: true });
      } else {
        await signUp(email, password, name);
        setSignupDone(true);
      }
    } catch (err) {
      if (mode === 'login') {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setError(err.message || '회원가입 중 오류가 발생했습니다.');
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

        {/* 탭 */}
        <div className="flex rounded-xl bg-gray-200 p-1 mb-4">
          <button
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              mode === 'login'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => switchMode('signup')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
              mode === 'signup'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            회원가입
          </button>
        </div>

        {/* 폼 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {signupDone ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">✉️</div>
              <p className="font-medium text-gray-800">가입 신청 완료!</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                <span className="font-medium text-gray-700">{email}</span>로<br />
                인증 메일을 보냈습니다.<br />
                메일 확인 후 로그인해 주세요.
              </p>
              <button
                onClick={() => switchMode('login')}
                className="text-sm text-blue-600 hover:underline"
              >
                로그인 화면으로 돌아가기
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    이름
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue focus:border-transparent transition"
                    placeholder="홍길동"
                  />
                </div>
              )}

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
                  비밀번호{mode === 'signup' && <span className="text-gray-400 font-normal"> (6자 이상)</span>}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={mode === 'signup' ? 6 : undefined}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
                {loading
                  ? (mode === 'login' ? '로그인 중...' : '가입 중...')
                  : (mode === 'login' ? '로그인' : '회원가입')}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Mercedes-Benz Trucks Korea — 사내 전용
        </p>
      </div>
    </div>
  );
}
