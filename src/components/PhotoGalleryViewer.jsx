import { useEffect } from "react";

export default function PhotoGalleryViewer({ photos = [], index = 0, title = "Product photos", onIndexChange, onClose }) {
  const safeIndex = Math.min(Math.max(0, index), Math.max(photos.length - 1, 0));
  const photo = photos[safeIndex];

  useEffect(() => {
    if (!photo) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
      if (event.key === "ArrowLeft" && safeIndex > 0) onIndexChange?.(safeIndex - 1);
      if (event.key === "ArrowRight" && safeIndex < photos.length - 1) onIndexChange?.(safeIndex + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [photo, safeIndex, photos.length, onClose, onIndexChange]);

  if (!photo) return null;

  return <div className="photo-gallery-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
    <section className="photo-gallery-viewer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="photo-gallery-close" aria-label="Close photo viewer" onClick={onClose}>×</button>
      <div className="photo-gallery-stage">
        <button type="button" className="photo-gallery-nav previous" aria-label="Previous photo" disabled={safeIndex <= 0} onClick={() => onIndexChange?.(safeIndex - 1)}>‹</button>
        <img src={photo.src} alt={photo.alt || title} />
        <button type="button" className="photo-gallery-nav next" aria-label="Next photo" disabled={safeIndex >= photos.length - 1} onClick={() => onIndexChange?.(safeIndex + 1)}>›</button>
      </div>
      <div className="photo-gallery-caption"><strong>{title}</strong><span>{safeIndex + 1} / {photos.length}</span></div>
    </section>
  </div>;
}
