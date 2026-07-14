import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Button from '../../components/ui/Button';
import Toggle from '../../components/ui/Toggle';
import SharePointPicker from '../../components/admin/SharePointPicker';
import { parseDocx, parseQuotationFilename } from '../../lib/parser';
import { downloadSourceFile } from '../../lib/sourceFiles';
import { listHomologationFolder, HOMOLOGATION_ROOT_LABEL } from '../../lib/homologation';
import { normCode, isKrCode, nextKrCode } from '../../lib/codeIndex';
import { useData } from '../../contexts/DataContext';

// SharePoint webUrl 에서 표시용 파일명 추출 (마지막 경로 세그먼트, 쿼리 제거)
function fileNameFromUrl(url) {
  if (!url) return '';
  try {
    const path = decodeURIComponent(String(url).split('?')[0]);
    return path.split('/').pop() || url;
  } catch {
    return url;
  }
}

const SERIES_OPTIONS = ['Actros', 'Arocs', 'Atego'];

export default function AdminModelEdit() {
  const { id } = useParams(); // undefined = 신규 등록
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const isEdit = Boolean(id);
  const { models, specs: cachedSpecs, modelNotes, codeDict, codeIndex, saveModel, upsertCode } = useData();

  // ── 기본 정보 ──
  const [series, setSeries] = useState('Actros');
  const [code, setCode] = useState('');
  const [axle, setAxle] = useState('');
  const [cabin, setCabin] = useState('');
  const [codeDesc, setCodeDesc] = useState('');
  const [nameKo, setNameKo] = useState('');
  const [modelYear, setModelYear] = useState('');
  const [productionMonth, setProductionMonth] = useState('');
  const [badge, setBadge] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  // 인증 자료 SharePoint 공유 링크
  const [homologSpecUrl, setHomologSpecUrl] = useState('');   // 제원표
  const [homologViewUrl, setHomologViewUrl] = useState('');   // 외관사면도

  // ── 파싱 상태 ──
  const [parsedSpecs, setParsedSpecs] = useState(null); // null | Spec[]
  const [parseWarnings, setParseWarnings] = useState([]);
  const [parseStatus, setParseStatus] = useState('idle');
  // idle | parsing | preview | saving | done | error

  const [isDragOver, setIsDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false); // SharePoint 견적서 선택 모달
  const [homologPicker, setHomologPicker] = useState(null); // null | 'spec' | 'view'
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // ── 사양 코드 직접 추가/편집 모달 ──
  const [specEditor, setSpecEditor] = useState(null); // null | { index, ... } (아래 openSpecEditor 참조)

  // ── 보충 노트 ──
  const [notes, setNotes] = useState([]);

  // ── 기존 모델 로드 (SharePoint 캐시에서, 1회) ──
  const populatedRef = useRef(false);
  useEffect(() => {
    if (!isEdit || populatedRef.current) return;
    const m = models.find((x) => Number(x.id) === Number(id));
    if (!m) return;
    populatedRef.current = true;
    setSeries(m.series);
    setCode(m.code);
    setAxle(m.axle ?? '');
    setCabin(m.cabin ?? '');
    setCodeDesc(m.code_desc ?? '');
    setNameKo(m.name_ko);
    setModelYear(m.model_year);
    setProductionMonth(m.production_month ?? '');
    setBadge(m.badge ?? '');
    setIsVisible(m.is_visible !== false);
    setHomologSpecUrl(m.homolog_spec_url ?? '');
    setHomologViewUrl(m.homolog_view_url ?? '');
    setParsedSpecs(
      cachedSpecs
        .filter((s) => Number(s.model_id) === Number(id))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    );
    setNotes(
      modelNotes
        .filter((n) => Number(n.model_id) === Number(id))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    );
  }, [isEdit, id, models, cachedSpecs, modelNotes]);

  // ── .docx 처리 (공통) — 로컬 파일/SharePoint 양쪽에서 호출 ──
  // buffer: ArrayBuffer, filename: 견적서 파일명, folderPath: SharePoint 폴더 경로(선택)
  async function processArrayBuffer(buffer, filename, folderPath) {
    setParseStatus('parsing');
    setErrorMsg('');

    try {
      const { specs, modelYear: detectedYear, warnings } = await parseDocx(buffer);
      console.log('[parse] 파싱 완료:', specs.length, '개 사양, MY:', detectedYear);

      if (specs.length === 0) {
        throw new Error('사양 데이터를 추출하지 못했습니다. .docx 파일 구조를 확인해주세요.');
      }

      // ── 파일명/폴더에서 기본 정보 자동 채움 (신규 등록 시에만) ──
      let yearAlreadySet = modelYear;
      if (!isEdit) {
        const info = parseQuotationFilename(filename);
        if (info.series && SERIES_OPTIONS.includes(info.series)) setSeries(info.series);
        if (info.code) setCode(info.code);
        if (info.axle) setAxle(info.axle);
        if (info.cabin) setCabin(info.cabin);
        // 폴더 경로 세그먼트 → Model Year("MY##") / 생산월("YYYY-MM")
        const segments = String(folderPath || '')
          .split('/')
          .map((s) => s.trim());
        const myFolder = segments.find((s) => /^MY\d{2}$/i.test(s));
        if (myFolder) {
          setModelYear(myFolder.toUpperCase());
          yearAlreadySet = myFolder.toUpperCase();
        }
        const monthFolder = segments.find((s) => /^\d{4}-\d{2}$/.test(s));
        if (monthFolder) setProductionMonth(monthFolder);
      }
      // 폴더에서 못 얻었으면 .docx 내용에서 감지한 연도 사용
      if (detectedYear && !yearAlreadySet) setModelYear(detectedYear);

      // 견적서에 없어 관리자가 직접 추가한 KR 코드 행은 재파싱 후에도 유지한다.
      const manual = (parsedSpecs || []).filter((s) => isKrCode(s.spec_value));
      const merged = [...specs, ...manual].map((s, i) => ({ ...s, sort_order: i }));

      setParsedSpecs(merged);
      setParseWarnings(warnings);
      setParseStatus('preview');
    } catch (err) {
      setErrorMsg(err.message);
      setParseStatus('error');
    }
  }

  // ── 로컬 파일 처리 ──
  async function processFile(file) {
    try {
      const buffer = await file.arrayBuffer();
      await processArrayBuffer(buffer, file.name);
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

  // ── SharePoint 공유폴더에서 선택 ──
  async function handleSharePointPick(file, folderPath) {
    setPickerOpen(false);
    setParseStatus('parsing');
    setErrorMsg('');
    try {
      const buffer = await downloadSourceFile(file.downloadUrl);
      await processArrayBuffer(buffer, file.name, folderPath);
    } catch (err) {
      setErrorMsg(err.message);
      setParseStatus('error');
    }
  }

  // ── 개별 사양 숨김 토글 ──
  function toggleSpecHidden(index) {
    setParsedSpecs((prev) =>
      prev.map((s, i) => (i === index ? { ...s, is_hidden: !s.is_hidden } : s))
    );
  }

  // ── 사양 행 직접 편집 (견적서에 없는 코드 추가 등) ──
  // 여기서의 변경은 SharePoint 의 견적서(.docx) 원본 파일에는 반영되지 않는다.
  // 신규 KR 코드는 code_dict 시트에만 등록된다.
  const specCategories = [...new Set([
    ...(parsedSpecs || []).map((s) => s.category).filter(Boolean),
    ...codeDict.map((c) => c.category).filter((c) => c && !/^[A-Za-z0-9]{1,8}$/.test(String(c).trim())),
  ])];

  function openSpecEditor(index = null) {
    const spec = index != null ? parsedSpecs[index] : null;
    if (spec) {
      const entry = codeIndex[normCode(spec.spec_value)];
      setSpecEditor({
        index,
        // 기존 행은 코드를 바꾸지 않는다 (KR 코드만 사전 내용까지 함께 편집)
        mode: isKrCode(spec.spec_value) ? 'kr' : 'existing',
        category: spec.category || '',
        code: spec.spec_value || '',
        label_ko: spec.label_ko || '',
        name_ko: entry?.name_ko || '',
        name_en: entry?.name_en || '',
        hex_color: entry?.hex_color || '',
        is_color: Boolean(spec.is_color),
        error: '',
      });
      return;
    }
    setSpecEditor({
      index: null,
      mode: 'kr',
      category: specCategories[0] || '추가 사양',
      code: nextKrCode(codeDict) || '',
      label_ko: '',
      name_ko: '',
      name_en: '',
      hex_color: '',
      is_color: false,
      error: '',
    });
  }

  async function submitSpecEditor() {
    const e = specEditor;
    const code = normCode(e.code);
    if (!code) return setSpecEditor({ ...e, error: '코드를 입력하세요.' });
    if (!e.category.trim()) return setSpecEditor({ ...e, error: '카테고리를 입력하세요.' });

    if (e.mode === 'kr') {
      if (!isKrCode(code)) {
        return setSpecEditor({ ...e, error: '사내 코드는 KR01~KR99 형식이어야 합니다.' });
      }
      if (!e.name_ko.trim()) {
        return setSpecEditor({ ...e, error: '국문명을 입력하세요. (코드 사전에 등록됩니다)' });
      }
    } else if (!codeIndex[code]) {
      return setSpecEditor({ ...e, error: `코드 사전에 없는 코드입니다: ${code}\n사내 코드(KR)로 새로 만들거나, 코드 사전에 먼저 등록하세요.` });
    }

    // 같은 코드가 이 모델에 이미 있으면 중복 추가 방지
    const dupIdx = (parsedSpecs || []).findIndex((s) => normCode(s.spec_value) === code);
    if (dupIdx >= 0 && dupIdx !== e.index) {
      return setSpecEditor({ ...e, error: `이 모델에 이미 있는 코드입니다: ${code}` });
    }

    setSpecEditor({ ...e, error: '', saving: true });
    try {
      // KR 코드: code_dict 에 등록/갱신 (견적서 원본 파일은 건드리지 않음)
      if (e.mode === 'kr') {
        await upsertCode({
          id: codeIndex[code]?.id,
          code,
          name_ko: e.name_ko.trim(),
          name_en: e.name_en.trim() || null,
          category: e.category.trim(),
          hex_color: e.is_color ? (e.hex_color || null) : null,
          is_hidden: false,
        });
      }

      const row = {
        category: e.category.trim(),
        spec_key: code,
        spec_value: code,
        label_ko: e.label_ko.trim() || null,
        use_translate: true,
        is_color: e.is_color,
        is_hidden: false,
      };
      setParsedSpecs((prev) => {
        const arr = prev ? [...prev] : [];
        if (e.index != null) arr[e.index] = { ...arr[e.index], ...row };
        else arr.push({ ...row, sort_order: arr.length });
        return arr;
      });
      setSpecEditor(null);
    } catch (err) {
      setSpecEditor((s) => ({ ...s, error: err.message, saving: false }));
    }
  }

  function deleteSpec(index) {
    setParsedSpecs((prev) => prev.filter((_, i) => i !== index));
  }

  function moveSpec(index, direction) {
    setParsedSpecs((prev) => {
      const arr = [...prev];
      const target = index + direction;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
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
      const modelCode = code.trim().toUpperCase();
      const modelAxle = axle.trim();
      const modelCabin = cabin.trim().toUpperCase();

      // ── 신규 등록 시 중복 체크 ──
      if (!isEdit) {
        const dup = models.find(
          (m) =>
            String(m.code || '').trim().toUpperCase() === modelCode &&
            String(m.model_year || '') === modelYear &&
            String(m.axle || '').trim() === modelAxle &&
            String(m.cabin || '').trim().toUpperCase() === modelCabin
        );
        if (dup && !codeDesc?.trim()) {
          // 동일 조합 + 기타특징 없음 → 등록 차단. 기타특징이 있으면 별도 모델로 바로 저장.
          setErrorMsg(
            '같은 모델 코드 + 축 + 캐빈 + Model Year 조합이 이미 등록되어 있습니다.\n기존 모델을 편집하거나, 기타특징(예: 챔피언스 에디션)을 입력하면 별도 모델로 등록할 수 있습니다.'
          );
          setSaving(false);
          return;
        }
      }

      // 모델 데이터
      const modelObj = {
        series,
        code: modelCode,
        axle: modelAxle,
        cabin: modelCabin,
        code_desc: codeDesc || null,
        name_ko: nameKo,
        model_year: modelYear,
        production_month: productionMonth?.trim() || null,
        badge: badge || null,
        is_visible: isVisible,
        homolog_spec_url: homologSpecUrl?.trim() || null,
        homolog_view_url: homologViewUrl?.trim() || null,
      };
      if (isEdit) modelObj.id = Number(id);

      // 사양 (spec_key 중복 제거, 마지막 값 우선)
      let specsList = [];
      if (parsedSpecs && parsedSpecs.length > 0) {
        const deduped = new Map();
        parsedSpecs.forEach((s, idx) => deduped.set(s.spec_key, { ...s, _idx: idx }));
        specsList = [...deduped.values()].map((s, idx) => ({
          category: s.category,
          spec_key: s.spec_key?.trim().toUpperCase() || s.spec_key,
          spec_value: s.spec_value?.trim().toUpperCase() || s.spec_value,
          label_ko: s.label_ko ?? null,
          use_translate: s.use_translate ?? true,
          is_color: s.is_color ?? false,
          is_hidden: s.is_hidden ?? false,
          sort_order: idx, // 미리보기 표의 현재 순서(↑↓ 이동 포함)를 그대로 저장
        }));
      }

      // 보충 노트 (항목명+내용 모두 입력된 것만)
      const notesList = notes
        .filter((n) => n.label.trim() && n.content.trim())
        .map((n, idx) => ({
          label: n.label.trim(),
          content: n.content.trim(),
          sort_order: idx,
        }));

      await saveModel(modelObj, specsList, notesList);
      navigate('/admin/models');
    } catch (err) {
      console.error('[모델 저장 실패]', err);
      setErrorMsg(err.message);
    }
    setSaving(false);
  }

  // ── 미매핑 코드 수 (정규화된 코드로 매칭) ──
  const unmappedCount = parsedSpecs
    ? parsedSpecs.filter((s) => s.use_translate && !codeIndex[normCode(s.spec_value)]).length
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
                  {productionMonth && (
                    <span className="ml-1.5 text-xs font-normal text-gray-400">({productionMonth})</span>
                  )}
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model Year *</label>
                <input
                  value={modelYear}
                  onChange={(e) => setModelYear(e.target.value)}
                  placeholder="예: MY26"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-mb-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">생산월</label>
                <input
                  value={productionMonth}
                  onChange={(e) => setProductionMonth(e.target.value)}
                  placeholder="예: 2026-04"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-mb-blue"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 -mt-2">SharePoint 견적서 선택 시 폴더 경로(`MY##`, `YYYY-MM`)에서 자동 유추됩니다.</p>

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
                <option value="fleet-domestic">Fleet내수</option>
                <option value="fleet-export">Fleet수출</option>
                <option value="branch-order">Branch주문차</option>
              </select>
            </div>

            <Toggle
              checked={isVisible}
              onChange={setIsVisible}
              label={isVisible ? '공개 (영업직원에게 표시)' : '숨김 (admin만 확인)'}
            />
          </div>

          {/* 인증(homologation) 자료 링크 카드 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3 sm:space-y-4">
            <h2 className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-sm">
              인증 자료 링크
            </h2>
            <p className="text-xs text-gray-400 -mt-1">
              SharePoint 인증 자료 폴더에서 파일을 선택하면 상세 화면에 [제원표]·[외관사면도] 버튼이 활성화됩니다.
              선택하지 않으면 해당 버튼은 비활성화됩니다.
            </p>

            <HomologLinkRow
              label="제원표"
              url={homologSpecUrl}
              onSelect={() => setHomologPicker('spec')}
              onClear={() => setHomologSpecUrl('')}
            />
            <HomologLinkRow
              label="외관사면도"
              url={homologViewUrl}
              onSelect={() => setHomologPicker('view')}
              onClear={() => setHomologViewUrl('')}
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

            {/* SharePoint 공유폴더에서 선택 */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">또는</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={parseStatus === 'parsing'}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50"
            >
              📁 SharePoint 공유폴더에서 선택
            </button>
            <p className="text-xs text-gray-400">
              공유폴더의 견적서를 고르면 시리즈·코드·축·캐빈이 자동 입력됩니다.
            </p>

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
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 whitespace-pre-line">
              {errorMsg}
            </div>
          )}
          <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
            {saving ? '저장 중...' : isEdit ? '변경 사항 저장' : '모델 등록'}
          </Button>
        </div>

        {/* ── 우: 사양 미리보기 / 직접 편집 ── */}
        <div className="lg:col-span-3">
          {parsedSpecs && parsedSpecs.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
                <span className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-sm">
                  사양 미리보기
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{parsedSpecs.length}개 항목</span>
                  <Button variant="outline" size="sm" onClick={() => openSpecEditor(null)}>+ 코드 추가</Button>
                </div>
              </div>

              <div className="overflow-y-auto overflow-x-auto max-h-[60vh] sm:max-h-[70vh]">
                <table className="w-full text-xs min-w-[520px]">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-2 sm:px-3 py-2 text-gray-500 font-medium w-20 sm:w-32">카테고리</th>
                      <th className="text-left px-2 sm:px-3 py-2 text-gray-500 font-medium">코드</th>
                      <th className="text-left px-2 sm:px-3 py-2 text-gray-500 font-medium">번역</th>
                      <th className="text-center px-2 sm:px-3 py-2 text-gray-500 font-medium w-10 sm:w-14">숨김</th>
                      <th className="text-right px-2 sm:px-3 py-2 text-gray-500 font-medium w-24 sm:w-28">편집</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedSpecs.map((spec, i) => {
                      const entry = codeIndex[normCode(spec.spec_value)];
                      const manual = isKrCode(spec.spec_value);
                      return (
                        <tr key={spec.id ?? `${spec.spec_value}-${i}`} className={spec.is_hidden ? 'opacity-40' : ''}>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-400">{spec.category}</td>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 font-mono whitespace-nowrap">
                            {spec.spec_key}
                            {manual && (
                              <span className="ml-1 px-1 py-px rounded bg-mb-blue/10 text-mb-blue text-[10px] font-sans align-middle">
                                직접추가
                              </span>
                            )}
                          </td>
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                            {spec.label_ko && (
                              <span className="text-gray-400 mr-1">{spec.label_ko}:</span>
                            )}
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
                          <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-right whitespace-nowrap">
                            <button
                              onClick={() => moveSpec(i, -1)}
                              disabled={i === 0}
                              className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              title="위로"
                            >↑</button>
                            <button
                              onClick={() => moveSpec(i, 1)}
                              disabled={i === parsedSpecs.length - 1}
                              className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              title="아래로"
                            >↓</button>
                            <button
                              onClick={() => openSpecEditor(i)}
                              className="px-1 text-gray-500 hover:text-mb-blue"
                              title="편집"
                            >수정</button>
                            <button
                              onClick={() => deleteSpec(i)}
                              className="px-1 text-red-400 hover:text-red-600"
                              title="이 모델에서 제거"
                            >삭제</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-400">
                여기서의 추가·삭제는 이 모델의 사양 목록에만 반영되며, SharePoint 견적서(.docx) 원본 파일은 변경되지 않습니다.
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-300 bg-gray-50 border border-dashed border-gray-300 rounded-xl min-h-[300px]">
              <div className="text-center">
                <div className="text-5xl mb-3">📄</div>
                <p className="text-sm">
                  {isEdit ? '새 .docx 파일을 업로드하면 사양을 교체합니다.' : '.docx 파일을 업로드하면 사양이 여기에 표시됩니다.'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => openSpecEditor(null)}>+ 코드 직접 추가</Button>
            </div>
          )}
        </div>
      </div>

      {/* SharePoint 견적서 선택 모달 */}
      {pickerOpen && (
        <SharePointPicker
          onPick={handleSharePointPick}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* SharePoint 인증 자료 선택 모달 */}
      {homologPicker && (
        <SharePointPicker
          listFolder={listHomologationFolder}
          rootLabel={HOMOLOGATION_ROOT_LABEL}
          title={`SharePoint 인증 자료 선택 — ${homologPicker === 'spec' ? '제원표' : '외관사면도'}`}
          hint="폴더를 눌러 이동하고, 파일을 누르면 해당 항목에 연동됩니다."
          onPick={(file) => {
            const url = file.webUrl || '';
            if (homologPicker === 'spec') setHomologSpecUrl(url);
            else setHomologViewUrl(url);
            setHomologPicker(null);
          }}
          onClose={() => setHomologPicker(null)}
        />
      )}

      {/* 사양 코드 직접 추가/편집 모달 */}
      {specEditor && (
        <SpecEditorModal
          value={specEditor}
          onChange={(patch) => setSpecEditor((s) => ({ ...s, ...patch, error: '' }))}
          onSubmit={submitSpecEditor}
          onClose={() => setSpecEditor(null)}
          categories={specCategories}
          codeIndex={codeIndex}
          nextKr={nextKrCode(codeDict)}
        />
      )}
    </Layout>
  );
}

// ── 사양 코드 추가/편집 모달 ────────────────────────────────────────
// 'kr'      = 견적서에 없는 사양을 사내 코드(KR01~KR99)로 새로 만들어 추가 (code_dict 에 등록)
// 'existing' = 이미 코드 사전에 있는 코드를 이 모델에 추가
function SpecEditorModal({ value: v, onChange, onSubmit, onClose, categories, codeIndex, nextKr }) {
  const isNew = v.index == null;
  const entry = codeIndex[normCode(v.code)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-sm">
            {isNew ? '사양 코드 추가' : '사양 코드 편집'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* 코드 유형 */}
          {isNew && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'kr', label: '사내 코드 신규', desc: 'KR01~KR99' },
                { key: 'existing', label: '기존 코드 사용', desc: '코드 사전에서' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    onChange({
                      mode: opt.key,
                      code: opt.key === 'kr' ? (nextKr || '') : '',
                    })
                  }
                  className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                    v.mode === opt.key
                      ? 'border-mb-blue bg-blue-50 text-mb-blue'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-xs opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          )}

          {v.mode === 'kr' && isNew && !nextKr && (
            <p className="text-xs text-red-600">KR01~KR99 를 모두 사용했습니다. 코드 사전에서 미사용 KR 코드를 정리해 주세요.</p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 *</label>
            <input
              list="spec-categories"
              value={v.category}
              onChange={(e) => onChange({ category: e.target.value })}
              placeholder="예: 엔진, 캡 외장, 추가 사항"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
            />
            <datalist id="spec-categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">코드 *</label>
            <input
              list={v.mode === 'existing' ? 'dict-codes' : undefined}
              value={v.code}
              onChange={(e) => onChange({ code: e.target.value.toUpperCase() })}
              disabled={v.mode === 'kr' && !isNew}
              placeholder={v.mode === 'kr' ? 'KR01' : '예: A1Z'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-mb-blue disabled:bg-gray-50 disabled:text-gray-500"
            />
            {v.mode === 'existing' && (
              <>
                <datalist id="dict-codes">
                  {Object.keys(codeIndex).slice(0, 2000).map((c) => <option key={c} value={c} />)}
                </datalist>
                <p className="text-xs mt-1">
                  {v.code
                    ? entry
                      ? <span className="text-green-600">✓ {entry.name_ko || entry.name_en}</span>
                      : <span className="text-amber-600">코드 사전에 없는 코드입니다.</span>
                    : <span className="text-gray-400">코드 사전에 등록된 코드만 선택할 수 있습니다.</span>}
                </p>
              </>
            )}
            {v.mode === 'kr' && (
              <p className="text-xs text-gray-400 mt-1">
                견적서(.docx)에 없는 사내 전용 코드입니다. 코드 사전(code_dict)에 등록되며 견적서 원본 파일은 변경되지 않습니다.
              </p>
            )}
          </div>

          {v.mode === 'kr' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">국문명 *</label>
                <input
                  value={v.name_ko}
                  onChange={(e) => onChange({ name_ko: e.target.value })}
                  placeholder="예: 국내 사양 리어 언더런 바"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">영문명 (선택)</label>
                <input
                  value={v.name_en}
                  onChange={(e) => onChange({ name_en: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
                />
              </div>
              <div className="space-y-2">
                <Toggle
                  checked={v.is_color}
                  onChange={(checked) => onChange({ is_color: checked })}
                  label="컬러 항목 (스와치 표시)"
                />
                {v.is_color && (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={v.hex_color || '#ffffff'}
                      onChange={(e) => onChange({ hex_color: e.target.value })}
                      className="h-9 w-12 border border-gray-300 rounded"
                    />
                    <input
                      value={v.hex_color}
                      onChange={(e) => onChange({ hex_color: e.target.value })}
                      placeholder="#RRGGBB"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-mb-blue"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">항목명 라벨 (선택)</label>
            <input
              value={v.label_ko}
              onChange={(e) => onChange({ label_ko: e.target.value })}
              placeholder="비우면 코드가 항목명으로 표시됩니다"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
            />
          </div>

          {v.error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 whitespace-pre-line">
              {v.error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={onSubmit} disabled={v.saving}>
            {v.saving ? '저장 중...' : isNew ? '추가' : '적용'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// 인증 자료 링크 1행 — 현재 선택된 파일명 표시 + 선택/변경/해제
function HomologLinkRow({ label, url, onSelect, onClear }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {url ? (
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0 truncate text-sm text-mb-blue hover:underline"
            title={fileNameFromUrl(url)}
          >
            📄 {fileNameFromUrl(url)}
          </a>
          <button
            type="button"
            onClick={onSelect}
            className="shrink-0 px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50"
          >
            변경
          </button>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50"
          >
            해제
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors"
        >
          📁 SharePoint 에서 선택
        </button>
      )}
    </div>
  );
}
