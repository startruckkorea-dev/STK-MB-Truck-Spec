import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ─── 디자인 토큰 (라이트 테마) ──────────────────────────────────
const MB_BLUE = { argb: 'FF00ADEF' };
const WHITE = { argb: 'FFFFFFFF' };
const BLACK = { argb: 'FF1A1A1A' };
const GRAY_50 = { argb: 'FFF9FAFB' };
const GRAY_100 = { argb: 'FFF3F4F6' };
const GRAY_200 = { argb: 'FFE5E7EB' };
const GRAY_500 = { argb: 'FF6B7280' };
const DIFF_BG = { argb: 'FFDBEAFE' }; // 연한 파란색 하이라이트

const FONT_BODY = 'Noto Sans KR';
const FONT_CODE = 'Roboto Mono';

const THIN_BORDER = { style: 'thin', color: GRAY_200 };
const CELL_BORDER = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

// ─── Excel 공통 스타일 헬퍼 ─────────────────────────────────────

function applyTitleRow(ws, text, colCount) {
  const row = ws.addRow([text]);
  row.height = 32;
  ws.mergeCells(row.number, 1, row.number, colCount);
  const cell = row.getCell(1);
  cell.font = { name: FONT_BODY, size: 14, bold: true, color: BLACK };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: WHITE };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  cell.border = CELL_BORDER;
}

function applySubtitleRow(ws, text, colCount) {
  const row = ws.addRow([text]);
  row.height = 16;
  ws.mergeCells(row.number, 1, row.number, colCount);
  const cell = row.getCell(1);
  cell.font = { name: FONT_BODY, size: 8, color: GRAY_500 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: WHITE };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
}

function applyHeaderRow(ws, values) {
  const row = ws.addRow(values);
  let maxLines = 1;
  row.eachCell((cell, colNumber) => {
    cell.font = { name: FONT_BODY, size: 10, bold: true, color: WHITE };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: MB_BLUE };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = CELL_BORDER;
    const lines = estimateLines(String(cell.value || ''), ws.getColumn(colNumber).width || 20);
    if (lines > maxLines) maxLines = lines;
  });
  row.height = Math.max(26, maxLines * 18);
  return row;
}

function applyCategoryRow(ws, text, colCount) {
  const row = ws.addRow([text]);
  row.height = 24;
  ws.mergeCells(row.number, 1, row.number, colCount);
  const cell = row.getCell(1);
  cell.font = { name: FONT_BODY, size: 10, bold: true, color: BLACK };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: GRAY_100 };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  cell.border = CELL_BORDER;
}

function applyDataRow(ws, values, { highlight = false, even = false } = {}) {
  const row = ws.addRow(values);
  const bg = highlight ? DIFF_BG : even ? GRAY_50 : WHITE;
  let maxLines = 1;

  row.eachCell((cell, colNumber) => {
    cell.font = {
      name: colNumber === 1 ? FONT_BODY : FONT_CODE,
      size: 9,
      color: BLACK,
    };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
    cell.border = CELL_BORDER;

    const lines = estimateLines(String(cell.value || ''), ws.getColumn(colNumber).width || 20);
    if (lines > maxLines) maxLines = lines;
  });

  row.height = Math.max(22, maxLines * 16);
  return row;
}

/**
 * 텍스트가 셀 안에서 몇 줄로 래핑되는지 추정
 * Excel 열 너비 단위 = 기본 폰트 기준 영문 글자 수
 * 한글/CJK는 2글자분, 영문/숫자/기호는 1글자분으로 계산
 * indent(1) + padding 등으로 실제 사용 가능 너비를 줄여서 계산
 */
function estimateLines(text, colWidth) {
  if (!text) return 1;
  // 실제 사용 가능 너비 (indent, padding 감안하여 보수적으로)
  const usableWidth = Math.max(colWidth - 4, 4);
  const segments = text.split(/\n/);
  let totalLines = 0;
  for (const seg of segments) {
    let used = 0;
    let lines = 1;
    for (const ch of seg) {
      // 한글/CJK/전각 = 2단위, 그 외 = 1단위
      const w = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(ch) ? 2 : 1;
      used += w;
      if (used > usableWidth) {
        lines++;
        used = w;
      }
    }
    totalLines += lines;
  }
  return totalLines;
}

