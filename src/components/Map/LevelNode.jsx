import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

// Darken a hex color by mixing with black at `ratio` (0–1)
function darkenHex(hex, ratio = 0.22) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((n >> 16) & 0xff) * (1 - ratio));
  const g = Math.round(((n >> 8)  & 0xff) * (1 - ratio));
  const b = Math.round(( n        & 0xff) * (1 - ratio));
  return `rgb(${r},${g},${b})`;
}

export default function LevelNode({ level, index, chapterColor, isCompleted, isUnlocked, stars, onClick }) {
  const nodeRef   = useRef(null);
  const stripeRef = useRef(null);
  const dotRef    = useRef(null);

  const isCurrent = isUnlocked && !isCompleted; // "active" state

  useGSAP(() => {
    // ── Entrance ──────────────────────────────────────────────────────
    gsap.fromTo(
      nodeRef.current,
      { y: 36, opacity: 0, scale: 0.72 },
      { y: 0, opacity: 1, scale: 1, duration: 0.5, delay: index * 0.1, ease: 'back.out(1.8)' }
    );

    // ── Scrolling stripe (completed + unlocked) ───────────────────────
    if (isUnlocked && stripeRef.current) {
      gsap.to(stripeRef.current, {
        backgroundPositionX: '+=60px',
        repeat: -1,
        duration: isCurrent ? 2.2 : 4.5,
        ease: 'none',
      });
    }

    // ── Pulsing dot for current level ─────────────────────────────────
    if (isCurrent && dotRef.current) {
      gsap.to(dotRef.current, {
        scale: 1.5,
        opacity: 0,
        repeat: -1,
        duration: 1.2,
        ease: 'power2.out',
      });
    }
  }, []);

  const handleClick = () => {
    if (!isUnlocked) {
      gsap.timeline()
        .to(nodeRef.current, { x: -5, duration: 0.07 })
        .to(nodeRef.current, { x:  5, duration: 0.07 })
        .to(nodeRef.current, { x: -3, duration: 0.06 })
        .to(nodeRef.current, { x:  0, duration: 0.06 });
      return;
    }
    gsap.timeline({ onComplete: onClick })
      .to(nodeRef.current, { scale: 0.88, duration: 0.1,  ease: 'power2.in' })
      .to(nodeRef.current, { scale: 1.05, duration: 0.14, ease: 'back.out(2)' })
      .to(nodeRef.current, { scale: 1,    duration: 0.1 });
  };

  // ── Visual config per state ──────────────────────────────────────────
  const bg          = isCompleted ? '#22C55E' : isUnlocked ? chapterColor : '#E5E7EB';
  const shadowColor = isCompleted ? '#15803D' : isUnlocked ? darkenHex(chapterColor) : '#C8C9D0';
  const stripeColor = isCompleted ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.15)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* ── Node button ─────────────────────────────────────────────── */}
      <button
        ref={nodeRef}
        onClick={handleClick}
        style={{
          position: 'relative',
          width: 76, height: 64,
          borderRadius: 28,
          background: bg,
          border: 'none',
          cursor: isUnlocked ? 'pointer' : 'default',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          opacity: !isUnlocked ? 0.5 : 1,
          boxShadow: `0 4px 0 ${shadowColor}`,
          outline: 'none',
          flexShrink: 0,
        }}
      >
        {/* Scrolling diagonal stripe overlay */}
        {isUnlocked && (
          <div
            ref={stripeRef}
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `repeating-linear-gradient(
                58deg,
                transparent,
                transparent 30px,
                ${stripeColor} 30px,
                ${stripeColor} 50px
              )`,
              backgroundSize: '60px 100%',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Pulsing ring for current level */}
        {isCurrent && (
          <div
            ref={dotRef}
            style={{
              position: 'absolute', inset: -4,
              borderRadius: 24,
              border: `2px solid ${chapterColor}`,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}

        {/* Icon */}
        <span style={{
          fontSize: isUnlocked ? 26 : 20,
          lineHeight: 1,
          position: 'relative', zIndex: 1,
        }}>
          {!isUnlocked ? '🔒' : level.icon}
        </span>

        {/* Level label inside card */}
        {isUnlocked && (
          <span style={{
            fontSize: 9, fontWeight: 800,
            color: 'rgba(255,255,255,0.72)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: 3,
            position: 'relative', zIndex: 1,
          }}>
            {isCompleted ? '✓ DONE' : `LV.${index + 1}`}
          </span>
        )}
      </button>

      {/* ── Label + stars ────────────────────────────────────────────── */}
      <div style={{ marginTop: 8, textAlign: 'center' }}>
        <p style={{
          fontSize: 11, fontWeight: 700,
          color: isUnlocked ? '#1E1B4B' : '#9CA3AF',
          marginBottom: 4,
          maxWidth: 80,
          lineHeight: 1.3,
        }}>
          {level.title}
        </p>
        <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          {[1, 2, 3].map(s => (
            <span
              key={s}
              style={{
                fontSize: 10,
                lineHeight: 1,
                filter: stars >= s ? 'none' : 'grayscale(1)',
                opacity: stars >= s ? 1 : 0.35,
              }}
            >
              ⭐
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
