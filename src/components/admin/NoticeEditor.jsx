/**
 * NoticeEditor.jsx — 공지사항 작성/수정 모달 (관리자 전용)
 *
 * 제목·내용과 함께 이미지/PDF/문서 파일을 첨부할 수 있다. 첨부는 [저장]을 눌러야
 * SharePoint `Notice` 폴더로 업로드되고, 지운 첨부는 저장 시점에 폴더에서도 삭제된다.
 * (취소하면 SharePoint 에는 아무 변화가 없다)
 */

import { useEffect, useRef, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../hooks/useAuth';
import {
  uploadNoticeFile,
  deleteNoticeFile,
  parseAttachments,
  stringifyAttachments,
  formatBytes,
  isImageName,
  MAX_ATTACHMENT_BYTES,
} from '../../lib/notices';

const MAX_MB = Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024);

export default function NoticeEditor({ notice, onClose }) {
  const { saveNotice } = useData();
  const { profile } = useAuth();
  const fileRef = useRef(null);

  const [title, setTitle] = useState(notice?.title || '');
  const [content, setContent] = useState(notice?.content || '');
  const [isPinned, setIsPinned] = useState(!!notice?.is_pinned);
  const [isVisible, setIsVisible] = useState(notice ? notice.is_visible !== false : true);
  // 기존 첨부(유지 중) / 새로 고른 파일 / 삭제 예정인 기존 첨부
  const [kept, setKept] = useState(parseAttachments(notice?.attachments));
  const [added, setAdded] = useState([]);       // File[]
  const [removed, setRemoved] = useState([]);   // 기존 첨부 메타[]
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  // 배경 클릭 닫기는 "배경에서 눌러 배경에서 뗀" 경우에만 인정한다.
  // (입력창 안에서 드래그로 텍스트를 선택하다 바깥에서 손을 떼면 click 이 배경에서
  //  발생해, 작성 중이던 글이 그대로 날아가며 창이 닫히던 문제)
  const backdropDown = useRef(false);

  // 작성/수정 중인 내용이 있는지 — 실수로 닫을 때 확인을 띄우는 기준
  const dirty =
    title !== (notice?.title || '') ||
    content !== (notice?.content || '') ||
    added.length > 0 ||
    removed.length > 0 ||
    isPinned !== !!notice?.is_pinned ||
    isVisible !== (notice ? notice.is_visible !== false : true);

  /** 저장 중이 아니고, 변경분이 있으면 한 번 확인한 뒤 닫는다 */
  function requestClose() {
    if (saving) return;
    if (dirty && !window.confirm('작성 중인 내용이 저장되지 않습니다. 닫을까요?')) return;
    onClose();
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function addFiles(list) {
    const files = Array.from(list || []);
    const tooBig = files.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig.length) {
      setErr(
        `${tooBig.map((f) => `"${f.name}"`).join(', ')} — 파일당 최대 ${MAX_MB}MB 까지 첨부할 수 있습니다.`
      );
    }
    const ok = files.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
    if (ok.length) setAdded((prev) => [...prev, ...ok]);
  }

  function removeKept(att) {
    setKept((prev) => prev.filter((a) => a.id !== att.id));
    setRemoved((prev) => [...prev, att]);
  }

  async function handleSave() {
    if (!title.trim()) { setErr('제목을 입력해 주세요.'); return; }
    setSaving(true);
    setErr('');
    try {
      // 1) 새 첨부 업로드 (파일명 충돌 방지를 위해 접두어를 붙인다)
      const stamp = Date.now().toString(36);
      const uploaded = [];
      for (let i = 0; i < added.length; i++) {
        uploaded.push(await uploadNoticeFile(added[i], `${stamp}${i}`));
      }
      // 2) 공지 저장
      await saveNotice({
        ...notice,
        title: title.trim(),
        content,
        is_pinned: isPinned,
        is_visible: isVisible,
        author: notice?.author || profile?.name || profile?.email || '',
        attachments: stringifyAttachments([...kept, ...uploaded]),
      });
      // 3) 삭제된 첨부를 SharePoint 에서도 정리 (실패해도 저장 자체는 유효)
      for (const att of removed) {
        try {
          await deleteNoticeFile(att.id);
        } catch {
          /* 파일 정리 실패는 무시 */
        }
      }
      onClose(true);
    } catch (e) {
      setErr(e.message || '저장에 실패했습니다.');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
      // 첨부 영역 밖에 파일을 떨어뜨리면 브라우저가 그 파일로 이동해 버려
      // 작성 중이던 글이 통째로 날아간다 — 모달 위 드롭은 전부 무시한다.
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      onMouseDown={(e) => { backdropDown.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropDown.current) requestClose();
        backdropDown.current = false;
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-4"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="font-barlow font-bold text-lg text-gray-900 tracking-wide">
            {notice ? '공지 수정' : '공지 작성'}
          </h2>
          <button
            onClick={requestClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="공지 제목"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue/40 focus:border-mb-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={7}
              placeholder="공지 내용을 입력하세요."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-mb-blue/40 focus:border-mb-blue"
            />
          </div>

          {/* 첨부파일 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              첨부파일{' '}
              <span className="font-normal text-gray-400">
                (이미지 · PDF · 문서, 파일당 최대 {MAX_MB}MB)
              </span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
                dragOver ? 'border-mb-blue bg-mb-blue/5' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
              }`}
            >
              <p className="text-sm text-gray-600">
                파일을 끌어다 놓거나 <span className="text-mb-blue font-medium">클릭해서 선택</span>
              </p>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
              />
            </div>

            {(kept.length > 0 || added.length > 0) && (
              <ul className="mt-2 space-y-1">
                {kept.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded text-sm">
                    <span className="flex-shrink-0">{isImageName(a.name) ? '🖼' : '📎'}</span>
                    <span className="truncate flex-1 text-gray-700">{a.name}</span>
                    {a.size != null && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(a.size)}</span>
                    )}
                    <button
                      onClick={() => removeKept(a)}
                      className="text-xs text-red-500 hover:text-red-600 flex-shrink-0"
                    >
                      삭제
                    </button>
                  </li>
                ))}
                {added.map((f, i) => (
                  <li key={`new-${i}`} className="flex items-center gap-2 px-3 py-1.5 bg-mb-blue/5 rounded text-sm">
                    <span className="flex-shrink-0">{isImageName(f.name) ? '🖼' : '📎'}</span>
                    <span className="truncate flex-1 text-gray-700">{f.name}</span>
                    <span className="text-[10px] font-semibold text-mb-blue flex-shrink-0">새 파일</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(f.size)}</span>
                    <button
                      onClick={() => setAdded((prev) => prev.filter((_, k) => k !== i))}
                      className="text-xs text-red-500 hover:text-red-600 flex-shrink-0"
                    >
                      취소
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 옵션 */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="rounded border-gray-300 text-mb-blue focus:ring-mb-blue"
              />
              상단 고정
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                className="rounded border-gray-300 text-mb-blue focus:ring-mb-blue"
              />
              공개 (해제 시 관리자에게만 보임)
            </label>
          </div>

          {err && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {err}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200">
          <button
            onClick={requestClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-mb-blue text-white hover:bg-mb-blue-dark disabled:opacity-60"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
