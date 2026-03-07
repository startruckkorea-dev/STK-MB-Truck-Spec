import { useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useModels } from '../../hooks/useModels';
import { supabase } from '../../lib/supabase';

const SERIES_BADGE = { Actros: 'actros', Arocs: 'arocs', Atego: 'atego' };

export default function AdminModels() {
  const { models, loading, error, refetch } = useModels();
  const [deleting, setDeleting] = useState(null);

  async function toggleVisibility(model) {
    const { error } = await supabase
      .from('models')
      .update({ is_visible: !model.is_visible })
      .eq('id', model.id);
    if (!error) refetch();
  }

  async function deleteModel(id) {
    if (!window.confirm('이 모델과 모든 사양 데이터를 삭제하시겠습니까?')) return;
    setDeleting(id);
    const { error } = await supabase.from('models').delete().eq('id', id);
    if (!error) refetch();
    setDeleting(null);
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="font-barlow font-bold text-lg sm:text-2xl text-gray-900 tracking-wide">
            모델 관리
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">총 {models.length}개 모델</p>
        </div>
        <Link to="/admin/models/new">
          <Button className="text-xs sm:text-sm">+ 모델 등록</Button>
        </Link>
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-400 animate-pulse">로딩 중...</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* 모바일: 카드 리스트 / 데스크톱: 테이블 */}
      {!loading && (
        <>
          {/* 데스크톱 테이블 (sm 이상) */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">모델</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">시리즈</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">MY</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">상태</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {models.map((model) => (
                  <tr
                    key={model.id}
                    className={`hover:bg-gray-50 transition-colors ${!model.is_visible ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{model.name_ko}</div>
                      <div className="font-mono text-xs text-gray-400">{model.code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={SERIES_BADGE[model.series] ?? 'default'}>{model.series}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-mono text-xs text-mb-blue font-semibold">{model.model_year}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          model.is_visible
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {model.is_visible ? '공개' : '숨김'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleVisibility(model)}
                          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                          title={model.is_visible ? '숨기기' : '공개하기'}
                        >
                          {model.is_visible ? '숨김' : '공개'}
                        </button>
                        <Link
                          to={`/admin/models/${model.id}/edit`}
                          className="px-2 py-1 text-xs text-mb-blue hover:bg-blue-50 rounded transition-colors"
                        >
                          편집
                        </Link>
                        <Link
                          to={`/models/${model.id}`}
                          className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                        >
                          보기
                        </Link>
                        <button
                          onClick={() => deleteModel(model.id)}
                          disabled={deleting === model.id}
                          className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {models.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                      등록된 모델이 없습니다.{' '}
                      <Link to="/admin/models/new" className="text-mb-blue hover:underline">
                        모델 등록하기
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 리스트 (sm 미만) */}
          <div className="sm:hidden space-y-2">
            {models.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                등록된 모델이 없습니다.{' '}
                <Link to="/admin/models/new" className="text-mb-blue hover:underline">
                  모델 등록하기
                </Link>
              </div>
            )}
            {models.map((model) => (
              <div
                key={model.id}
                className={`bg-white border border-gray-200 rounded-xl p-3 ${!model.is_visible ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <Badge variant={SERIES_BADGE[model.series] ?? 'default'}>{model.series}</Badge>
                      <span className="font-mono text-xs text-mb-blue font-semibold">{model.model_year}</span>
                      <span
                        className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                          model.is_visible ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {model.is_visible ? '공개' : '숨김'}
                      </span>
                    </div>
                    <div className="font-medium text-gray-900 text-sm">{model.name_ko}</div>
                    <div className="font-mono text-xs text-gray-400">{model.code}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => toggleVisibility(model)}
                    className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                  >
                    {model.is_visible ? '숨김' : '공개'}
                  </button>
                  <Link
                    to={`/admin/models/${model.id}/edit`}
                    className="px-2 py-1 text-xs text-mb-blue hover:bg-blue-50 rounded transition-colors"
                  >
                    편집
                  </Link>
                  <Link
                    to={`/models/${model.id}`}
                    className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                  >
                    보기
                  </Link>
                  <button
                    onClick={() => deleteModel(model.id)}
                    disabled={deleting === model.id}
                    className="ml-auto px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
