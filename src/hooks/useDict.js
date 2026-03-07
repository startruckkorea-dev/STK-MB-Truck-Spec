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

  useEffect(() => {
    fetchItems();
  }, [page, search, filterCategory, filterHidden]);

  async function fetchItems() {
    setLoading(true);

    let query = supabase.from('code_dict').select('*', { count: 'exact' });

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
    query = query.range(from, to).order('category').order('code');

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
    categories,
    upsertItem, deleteItem, toggleHidden,
    refetch: fetchItems,
  };
}
