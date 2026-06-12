import { useRef, useState, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useUserStore from '../../store/userStore';
import { useIcon } from '../../lib/icons';

gsap.registerPlugin(useGSAP);

const BOOST_DURATION_MS = 15 * 60 * 1000;

/**
 * XpBoostWidget — Draggable floating badge showing active XP boost and countdown.
 * Rendered globally in App.jsx so it persists across all pages.
 */
export default function XpBoostWidget() {
  const xpBoost     = useUserStore(s => s.xpBoost);
  const coinBoost   = useUserStore(s => s.coinBoost);
  const syncXpBoost = useUserStore(s => s.syncXpBoost);
  const exp2Img = useIcon('item/exp2.png');
  const exp3Img = useIcon('item/exp3.png');
  const coin2Img = useIcon('item/coin2.png');
  const coin3Img = useIcon('item/coin3.png');

  const [now, setNow] = useState(() => Date.now());
  const [isDragging, setIsDragging] = useState(false);
  // Initial position: top-right corner, away from nav bar
  const [pos, setPos] = useState(() => ({
    x: (typeof window !== 'undefined' ? window.innerWidth : 375) - 152,
    y: 88,
  }));

  const widgetRef = useRef(null);
  const drag      = useRef({ active: false, sx: 0, sy: 0, px: 0, py: 0 });
  // Track previous boost presence to detect when a new boost starts
  const prevBoost = useRef(null);

  // ── Countdown ticker ────────────────────────────────────────────────
  useEffect(() => {
    if (!xpBoost && !coinBoost) return;
    const id = setInterval(() => {
      syncXpBoost();
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [!!xpBoost, !!coinBoost, syncXpBoost]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Entrance animation when boost activates ──────────────────────────
  useGSAP(() => {
    if ((!xpBoost && !coinBoost) || !widgetRef.current) return;
    if (prevBoost.current === null) {
      // Fresh appearance
      gsap.fromTo(widgetRef.current,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.5)' }
      );
    }
    prevBoost.current = xpBoost ?? coinBoost;
  }, [!!xpBoost, !!coinBoost]);

  // ── Exit animation when boost expires ────────────────────────────────
  useGSAP(() => {
    if (xpBoost || coinBoost || !widgetRef.current || prevBoost.current === null) return;
    gsap.to(widgetRef.current, {
      scale: 0.6, opacity: 0, duration: 0.4, ease: 'back.in(2)',
    });
    prevBoost.current = null;
  }, [!!xpBoost, !!coinBoost]);

  // ── Drag handlers ────────────────────────────────────────────────────
  const handlePointerDown = (e) => {
    drag.current = {
      active: true,
      sx: e.clientX, sy: e.clientY,
      px: pos.x,     py: pos.y,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!drag.current.active) return;
    const WIDGET_W = 148, WIDGET_H = 60;
    setPos({
      x: Math.max(0, Math.min(
        window.innerWidth - WIDGET_W,
        drag.current.px + e.clientX - drag.current.sx
      )),
      y: Math.max(0, Math.min(
        window.innerHeight - WIDGET_H - 64, // keep above nav bar (~64 px)
        drag.current.py + e.clientY - drag.current.sy
      )),
    });
  };

  const handlePointerUp = () => {
    drag.current.active = false;
    setIsDragging(false);
  };

  const activeBoost = xpBoost ? { ...xpBoost, boostType: 'xp' } : coinBoost ? { ...coinBoost, boostType: 'coin' } : null;
  if (!activeBoost) return null;

  const remaining  = Math.max(0, activeBoost.expiresAt - now);
  const min        = Math.floor(remaining / 60000);
  const sec        = Math.floor((remaining % 60000) / 1000);
  const countdown  = `${min}:${sec.toString().padStart(2, '0')}`;
  const isDouble   = activeBoost.multiplier === 2;
  const isCoinBoost = activeBoost.boostType === 'coin';
  const pct        = Math.min(1, remaining / BOOST_DURATION_MS); // progress fraction 0→1
  const iconSrc = isCoinBoost
    ? (isDouble ? coin2Img : coin3Img)
    : (isDouble ? exp2Img : exp3Img);
  const bg = isCoinBoost
    ? (isDouble ? '#ECFDF5' : '#EFF6FF')
    : (isDouble ? '#FFFBEB' : '#F5F3FF');
  const border = isCoinBoost
    ? (isDouble ? '#A7F3D0' : '#BFDBFE')
    : (isDouble ? '#FDE68A' : '#DDD6FE');
  const accent = isCoinBoost
    ? (isDouble ? '#047857' : '#1D4ED8')
    : (isDouble ? '#92400E' : '#5B21B6');
  const progress = isCoinBoost
    ? (isDouble ? '#34D399' : '#60A5FA')
    : (isDouble ? '#FCD34D' : '#A78BFA');

  return (
    <div
      ref={widgetRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'fixed',
        left: pos.x, top: pos.y,
        zIndex: 150,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          background: bg,
          borderRadius: 12,
          padding: '7px 12px 6px',
          display: 'flex', alignItems: 'center', gap: 8,
          border: `1.5px solid ${border}`,
          minWidth: 130,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Time progress bar at bottom */}
        <div style={{
          position: 'absolute', left: 0, bottom: 0, height: 2,
          width: `${pct * 100}%`,
          background: progress,
          transition: 'width 1s linear',
        }} />

        <img src={iconSrc} alt={isCoinBoost ? '金币加成' : 'XP加速'} width={28} height={28} style={{ objectFit: 'contain', flexShrink: 0 }} />
        <div>
          <div style={{
            fontSize: 12, fontWeight: 700, lineHeight: 1.3,
            color: accent,
          }}>
            {activeBoost.multiplier}× {isCoinBoost ? '金币加成' : '经验加成'}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 500,
            color: accent,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {countdown}
          </div>
        </div>
      </div>
    </div>
  );
}
