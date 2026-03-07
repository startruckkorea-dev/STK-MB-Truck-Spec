/**
 * debug-docx.mjs — docx 파일을 mammoth로 HTML 변환 후 덤프
 * 사용법: node scripts/debug-docx.mjs <docx파일경로>
 */
import mammoth from 'mammoth';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const filePath = process.argv[2] || 'quotation/Internal quotation_TR01-1  Actros-L 2863 LS 6x2 G5F 2026-04_(2).docx';
const absPath = resolve(filePath);

console.log('파일:', absPath);

const buffer = readFileSync(absPath);
const result = await mammoth.convertToHtml({ buffer });

writeFileSync('debug-docx-output.html', result.value, 'utf-8');
console.log('HTML 저장 완료: debug-docx-output.html');
console.log('경고:', result.messages.length, '개');
result.messages.forEach(m => console.log(' -', m.message));
