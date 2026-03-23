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

  useEffect(() => {
    fetchItems();
  }, [page, search, filterCategory, filterHidden, mode]);

  async function fetchItems() {
    setLoading(true);

    let query = supabase.from('code_dict').select('*', { count: 'exact' });

    // 모델 사용 코드 탭: specs 테이블에서 실제 사용된 코드만 필터
    if (mode === 'updated') {
      const { data: specData } = await supabase
        .from('specs')
        .select('spec_value')
        .not('spec_value', 'is', null);
      const modelCodes = [...new Set((specData || []).map((r) => r.spec_value))];
      if (modelCodes.length === 0) {
        setItems([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      query = query.in('code', modelCodes);
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
    upsertItem, deleteItem, toggleHidden,
    refetch: fetchItems,
  };
}
