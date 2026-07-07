import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from './useAuth';
import { compareModels, isModelHiddenForSales } from '../lib/modelSort';

/**
 * 모델 목록 조회 (SharePoint 캐시 기반)
 * - admin / 본사직원A: is_visible=false 포함 전체
 * - 본사직원B / sales: is_visible=true 만
 * - sales: 추가로 Fleet 내수·수출 배지 모델은 숨김
 */
export function useModels() {
  const { models, loading, error, reload } = useData();
  const { canViewHidden, isSales } = useAuth();

  const sorted = useMemo(() => {
    let list = canViewHidden ? models : models.filter((m) => m.is_visible !== false);
    if (isSales) list = list.filter((m) => !isModelHiddenForSales(m));
    return [...list].sort(compareModels);
  }, [models, canViewHidden, isSales]);

  return { models: sorted, loading, error, refetch: reload };
}

/**
 * 단일 모델 + 사양 + 보충 노트 조회 (SharePoint 캐시 기반)
 */
export function useModelDetail(id) {
  const { models, specs, modelNotes, loading, error } = useData();
  const { isSales } = useAuth();
  const modelId = Number(id);

  // sales 는 Fleet 내수·수출 모델을 직접 URL 로도 열람할 수 없다(null 처리).
  const model = useMemo(() => {
    const found = models.find((m) => Number(m.id) === modelId) || null;
    if (found && isSales && isModelHiddenForSales(found)) return null;
    return found;
  }, [models, modelId, isSales]);

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
