import { useState } from 'react';
import Layout from '../../components/Layout';
import Button from '../../components/ui/Button';
import Toggle from '../../components/ui/Toggle';
import ExcelImport from '../../components/admin/ExcelImport';
import { useDict } from '../../hooks/useDict';
import { supabase } from '../../lib/supabase';

const CATEGORY_OPTIONS = [
  '엔진', '변속기', '차축', '서스펜션', '타이어/휠', '캡', '외장 컬러',
  '내장', '안전장비', '편의장비', '기타',
];

const EMPTY_FORM = {
  code: '', name_en: '', name_ko: '', category: '', hex_color: '', is_hidden: false,
};

// DB에 두 유형의 데이터가 혼재:
// 유형 A: code=긴영문, category=짧은MB코드 (엑셀 가져오기)
// 유형 B: code=짧은MB코드, name_en=영문설명 (모델 spec)
function getDisplayFields(item) {
  const cat = item.category;
  const catIsShortCode = cat && cat.length <= 6 && !cat.includes(' ');
  if (catIsShortCode) {
    return { shortCode: cat, engName: item.code, category: item.name_en };
  }
  return { shortCode: item.code, engName: item.name_en, category: item.category };
}

export default function AdminDict() {
  const {
    items, total, totalPages, loading, error,
    page, setPage,
    search, setSearch,
    filterCategory, setFilterCategory,
    filterHidden, setFilterHidden,
    mode, setMode,
    categories, unregisteredCodes,
    upsertItem, deleteItem, toggleHidden, refetch,
  } = useDict();

  const [modal, setModal] = useState(null); // null | 'new' | item
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function openNew(prefillCode = '') {
    setForm({ ...EMPTY_FORM, code: prefillCode });
    setFormError('');
    setModal('new');
  }

  function openEdit(item) {
    setForm({
      id: item.id,
      code: item.code,
      name_en: item.name_en ?? '',
      name_ko: item.name_ko,
      category: item.category ?? '',
      hex_color: item.hex_color ?? '',
      is_hidden: item.is_hidden,
    });
    setFormError('');
    setModal('edit');
  }

  async function handleSave() {
    if (!form.code || !form.name_ko) {
      setFormError('영문 코드와 국문 번역은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      await upsertItem({
        ...form,
        hex_color: form.hex_color || null,
        name_en: form.name_en || null,
        category: form.category || null,
      });
      setModal(null);
    } catch (err) {
      setFormError(err.message);
    }
    setSaving(false);
  }

  async function handleDelete(item) {
    if (!window.confirm(`"${item.code}" 코드를 삭제하시겠습니까?\n이 코드를 참조하는 사양 표시에 영향을 줄 수 있습니다.`)) return;
    try {
      await deleteItem(item.id);
    } catch (err) {
      alert(err.message);
    }
  }

  const allCategories = [...new Set([...CATEGORY_OPTIONS, ...categories])];

  return (
    <Layout>
      <div className="mb-4 sm:mb-6">
        <h1 className="font-barlow font-bold text-lg sm:text-2xl text-gray-900 tracking-wide">코드 번역 사전</h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">
          {mode === 'updated' ? `등록 모델 사용 코드 ${total.toLocaleString()}개` : `총 ${total.toLocaleString()}개 코드`}
        </p>
      </div>

      {/* 엑셀 가져오기 */}
      <div className="mb-4 sm:mb-6">
        <ExcelImport onImportComplete={refetch} />
      </div>

      {/* 탭 바 */}
      <div className="flex border border-gray-300 rounded-lg overflow-hidden mb-4 w-fit">
        <button
          onClick={() => { setMode('all'); setPage(0); }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'all'
              ? 'bg-mb-blue text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          전체 코드
        </button>
        <button
          onClick={() => { setMode('updated'); setPage(0); }}
          className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
            mode === 'updated'
              ? 'bg-mb-blue text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          모델 사용 코드
        </button>
      </div>

      {/* 필터 + 검색 + 등록 버튼 */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:flex-row sm:gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="코드 또는 번역명 검색..."
          className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
        />
        {mode === 'all' && (
          <div className="flex gap-2 sm:gap-3">
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(0); }}
              className="flex-1 sm:flex-none px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-mb-blue"
            >
              <option value="">전체 카테고리</option>
              {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterHidden}
              onChange={(e) => { setFilterHidden(e.target.value); setPage(0); }}
              className="flex-1 sm:flex-none px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-mb-blue"
            >
              <option value="all">전체</option>
              <option value="shown">표시</option>
              <option value="hidden">숨김</option>
            </select>
            <Button onClick={openNew} className="flex-shrink-0 text-xs sm:text-sm">+ 등록</Button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
      )}

      {/* 데스크톱 테이블 */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-gray-500 font-medium w-24">코드</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium hidden lg:table-cell">영문명</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">국문 번역</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">카테고리</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium w-20">컬러</th>
              <th className="text-center px-4 py-3 text-gray-500 font-medium w-20">숨김</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium w-20">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* 미등록 코드 행 (모델 사용 코드 탭에서만) */}
            {!loading && mode === 'updated' && unregisteredCodes.map((code) => (
              <tr key={`unreg-${code}`} className="bg-amber-50">
                <td className="px-4 py-2.5 font-mono text-xs text-amber-800 font-semibold whitespace-nowrap">{code}</td>
                <td className="px-4 py-2.5 text-amber-500 text-xs hidden lg:table-cell">—</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs text-amber-600 font-medium">번역 미등록</span>
                </td>
                <td className="px-4 py-2.5 text-amber-400 text-xs hidden md:table-cell">—</td>
                <td className="px-4 py-2.5 text-center">—</td>
                <td className="px-4 py-2.5 text-center">—</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => openNew(code)}
                    className="px-2 py-1 text-xs text-white bg-amber-500 hover:bg-amber-600 rounded transition-colors"
                  >
                    등록
                  </button>
                </td>
              </tr>
            ))}
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400 animate-pulse">로딩 중...</td>
              </tr>
            ) : items.length === 0 && unregisteredCodes.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400">검색 결과가 없습니다.</td>
              </tr>
            ) : items.map((item) => {
              const d = getDisplayFields(item);
              return (
              <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.is_hidden ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-800 whitespace-nowrap">{d.shortCode}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs hidden lg:table-cell break-words max-w-xs">{d.engName}</td>
                <td className="px-4 py-2.5 text-gray-900">
                  <div className="flex items-center gap-2">
                    {item.hex_color && (
                      <span
                        className="inline-block w-4 h-4 rounded-full border border-gray-200 flex-shrink-0"
                        style={{ backgroundColor: item.hex_color }}
                      />
                    )}
                    {item.name_ko}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-xs hidden md:table-cell">{d.category}</td>
                <td className="px-4 py-2.5 text-center">
                  {item.hex_color && (
                    <span className="font-mono text-xs text-gray-400">{item.hex_color}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Toggle
                    checked={item.is_hidden}
                    onChange={() => toggleHidden(item.id, item.is_hidden)}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(item)}
                      className="px-2 py-1 text-xs text-mb-blue hover:bg-blue-50 rounded transition-colors"
                    >
                      편집
                    </button>
                    {mode === 'all' && (
                      <button
                        onClick={() => handleDelete(item)}
                        className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              {page * 50 + 1}–{Math.min((page + 1) * 50, total)} / {total.toLocaleString()}개
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100 transition-colors"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100 transition-colors"
              >
                ‹
              </button>
              {(() => {
                const pages = [];
                let start = Math.max(0, page - 2);
                let end = Math.min(totalPages - 1, start + 4);
                start = Math.max(0, end - 4);
                for (let i = start; i <= end; i++) pages.push(i);
                return pages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      p === page
                        ? 'bg-mb-blue text-white'
                        : 'border border-gray-300 hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    {p + 1}
                  </button>
                ));
              })()}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100 transition-colors"
              >
                ›
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100 transition-colors"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="sm:hidden space-y-2">
        {/* 미등록 코드 카드 */}
        {!loading && mode === 'updated' && unregisteredCodes.map((code) => (
          <div key={`unreg-${code}`} className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-2">
            <div>
              <span className="font-mono text-xs font-semibold text-amber-800">{code}</span>
              <p className="text-xs text-amber-600 mt-0.5">번역 미등록</p>
            </div>
            <button
              onClick={() => openNew(code)}
              className="px-2 py-1 text-xs text-white bg-amber-500 hover:bg-amber-600 rounded transition-colors flex-shrink-0"
            >
              등록
            </button>
          </div>
        ))}
        {loading ? (
          <div className="text-center py-10 text-gray-400 animate-pulse">로딩 중...</div>
        ) : items.length === 0 && unregisteredCodes.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">검색 결과가 없습니다.</div>
        ) : items.map((item) => {
          const d = getDisplayFields(item);
          return (
          <div
            key={item.id}
            className={`bg-white border border-gray-200 rounded-lg p-3 ${item.is_hidden ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-semibold text-gray-800">{d.shortCode}</span>
                  {item.hex_color && (
                    <span
                      className="inline-block w-3.5 h-3.5 rounded-full border border-gray-200 flex-shrink-0"
                      style={{ backgroundColor: item.hex_color }}
                    />
                  )}
                </div>
                <div className="text-sm text-gray-700">{item.name_ko}</div>
                {d.engName && (
                  <div className="text-xs text-gray-400 mt-0.5">{d.engName}</div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => openEdit(item)}
                  className="px-2 py-1 text-xs text-mb-blue hover:bg-blue-50 rounded"
                >
                  편집
                </button>
                {mode === 'all' && (
                  <button
                    onClick={() => handleDelete(item)}
                    className="px-2 py-1 text-xs text-red-400 hover:bg-red-50 rounded"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>
          );
        })}

        {/* 모바일 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between py-3">
            <p className="text-xs text-gray-500">
              {page * 50 + 1}–{Math.min((page + 1) * 50, total)} / {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded disabled:opacity-40"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded disabled:opacity-40"
              >
                ‹
              </button>
              {(() => {
                const pages = [];
                let start = Math.max(0, page - 1);
                let end = Math.min(totalPages - 1, start + 2);
                start = Math.max(0, end - 2);
                for (let i = start; i <= end; i++) pages.push(i);
                return pages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2.5 py-1.5 text-xs rounded transition-colors ${
                      p === page
                        ? 'bg-mb-blue text-white'
                        : 'border border-gray-300 text-gray-600'
                    }`}
                  >
                    {p + 1}
                  </button>
                ));
              })()}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded disabled:opacity-40"
              >
                ›
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded disabled:opacity-40"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 등록/편집 모달 ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/30">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-barlow font-bold text-lg text-gray-900 tracking-wide">
              {modal === 'new' ? '코드 등록' : '코드 편집'}
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">영문 코드 *</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                disabled={modal === 'edit'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-mb-blue disabled:bg-gray-50"
                placeholder="예: OM471"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">영문 설명 (선택)</label>
              <input
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
                placeholder="예: 6-cylinder in-line diesel engine"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">국문 번역 *</label>
              <input
                value={form.name_ko}
                onChange={(e) => setForm((f) => ({ ...f, name_ko: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
                placeholder="예: 직렬 6기통 디젤 (OM471)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-mb-blue"
              >
                <option value="">선택안함</option>
                {CATEGORY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HEX 컬러 (선택)</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.hex_color || '#ffffff'}
                  onChange={(e) => setForm((f) => ({ ...f, hex_color: e.target.value }))}
                  className="w-10 h-9 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  value={form.hex_color}
                  onChange={(e) => setForm((f) => ({ ...f, hex_color: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-mb-blue"
                  placeholder="#1a1a1a"
                />
              </div>
            </div>
            <Toggle
              checked={form.is_hidden}
              onChange={(v) => setForm((f) => ({ ...f, is_hidden: v }))}
              label="숨김 (모든 모델에서 이 코드 비표시)"
            />

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {formError}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? '저장 중...' : '저장'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setModal(null)}
                disabled={saving}
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
