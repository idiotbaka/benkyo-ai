import { useRef, useState, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

const CROP_SIZE = 240;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function AvatarCropper({ imgSrc, onConfirm, onCancel }) {
  const overlayRef = useRef(null);
  const cardRef = useRef(null);
  const imgRef = useRef(null);

  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });
  const [minScale, setMinScale] = useState(1);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const scaleRef = useRef(1);
  const naturalSizeRef = useRef({ w: 1, h: 1 });

  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { naturalSizeRef.current = naturalSize; }, [naturalSize]);

  useGSAP(() => {
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(cardRef.current, { scale: 0.85, opacity: 0, y: 24 });
  });

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.to(overlayRef.current, { opacity: 1, duration: 0.3 });
    tl.to(cardRef.current, { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, '-=0.15');
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const ms = Math.max(CROP_SIZE / w, CROP_SIZE / h);
      setNaturalSize({ w, h });
      setMinScale(ms);
      setScale(ms);
      scaleRef.current = ms;
      naturalSizeRef.current = { w, h };
      setOffset({ x: 0, y: 0 });
    };
    img.src = imgSrc;
  }, [imgSrc]);

  const clampOff = (ox, oy, s, nw, nh) => {
    const maxX = Math.max(0, (nw * s - CROP_SIZE) / 2);
    const maxY = Math.max(0, (nh * s - CROP_SIZE) / 2);
    return { x: clamp(ox, -maxX, maxX), y: clamp(oy, -maxY, maxY) };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const { w, h } = naturalSizeRef.current;
    setOffset(clampOff(dragStart.current.ox + dx, dragStart.current.oy + dy, scaleRef.current, w, h));
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    setDragging(false);
  };

  const handleZoom = (factor) => {
    const s = clamp(scaleRef.current * factor, minScale, minScale * 4);
    setScale(s);
    scaleRef.current = s;
    const { w, h } = naturalSizeRef.current;
    setOffset(prev => clampOff(prev.x, prev.y, s, w, h));
  };

  const handleConfirm = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const s = scale;
    const { w, h } = naturalSize;
    const imgLeft = CROP_SIZE / 2 + offset.x - w * s / 2;
    const imgTop = CROP_SIZE / 2 + offset.y - h * s / 2;
    const cropX = -imgLeft / s;
    const cropY = -imgTop / s;
    const cropW = CROP_SIZE / s;
    const cropH = CROP_SIZE / s;

    ctx.drawImage(imgRef.current, cropX, cropY, cropW, cropH, 0, 0, 256, 256);
    onConfirm(canvas.toDataURL('image/jpeg', 0.85));
  };

  const dW = naturalSize.w * scale;
  const dH = naturalSize.h * scale;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
    >
      <div
        ref={cardRef}
        className="w-full rounded-3xl flex flex-col items-center"
        style={{ maxWidth: 360, background: '#1A1645', padding: '28px 24px 24px' }}
      >
        <p className="text-white font-bold text-lg mb-1">调整头像</p>
        <p className="mb-5" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>拖动图片调整位置</p>

        <div
          style={{
            width: CROP_SIZE,
            height: CROP_SIZE,
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
            background: '#0a0820',
            cursor: dragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            boxShadow: '0 0 0 3px var(--tp-from), 0 0 0 8px rgba(124,108,246,0.18)',
            flexShrink: 0,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
        >
          <img
            ref={imgRef}
            src={imgSrc}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              width: dW,
              height: dH,
              maxWidth: 'none',
              left: CROP_SIZE / 2 + offset.x - dW / 2,
              top: CROP_SIZE / 2 + offset.y - dH / 2,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        </div>

        <div className="flex items-center gap-5 mt-5 mb-6">
          <button
            onClick={() => handleZoom(0.875)}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', color: 'white',
              fontSize: 22, fontWeight: 700, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >−</button>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>缩放</span>
          <button
            onClick={() => handleZoom(1.125)}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', color: 'white',
              fontSize: 22, fontWeight: 700, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >+</button>
        </div>

        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl font-semibold"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
          >取消</button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 rounded-2xl font-bold text-white"
            style={{ background: 'var(--tp)', boxShadow: '0 4px 0 var(--tp-deep)' }}
            onMouseDown={e => gsap.to(e.currentTarget, { translateY: 3, boxShadow: '0 1px 0 var(--tp-deep)', duration: 0.08 })}
            onMouseUp={e => gsap.to(e.currentTarget, { translateY: 0, boxShadow: '0 4px 0 var(--tp-deep)', duration: 0.15, ease: 'back.out(2)' })}
          >确认裁剪</button>
        </div>
      </div>
    </div>
  );
}
