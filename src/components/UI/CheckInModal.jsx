import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useIcon } from '../../lib/icons';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';

let lastCheckInSoundAt = 0;

function playCheckInSoundOnce() {
  const now = Date.now();
  if (now - lastCheckInSoundAt < 900) return;
  lastCheckInSoundAt = now;
  playSoundEffect(SOUND_EFFECT_TYPES.LEVEL_COMPLETE);
}

/**
 * CheckInModal — 每日签到成功弹窗
 * Props:
 *   coins: number  — 本次奖励的金币数
 *   onDismiss: () => void
 */
export default function CheckInModal({ coins, onDismiss }) {
  const coinImg = useIcon('item/coin.png');
  const sdCheckInImg = useIcon('sd/sd_check_in.png');
  const overlayRef  = useRef(null);
  const cardRef     = useRef(null);
  const coinIconRef = useRef(null);
  const amountRef   = useRef(null);
  const particleRef = useRef(null);
  const btnRef      = useRef(null);

  useEffect(() => {
    playCheckInSoundOnce();

    const overlay  = overlayRef.current;
    const card     = cardRef.current;
    const coinIcon = coinIconRef.current;
    const amount   = amountRef.current;
    const particle = particleRef.current;
    const btn      = btnRef.current;

    // ── Initial state ─────────────────────────────────────────────────
    gsap.set(overlay,  { opacity: 0 });
    gsap.set(card,     { y: 60, opacity: 0, scale: 0.88 });
    gsap.set(coinIcon, { scale: 0, rotate: -20 });
    gsap.set(amount,   { opacity: 0, y: 16 });
    gsap.set(btn,      { opacity: 0, y: 12 });

    // ── Coin particle burst ───────────────────────────────────────────
    const COIN_COUNT = 18;
    for (let i = 0; i < COIN_COUNT; i++) {
      const el = document.createElement('span');
      el.textContent = '🪙';
      el.style.cssText = `
        position: absolute;
        left: calc(50% - 12px);
        top: 60px;
        font-size: ${13 + Math.random() * 10}px;
        pointer-events: none;
        z-index: 1;
      `;
      particle.appendChild(el);
      const angle = (i / COIN_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist  = 70 + Math.random() * 80;
      gsap.fromTo(el,
        { x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 },
        {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 20,
          scale: 1,
          rotate: (Math.random() - 0.5) * 180,
          opacity: 0,
          duration: 1.0 + Math.random() * 0.6,
          delay: 0.3 + i * 0.03,
          ease: 'power2.out',
          onComplete: () => el.remove(),
        }
      );
    }

    // ── Animated coin counter ─────────────────────────────────────────
    const counter = { val: 0 };

    // ── Main timeline ─────────────────────────────────────────────────
    const tl = gsap.timeline();

    tl.to(overlay, { opacity: 1, duration: 0.22 });
    tl.to(card, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, '-=0.1');
    tl.to(coinIcon, { scale: 1, rotate: 0, duration: 0.4, ease: 'back.out(3.5)' }, '-=0.2');
    tl.to(coinIcon, { scale: 1.12, duration: 0.15, ease: 'sine.inOut', yoyo: true, repeat: 1 }, '-=0.05');

    // 数字滚动
    tl.to(amount, { opacity: 1, y: 0, duration: 0.3, ease: 'back.out(2)' }, '-=0.1');
    tl.to(counter, {
      val: coins,
      duration: 0.9,
      ease: 'power2.out',
      onUpdate() {
        if (amount) amount.textContent = `+${Math.round(counter.val)}`;
      },
    }, '-=0.2');

    tl.to(btn, { opacity: 1, y: 0, duration: 0.3, ease: 'back.out(2)' }, '-=0.3');

    return () => {
      tl.kill();
      particle.replaceChildren();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    const tl = gsap.timeline({ onComplete: onDismiss });
    tl.to(cardRef.current,    { y: 40, opacity: 0, scale: 0.92, duration: 0.3, ease: 'power2.in' });
    tl.to(overlayRef.current, { opacity: 0, duration: 0.2 }, '-=0.1');
  };

  // 今日日期
  const today = new Date();
  const dateStr = `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日`;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 120,
        background: 'rgba(10, 8, 30, 0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Particle container */}
      <div
        ref={particleRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      />

      {/* Card */}
      <div
        ref={cardRef}
        style={{
          background: 'white',
          borderRadius: 28,
          padding: '36px 28px 28px',
          width: 300,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Date chip */}
        <div style={{
          position: 'absolute', top: -14,
          background: 'linear-gradient(135deg, var(--tp), var(--tp-from))',
          borderRadius: 20, padding: '5px 18px',
          fontSize: 12, fontWeight: 700, color: 'white',
          boxShadow: '0 4px 12px rgba(91,79,233,0.4)',
        }}>
          {dateStr}
        </div>

        {/* Check-in illustration */}
        <div
          ref={coinIconRef}
          style={{
            width: 160, height: 160,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 4, marginBottom: 0,
          }}
        >
          <img
            src={sdCheckInImg}
            alt="每日签到"
            width={160}
            height={160}
            className="sd-hop"
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Title */}
        <p style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B', marginBottom: 4 }}>
          签到成功！
        </p>
        <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 500, marginBottom: 16 }}>
          今日奖励已发放
        </p>

        {/* Coin amount */}
        <div style={{
          background: '#FFFBEB',
          border: '1.5px solid #FDE68A',
          borderRadius: 16,
          padding: '12px 32px',
          marginBottom: 24,
          textAlign: 'center',
        }}>
          <div
            ref={amountRef}
            style={{
              fontSize: 38, fontWeight: 900,
              color: '#D97706',
              letterSpacing: '-1px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            +0
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#B45309', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <img src={coinImg} alt="金币" width={14} height={14} style={{ objectFit: 'contain' }} /> 金币
          </div>
        </div>

        {/* Dismiss button */}
        <button
          ref={btnRef}
          onClick={handleDismiss}
          style={{
            width: '100%', padding: '13px 0',
            borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, var(--tp-from), var(--tp))',
            color: 'white', fontSize: 15, fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(91,79,233,0.35)',
          }}
        >
          太棒了 🎉
        </button>
      </div>
    </div>
  );
}
