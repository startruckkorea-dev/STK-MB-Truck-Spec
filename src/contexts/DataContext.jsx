/**
 * DataContext.jsx — SharePoint Excel 데이터 캐시 + 변경 API
 *
 * 로그인(MSAL) 후 워크북 5개 시트를 메모리에 1회 로드한다. 검색·필터·페이지네이션은
 * 전부 메모리에서 처리하고, 변경 시에만 Microsoft Graph 로 SharePoint 파일을 갱신한다.
 *
 * 메모리 배열은 항상 "시트 행 순서"와 동일하게 유지된다 (행 index = 배열 index).
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as wb from '../lib/workbook';
import { buildCodeIndex } from '../lib/codeIndex';
import { compareModels } from '../lib/modelSort';

const DataContext = createContext(null);

const EMPTY = { codeDict: [], models: [], specs: [], modelNotes: [] };

/** 배열에서 다음 정수 id (max + 1) */
const nextId = (arr) => arr.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
const sameId = (a, b) => Number(a) === Number(b);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const loadingRef = useRef(false);

  // ─── 전체 로드 / 새로고침 ──────────────────────────────────────────
  const reload = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const [codeDict, models, specs, modelNotes] = await Promise.all([
        wb.readSheet('code_dict'),
        wb.readSheet('models'),
        wb.readSheet('specs'),
        wb.readSheet('model_notes'),
      ]);
      setState({ codeDict, models, specs, modelNotes });
      setLoaded(true);
    } catch (e) {
      const msg = /404|찾지 못/.test(e.message)
        ? "SharePoint 'mbtruck-spec/Code' 폴더의 엑셀 파일에 접근하지 못했습니다. 파일 위치와 읽기 권한을 확인해 주세요."
        : `데이터를 불러오지 못했습니다: ${e.message}`;
      setError(msg);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // 안정적인 primitive 키로 효과 재실행을 제어 (user 객체 참조 변경에 영향받지 않음)
  const userId = user?.id || null;
  useEffect(() => {
    if (userId && !loaded) reload();
    if (!userId) setLoading(false);
  }, [userId, loaded, reload]);

  // ─── 동시편집 검증 (단건 쓰기 전 해당 행이 그대로인지 확인) ─────────
  async function verifyIndex(sheet, idx, expectedId) {
    const live = await wb.readRow(sheet, idx);
    if (!live || !sameId(live.id, expectedId)) {
      await reload();
      throw new Error('다른 사용자가 데이터를 변경했습니다. 새로고침했으니 다시 시도해 주세요.');
    }
  }

  // ─── code_dict ────────────────────────────────────────────────────
  async function upsertCode(item) {
    const cur = stateRef.current.codeDict;
    let idx = -1;
    if (item.id != null) idx = cur.findIndex((c) => sameId(c.id, item.id));
    if (idx < 0 && item.code) idx = cur.findIndex((c) => String(c.code) === String(item.code));

    if (idx >= 0) {
      const updated = { ...cur[idx], ...item, id: cur[idx].id, code: cur[idx].code };
      await verifyIndex('code_dict', idx, cur[idx].id);
      await wb.updateRow('code_dict', idx, updated);
      setState((s) => ({ ...s, codeDict: s.codeDict.map((x, i) => (i === idx ? updated : x)) }));
    } else {
      const row = { ...item, id: nextId(cur) };
      await wb.appendRows('code_dict', [row]);
      setState((s) => ({ ...s, codeDict: [...s.codeDict, row] }));
    }
  }

  async function deleteCode(id) {
    const cur = stateRef.current.codeDict;
    const idx = cur.findIndex((c) => sameId(c.id, id));
    if (idx < 0) throw new Error('코드를 찾을 수 없습니다.');
    await verifyIndex('code_dict', idx, id);
    await wb.deleteRow('code_dict', idx);
    setState((s) => ({ ...s, codeDict: s.codeDict.filter((_, i) => i !== idx) }));
  }

  async function setCodeHidden(id, hidden) {
    const cur = stateRef.current.codeDict;
    const idx = cur.findIndex((c) => sameId(c.id, id));
    if (idx < 0) throw new Error('코드를 찾을 수 없습니다.');
    const updated = { ...cur[idx], is_hidden: hidden };
    await verifyIndex('code_dict', idx, id);
    await wb.updateRow('code_dict', idx, updated);
    setState((s) => ({ ...s, codeDict: s.codeDict.map((x, i) => (i === idx ? updated : x)) }));
  }

  // ─── models + specs + model_notes (한 모델을 묶음으로 처리) ─────────
  /** 모델 저장 (신규/수정). specsList/notesList 는 이 모델의 전체 목록. 모델 id 반환 */
  async function saveModel(model, specsList = [], notesList = []) {
    const s = stateRef.current;
    const isNew = model.id == null;
    const modelId = isNew ? nextId(s.models) : Number(model.id);
    const modelRow = { ...model, id: modelId };
    // 편집 폼은 sort_order 를 다루지 않으므로, 누락 시 기존 표시 순서를 보존한다.
    if (modelRow.sort_order == null && !isNew) {
      const prev = s.models.find((m) => sameId(m.id, modelId));
      if (prev && prev.sort_order != null) modelRow.sort_order = prev.sort_order;
    }
    const newModels = isNew
      ? [...s.models, modelRow]
      : s.models.map((m) => (sameId(m.id, modelId) ? modelRow : m));

    const otherSpecs = s.specs.filter((x) => !sameId(x.model_id, modelId));
    const specBase = nextId(s.specs);
    const newModelSpecs = specsList.map((x, i) => ({ ...x, id: specBase + i, model_id: modelId }));
    const newSpecs = [...otherSpecs, ...newModelSpecs];

    const otherNotes = s.modelNotes.filter((x) => !sameId(x.model_id, modelId));
    const noteBase = nextId(s.modelNotes);
    const newModelNotes = notesList.map((x, i) => ({ ...x, id: noteBase + i, model_id: modelId }));
    const newNotes = [...otherNotes, ...newModelNotes];

    await wb.overwriteSheet('models', newModels);
    await wb.overwriteSheet('specs', newSpecs);
    await wb.overwriteSheet('model_notes', newNotes);

    setState((st) => ({ ...st, models: newModels, specs: newSpecs, modelNotes: newNotes }));
    return modelId;
  }

  async function deleteModel(id) {
    const s = stateRef.current;
    const newModels = s.models.filter((m) => !sameId(m.id, id));
    const newSpecs = s.specs.filter((x) => !sameId(x.model_id, id));
    const newNotes = s.modelNotes.filter((x) => !sameId(x.model_id, id));
    await wb.overwriteSheet('models', newModels);
    if (newSpecs.length !== s.specs.length) await wb.overwriteSheet('specs', newSpecs);
    if (newNotes.length !== s.modelNotes.length) await wb.overwriteSheet('model_notes', newNotes);
    setState((st) => ({ ...st, models: newModels, specs: newSpecs, modelNotes: newNotes }));
  }

  async function setModelVisible(id, visible) {
    const s = stateRef.current;
    const newModels = s.models.map((m) => (sameId(m.id, id) ? { ...m, is_visible: visible } : m));
    await wb.overwriteSheet('models', newModels);
    setState((st) => ({ ...st, models: newModels }));
  }

  /**
   * 두 모델(idA, idB)의 표시 순서를 맞바꾼다.
   * 화면 표시 순서(compareModels)대로 정렬한 뒤 두 모델 위치를 교환하고,
   * 전체에 sort_order = 0,1,2… 를 다시 부여해 저장한다. sort_order 가 정렬의
   * 1순위 키이므로 이렇게 해야 순서가 확실히 고정된다.
   * (specs/model_notes 는 model_id 로 참조하므로 행 순서 변경에 영향 없음)
   */
  async function moveModelOrder(idA, idB) {
    const s = stateRef.current;
    const ordered = [...s.models].sort(compareModels);
    const ia = ordered.findIndex((m) => sameId(m.id, idA));
    const ib = ordered.findIndex((m) => sameId(m.id, idB));
    if (ia < 0 || ib < 0 || ia === ib) return;
    [ordered[ia], ordered[ib]] = [ordered[ib], ordered[ia]];
    const renumbered = ordered.map((m, i) => ({ ...m, sort_order: i }));
    await wb.overwriteSheet('models', renumbered);
    setState((st) => ({ ...st, models: renumbered }));
  }

  /**
   * 드래그로 여러 모델의 표시 순서를 한 번에 재배치한다.
   * orderedIds: 재배치할 모델 id 들의 "새 상대 순서" (보통 한 그룹의 행들).
   * 이 id 들이 현재 화면 순서(compareModels)에서 차지하던 위치(slot)는 그대로 두고,
   * 그 slot 들에 orderedIds 를 새 순서대로 다시 채운 뒤 전체 sort_order 를 0,1,2…
   * 로 재부여해 저장한다. (그룹 밖 모델의 위치는 보존된다)
   */
  async function reorderModels(orderedIds) {
    const s = stateRef.current;
    const ids = orderedIds.map(Number);
    const ordered = [...s.models].sort(compareModels);
    const idSet = new Set(ids);
    const byId = new Map(ordered.map((m) => [Number(m.id), m]));
    // 이 id 들이 차지하던 slot(전역 순서 인덱스) 수집
    const slots = [];
    ordered.forEach((m, i) => { if (idSet.has(Number(m.id))) slots.push(i); });
    if (slots.length !== ids.length) return; // 일부 id 를 못 찾음 → 무시
    // slot 에 새 순서대로 배치
    const result = [...ordered];
    ids.forEach((id, k) => { result[slots[k]] = byId.get(id); });
    const renumbered = result.map((m, i) => ({ ...m, sort_order: i }));
    await wb.overwriteSheet('models', renumbered);
    setState((st) => ({ ...st, models: renumbered }));
  }

  async function setSpecHidden(specId, hidden) {
    const s = stateRef.current;
    const idx = s.specs.findIndex((x) => sameId(x.id, specId));
    if (idx < 0) throw new Error('사양 항목을 찾을 수 없습니다.');
    const updated = { ...s.specs[idx], is_hidden: hidden };
    await wb.updateRow('specs', idx, updated);
    setState((st) => ({ ...st, specs: st.specs.map((x, i) => (i === idx ? updated : x)) }));
  }

  // 역할(권한)은 SharePoint `Access/Access_List_*.xlsx` 로만 관리한다.
  // 앱에서 사용자 CRUD 를 하지 않으므로 users 시트 관련 로직은 두지 않는다.

  // 코드 사전 번역 인덱스 (정규화된 MB 코드 → 행)
  const codeIndex = useMemo(() => buildCodeIndex(state.codeDict), [state.codeDict]);

  const value = {
    ...state,
    codeIndex,
    loading,
    error,
    reload,
    upsertCode,
    deleteCode,
    setCodeHidden,
    saveModel,
    deleteModel,
    setModelVisible,
    moveModelOrder,
    reorderModels,
    setSpecHidden,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
