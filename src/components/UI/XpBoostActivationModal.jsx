import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import exp2Img from '../../assets/icons/item/exp2.png';
import exp3Img from '../../assets/icons/item/exp3.png';

/**
 * XpBoostActivationModal — Full-screen celebration animation shown when
 * an XP boost card is activated.
 * Props:
 *   multiplier: 2 | 3
 *   onDismiss: () => void  — called once the animation ends (~3.2 s)
 */
export default function XpBoostActivationModal({ multiplier, onDismiss }) {
  const isDouble = multiplier === 2;

  const overlayRef   = useRef(null);
  const particleRef  = useRef(null); // container for JS-spawned particles
  const ring1Ref     = useRef(null);
  const ring2Ref     = useRef(null);
  const ring3Ref     = useRef(null);
  const circleRef    = useRef(null);
  const multRef      = useRef(null);
  const textRef      = useRef(null);

  const mainColor  = isDouble ? '#92400E' : '#3B0764';
  const glowColor  = isDouble ? 'rgba(251,191,36,0.7)' : 'rgba(139,92,246,0.7)';
  const ringColor  = isDouble ? '#FCD34D' : '#A78BFA';
  const bgGradient = isDouble
    ? 'radial-gradient(circle at 50% 50%, #FFFDE7 0%, #FDE68A 45%, #F59E0B 100%)'
    : `radial-gradient(circle at 50% 50%, var(--tp-lite) 0%, var(--tp-bdr) 45%, var(--tp-dark) 100%)`;

  useEffect(() => {
    const overlay  = overlayRef.current;
    const particle = particleRef.current;
    const rings    = [ring1Ref.current, ring2Ref.current, ring3Ref.current];
    const circle   = circleRef.current;
    const mult     = multRef.current;
    const text     = textRef.current;

    // ── Initial state (FOUC prevention) ─────────────────────────────
    gsap.set(overlay,  { opacity: 0 });
    gsap.set(rings,    { scale: 0.5, opacity: 0 });
    gsap.set(circle,   { scale: 0, opacity: 0, rotate: -15 });
    gsap.set(mult,     { scale: 0.3, opacity: 0 });
    gsap.set(text,     { y: 36, opacity: 0 });

    // ── Particle burst ────────────────────────────────────────────────
    const PARTICLES = 16;
    const stars = ['✨', '⭐', '💫', '🌟'];
    for (let i = 0; i < PARTICLES; i++) {
      const el = document.createElement('span');
      el.textContent = stars[i % stars.length];
      el.style.cssText = `
        position:absolute; left:calc(50% - 12px); top:calc(50% - 12px);
        font-size:${14 + Math.random() * 12}px; pointer-events:none;
      `;
      particle.appendChild(el);
      const angle = (i / PARTICLES) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist  = 90 + Math.random() * 70;
      gsap.fromTo(el,
        { x: 0, y: 0, scale: 0.1, opacity: 1 },
        {
          x: Math.cos(angle) * dist, y: Math.sin(angle) * dist,
          scale: 1, opacity: 0,
          duration: 1.1 + Math.random() * 0.5,
          delay: 0.35 + i * 0.025,
          ease: 'power2.out',
          onComplete: () => el.remove(),
        }
      );
    }

    // ── Main timeline ─────────────────────────────────────────────────
    const tl = gsap.timeline({ onComplete: onDismiss });

    // Backdrop
    tl.to(overlay, { opacity: 1, duration: 0.22 });

    // Expanding rings (behind circle)
    tl.to(rings, {
      scale: 3.2, opacity: 0,
      stagger: 0.18,
      duration: 1.6,
      ease: 'power2.out',
    }, '-=0.05');

    // Circle bounces in
    tl.fromTo(circle,
      { scale: 0, opacity: 0, rotate: -15 },
      { scale: 1, opacity: 1, rotate: 0, duration: 0.55, ease: 'back.out(3)' },
      '<0.12'
    );

    // Multiplier text pops
    tl.fromTo(mult,
      { scale: 0.3, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(3.5)' },
      '-=0.15'
    );

    // Circle gentle pulse
    tl.to(circle, { scale: 1.06, duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: 1 }, '-=0.05');

    // Sub-text slides up
    tl.fromTo(text,
      { y: 36, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(2)' },
      '-=0.3'
    );

    // Hold
    tl.to({}, { duration: 1.8 });

    // Fade out
    tl.to([circle, mult, text], {
      opacity: 0, scale: 0.88, y: -20,
      duration: 0.45, ease: 'power2.in',
      stagger: 0.06,
    });
    tl.to(overlay, { opacity: 0, duration: 0.25 }, '-=0.2');

    return () => tl.kill();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(8, 5, 28, 0.88)',
        pointerEvents: 'none',
      }}
    >
      {/* Expanding rings (behind everything) */}
      <div
        ref={ring1Ref}
        style={{
          position: 'absolute', width: 180, height: 180,
          borderRadius: '50%', border: `2px solid ${ringColor}`, opacity: 0,
        }}
      />
      <div
        ref={ring2Ref}
        style={{
          position: 'absolute', width: 200, height: 200,
          borderRadius: '50%', border: `1.5px solid ${ringColor}`, opacity: 0,
        }}
      />
      <div
        ref={ring3Ref}
        style={{
          position: 'absolute', width: 220, height: 220,
          borderRadius: '50%', border: `1px solid ${ringColor}`, opacity: 0,
        }}
      />

      {/* Particle container */}
      <div
        ref={particleRef}
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      />

      {/* Main glowing circle */}
      <div
        ref={circleRef}
        style={{
          position: 'relative',
          width: 190, height: 190,
          borderRadius: '50%',
          background: bgGradient,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 40px ${glowColor}, 0 0 90px ${glowColor}, 0 0 160px ${glowColor}40`,
          zIndex: 1,
        }}
      >
        <img src={isDouble ? exp2Img : exp3Img} alt="XP加速" width={70} height={70} style={{ objectFit: 'contain', marginBottom: 2 }} />
        <div
          ref={multRef}
          style={{
            fontSize: 52, fontWeight: 900,
            color: mainColor,
            lineHeight: 1,
            letterSpacing: '-2px',
          }}
        >
          {multiplier}X
        </div>
      </div>

      {/* Text below circle */}
      <div ref={textRef} style={{ textAlign: 'center', marginTop: 28 }}>
        <p style={{
          fontSize: 22, fontWeight: 900, color: 'white',
          marginBottom: 6, letterSpacing: '-0.3px',
        }}>
          {isDouble ? '双倍' : '三倍'}经验已开启！
        </p>
        <p style={{
          fontSize: 14, fontWeight: 700,
          color: isDouble ? '#FDE68A' : '#DDD6FE',
        }}>
          🕐 有效期 15 分钟
        </p>
      </div>
    </div>
  );
}
