import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import Button from '../../components/ui/Button';
import Toggle from '../../components/ui/Toggle';
import { supabase } from '../../lib/supabase';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setUsers(data ?? []);
    setLoading(false);
  }

  async function toggleRole(user) {
    const newRole = user.role === 'admin' ? 'sales' : 'admin';
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', user.id);
    if (!error) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
    }
  }

  async function toggleActive(user) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !user.is_active })
      .eq('id', user.id);
    if (!error) {
      setUsers((prev) =>
        prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u)
      );
    }
  }

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const salesCount = users.filter((u) => u.role === 'sales').length;

  return (
    <Layout>
      <div className="mb-4 sm:mb-6">
        <h1 className="font-barlow font-bold text-lg sm:text-2xl text-gray-900 tracking-wide">사용자 관리</h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">
          총 {users.length}명 (관리자 {adminCount}명 / 영업 {salesCount}명)
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* 데스크톱 테이블 */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-gray-500 font-medium">이름</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium hidden sm:table-cell">가입일</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium w-24">역할</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium w-24">활성</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-gray-400 animate-pulse">로딩 중...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-gray-400">등록된 사용자가 없습니다.</td>
              </tr>
            ) : users.map((user) => (
              <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${!user.is_active ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{user.name || '(이름 없음)'}</div>
                  <div className="text-xs text-gray-400 font-mono">{user.id.slice(0, 8)}...</div>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                  {new Date(user.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleRole(user)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      user.role === 'admin'
                        ? 'bg-mb-blue text-white hover:bg-mb-blue-dark'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {user.role === 'admin' ? 'Admin' : 'Sales'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <Toggle
                    checked={user.is_active ?? true}
                    onChange={() => toggleActive(user)}
                  />
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
        ) : users.map((user) => (
          <div
            key={user.id}
            className={`bg-white border border-gray-200 rounded-lg p-3 ${!user.is_active ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 text-sm">{user.name || '(이름 없음)'}</div>
                <div className="text-xs text-gray-400 font-mono">{user.id.slice(0, 8)}...</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleRole(user)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.role === 'admin'
                      ? 'bg-mb-blue text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {user.role === 'admin' ? 'Admin' : 'Sales'}
                </button>
                <Toggle
                  checked={user.is_active ?? true}
                  onChange={() => toggleActive(user)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs sm:text-sm text-amber-700">
        <strong>참고:</strong> 신규 사용자는 Supabase Authentication에서 이메일로 초대 후 자동으로 이 목록에 추가됩니다.
        역할 기본값은 <code className="bg-amber-100 px-1 rounded">sales</code>이며 필요 시 Admin으로 변경하세요.
      </div>
    </Layout>
  );
}
