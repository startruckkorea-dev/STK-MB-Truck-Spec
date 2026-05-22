import { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { rowMbCode, normCode, isShortCode } from '../lib/codeIndex';

const PAGE_SIZE = 50;

/**
 * 코드 번역 사전 (SharePoint 캐시 기반)
 * 반환 시그니처는 기존 Supabase 버전과 동일 — AdminDict.jsx 무수정 유지.
 */
export function useDict() {
  const {
    codeDict, specs, codeIndex, loading, error, reload,
    upsertCode, deleteCode, setCodeHidden,
  } = useData();

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterHidden, setFilterHidden] = useState('all'); // 'all' | 'shown' | 'hidden'
  const [mode, setMode] = useState('all'); // 'all' | 'updated'

  // 모델 사양에서 실제 사용된 코드 (use_translate=true, 정규화)
  const usedSpecCodes = useMemo(
    () => [
      ...new Set(
        specs
          .filter((s) => s.use_translate && s.spec_value)
          .map((s) => normCode(s.spec_value))
          .filter(Boolean)
      ),
    ],
    [specs]
  );

  // 검색/필터/모드 적용
  const { filtered, unregisteredCodes } = useMemo(() => {
    let base = codeDict;
    let unregistered = [];

    if (mode === 'updated') {
      const usedSet = new Set(usedSpecCodes);
      base = base.filter((r) => usedSet.has(rowMbCode(r)));
      unregistered = usedSpecCodes.filter((c) => !codeIndex[c]).sort();
    }

    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter(
        (r) =>
          String(r.code || '').toLowerCase().includes(q) ||
          String(r.name_ko || '').toLowerCase().includes(q) ||
          String(r.name_en || '').toLowerCase().includes(q)
      );
      unregistered = unregistered.filter((c) => c.toLowerCase().includes(q));
    }
    if (filterCategory) {
      base = base.filter((r) => r.category === filterCategory);
    }
    if (filterHidden === 'shown') base = base.filter((r) => !r.is_hidden);
    else if (filterHidden === 'hidden') base = base.filter((r) => r.is_hidden);

    // 정렬: 카테고리 asc(빈 값 마지막), code asc
    const sorted = [...base].sort((a, b) => {
      const ca = a.category || '';
      const cb = b.category || '';
      if (ca !== cb) {
        if (!ca) return 1;
        if (!cb) return -1;
        return ca.localeCompare(cb);
      }
      return String(a.code || '').localeCompare(String(b.code || ''));
    });

    return { filtered: sorted, unregisteredCodes: unregistered };
  }, [codeDict, usedSpecCodes, codeIndex, mode, search, filterCategory, filterHidden]);

  const total = filtered.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const items = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page]
  );

  // 카테고리 목록 (MB 코드 형태는 제외, 실제 카테고리명만)
  const categories = useMemo(() => {
    const set = new Set();
    for (const r of codeDict) {
      if (r.category && !isShortCode(r.category)) set.add(r.category);
    }
    return [...set].sort();
  }, [codeDict]);

  return {
    items,
    total,
    totalPages,
    loading,
    error,
    page,
    setPage,
    search,
    setSearch,
    filterCategory,
    setFilterCategory,
    filterHidden,
    setFilterHidden,
    mode,
    setMode,
    categories,
    unregisteredCodes,
    upsertItem: (item) => upsertCode(item),
    deleteItem: (id) => deleteCode(id),
    toggleHidden: (id, currentValue) => setCodeHidden(id, !currentValue),
    refetch: reload,
  };
}
