/**
 * NoticeBoard.jsx — 모델 목록 상단 공지사항 게시판
 *
 * - 모든 로그인 사용자가 공지를 읽을 수 있다 (첨부 이미지·PDF 포함).
 * - 관리자만 작성/수정/삭제·공개·상단고정을 할 수 있다.
 * - 데이터는 워크북 `notices` 시트, 첨부파일은 SharePoint `Notice` 폴더에 있다.
 *   ([src/lib/notices.js])
 */

import { useEffect, useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../hooks/useAuth';
import NoticeEditor from './admin/NoticeEditor';
import ImageLightbox from './ImageLightbox';
import {
  parseAttachments,
  resolveNoticeFileUrls,
  formatBytes,
  isImageName,
  isPdfName,
} from '../lib/notices';

/** 'YYYY-MM-DD' 표기 (ISO 문자열·엑셀 문자열 모두 허용) */
function formatDate(v) {
  if (!v) return '';
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

/** 목록에서 최신 글에 NEW 배지를 붙이는 기준 (7일) */
function isRecent(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
}

/** 한 페이지에 보여 줄 공지 수 — 나머지는 페이지를 넘겨서 본다 */
const PAGE_SIZE = 5;

export default function NoticeBoard() {
  const { notices, deleteNotice, setNoticePinned, setNoticeVisible } = useData();
  const { isAdmin } = useAuth();

  const [page, setPage] = useState(1); // 1-base
  const [openNotice, setOpenNotice] = useState(null); // 읽기 모달
  const [editing, setEditing] = useState(null); // { notice } | { notice: null } = 신규
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');

  // 공개 여부 필터 + 고정 우선 + 최신순
  const list = useMemo(() => {
    const visible = (notices || []).filter((n) => isAdmin || n.is_visible !== false);
    return [...visible].sort((a, b) => {
      if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  }, [notices, isAdmin]);

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  // 글이 지워져 페이지 수가 줄면 마지막 페이지로 당긴다
  const curPage = Math.min(page, totalPages);
  const shown = list.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  useEffect(() => {
    if (page !== curPage) setPage(curPage);
  }, [page, curPage]);

  async function run(id, fn) {
    setBusyId(id);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e.message || '처리에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  // 공지가 하나도 없고 관리자도 아니면 영역 자체를 숨긴다
  if (!list.length && !isAdmin) return null;

  return (
    <section className="mb-4 sm:mb-6 border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <h2 className="font-barlow font-bold text-base sm:text-lg text-gray-900 tracking-wide flex items-center gap-2">
          <span aria-hidden="true">📢</span> 공지사항
        </h2>
        {isAdmin && (
          <button
            onClick={() => setEditing({ notice: null })}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-mb-blue text-white hover:bg-mb-blue-dark"
          >
            + 공지 작성
          </button>
        )}
      </div>

      {err && (
        <p className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">{err}</p>
      )}

      {list.length === 0 ? (
        <p className="px-4 py-5 text-sm text-gray-400 text-center">
          등록된 공지가 없습니다. [공지 작성]으로 첫 공지를 올려 보세요.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {shown.map((n) => {
            const atts = parseAttachments(n.attachments);
            return (
              <li key={n.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50">
                <button
                  onClick={() => setOpenNotice(n)}
                  className="flex-1 min-w-0 text-left flex items-center gap-2"
                >
                  {n.is_pinned && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-mb-blue/10 text-mb-blue">
                      고정
                    </span>
                  )}
                  {n.is_visible === false && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-500">
                      비공개
                    </span>
                  )}
                  <span className="truncate text-sm text-gray-800 font-medium">{n.title}</span>
                  {atts.length > 0 && (
                    <span className="flex-shrink-0 text-xs text-gray-400">📎 {atts.length}</span>
                  )}
                  {isRecent(n.created_at) && (
                    <span className="flex-shrink-0 text-[10px] font-bold text-red-500">NEW</span>
                  )}
                </button>

                <span className="hidden sm:block flex-shrink-0 text-xs text-gray-400 font-mono">
                  {formatDate(n.created_at)}
                </span>

                {isAdmin && (
                  <span className="flex-shrink-0 flex items-center gap-1">
                    <button
                      onClick={() => run(n.id, () => setNoticePinned(n.id, !n.is_pinned))}
                      disabled={busyId === n.id}
                      className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                      title={n.is_pinned ? '고정 해제' : '상단 고정'}
                    >
                      {n.is_pinned ? '고정해제' : '고정'}
                    </button>
                    <button
                      onClick={() => run(n.id, () => setNoticeVisible(n.id, n.is_visible === false))}
                      disabled={busyId === n.id}
                      className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {n.is_visible === false ? '공개' : '숨김'}
                    </button>
                    <button
                      onClick={() => setEditing({ notice: n })}
                      className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm(`"${n.title}" 공지를 삭제할까요?`)) return;
                        run(n.id, () => deleteNotice(n.id));
                      }}
                      disabled={busyId === n.id}
                      className="px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <Pager page={curPage} totalPages={totalPages} total={list.length} onChange={setPage} />
      )}

      {openNotice && (
        <NoticeViewer notice={openNotice} onClose={() => setOpenNotice(null)} />
      )}
      {editing && (
        <NoticeEditor notice={editing.notice} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

// ─── 페이지 이동 ────────────────────────────────────────────────────
/** 페이지가 많아져도 버튼이 넘치지 않게 현재 페이지 주변만 보여 준다 */
function pageWindow(page, totalPages, size = 5) {
  const start = Math.max(1, Math.min(page - Math.floor(size / 2), totalPages - size + 1));
  const end = Math.min(totalPages, start + size - 1);
  const out = [];
  for (let i = Math.max(1, start); i <= end; i++) out.push(i);
  return out;
}

function Pager({ page, totalPages, total, onChange }) {
  const btn = 'px-2 py-1 rounded text-xs font-medium disabled:opacity-40 disabled:cursor-default';
  return (
    <div className="flex items-center justify-center gap-1 py-2 border-t border-gray-100 bg-white">
      <span className="mr-2 text-[11px] text-gray-400">전체 {total}건</span>
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={`${btn} text-gray-500 hover:bg-gray-100`}
        aria-label="이전 페이지"
      >
        ‹ 이전
      </button>
      {pageWindow(page, totalPages).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-current={p === page ? 'page' : undefined}
          className={`${btn} min-w-[1.75rem] ${
            p === page ? 'bg-mb-blue text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className={`${btn} text-gray-500 hover:bg-gray-100`}
        aria-label="다음 페이지"
      >
        다음 ›
      </button>
    </div>
  );
}

// ─── 공지 읽기 모달 ─────────────────────────────────────────────────
function NoticeViewer({ notice, onClose }) {
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const metas = useMemo(() => parseAttachments(notice.attachments), [notice.attachments]);

  // 다운로드 URL 은 만료되므로 열 때마다 새로 받아온다
  useEffect(() => {
    let cancelled = false;
    if (!metas.length) { setFiles([]); return; }
    setLoadingFiles(true);
    resolveNoticeFileUrls(metas)
      .then((r) => { if (!cancelled) setFiles(r); })
      .catch(() => { if (!cancelled) setFiles(metas.map((m) => ({ ...m, missing: true }))); })
      .finally(() => { if (!cancelled) setLoadingFiles(false); });
    return () => { cancelled = true; };
  }, [metas]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const images = files.filter((f) => isImageName(f.name) && f.url);
  const others = files.filter((f) => !(isImageName(f.name) && f.url));

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-gray-200">
          <div className="min-w-0">
            <h2 className="font-noto font-bold text-lg text-gray-900 break-words">
              {notice.title}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDate(notice.created_at)}
              {notice.author ? ` · ${notice.author}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {notice.content && (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
              {notice.content}
            </p>
          )}

          {loadingFiles && <p className="text-xs text-gray-400">첨부파일 불러오는 중...</p>}

          {/* 이미지 첨부 — 바로 보이게 */}
          {images.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {images.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setLightbox(f)}
                  className="block rounded-lg overflow-hidden border border-gray-200 hover:border-mb-blue transition-colors"
                  title={f.name}
                >
                  <img src={f.url} alt={f.name} className="w-full h-48 object-contain bg-gray-50" />
                </button>
              ))}
            </div>
          )}

          {/* 그 외 첨부 — PDF·문서 등 */}
          {others.length > 0 && (
            <ul className="space-y-1">
              {others.map((f) => (
                <li key={f.id}>
                  {f.url || f.webUrl ? (
                    <a
                      href={f.url || f.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm"
                    >
                      <span className="flex-shrink-0">{isPdfName(f.name) ? '📄' : '📎'}</span>
                      <span className="truncate flex-1 text-gray-700">{f.name}</span>
                      {f.size != null && (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatBytes(f.size)}
                        </span>
                      )}
                      <span className="text-xs text-mb-blue font-medium flex-shrink-0">
                        {isPdfName(f.name) ? '열기' : '다운로드'}
                      </span>
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-400">
                      📎 {f.name} — 파일을 찾을 수 없습니다
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            닫기
          </button>
        </div>
      </div>

      {lightbox && (
        <ImageLightbox src={lightbox.url} alt={lightbox.name} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
