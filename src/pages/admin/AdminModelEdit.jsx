import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Button from '../../components/ui/Button';
import Toggle from '../../components/ui/Toggle';
import { parseDocx, parseModelYear } from '../../lib/parser';
import { supabase } from '../../lib/supabase';

const SERIES_OPTIONS = ['Actros', 'Arocs', 'Atego'];
const BADGE_OPTIONS = ['', 'new', 'updated'];
const BATCH_SIZE = 200;

export default function AdminModelEdit() {
  const { id } = useParams(); // undefined = 신규 등록
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const isEdit = Boolean(id);

  // ── 기본 정보 ──
  const [series, setSeries] = useState('Actros');
  const [code, setCode] = useState('');
  const [axle, setAxle] = useState('');
  const [cabin, setCabin] = useState('');
  const [codeDesc, setCodeDesc] = useState('');
  const [nameKo, setNameKo] = useState('');
  const [modelYear, setModelYear] = useState('');
  const [badge, setBadge] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  // ── 파싱 상태 ──
  const [parsedSpecs, setParsedSpecs] = useState(null); // null | Spec[]
  const [dictMap, setDictMap] = useState({});           // { [code]: DictEntry }
  const [parseWarnings, setParseWarnings] = useState([]);
  const [parseStatus, setParseStatus] = useState('idle');
  // idle | parsing | preview | saving | done | error

  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // ── 보충 노트 ──
  const [notes, setNotes] = useState([]);

  // ── 기존 모델 로드 ──
  useEffect(() => {
    if (!isEdit) return;
    supabase.from('models').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) return;
      setSeries(data.series);
      setCode(data.code);
      setAxle(data.axle ?? '');
      setCabin(data.cabin ?? '');
      setCodeDesc(data.code_desc ?? '');
      setNameKo(data.name_ko);
      setModelYear(data.model_year);
      setBadge(data.badge ?? '');
      setIsVisible(data.is_visible);
    });
    supabase.from('specs').select('*').eq('model_id', id).order('sort_order').then(({ data }) => {
      if (data) setParsedSpecs(data);
    });
    supabase.from('model_notes').select('*').eq('model_id', id).order('sort_order').then(({ data }) => {
      if (data) setNotes(data);
    });
  }, [id]);

  // ── .docx 파일 처리 (공통) ──
  async function processFile(file) {
    setParseStatus('parsing');
    setErrorMsg('');

    try {
      console.log('[1] 파일 읽기 시작:', file.name, file.size, 'bytes');
      const buffer = await file.arrayBuffer();
      console.log('[2] arrayBuffer 완료, mammoth 파싱 시작...');
      const { specs, modelYear: detectedYear, warnings } = await parseDocx(buffer);
      console.log('[3] 파싱 완료:', specs.length, '개 사양, MY:', detectedYear);

      if (specs.length === 0) {
        throw new Error('사양 데이터를 추출하지 못했습니다. .docx 파일 구조를 확인해주세요.');
      }

      if (detectedYear && !modelYear) setModelYear(detectedYear);

      // code_dict에서 번역 조회 (코드 정규화: trim + uppercase)
      const codes = [...new Set(specs.map((s) => s.spec_value.trim().toUpperCase()))];
      console.log('[4] code_dict 조회:', codes.length, '개 코드');
      console.log('[4-debug] 코드 샘플:', codes.slice(0, 10));
      const { data: dictRows } = await supabase
        .from('code_dict')
        .select('code, name_ko, category, hex_color, is_hidden')
        .in('code', codes);
      const map = {};
      (dictRows || []).forEach((d) => { map[d.code] = d; });
      console.log('[5] code_dict 매핑 완료:', Object.keys(map).length, '/', codes.length, '개 매칭');
      if (codes.length > Object.keys(map).length) {
        const unmatched = codes.filter(c => !map[c]);
        console.warn('[5-debug] 미매칭 코드:', unmatched.slice(0, 10));
      }

      setParsedSpecs(specs);
      setDictMap(map);
      setParseWarnings(warnings);
      setParseStatus('preview');
    } catch (err) {
      setErrorMsg(err.message);
      setParseStatus('error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── 파일 input 선택 ──
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processFile(file);
  }

  // ── 드래그 앤 드롭 ──
  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.docx')) processFile(file);
  }

  // ── 개별 사양 숨김 토글 ──
  function toggleSpecHidden(index) {
    setParsedSpecs((prev) =>
      prev.map((s, i) => (i === index ? { ...s, is_hidden: !s.is_hidden } : s))
    );
  }

  // ── 보충 노트 헬퍼 ──
  function addNote() {
    setNotes((prev) => [...prev, { label: '', content: '' }]);
  }
  function updateNote(index, field, value) {
    setNotes((prev) => prev.map((n, i) => (i === index ? { ...n, [field]: value } : n)));
  }
  function deleteNote(index) {
    setNotes((prev) => prev.filter((_, i) => i !== index));
  }
  function moveNote(index, direction) {
    setNotes((prev) => {
      const arr = [...prev];
      const target = index + direction;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  }

  // ── 저장 ──
  async function handleSave() {
    if (!series || !code || !nameKo || !modelYear) {
      setErrorMsg('시리즈, 모델 코드, 차종분류, Model Year는 필수입니다.');
      return;
    }
    if (!axle || !cabin) {
      setErrorMsg('축 구성과 캐빈 타입은 필수입니다.');
      return;
    }
    setSaving(true);
    setErrorMsg('');

    try {
      console.log('[Save-1] 저장 시작');
      let modelId = id ? Number(id) : null;

      // models 테이블 upsert
      const modelPayload = {
        series,
        code: code.trim().toUpperCase(),
        axle: axle.trim(),
        cabin: cabin.trim().toUpperCase(),
        code_desc: codeDesc || null,
        name_ko: nameKo,
        model_year: modelYear,
        badge: badge || null,
        is_visible: isVisible,
      };

      if (isEdit) {
        const { error } = await supabase.from('models').update(modelPayload).eq('id', modelId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('models').insert(modelPayload).select('id').single();
        if (error) throw error;
        modelId = data.id;
      }
      console.log('[Save] models 저장 완료, modelId:', modelId);

      // specs 저장
      if (parsedSpecs && parsedSpecs.length > 0) {
        console.log('[Save-4] specs 저장 시작:', parsedSpecs.length, '개');
        // 기존 사양 삭제 후 재삽입
        if (isEdit) {
          const { error } = await supabase.from('specs').delete().eq('model_id', modelId);
          if (error) throw error;
          console.log('[Save-5] 기존 specs 삭제 완료');
        }

        // spec_key 중복 제거 (마지막 값 우선)
        const deduped = new Map();
        parsedSpecs.forEach((s, idx) => {
          deduped.set(s.spec_key, { ...s, _idx: idx });
        });
        const specsPayload = [...deduped.values()].map((s, idx) => ({
          model_id: modelId,
          category: s.category,
          spec_key: s.spec_key?.trim().toUpperCase() || s.spec_key,
          spec_value: s.spec_value?.trim().toUpperCase() || s.spec_value,
          label_ko: s.label_ko ?? null,
          use_translate: s.use_translate ?? true,
          is_color: s.is_color ?? false,
          is_hidden: s.is_hidden ?? false,
          sort_order: s.sort_order ?? s._idx,
        }));

        for (let i = 0; i < specsPayload.length; i += BATCH_SIZE) {
          const batch = specsPayload.slice(i, i + BATCH_SIZE);
          console.log('[Save-6] specs 배치 저장:', i, '~', Math.min(i + BATCH_SIZE, specsPayload.length));
          const { error } = await supabase.from('specs').insert(batch);
          if (error) throw error;
        }
        console.log('[Save-7] specs 저장 완료');
      }

      // 보충 노트 저장 (기존 삭제 후 재삽입)
      const validNotes = notes.filter((n) => n.label.trim() && n.content.trim());
      await supabase.from('model_notes').delete().eq('model_id', modelId);
      if (validNotes.length > 0) {
        const notesPayload = validNotes.map((n, idx) => ({
          model_id: modelId,
          label: n.label.trim(),
          content: n.content.trim(),
          sort_order: idx,
        }));
        const { error } = await supabase.from('model_notes').insert(notesPayload);
        if (error) throw error;
      }
      console.log('[Save-8] 노트 저장 완료');

      console.log('[Save-9] 저장 완료, 리다이렉트');
      navigate('/admin/models');
    } catch (err) {
      console.error('[Save-Error]', err);
      if (err.message?.includes('models_code_axle_cabin_year_key') || err.message?.includes('models_code_model_year_key')) {
        setErrorMsg('같은 모델 코드 + 축 + 캐빈 + Model Year 조합이 이미 등록되어 있습니다. 기존 모델 목록에서 해당 모델을 편집하거나 값을 변경해주세요.');
      } else {
        setErrorMsg(err.message);
      }
    }
    setSaving(false);
  }

  // ── 미매핑 코드 수 (정규화된 코드로 매칭) ──
  const unmappedCount = parsedSpecs
    ? parsedSpecs.filter((s) => s.use_translate && !dictMap[(s.spec_value || '').trim().toUpperCase()]).length
    : 0;

  return (
    <Layout>
      {/* 헤더 */}
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Link to="/admin/models">
          <Button variant="outline" size="sm">← 목록</Button>
        </Link>
        <h1 className="font-barlow font-bold text-lg sm:text-2xl text-gray-900 tracking-wide">
          {isEdit ? '모델 편집' : '모델 등록'}
        </h1>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-6">
        {/* ── 좌: 기본 정보 + 파일 업로드 ── */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-5">
          {/* 기본 정보 카드 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3 sm:space-y-4">
            <h2 className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-sm">
              기본 정보
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시리즈 *</label>
              <select
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
              >
                {SERIES_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">모델 코드 *</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="예: 2863LS, 1833L"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-mb-blue"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">축 구성 *</label>
                <input
                  value={axle}
                  onChange={(e) => setAxle(e.target.value)}
                  placeholder="예: 6x2, 8x4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-mb-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">캐빈 *</label>
                <input
                  value={cabin}
                  onChange={(e) => setCabin(e.target.value)}
                  placeholder="예: S5F, G5F"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-mb-blue"
                />
              </div>
            </div>

            {/* 미리보기 */}
            {(code || axle || cabin) && (
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-400 mb-0.5">표시 이름 미리보기</p>
                <p className="text-sm font-bold text-gray-800 font-mono">
                  {series} {code}{axle ? ` ${axle}` : ''}{cabin ? ` ${cabin}` : ''}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">기타 특징 (선택)</label>
              <input
                value={codeDesc}
                onChange={(e) => setCodeDesc(e.target.value)}
                placeholder="예: Actros L 4x2 6-cylinder"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">차종분류 *</label>
              <input
                value={nameKo}
                onChange={(e) => setNameKo(e.target.value)}
                placeholder="예: 트랙터, 카고, 덤프"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model Year *</label>
              <input
                value={modelYear}
                onChange={(e) => setModelYear(e.target.value)}
                placeholder="예: MY26"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-mb-blue"
              />
              <p className="text-xs text-gray-400 mt-1">.docx 파일 업로드 시 자동 유추됩니다.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태 배지</label>
              <select
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
              >
                <option value="">없음</option>
                <option value="new">NEW</option>
                <option value="updated">UPDATED</option>
              </select>
            </div>

            <Toggle
              checked={isVisible}
              onChange={setIsVisible}
              label={isVisible ? '공개 (영업직원에게 표시)' : '숨김 (admin만 확인)'}
            />
          </div>

          {/* .docx 업로드 카드 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3">
            <h2 className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-sm">
              사양서 업로드 (.docx)
            </h2>

            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors select-none
                ${isDragOver
                  ? 'border-mb-blue bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }`}
            >
              {parseStatus === 'parsing' ? (
                <p className="text-sm text-gray-400 animate-pulse">분석 중...</p>
              ) : (
                <>
                  <p className="text-2xl mb-1">📄</p>
                  <p className="text-sm text-gray-600 font-medium">.docx 파일을 드래그하거나 클릭해서 선택</p>
                  <p className="text-xs text-gray-400 mt-1">파일 1개 = 모델 1개</p>
                </>
              )}
            </div>

            {parseStatus === 'error' && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 whitespace-pre-line">
                {errorMsg}
              </div>
            )}

            {parseStatus === 'preview' && parsedSpecs && (
              <div className="space-y-2">
                <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
                  <span className="font-medium text-green-600">✓ 추출 완료</span>
                  {' — '}총 {parsedSpecs.length}개 사양,{' '}
                  {unmappedCount > 0 && (
                    <span className="text-amber-600">미매핑 {unmappedCount}개</span>
                  )}
                  {unmappedCount === 0 && <span className="text-green-600">전체 번역 완료</span>}
                </div>
                {parseWarnings.length > 0 && (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                    {parseWarnings.slice(0, 3).join('\n')}
                    {parseWarnings.length > 3 && ` 외 ${parseWarnings.length - 3}개 경고`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 보충 설명 노트 카드 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-sm">
                보충 설명 노트
              </h2>
              <Button variant="outline" size="sm" onClick={addNote}>+ 추가</Button>
            </div>

            {notes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">
                등록된 노트가 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {notes.map((note, i) => (
                  <div
                    key={note.id ?? `new-${i}`}
                    className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50"
                  >
                    <input
                      value={note.label}
                      onChange={(e) => updateNote(i, 'label', e.target.value)}
                      placeholder="항목명 (예: 엔진 토크)"
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue bg-white"
                    />
                    <textarea
                      value={note.content}
                      onChange={(e) => updateNote(i, 'content', e.target.value)}
                      placeholder="내용 (예: 1700 Nm @ 1100-1400 rpm)"
                      rows={2}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-mb-blue bg-white"
                    />
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => moveNote(i, -1)}
                        disabled={i === 0}
                        className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="위로"
                      >↑</button>
                      <button
                        onClick={() => moveNote(i, 1)}
                        disabled={i === notes.length - 1}
                        className="px-2 py-0.5 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="아래로"
                      >↓</button>
                      <button
                        onClick={() => deleteNote(i)}
                        className="px-2 py-0.5 text-xs text-red-400 hover:text-red-600"
                        title="삭제"
                      >삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400">항목명과 내용을 모두 입력해야 저장됩니다.</p>
          </div>

          {/* 저장 버튼 */}
          {errorMsg && parseStatus !== 'error' && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {errorMsg}
            </div>
          )}
          <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
            {saving ? '저장 중...' : isEdit ? '변경 사항 저장' : '모델 등록'}
          </Button>
        </div>

        {/* ── 우: 사양 미리보기 ── */}
        <div className="lg:col-span-3">
          {parsedSpecs && parsedSpecs.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-sm">
                  사양 미리보기
                </span>
                <span className="text-xs text-gray-400">{parsedSpecs.length}개 항목</span>
              </div>

              <div className="overflow-y-auto overflow-x-auto max-h-[60vh] sm:max-h-[70vh]">
                <table className="w-full text-xs min-w-[400px]">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-2 sm:px-3 py-2 text-gray-500 font-medium w-20 sm:w-32">카테고리</th>
                      <th className="text-left px-2 sm:px-3 py-2 text-gray-500 font-medium">코드</th>
                      <th className="text-left px-2 sm:px-3 py-2 text-gray-500 font-medium">번역</th>
                      <th className="text-center px-2 sm:px-3 py-2 text-gray-500 font-medium w-10 sm:w-14">숨김</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedSpecs.map((spec, i) => {
                      const entry = dictMap[(spec.spec_value || '').trim().toUpperCase()];
                      return (
                        <tr key={i} className={spec.is_hidden ? 'opacity-40' : ''}>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-400">{spec.category}</td>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 font-mono">{spec.spec_key}</td>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                            {entry ? (
                              <span className="text-gray-800">{entry.name_ko}</span>
                            ) : (
                              <span className="text-amber-500">미매핑</span>
                            )}
                          </td>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center">
                            <input
                              type="checkbox"
                              checked={spec.is_hidden}
                              onChange={() => toggleSpecHidden(i)}
                              className="accent-mb-blue"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-300 bg-gray-50 border border-dashed border-gray-300 rounded-xl min-h-[300px]">
              <div className="text-center">
                <div className="text-5xl mb-3">📄</div>
                <p className="text-sm">
                  {isEdit ? '새 .docx 파일을 업로드하면 사양을 교체합니다.' : '.docx 파일을 업로드하면 사양이 여기에 표시됩니다.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