function finalizeSheet(ws) {
  ws.eachRow((row) => {
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell = row.getCell(c);
      if (!cell.fill || !cell.fill.fgColor) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: WHITE };
      }
      if (!cell.border) cell.border = CELL_BORDER;
    }
  });
}

async function saveWorkbook(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ═══════════════════════════════════════════════════════════════
//  사양 상세 — Excel
// ═══════════════════════════════════════════════════════════════

function modelFullName(m) {
  return `${m.series} ${m.code}${m.axle ? ` ${m.axle}` : ''}${m.cabin ? ` ${m.cabin}` : ''}`;
}

export async function exportDetailToExcel(model, specs, dict, notes = [], language = 'ko') {
  const title = `${modelFullName(model)} (${model.model_year})`;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 31));

  const colCount = 3;
  ws.columns = [
    { width: 32 },
    { width: 22 },
    { width: 42 },
  ];

  // 타이틀
  applyTitleRow(ws, title, colCount);
  const dateStr = new Date().toLocaleDateString('ko-KR');
  applySubtitleRow(ws, `생성일: ${dateStr}`, colCount);
  ws.addRow([]); // 빈 줄

  // 보충 설명
  if (notes.length > 0) {
    applyCategoryRow(ws, '보충 설명', colCount);
    applyHeaderRow(ws, ['항목', '내용', '']);
    notes.forEach((note, i) => {
      applyDataRow(ws, [note.label, note.content, ''], { even: i % 2 === 0 });
    });
    ws.addRow([]);
  }

  // 사양 데이터
  applyHeaderRow(ws, ['항목', '코드', '값']);
  const groups = groupByCategory(specs.filter((s) => !s.is_hidden));
  groups.forEach(({ category, items }) => {
    applyCategoryRow(ws, category, colCount);
    items.forEach((spec, i) => {
      const translated = resolveValue(spec, dict, language);
      applyDataRow(ws, [spec.label_ko || spec.spec_key, spec.spec_value, translated], { even: i % 2 === 0 });
    });
  });

  finalizeSheet(ws);
  const suffix = language === 'en' ? '_EN' : '';
  await saveWorkbook(wb, `${sanitizeFilename(title)}${suffix}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════
//  사양 상세 — PDF (브라우저 인쇄)
// ═══════════════════════════════════════════════════════════════

export function exportDetailToPDF(model, specs, dict, notes = [], language = 'ko') {
  const title = `${modelFullName(model)} (${model.model_year})`;
  const groups = groupByCategory(specs.filter((s) => !s.is_hidden));

  let notesHtml = '';
  if (notes.length > 0) {
    notesHtml = `
      <div class="category">보충 설명</div>
      <table>
        <thead><tr><th style="width:35%">항목</th><th>내용</th></tr></thead>
        <tbody>
          ${notes.map((n, i) => `<tr class="${i % 2 === 0 ? 'even' : ''}"><td>${esc(n.label)}</td><td>${esc(n.content)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  const specsHtml = groups.map(({ category, items }) => `
    <div class="category">${esc(category)}</div>
    <table>
      <thead><tr><th style="width:35%">항목</th><th style="width:20%">코드</th><th>값</th></tr></thead>
      <tbody>
        ${items.map((spec, i) => `
          <tr class="${i % 2 === 0 ? 'even' : ''}">
            <td>${esc(spec.label_ko || spec.spec_key)}</td>
            <td class="code">${esc(spec.spec_value)}</td>
            <td>${esc(resolveValue(spec, dict, language))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `).join('');

  openPrintWindow(title, notesHtml + specsHtml);
}

// ═══════════════════════════════════════════════════════════════
//  비교 — Excel
// ═══════════════════════════════════════════════════════════════

export async function exportCompareToExcel(models, specsMap, dict, notesMap = {}, showDiffOnly = false, language = 'ko') {
  const allKeys = buildAllKeys(models, specsMap, dict);
  const diffSet = showDiffOnly ? buildDiffSet(allKeys, models, specsMap, dict, language) : null;

  const wb = new ExcelJS.Workbook();
  const sheetName = `비교_${models.map((m) => m.code).join('_')}`.slice(0, 31);
  const ws = wb.addWorksheet(sheetName);

  const colCount = 1 + models.length;
  ws.columns = [
    { width: 32 },
    ...models.map(() => ({ width: 30 })),
  ];

  // 타이틀
  const titleText = models.map((m) => modelFullName(m)).join(' vs ');
  applyTitleRow(ws, `모델 비교: ${titleText}`, colCount);
  applySubtitleRow(ws, `생성일: ${new Date().toLocaleDateString('ko-KR')}`, colCount);
  ws.addRow([]);

  // 보충 설명
  const hasNotes = models.some((m) => (notesMap[m.id] ?? []).length > 0);
  if (hasNotes) {
    applyCategoryRow(ws, '보충 설명', colCount);
    applyHeaderRow(ws, ['항목', ...models.map((m) => modelFullName(m))]);
    const maxNotes = Math.max(...models.map((m) => (notesMap[m.id] ?? []).length));
    for (let i = 0; i < maxNotes; i++) {
      const label = models.map((m) => (notesMap[m.id] ?? [])[i]?.label).find(Boolean) || '';
      const vals = models.map((m) => {
        const note = (notesMap[m.id] ?? [])[i];
        return note ? note.content : '';
      });
      applyDataRow(ws, [label, ...vals], { even: i % 2 === 0 });
    }
    ws.addRow([]);
  }

  // 헤더
  applyHeaderRow(ws, ['항목', ...models.map((m) => `${modelFullName(m)}\n(${m.model_year})`)]);

  let rowIndex = 0;
  allKeys.forEach((row) => {
    if (row.type === 'category') {
      if (diffSet && !diffSet.categories.has(row.category)) return;
      applyCategoryRow(ws, row.category, colCount);
      rowIndex = 0;
      return;
    }
    if (diffSet && !diffSet.specKeys.has(row.spec_key)) return;

    const values = models.map((m) => {
      const specs = specsMap[m.id] ?? [];
      const spec = specs.find((s) => s.spec_key === row.spec_key);
      if (!spec) return '—';
      return resolveValue(spec, dict, language);
    });

    const uniqueVals = new Set(values.filter((v) => v !== '—'));
    const hasAbsent = values.some((v) => v === '—');
    const isDiff = uniqueVals.size > 1 || (hasAbsent && uniqueVals.size > 0);

    applyDataRow(ws, [row.labelKo || row.spec_key, ...values], {
      highlight: isDiff,
      even: rowIndex % 2 === 0,
    });
    rowIndex++;
  });

  finalizeSheet(ws);
  const suffix = language === 'en' ? '_EN' : '';
  await saveWorkbook(wb, `${sanitizeFilename(sheetName)}${suffix}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════
//  비교 — PDF (브라우저 인쇄)
// ═══════════════════════════════════════════════════════════════

export function exportCompareToPDF(models, specsMap, dict, notesMap = {}, showDiffOnly = false, language = 'ko') {
  const allKeys = buildAllKeys(models, specsMap, dict);
  const diffSet = showDiffOnly ? buildDiffSet(allKeys, models, specsMap, dict, language) : null;

  const title = `모델 비교: ${models.map((m) => modelFullName(m)).join(' vs ')}`;
  const modelHeaders = models.map((m) => `<th>${esc(modelFullName(m))}<br><small>${m.model_year}</small></th>`).join('');

  // 보충 설명
  let notesHtml = '';
  const hasNotes = models.some((m) => (notesMap[m.id] ?? []).length > 0);
  if (hasNotes) {
    const maxNotes = Math.max(...models.map((m) => (notesMap[m.id] ?? []).length));
    let noteRows = '';
    for (let i = 0; i < maxNotes; i++) {
      const label = models.map((m) => (notesMap[m.id] ?? [])[i]?.label).find(Boolean) || '';
      const cells = models.map((m) => {
        const note = (notesMap[m.id] ?? [])[i];
        return `<td>${esc(note ? note.content : '—')}</td>`;
      }).join('');
      noteRows += `<tr class="${i % 2 === 0 ? 'even' : ''}"><td>${esc(label)}</td>${cells}</tr>`;
    }
    notesHtml = `
      <div class="category">보충 설명</div>
      <table><thead><tr><th style="width:25%">항목</th>${modelHeaders}</tr></thead>
      <tbody>${noteRows}</tbody></table>
    `;
  }

  // 사양 테이블
  let specsHtml = '';
  let currentCategory = '';
  let tableRows = '';
  let rowIdx = 0;

  const flushTable = () => {
    if (!tableRows) return;
    specsHtml += `
      <div class="category">${esc(currentCategory)}</div>
      <table><thead><tr><th style="width:25%">항목</th>${modelHeaders}</tr></thead>
      <tbody>${tableRows}</tbody></table>
    `;
    tableRows = '';
  };

  allKeys.forEach((row) => {
    if (row.type === 'category') {
      if (diffSet && !diffSet.categories.has(row.category)) return;
      flushTable();
      currentCategory = row.category;
      rowIdx = 0;
      return;
    }
    if (diffSet && !diffSet.specKeys.has(row.spec_key)) return;

    const values = models.map((m) => {
      const specs = specsMap[m.id] ?? [];
      const spec = specs.find((s) => s.spec_key === row.spec_key);
      if (!spec) return '—';
      return resolveValue(spec, dict, language);
    });

    const uniqueVals = new Set(values.filter((v) => v !== '—'));
    const hasAbsent = values.some((v) => v === '—');
    const isDiff = uniqueVals.size > 1 || (hasAbsent && uniqueVals.size > 0);

    const cells = values.map((v) => `<td>${esc(v)}</td>`).join('');
    tableRows += `<tr class="${isDiff ? 'diff' : ''} ${rowIdx % 2 === 0 ? 'even' : ''}"><td>${esc(row.labelKo || row.spec_key)}</td>${cells}</tr>`;
    rowIdx++;
  });
  flushTable();

  openPrintWindow(title, notesHtml + specsHtml, models.length > 2);
}

// ═══════════════════════════════════════════════════════════════
//  PDF 인쇄 윈도우
// ═══════════════════════════════════════════════════════════════

function openPrintWindow(title, bodyHtml, landscape = false) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
    return;
  }

  w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&family=Roboto+Mono:wght@400&display=swap');

  ${landscape ? '@page { size: A4 landscape; margin: 12mm; }' : '@page { size: A4; margin: 15mm; }'}

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Noto Sans KR', sans-serif;
    background: #fff;
    color: #1a1a1a;
    padding: 24px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .header {
    border-bottom: 3px solid #00ADEF;
    padding: 16px 0 12px;
    margin-bottom: 20px;
  }
  .header h1 {
    font-family: 'Noto Sans KR', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: #1a1a1a;
  }
  .header .date {
    font-size: 11px;
    color: #6b7280;
    margin-top: 4px;
  }

  .category {
    font-family: 'Noto Sans KR', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #1a1a1a;
    background: #f3f4f6;
    padding: 8px 14px;
    margin-top: 16px;
    border: 1px solid #e5e7eb;
    border-bottom: none;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    font-size: 11px;
  }
  thead th {
    background: #00ADEF;
    color: #fff;
    font-family: 'Noto Sans KR', sans-serif;
    font-weight: 600;
    font-size: 11px;
    padding: 8px 12px;
    text-align: left;
    border: 1px solid #e5e7eb;
  }
  tbody td {
    padding: 7px 12px;
    border: 1px solid #e5e7eb;
    color: #1a1a1a;
    vertical-align: top;
    line-height: 1.5;
  }
  tbody tr { background: #fff; }
  tbody tr.even { background: #f9fafb; }
  tbody tr.diff { background: #dbeafe; }
  tbody tr.diff td { color: #1e40af; }
  td.code, .code { font-family: 'Roboto Mono', monospace; font-size: 10px; color: #4b5563; }

  .footer {
    text-align: center;
    font-size: 9px;
    color: #9ca3af;
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid #e5e7eb;
  }

  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
    .header { break-after: avoid; }
    table { break-inside: auto; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:16px;">
    <button onclick="window.print()" style="
      background:#00ADEF;color:#fff;border:none;padding:10px 32px;
      border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;
      font-family:'Noto Sans KR',sans-serif;
    ">PDF 저장 / 인쇄</button>
    <span style="color:#6b7280;font-size:12px;margin-left:12px;">
      인쇄 대화상자에서 "PDF로 저장"을 선택하세요
    </span>
  </div>
  <div class="header">
    <h1>${esc(title)}</h1>
    <div class="date">생성일: ${new Date().toLocaleDateString('ko-KR')}</div>
  </div>
  ${bodyHtml}
  <div class="footer">MB Trucks Korea — Spec Viewer</div>
</body>
</html>`);
  w.document.close();
}

// ═══════════════════════════════════════════════════════════════
//  공통 헬퍼
// ═══════════════════════════════════════════════════════════════

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resolveValue(spec, dict, language = 'ko') {
  if (!spec.use_translate) return spec.spec_value || '';
  const entry = dict[(spec.spec_value || '').trim().toUpperCase()];
  if (language === 'en') return (entry?.name_en) || spec.spec_value || '';
  if (!entry) return spec.spec_value || '';
  return entry.name_ko || spec.spec_value;
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

function groupByCategory(specs) {
  const map = new Map();
  for (const spec of specs) {
    const cat = spec.category || '기타';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(spec);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

function buildAllKeys(models, specsMap, dict) {
  const categoryOrder = [];
  const keysByCategory = new Map();
  models.forEach((m) => {
    const specs = specsMap[m.id] ?? [];
    specs.forEach((spec) => {
      if (spec.is_hidden || dict[(spec.spec_value || '').trim().toUpperCase()]?.is_hidden) return;
      const cat = spec.category || '기타';
      if (!keysByCategory.has(cat)) {
        keysByCategory.set(cat, new Map());
        categoryOrder.push(cat);
      }
      const keyMap = keysByCategory.get(cat);
      if (!keyMap.has(spec.spec_key)) {
        keyMap.set(spec.spec_key, { spec_key: spec.spec_key, labelKo: spec.label_ko, sort_order: spec.sort_order });
      }
    });
  });
  const result = [];
  categoryOrder.forEach((cat) => {
    result.push({ type: 'category', category: cat });
    const keys = Array.from(keysByCategory.get(cat).values()).sort((a, b) => a.sort_order - b.sort_order);
    keys.forEach((k) => result.push({ type: 'spec', category: cat, ...k }));
  });
  return result;
}

function buildDiffSet(allKeys, models, specsMap, dict, language = 'ko') {
  const specKeys = new Set();
  const categories = new Set();
  allKeys.forEach((row) => {
    if (row.type !== 'spec') return;
    const vals = models.map((m) => {
      const specs = specsMap[m.id] ?? [];
      const spec = specs.find((s) => s.spec_key === row.spec_key);
      if (!spec) return null;
      return resolveValue(spec, dict, language);
    });
    const unique = new Set(vals.filter(Boolean));
    const hasAbsent = vals.some((v) => v === null);
    if (unique.size > 1 || (hasAbsent && unique.size > 0)) {
      specKeys.add(row.spec_key);
      categories.add(row.category);
    }
  });
  return { specKeys, categories };
}
