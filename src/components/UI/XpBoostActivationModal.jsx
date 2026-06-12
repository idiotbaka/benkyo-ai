import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useIcon } from '../../lib/icons';

/**
 * XpBoostActivationModal — Full-screen celebration animation shown when
 * an XP boost card is activated.
 * Props:
 *   multiplier: 2 | 3
 *   onDismiss: () => void  — called once the animation ends (~3.2 s)
 */
export default function XpBoostActivationModal({ multiplier, boostType = 'xp', onDismiss }) {
  const isDouble = multiplier === 2;
  const isCoinBoost = boostType === 'coin';
  const exp2Img = useIcon('item/exp2.png');
  const exp3Img = useIcon('item/exp3.png');
  const coin2Img = useIcon('item/coin2.png');
  const coin3Img = useIcon('item/coin3.png');

  const overlayRef   = useRef(null);
  const particleRef  = useRef(null); // container for JS-spawned particles
  const cardRef      = useRef(null);
  const iconRef      = useRef(null);
  const multRef      = useRef(null);
  const textRef      = useRef(null);

  const boostIcon = isCoinBoost
    ? (isDouble ? coin2Img : coin3Img)
    : (isDouble ? exp2Img : exp3Img);
  const accentColor = isCoinBoost
    ? (isDouble ? '#059669' : '#2563EB')
    : (isDouble ? '#D97706' : 'var(--tp)');
  const softBg = isCoinBoost
    ? (isDouble ? 'linear-gradient(180deg, #ECFDF5 0%, #FFFBEB 100%)' : 'linear-gradient(180deg, #EFF6FF 0%, #F5F3FF 100%)')
    : isDouble
    ? 'linear-gradient(180deg, #FFF7ED 0%, #FFFBEB 100%)'
    : 'linear-gradient(180deg, #F5F3FF 0%, #FFF1F2 100%)';
  const borderColor = isCoinBoost ? (isDouble ? '#A7F3D0' : '#BFDBFE') : isDouble ? '#FDE68A' : 'var(--tp-bdr)';

  useEffect(() => {
    const overlay  = overlayRef.current;
    const particle = particleRef.current;
    const card     = cardRef.current;
    const icon     = iconRef.current;
    const mult     = multRef.current;
    const text     = textRef.current;

    // ── Initial state (FOUC prevention) ─────────────────────────────
    gsap.set(overlay,  { opacity: 0 });
    gsap.set(card,     { y: 56, opacity: 0, scale: 0.88 });
    gsap.set(icon,     { scale: 0, rotate: -12 });
    gsap.set(mult,     { y: 12, opacity: 0 });
    gsap.set(text,     { y: 14, opacity: 0 });

    // ── Particle burst ────────────────────────────────────────────────
    const PARTICLES = 18;
    for (let i = 0; i < PARTICLES; i++) {
      const el = document.createElement('img');
      el.src = boostIcon;
      el.alt = '';
      el.style.cssText = `
        position:absolute; left:calc(50% - 10px); top:calc(50% - 64px);
        width:${12 + Math.random() * 10}px; height:${12 + Math.random() * 10}px;
        object-fit:contain; pointer-events:none;
      `;
      particle.appendChild(el);
      const angle = (i / PARTICLES) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist  = 72 + Math.random() * 72;
      gsap.fromTo(el,
        { x: 0, y: 0, scale: 0.1, opacity: 1, rotate: 0 },
        {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 18,
          scale: 1,
          rotate: (Math.random() - 0.5) * 220,
          opacity: 0,
          duration: 1.0 + Math.random() * 0.42,
          delay: 0.28 + i * 0.025,
          ease: 'power2.out',
          onComplete: () => el.remove(),
        }
      );
    }

    // ── Main timeline ─────────────────────────────────────────────────
    const tl = gsap.timeline({ onComplete: onDismiss });

    // Backdrop
    tl.to(overlay, { opacity: 1, duration: 0.2 });

    // Card and icon
    tl.to(card, { y: 0, opacity: 1, scale: 1, duration: 0.42, ease: 'back.out(2)' }, '-=0.08');
    tl.to(icon, { scale: 1, rotate: 0, duration: 0.38, ease: 'back.out(3)' }, '-=0.18');
    tl.to(icon, { scale: 1.08, duration: 0.14, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '-=0.02');

    // Multiplier text pops
    tl.to(mult, { y: 0, opacity: 1, duration: 0.28, ease: 'back.out(2)' }, '-=0.08');

    // Sub-text slides up
    tl.to(text, { y: 0, opacity: 1, duration: 0.28, ease: 'back.out(1.8)' }, '-=0.14');

    // Hold
    tl.to({}, { duration: 1.55 });

    // Fade out
    tl.to(card, {
      opacity: 0,
      scale: 0.94,
      y: -22,
      duration: 0.36,
      ease: 'power2.in',
    });
    tl.to(overlay, { opacity: 0, duration: 0.2 }, '-=0.14');

    return () => {
      tl.kill();
      particle.replaceChildren();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(17, 24, 39, 0.58)',
        backdropFilter: 'blur(7px)',
        pointerEvents: 'none',
        padding: 24,
      }}
    >
      {/* Particle container */}
      <div
        ref={particleRef}
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      />

      <div
        ref={cardRef}
        style={{
          position: 'relative',
          width: 304,
          borderRadius: 30,
          background: 'white',
          boxShadow: '0 22px 60px rgba(17,24,39,0.28)',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: softBg,
            padding: '24px 24px 18px',
            textAlign: 'center',
            borderBottom: '1px solid #F3F4F6',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 24,
              borderRadius: 999,
              padding: '0 12px',
              background: 'rgba(255,255,255,0.78)',
              border: '1px solid rgba(255,255,255,0.95)',
              color: '#9CA3AF',
              fontSize: 11,
              fontWeight: 900,
              marginBottom: 12,
            }}
          >
            {isCoinBoost ? '金币加成' : '经验加成'}
          </div>

          <div
            ref={iconRef}
            style={{
              width: 118,
              height: 118,
              borderRadius: 30,
              background: 'rgba(255,255,255,0.72)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px',
              border: `1.5px solid ${borderColor}`,
              filter: isDouble
                ? 'drop-shadow(0 10px 16px rgba(217,119,6,0.16))'
                : 'drop-shadow(0 10px 16px rgba(91,79,233,0.16))',
            }}
          >
            <img src={boostIcon} alt={isCoinBoost ? '金币加成' : 'XP加速'} width={78} height={78} style={{ objectFit: 'contain' }} />
          </div>

          <div
            ref={multRef}
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: accentColor,
              lineHeight: 1,
              letterSpacing: '-1px',
            }}
          >
            {multiplier}×
          </div>
        </div>

        <div ref={textRef} style={{ textAlign: 'center', padding: '18px 24px 24px' }}>
          <p style={{
            fontSize: 21,
            fontWeight: 900,
            color: '#1E1B4B',
            marginBottom: 8,
          }}>
            {isDouble ? '双倍' : '三倍'}{isCoinBoost ? '金币' : '经验'}已开启
          </p>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 30,
              borderRadius: 999,
              padding: '0 13px',
              background: isDouble ? '#FFFBEB' : '#F5F3FF',
              border: `1.5px solid ${borderColor}`,
              color: accentColor,
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            有效期 15 分钟
          </div>
        </div>
      </div>
    </div>
  );
}
