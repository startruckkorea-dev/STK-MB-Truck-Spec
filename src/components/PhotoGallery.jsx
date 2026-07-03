/**
 * PhotoGallery.jsx — 모델 사진 갤러리 모달
 *
 * 상세 화면의 [사진] 버튼으로 열린다. SharePoint 사진 폴더([src/lib/pictures.js])를
 * 조회해 반응형 그리드로 보여주고, 사진을 누르면 전체화면 라이트박스로 확대한다.
 * 권한 구분 없이 sales 포함 전체가 볼 수 있다.
 */

import { useState, useEffect, useCallback } from 'react';
import { listModelPictures } from '../lib/pictures';

export default function PhotoGallery({ model, onClose }) {
  const [photos, setPhotos] = useState(null); // null=로딩중
  const [error, setError] = useState('');
  const [active, setActive] = useState(null); // 라이트박스 인덱스

  useEffect(() => {
    let alive = true;
    setError('');
    setPhotos(null);
    listModelPictures(model)
      .then((list) => alive && setPhotos(list))
      .catch((e) => alive && (setError(e.message), setPhotos([])))
      .finally(() => {});
    return () => {
      alive = false;
    };
  }, [model]);

  const showPrev = useCallback(
    () => setActive((i) => (i == null ? i : (i - 1 + photos.length) % photos.length)),
    [photos]
  );
  const showNext = useCallback(
    () => setActive((i) => (i == null ? i : (i + 1) % photos.length)),
    [photos]
  );

  // 키보드: Esc 닫기, ←/→ 이동
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (active != null) setActive(null);
        else onClose();
      } else if (active != null && e.key === 'ArrowLeft') showPrev();
      else if (active != null && e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose, showPrev, showNext]);

  const title = [model.series, model.code, model.axle, model.cabin]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-200">
          <div className="min-w-0">
            <h3 className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-sm truncate">
              {title} 사진
            </h3>
            {Array.isArray(photos) && photos.length > 0 && (
              <span className="text-xs text-gray-400">{photos.length}장</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none ml-4"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 min-h-[240px] p-3 sm:p-4">
          {photos === null && (
            <p className="text-sm text-gray-400 text-center py-16 animate-pulse">
              사진 불러오는 중...
            </p>
          )}

          {photos !== null && error && (
            <div className="m-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3 whitespace-pre-line">
              {error}
            </div>
          )}

          {photos !== null && !error && photos.length === 0 && (
            <div className="text-center py-16 text-sm text-gray-400">
              등록된 사진이 없습니다.
              <p className="text-xs text-gray-300 mt-1">
                SharePoint 사진 폴더에 이미지를 추가하면 여기에 표시됩니다.
              </p>
            </div>
          )}

          {photos !== null && photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setActive(i)}
                  className="group relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:border-mb-blue focus:outline-none focus:ring-2 focus:ring-mb-blue"
                >
                  <img
                    src={p.thumbUrl}
                    alt={p.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 라이트박스 */}
      {active != null && photos && photos[active] && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center select-none"
          onClick={() => setActive(null)}
        >
          <button
            onClick={(e) => (e.stopPropagation(), setActive(null))}
            className="absolute top-3 right-4 text-white/80 hover:text-white text-3xl leading-none"
            aria-label="닫기"
          >
            ✕
          </button>

          {photos.length > 1 && (
            <button
              onClick={(e) => (e.stopPropagation(), showPrev())}
              className="absolute left-2 sm:left-5 text-white/70 hover:text-white text-4xl sm:text-5xl px-2"
              aria-label="이전"
            >
              ‹
            </button>
          )}

          <img
            src={photos[active].fullUrl}
            alt={photos[active].name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[94vw] max-h-[88vh] object-contain rounded shadow-2xl"
          />

          {photos.length > 1 && (
            <button
              onClick={(e) => (e.stopPropagation(), showNext())}
              className="absolute right-2 sm:right-5 text-white/70 hover:text-white text-4xl sm:text-5xl px-2"
              aria-label="다음"
            >
              ›
            </button>
          )}

          <div className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-xs">
            {active + 1} / {photos.length} · {photos[active].name}
          </div>
        </div>
      )}
    </div>
  );
}
