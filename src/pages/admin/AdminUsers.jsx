import { useState } from 'react';
import Layout from '../../components/Layout';
import Button from '../../components/ui/Button';
import Toggle from '../../components/ui/Toggle';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../hooks/useAuth';

const ROLES = ['admin', 'staff', 'sales'];
const ROLE_LABEL = { admin: 'Admin', staff: 'Staff', sales: 'Sales' };

export default function AdminUsers() {
  const { users, loading, error, upsertUser, deleteUser } = useData();
  const { user: me } = useAuth();

  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'sales' });

  async function run(fn) {
    setActionError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setActionError(e.message);
    }
    setBusy(false);
  }

  function addUser() {
    const email = form.email.trim().toLowerCase();
    if (!email) {
      setActionError('이메일을 입력하세요.');
      return;
    }
    run(async () => {
      await upsertUser({ email, name: form.name.trim(), role: form.role, is_active: true });
      setForm({ email: '', name: '', role: 'sales' });
    });
  }

  function cycleRole(u) {
    const next = ROLES[(ROLES.indexOf(u.role) + 1) % ROLES.length];
    run(() => upsertUser({ email: u.email, role: next }));
  }

  function toggleActive(u) {
    run(() => upsertUser({ email: u.email, is_active: !(u.is_active ?? true) }));
  }

  function removeUser(u) {
    if (!window.confirm(`"${u.email}" 사용자를 삭제하시겠습니까?`)) return;
    run(() => deleteUser(u.email));
  }

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const staffCount = users.filter((u) => u.role === 'staff').length;
  const salesCount = users.filter((u) => u.role === 'sales').length;
  const myEmail = String(me?.email || '').trim().toLowerCase();

  return (
    <Layout>
      <div className="mb-4 sm:mb-6">
        <h1 className="font-barlow font-bold text-lg sm:text-2xl text-gray-900 tracking-wide">사용자 관리</h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">
          총 {users.length}명 (관리자 {adminCount}명 / 본사직원 {staffCount}명 / 영업 {salesCount}명)
        </p>
      </div>

      {adminCount === 0 && (
        <div className="mb-4 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs sm:text-sm text-amber-700">
          <strong>관리자가 아직 없습니다.</strong> 현재는 로그인한 모든 사용자가 임시로 관리자 권한을 갖습니다.
          본인 계정을 <code className="bg-amber-100 px-1 rounded">admin</code> 으로 먼저 등록하세요.
        </div>
      )}

      {(error || actionError) && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4 whitespace-pre-line">
          {error || actionError}
        </div>
      )}

      {/* 사용자 추가 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <h2 className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-sm mb-3">
          사용자 추가
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Microsoft 365 이메일"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
          />
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="이름 (선택)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
          />
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-mb-blue"
          >
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <Button onClick={addUser} disabled={busy} className="flex-shrink-0">추가</Button>
        </div>
      </div>

      {/* 데스크톱 테이블 */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-gray-500 font-medium">이름</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">이메일</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium w-24">역할</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium w-20">활성</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium w-20">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400 animate-pulse">로딩 중...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">등록된 사용자가 없습니다.</td></tr>
            ) : users.map((u) => (
              <tr key={u.email} className={`hover:bg-gray-50 transition-colors ${u.is_active === false ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {u.name || '(이름 없음)'}
                  {String(u.email).trim().toLowerCase() === myEmail && (
                    <span className="ml-1.5 text-xs text-mb-blue">(나)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">{u.email}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => cycleRole(u)}
                    disabled={busy}
                    title="클릭하여 역할 변경 (Admin → Staff → Sales)"
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      u.role === 'admin'
                        ? 'bg-mb-blue text-white hover:bg-blue-600'
                        : u.role === 'staff'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {ROLE_LABEL[u.role] || 'Sales'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <Toggle checked={u.is_active ?? true} onChange={() => toggleActive(u)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => removeUser(u)}
                    disabled={busy}
                    className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="sm:hidden space-y-2">
        {loading ? (
          <div className="text-center py-10 text-gray-400 animate-pulse">로딩 중...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">등록된 사용자가 없습니다.</div>
        ) : users.map((u) => (
          <div key={u.email} className={`bg-white border border-gray-200 rounded-lg p-3 ${u.is_active === false ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 text-sm">
                  {u.name || '(이름 없음)'}
                  {String(u.email).trim().toLowerCase() === myEmail && (
                    <span className="ml-1.5 text-xs text-mb-blue">(나)</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 font-mono truncate">{u.email}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => cycleRole(u)}
                  disabled={busy}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.role === 'admin'
                      ? 'bg-mb-blue text-white'
                      : u.role === 'staff'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {ROLE_LABEL[u.role] || 'Sales'}
                </button>
                <Toggle checked={u.is_active ?? true} onChange={() => toggleActive(u)} />
                <button
                  onClick={() => removeUser(u)}
                  disabled={busy}
                  className="px-2 py-1 text-xs text-red-400 hover:bg-red-50 rounded"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 sm:p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-600">
        역할 배지를 클릭하면 Admin → Staff → Sales 순으로 변경됩니다.
        <br />• <strong>Admin</strong>: 전체 관리 기능 &nbsp;• <strong>Staff (본사직원)</strong>: 코드 열람 가능 &nbsp;• <strong>Sales (영업직원)</strong>: 국문명만 표시
        <br />사용자가 앱을 쓰려면 SharePoint <code className="bg-gray-200 px-1 rounded">mbtruck-spec-data.xlsx</code> 파일의 읽기 권한도 필요합니다.
      </div>
    </Layout>
  );
}
