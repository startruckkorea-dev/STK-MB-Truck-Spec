import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 모델 목록 조회
 * - admin: is_visible=false 포함 전체
 * - sales: is_visible=true만 (RLS가 처리)
 */
export function useModels() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchModels();
  }, []);

  async function fetchModels() {
    setLoading(true);
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .order('model_year', { ascending: false })
      .order('series')
      .order('code');

    if (error) setError(error.message);
    else setModels(data ?? []);
    setLoading(false);
  }

  return { models, loading, error, refetch: fetchModels };
}

/**
 * 단일 모델 + 사양 + 보충 노트 조회
 */
export function useModelDetail(id) {
  const [model, setModel] = useState(null);
  const [specs, setSpecs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    fetchModelDetail(id);
  }, [id]);

  async function fetchModelDetail(modelId) {
    setLoading(true);

    const [
      { data: modelData, error: modelErr },
      { data: specsData, error: specsErr },
      { data: notesData, error: notesErr },
    ] = await Promise.all([
      supabase.from('models').select('*').eq('id', modelId).single(),
      supabase.from('specs').select('*').eq('model_id', modelId).order('sort_order'),
      supabase.from('model_notes').select('*').eq('model_id', modelId).order('sort_order'),
    ]);

    if (modelErr || specsErr || notesErr) {
      setError((modelErr || specsErr || notesErr).message);
    } else {
      setModel(modelData);
      setSpecs(specsData ?? []);
      setNotes(notesData ?? []);
    }
    setLoading(false);
  }

  return { model, specs, notes, loading, error };
}

/**
 * 코드 사전 일괄 조회 (번역 매핑용)
 */
export function useCodeDict(codes) {
  const [dict, setDict] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!codes || codes.length === 0) return;
    fetchDict(codes);
  }, [codes?.join(',')]);

  async function fetchDict(codeList) {
    setLoading(true);
    const { data, error } = await supabase
      .from('code_dict')
      .select('code, name_ko, hex_color, is_hidden, category')
      .in('code', codeList);

    if (!error && data) {
      const map = {};
      data.forEach((row) => { map[row.code] = row; });
      setDict(map);
    }
    setLoading(false);
  }

  return { dict, loading };
}
