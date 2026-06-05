import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { useIcon } from '../../lib/icons';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';

export default function RewardModal({
  reward,
  title = '获得奖励！',
  subtitle = '奖励已放入背包',
  sourceLabel = '奖励',
  onDismiss,
}) {
  const rewardIcon = useIcon(reward?.iconPath);
  const overlayRef = useRef(null);
  const cardRef = useRef(null);
  const iconRef = useRef(null);
  const amountRef = useRef(null);
  const particleRef = useRef(null);
  const btnRef = useRef(null);

  const amount = Math.max(0, Number(reward?.amount) || 0);
  const rewardLabel = reward?.label ?? (reward?.type === 'coins' ? '金币' : '道具');
  const amountText = reward?.type === 'coins' ? `+${amount}` : `x${amount}`;
  const isCoins = reward?.type === 'coins';

  useEffect(() => {
    playSoundEffect(SOUND_EFFECT_TYPES.LEVEL_COMPLETE);

    const overlay = overlayRef.current;
    const card = cardRef.current;
    const icon = iconRef.current;
    const amountEl = amountRef.current;
    const particle = particleRef.current;
    const btn = btnRef.current;

    gsap.set(overlay, { opacity: 0 });
    gsap.set(card, { y: 58, opacity: 0, scale: 0.88 });
    gsap.set(icon, { scale: 0, rotate: -16 });
    gsap.set(amountEl, { opacity: 0, y: 14 });
    gsap.set(btn, { opacity: 0, y: 12 });

    const particleCount = 18;
    for (let i = 0; i < particleCount; i += 1) {
      const el = document.createElement('img');
      el.src = rewardIcon;
      el.alt = '';
      el.style.cssText = `
        position: absolute;
        left: calc(50% - 10px);
        top: 92px;
        width: ${12 + Math.random() * 9}px;
        height: ${12 + Math.random() * 9}px;
        object-fit: contain;
        pointer-events: none;
        z-index: 1;
      `;
      particle.appendChild(el);

      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 70 + Math.random() * 76;
      gsap.fromTo(
        el,
        { x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 },
        {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 24,
          scale: 1,
          rotate: (Math.random() - 0.5) * 220,
          opacity: 0,
          duration: 1.05 + Math.random() * 0.45,
          delay: 0.26 + i * 0.025,
          ease: 'power2.out',
          onComplete: () => el.remove(),
        }
      );
    }

    const counter = { val: 0 };
    const tl = gsap.timeline();
    tl.to(overlay, { opacity: 1, duration: 0.2 });
    tl.to(card, { y: 0, opacity: 1, scale: 1, duration: 0.42, ease: 'back.out(2)' }, '-=0.08');
    tl.to(icon, { scale: 1, rotate: 0, duration: 0.36, ease: 'back.out(3)' }, '-=0.18');
    tl.to(icon, { scale: 1.08, duration: 0.14, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '-=0.03');
    tl.to(amountEl, { opacity: 1, y: 0, duration: 0.24, ease: 'back.out(2)' }, '-=0.06');
    tl.to(counter, {
      val: amount,
      duration: isCoins ? 0.8 : 0.35,
      ease: 'power2.out',
      onUpdate() {
        if (!amountEl) return;
        const value = Math.max(1, Math.round(counter.val));
        amountEl.textContent = isCoins ? `+${value}` : `x${value}`;
      },
    }, '-=0.12');
    tl.to(btn, { opacity: 1, y: 0, duration: 0.28, ease: 'back.out(1.8)' }, '-=0.22');

    return () => {
      tl.kill();
      particle.replaceChildren();
    };
  }, [amount, isCoins, rewardIcon]);

  const handleDismiss = () => {
    const tl = gsap.timeline({ onComplete: onDismiss });
    tl.to(cardRef.current, { y: 36, opacity: 0, scale: 0.94, duration: 0.26, ease: 'power2.in' });
    tl.to(overlayRef.current, { opacity: 0, duration: 0.18 }, '-=0.1');
  };

  const modal = (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 140,
        background: 'rgba(17, 24, 39, 0.58)',
        backdropFilter: 'blur(7px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        ref={particleRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      />

      <div
        ref={cardRef}
        style={{
          width: 304,
          borderRadius: 30,
          background: 'white',
          boxShadow: '0 22px 60px rgba(17,24,39,0.28)',
          position: 'relative',
          zIndex: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: isCoins
              ? 'linear-gradient(180deg, #FFF7ED 0%, #FFFBEB 100%)'
              : 'linear-gradient(180deg, #FFF1F2 0%, #F5F3FF 100%)',
            padding: '22px 24px 18px',
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
              border: '1px solid rgba(255,255,255,0.9)',
              color: '#9CA3AF',
              fontSize: 11,
              fontWeight: 900,
              marginBottom: 12,
            }}
          >
            {sourceLabel}
          </div>

          <div
            ref={iconRef}
            style={{
              width: 116,
              height: 116,
              borderRadius: 32,
              background: 'rgba(255,255,255,0.72)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px',
              filter: isCoins
                ? 'drop-shadow(0 10px 16px rgba(217,119,6,0.18))'
                : 'drop-shadow(0 10px 16px rgba(219,39,119,0.16))',
            }}
          >
            <img src={rewardIcon} alt={rewardLabel} width={78} height={78} style={{ objectFit: 'contain' }} />
          </div>

          <div style={{ fontSize: 21, fontWeight: 900, color: '#1E1B4B', lineHeight: 1.15 }}>
            {title}
          </div>
          <div style={{ marginTop: 5, color: '#9CA3AF', fontSize: 12, fontWeight: 700 }}>
            {subtitle}
          </div>
        </div>

        <div style={{ padding: '18px 24px 24px', textAlign: 'center' }}>
          <div
            style={{
              borderRadius: 18,
              background: isCoins ? '#FFFBEB' : '#F9FAFB',
              border: `1.5px solid ${isCoins ? '#FDE68A' : '#E5E7EB'}`,
              padding: '13px 18px',
              marginBottom: 18,
            }}
          >
            <div
              ref={amountRef}
              style={{
                fontSize: 38,
                fontWeight: 900,
                lineHeight: 1,
                color: isCoins ? '#D97706' : 'var(--tp)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {amountText}
            </div>
            <div
              style={{
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 800,
                color: isCoins ? '#B45309' : '#6B7280',
              }}
            >
              <img src={rewardIcon} alt="" width={15} height={15} style={{ objectFit: 'contain' }} />
              {rewardLabel}
            </div>
          </div>

          <button
            ref={btnRef}
            type="button"
            onClick={handleDismiss}
            className="btn-press"
            style={{
              width: '100%',
              height: 48,
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
            收下奖励
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
