import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from './useAuth';
import { compareModels } from '../lib/modelSort';

/**
 * 모델 목록 조회 (SharePoint 캐시 기반)
 * - admin: is_visible=false 포함 전체
 * - sales/staff: is_visible=true 만
 */
export function useModels() {
  const { models, loading, error, reload } = useData();
  const { isAdmin } = useAuth();

  const sorted = useMemo(() => {
    const list = isAdmin ? models : models.filter((m) => m.is_visible !== false);
    return [...list].sort(compareModels);
  }, [models, isAdmin]);

  return { models: sorted, loading, error, refetch: reload };
}

/**
 * 단일 모델 + 사양 + 보충 노트 조회 (SharePoint 캐시 기반)
 */
export function useModelDetail(id) {
  const { models, specs, modelNotes, loading, error } = useData();
  const modelId = Number(id);

  const model = useMemo(
    () => models.find((m) => Number(m.id) === modelId) || null,
    [models, modelId]
  );

  const modelSpecs = useMemo(
    () =>
      specs
        .filter((s) => Number(s.model_id) === modelId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [specs, modelId]
  );

  const notes = useMemo(
    () =>
      modelNotes
        .filter((n) => Number(n.model_id) === modelId)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [modelNotes, modelId]
  );

  return { model, specs: modelSpecs, notes, loading, error };
}
