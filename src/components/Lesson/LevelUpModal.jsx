import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { XP_PER_LEVEL } from '../../store/gameStore';

const CONFETTI_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF9500', '#C77DFF', '#FF8FAB', '#00D4AA'];
const CONFETTI_COUNT = 32;

export default function LevelUpModal({ oldLevel, newLevel, totalXp, onContinue }) {
  const overlayRef = useRef(null);
  const cardRef = useRef(null);
  const crownRef = useRef(null);
  const titleRef = useRef(null);
  const badgeRef = useRef(null);
  const barFillRef = useRef(null);
  const xpLabelRef = useRef(null);
  const btnRef = useRef(null);
  const confettiRefs = useRef([]);

  const xpInLevel = totalXp % XP_PER_LEVEL;
  const xpPct = (xpInLevel / XP_PER_LEVEL) * 100;

  // Set initial invisible states to prevent FOUC
  useGSAP(() => {
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(cardRef.current, { scale: 0.75, opacity: 0, y: 30 });
    gsap.set(crownRef.current, { scale: 0, rotation: -20, opacity: 0 });
    gsap.set(titleRef.current, { y: 16, opacity: 0 });
    gsap.set(badgeRef.current, { scale: 0, opacity: 0 });
    gsap.set(barFillRef.current, { width: '0%' });
    gsap.set(xpLabelRef.current, { opacity: 0 });
    gsap.set(btnRef.current, { y: 20, opacity: 0 });
    confettiRefs.current.filter(Boolean).forEach(el =>
      gsap.set(el, { x: 0, y: 0, opacity: 0, scale: 0 })
    );
  });

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    // 1. Overlay fades in
    tl.to(overlayRef.current, { opacity: 1, duration: 0.35 });

    // 2. Card rises and scales in
    tl.to(cardRef.current, { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2)' }, '-=0.15');

    // 3. Crown pops in
    tl.to(crownRef.current, { scale: 1, rotation: 0, opacity: 1, duration: 0.45, ease: 'back.out(3)' }, '-=0.2');

    // 4. Title slides up
    tl.to(titleRef.current, { y: 0, opacity: 1, duration: 0.3 }, '-=0.15');

    // 5. Level badge elastic pop
    tl.to(badgeRef.current, { scale: 1, opacity: 1, duration: 0.55, ease: 'elastic.out(1, 0.55)' }, '-=0.05');

    // 6. Confetti burst timed with badge pop
    confettiRefs.current.filter(Boolean).forEach((el, i) => {
      const angle = (i / CONFETTI_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = 90 + Math.random() * 120;
      tl.fromTo(
        el,
        { x: 0, y: 0, opacity: 1, scale: 1, rotation: 0 },
        {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          opacity: 0,
          scale: 0.2,
          rotation: (Math.random() - 0.5) * 540,
          duration: 1.0 + Math.random() * 0.3,
          ease: 'power3.out',
        },
        // Stagger slightly, all starting near badge pop
        '<0.05'
      );
    });

    // 7. XP bar fills
    tl.to(barFillRef.current, { width: `${xpPct}%`, duration: 0.9, ease: 'power2.inOut' }, '-=0.7');
    tl.to(xpLabelRef.current, { opacity: 1, duration: 0.25 }, '-=0.4');

    // 8. Continue button
    tl.to(btnRef.current, { y: 0, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }, '+=0.1');
  }, []);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(10, 6, 40, 0.90)', backdropFilter: 'blur(6px)' }}
    >
      {/* Confetti particles — centered in viewport */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
          <div
            key={i}
            ref={el => { confettiRefs.current[i] = el; }}
            style={{
              position: 'absolute',
              width: i % 4 === 0 ? 14 : i % 3 === 0 ? 10 : 7,
              height: i % 4 === 0 ? 14 : i % 3 === 0 ? 10 : 7,
              borderRadius: i % 3 === 0 ? '50%' : '2px',
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        ref={cardRef}
        className="w-full rounded-3xl flex flex-col items-center text-center overflow-hidden"
        style={{
          maxWidth: 360,
          background: 'linear-gradient(160deg, #2A2070 0%, #130D3E 100%)',
          boxShadow: '0 0 80px rgba(91,79,233,0.45), 0 24px 64px rgba(0,0,0,0.6)',
          padding: '40px 32px 36px',
        }}
      >
        {/* Decorative top glow */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 200,
            height: 100,
            borderRadius: '0 0 50% 50%',
            background: 'radial-gradient(ellipse, rgba(124,108,246,0.35) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Crown */}
        <div ref={crownRef} className="relative z-10 text-6xl mb-3" style={{ filter: 'drop-shadow(0 0 16px gold)' }}>
          👑
        </div>

        {/* Title */}
        <div ref={titleRef} className="relative z-10 mb-6">
          <h2 className="text-white font-extrabold text-2xl jp tracking-wide">升级了！</h2>
          <p className="text-white/50 text-sm mt-1 font-medium">レベルアップ！</p>
        </div>

        {/* Level badge: old → new */}
        <div ref={badgeRef} className="relative z-10 flex items-center gap-5 mb-7">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-white/35">Lv.{oldLevel}</p>
            <p className="text-xs text-white/25 mt-0.5">之前</p>
          </div>

          <div className="text-white/40 text-xl">→</div>

          <div
            className="rounded-2xl px-6 py-3"
            style={{
              background: 'linear-gradient(135deg, var(--tp-from), var(--tp))',
              boxShadow: '0 6px 24px rgba(91,79,233,0.7), 0 0 0 2px rgba(124,108,246,0.4)',
            }}
          >
            <p className="text-white font-extrabold text-4xl tracking-tight">Lv.{newLevel}</p>
          </div>
        </div>

        {/* XP progress bar in new level */}
        <div className="w-full relative z-10 mb-7">
          <div ref={xpLabelRef} className="flex justify-between text-xs text-white/45 mb-2 font-medium">
            <span>本级进度</span>
            <span>{xpInLevel} / {XP_PER_LEVEL} XP</span>
          </div>
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 10, background: 'rgba(255,255,255,0.08)' }}
          >
            <div
              ref={barFillRef}
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, var(--tp-from), #A78BFA)',
                boxShadow: '0 0 8px rgba(167,139,250,0.8)',
                width: '0%',
              }}
            />
          </div>
        </div>

        {/* Continue button */}
        <button
          ref={btnRef}
          onClick={onContinue}
          className="w-full py-4 rounded-2xl font-bold text-white text-base relative z-10"
          style={{
            background: 'linear-gradient(135deg, var(--tp-from), var(--tp))',
            boxShadow: '0 5px 0 var(--tp-deep)',
          }}
          onMouseDown={e =>
            gsap.to(e.currentTarget, { translateY: 4, boxShadow: '0 1px 0 var(--tp-deep)', duration: 0.08 })
          }
          onMouseUp={e =>
            gsap.to(e.currentTarget, { translateY: 0, boxShadow: '0 5px 0 var(--tp-deep)', duration: 0.15, ease: 'back.out(2)' })
          }
        >
          太棒了！继续学习 →
        </button>
      </div>
    </div>
  );
}
