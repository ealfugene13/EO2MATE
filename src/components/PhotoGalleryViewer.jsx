import { useEffect, useRef, useState } from "react";

export default function PhotoGalleryViewer({ photos = [], index = 0, title = "Product photos", onIndexChange, onClose }) {
  const safeIndex = Math.min(Math.max(0, index), Math.max(photos.length - 1, 0));
  const photo = photos[safeIndex];
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragging(false);
    dragRef.current = null;
  }, [photo?.src]);

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

  function clampPan(x, y, scale = zoom) {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image) return { x, y };
    const maxX = Math.max(0, (image.offsetWidth * scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * scale - stage.clientHeight) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }

  function changeZoom(nextZoom) {
    const value = Math.max(1, Math.min(4, nextZoom));
    setZoom(value);
    if (value === 1) setPan({ x: 0, y: 0 });
    else setPan((current) => clampPan(current.x, current.y, value));
  }

  function handleWheel(event) {
    event.preventDefault();
    changeZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
  }

  function startDrag(event) {
    if (zoom <= 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    setDragging(true);
  }

  function moveDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan(clampPan(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY,
    ));
  }

  function stopDrag() {
    dragRef.current = null;
    setDragging(false);
  }

  return <div className="photo-gallery-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
    <section className="photo-gallery-viewer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="photo-gallery-close" aria-label="Close photo viewer" onClick={onClose}>×</button>
      <div className="photo-gallery-stage" ref={stageRef} onWheel={handleWheel}>
        <button type="button" className="photo-gallery-nav previous" aria-label="Previous photo" disabled={safeIndex <= 0} onClick={() => onIndexChange?.(safeIndex - 1)}>‹</button>
        <button type="button" className="photo-gallery-zoom" aria-label={zoom > 1 ? "Fit image to screen" : "Zoom in"} onClick={() => changeZoom(zoom > 1 ? 1 : 2)}>{zoom > 1 ? "Fit" : "Zoom"}</button>
        <img
          ref={imageRef}
          src={photo.src}
          alt={photo.alt || title}
          draggable="false"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onLostPointerCapture={stopDrag}
        />
        <button type="button" className="photo-gallery-nav next" aria-label="Next photo" disabled={safeIndex >= photos.length - 1} onClick={() => onIndexChange?.(safeIndex + 1)}>›</button>
      </div>
      <div className="photo-gallery-caption"><strong>{title}</strong><span>{safeIndex + 1} / {photos.length}</span></div>
    </section>
  </div>;
}
