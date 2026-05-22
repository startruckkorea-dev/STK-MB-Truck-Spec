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

const DataContext = createContext(null);

const EMPTY = { codeDict: [], models: [], specs: [], modelNotes: [], users: [] };

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
      const [codeDict, models, specs, modelNotes, users] = await Promise.all([
        wb.readSheet('code_dict'),
        wb.readSheet('models'),
        wb.readSheet('specs'),
        wb.readSheet('model_notes'),
        wb.readSheet('users'),
      ]);
      setState({ codeDict, models, specs, modelNotes, users });
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

  async function setSpecHidden(specId, hidden) {
    const s = stateRef.current;
    const idx = s.specs.findIndex((x) => sameId(x.id, specId));
    if (idx < 0) throw new Error('사양 항목을 찾을 수 없습니다.');
    const updated = { ...s.specs[idx], is_hidden: hidden };
    await wb.updateRow('specs', idx, updated);
    setState((st) => ({ ...st, specs: st.specs.map((x, i) => (i === idx ? updated : x)) }));
  }

  // ─── users ────────────────────────────────────────────────────────
  async function saveUsers(newUsers) {
    await wb.overwriteSheet('users', newUsers);
    setState((st) => ({ ...st, users: newUsers }));
  }

  async function upsertUser(u) {
    const cur = stateRef.current.users;
    const email = String(u.email || '').trim().toLowerCase();
    if (!email) throw new Error('이메일은 필수입니다.');
    const exists = cur.some((x) => String(x.email).trim().toLowerCase() === email);
    const newUsers = exists
      ? cur.map((x) => (String(x.email).trim().toLowerCase() === email ? { ...x, ...u, email } : x))
      : [...cur, { is_active: true, role: 'sales', ...u, email }];
    await saveUsers(newUsers);
  }

  async function deleteUser(email) {
    const key = String(email).trim().toLowerCase();
    const newUsers = stateRef.current.users.filter(
      (x) => String(x.email).trim().toLowerCase() !== key
    );
    await saveUsers(newUsers);
  }

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
    setSpecHidden,
    upsertUser,
    deleteUser,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
