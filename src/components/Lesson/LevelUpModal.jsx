import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { XP_PER_LEVEL } from '../../store/gameStore';
import { useIcon } from '../../lib/icons';

const CONFETTI_COLORS = ['#F472B6', '#FBBF24', '#FB7185', '#A78BFA', '#34D399', '#60A5FA'];
const CONFETTI_COUNT = 24;

export default function LevelUpModal({ oldLevel, newLevel, totalXp, onContinue }) {
  const overlayRef = useRef(null);
  const cardRef = useRef(null);
  const iconRef = useRef(null);
  const titleRef = useRef(null);
  const badgeRef = useRef(null);
  const barFillRef = useRef(null);
  const xpLabelRef = useRef(null);
  const btnRef = useRef(null);
  const confettiRefs = useRef([]);
  const levelIcon = useIcon('ui/lv.png');

  const xpInLevel = totalXp % XP_PER_LEVEL;
  const xpPct = (xpInLevel / XP_PER_LEVEL) * 100;

  // Set initial invisible states to prevent FOUC
  useGSAP(() => {
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(cardRef.current, { scale: 0.92, opacity: 0, y: 24 });
    gsap.set(iconRef.current, { scale: 0.72, rotation: -8, opacity: 0, y: 10 });
    gsap.set(titleRef.current, { y: 12, opacity: 0 });
    gsap.set(badgeRef.current, { y: 16, opacity: 0 });
    gsap.set(barFillRef.current, { width: '0%' });
    gsap.set(xpLabelRef.current, { y: 8, opacity: 0 });
    gsap.set(btnRef.current, { y: 16, opacity: 0 });
    confettiRefs.current.filter(Boolean).forEach(el =>
      gsap.set(el, { x: 0, y: 0, opacity: 0, scale: 0 })
    );
  });

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    // 1. Overlay fades in
    tl.to(overlayRef.current, { opacity: 1, duration: 0.22 });

    // 2. Card rises and scales in
    tl.to(cardRef.current, { scale: 1, opacity: 1, y: 0, duration: 0.36, ease: 'back.out(1.7)' }, '-=0.05');

    // 3. Level icon pops in
    tl.to(iconRef.current, { scale: 1, rotation: 0, opacity: 1, y: 0, duration: 0.46, ease: 'back.out(2.4)' }, '-=0.12');

    // 4. Title slides up
    tl.to(titleRef.current, { y: 0, opacity: 1, duration: 0.26 }, '-=0.18');

    // 5. Level transition settles in
    tl.to(badgeRef.current, { y: 0, opacity: 1, duration: 0.34, ease: 'back.out(1.7)' }, '-=0.02');

    // 6. Confetti burst timed with the level transition
    confettiRefs.current.filter(Boolean).forEach((el, i) => {
      const angle = (-Math.PI * 0.92) + (i / Math.max(1, CONFETTI_COUNT - 1)) * Math.PI * 1.84;
      const dist = 58 + Math.random() * 52;
      tl.fromTo(
        el,
        { x: 0, y: 0, opacity: 1, scale: 1, rotation: 0 },
        {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          opacity: 0,
          scale: 0.25,
          rotation: (Math.random() - 0.5) * 360,
          duration: 0.75 + Math.random() * 0.18,
          ease: 'power3.out',
        },
        '<0.02'
      );
    });

    // 7. XP bar fills
    tl.to(xpLabelRef.current, { y: 0, opacity: 1, duration: 0.24 }, '-=0.42');
    tl.to(barFillRef.current, { width: `${xpPct}%`, duration: 0.72, ease: 'power2.inOut' }, '-=0.28');

    // 8. Continue button
    tl.to(btnRef.current, { y: 0, opacity: 1, duration: 0.28, ease: 'back.out(1.7)' }, '-=0.08');
  }, []);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(31, 41, 55, 0.52)', backdropFilter: 'blur(8px)' }}
    >
      {/* Card */}
      <div
        ref={cardRef}
        className="w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: 360,
          borderRadius: 28,
          background: '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.72)',
          boxShadow: '0 18px 46px rgba(31,41,55,0.26)',
          position: 'relative',
        }}
      >
        {/* Confetti particles — centered around the icon inside the card */}
        <div
          className="absolute left-1/2 top-[90px] pointer-events-none overflow-visible"
          style={{ zIndex: 4 }}
        >
          {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
            <div
              key={i}
              ref={el => { confettiRefs.current[i] = el; }}
              style={{
                position: 'absolute',
                width: i % 3 === 0 ? 9 : 6,
                height: i % 3 === 0 ? 9 : 6,
                borderRadius: i % 4 === 0 ? '50%' : 2,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              }}
            />
          ))}
        </div>

        <div
          className="flex flex-col items-center text-center"
          style={{
            background: 'linear-gradient(180deg, #FFF1F2 0%, #FFF7ED 100%)',
            padding: '28px 26px 22px',
            borderBottom: '1px solid #FDE2E7',
          }}
        >
          <div
            ref={iconRef}
            style={{
              width: 118,
              height: 118,
              borderRadius: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: 'drop-shadow(0 12px 14px rgba(190,18,60,0.18))',
              marginBottom: 10,
            }}
          >
            <img src={levelIcon} alt="升级" width={112} height={112} style={{ objectFit: 'contain' }} />
          </div>

          <div ref={titleRef}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#1E1B4B', lineHeight: 1.15 }}>
              等级提升
            </div>
            <div style={{ marginTop: 5, fontSize: 12, fontWeight: 800, color: '#BE123C' }}>
              レベルアップ
            </div>
          </div>
        </div>

        <div style={{ padding: '22px 24px 24px' }}>
          {/* Level badge: old → new */}
          <div
            ref={badgeRef}
            className="flex items-center"
            style={{ marginBottom: 20, gap: 10 }}
          >
            <LevelPill label="之前" level={oldLevel} muted />

            <div
              aria-hidden="true"
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: '#F3F4F6',
                color: '#9CA3AF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              →
            </div>

            <LevelPill label="现在" level={newLevel} />
          </div>

          {/* XP progress bar in new level */}
          <div
            ref={xpLabelRef}
            style={{ marginBottom: 22 }}
          >
            <div className="flex justify-between" style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, marginBottom: 7 }}>
              <span>升到 Lv.{newLevel + 1}</span>
              <span>{xpInLevel} / {XP_PER_LEVEL} XP</span>
            </div>
            <div
              className="w-full overflow-hidden"
              style={{ height: 8, borderRadius: 4, background: '#F3F4F6' }}
            >
              <div
                ref={barFillRef}
                style={{
                  height: '100%',
                  width: '0%',
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, var(--tp-from), var(--tp))',
                  minWidth: xpPct > 0 ? 6 : 0,
                }}
              />
            </div>
          </div>

          {/* Continue button */}
          <button
            ref={btnRef}
            onClick={onContinue}
            className="btn-press"
            style={{
              width: '100%',
              height: 52,
              borderRadius: 16,
              border: 'none',
              background: 'linear-gradient(135deg, var(--tp-from), var(--tp))',
              boxShadow: '0 4px 0 var(--tp-deep)',
              color: 'white',
              fontSize: 15,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            继续学习
          </button>
        </div>
      </div>
    </div>
  );
}

function LevelPill({ label, level, muted = false }) {
  if (muted) {
    return (
      <div style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center' }}>
        <div
          style={{
            borderRadius: 16,
            background: '#F9FAFB',
            border: '1.5px solid #E5E7EB',
            padding: '10px 8px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', marginBottom: 2 }}>
            {label}
          </div>
          <div style={{ fontSize: 21, fontWeight: 900, color: '#9CA3AF', lineHeight: 1 }}>
            Lv.{level}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center' }}>
      <div
        style={{
          borderRadius: 18,
          background: '#FFFFFF',
          border: '2px solid var(--tp-bdr)',
          padding: '11px 10px',
          boxShadow: '0 4px 0 var(--tp-bdr), 0 8px 18px rgba(91,79,233,0.12)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--tp)', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--tp)', lineHeight: 1 }}>
          Lv.{level}
        </div>
      </div>
    </div>
  );
}
