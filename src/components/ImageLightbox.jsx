/**
 * ImageLightbox.jsx — 단일 이미지 확대 보기 모달
 *
 * 사양 상세의 [보기] 버튼, 코드사전 미리보기 등에서 공용으로 쓴다.
 * Esc 또는 배경 클릭으로 닫힌다.
 */

import { useEffect } from 'react';

export default function ImageLightbox({ src, alt = '', onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center select-none p-4"
      onClick={onClose}
    >
      <button
        onClick={(e) => (e.stopPropagation(), onClose())}
        className="absolute top-3 right-4 text-white/80 hover:text-white text-3xl leading-none"
        aria-label="닫기"
      >
        ✕
      </button>

      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[94vw] max-h-[88vh] object-contain rounded shadow-2xl"
      />
    </div>
  );
}
