import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 50;

export function useDict() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterHidden, setFilterHidden] = useState('all'); // 'all' | 'shown' | 'hidden'
  const [mode, setMode] = useState('all'); // 'all' | 'updated'
  // 모델에서 사용 중이지만 code_dict에 미등록된 코드
  const [unregisteredCodes, setUnregisteredCodes] = useState([]);

  useEffect(() => {
    fetchItems();
  }, [page, search, filterCategory, filterHidden, mode]);

  async function fetchItems() {
    setLoading(true);
    setUnregisteredCodes([]);

    let query = supabase.from('code_dict').select('*', { count: 'exact' });

    // 모델 사용 코드 탭: specs 테이블에서 실제 사용된 코드 기준
    if (mode === 'updated') {
      const { data: specData } = await supabase
        .from('specs')
        .select('spec_value')
        .eq('use_translate', true)
        .not('spec_value', 'is', null);

      const allSpecCodes = [...new Set((specData || []).map((r) => r.spec_value))];

      if (allSpecCodes.length === 0) {
        setItems([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      // code_dict에 등록된 코드 확인
      const { data: dictCodes } = await supabase
        .from('code_dict')
        .select('code')
        .in('code', allSpecCodes);

      const registeredSet = new Set((dictCodes || []).map((d) => d.code));

      // 미등록 코드 (검색어 적용)
      let unregistered = allSpecCodes
        .filter((c) => !registeredSet.has(c))
        .sort();
      if (search) {
        unregistered = unregistered.filter((c) =>
          c.toLowerCase().includes(search.toLowerCase())
        );
      }
      setUnregisteredCodes(unregistered);

      query = query.in('code', allSpecCodes);
    }

    if (search) {
      query = query.or(`code.ilike.%${search}%,name_ko.ilike.%${search}%,name_en.ilike.%${search}%`);
    }
    if (filterCategory) {
      query = query.eq('category', filterCategory);
    }
    if (filterHidden === 'shown') {
      query = query.eq('is_hidden', false);
    } else if (filterHidden === 'hidden') {
      query = query.eq('is_hidden', true);
    }

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query
      .range(from, to)
      .order('category', { ascending: true, nullsFirst: false })
      .order('code', { ascending: true });

    const { data, error, count } = await query;

    if (error) setError(error.message);
    else {
      setItems(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }

  async function upsertItem(item) {
    const { error } = await supabase
      .from('code_dict')
      .upsert({ ...item, updated_at: new Date().toISOString() }, { onConflict: 'code' });
    if (error) throw error;
    await fetchItems();
  }

  async function deleteItem(id) {
    const { error } = await supabase.from('code_dict').delete().eq('id', id);
    if (error) throw error;
    await fetchItems();
  }

  async function toggleHidden(id, currentValue) {
    const { error } = await supabase
      .from('code_dict')
      .update({ is_hidden: !currentValue, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_hidden: !currentValue } : i)));
  }

  // 카테고리 목록 조회 (필터용)
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    supabase
      .from('code_dict')
      .select('category')
      .not('category', 'is', null)
      .then(({ data }) => {
        if (data) {
          const cats = [...new Set(data.map((r) => r.category).filter(Boolean))].sort();
          setCategories(cats);
        }
      });
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return {
    items, total, totalPages, loading, error,
    page, setPage,
    search, setSearch,
    filterCategory, setFilterCategory,
    filterHidden, setFilterHidden,
    mode, setMode,
    categories,
    unregisteredCodes,
    upsertItem, deleteItem, toggleHidden,
    refetch: fetchItems,
  };
}
