import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import coinImg from '../../assets/icons/item/coin.png';

/**
 * CoinBurst — individual coin icons burst out in a parabolic arc.
 * Must be placed inside a `position: relative` container (with overflow: visible).
 * Trigger by passing a new `trigger` prop: { amount, uid }.
 */
export default function CoinBurst({ trigger, targetRef, onCollect }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!trigger || !containerRef.current) return;
    const container = containerRef.current;
    const amount = Number(trigger.amount) || 0;
    const count = Math.min(Math.max(amount, 0), 8);
    if (count <= 0) return;

    const coinSize = 28;
    const containerRect = container.getBoundingClientRect();
    const targetRect = targetRef?.current?.getBoundingClientRect();
    const startLeft = containerRect.width / 2 - coinSize / 2;
    const startTop = containerRect.height * 0.44;
    const targetOffset = targetRect
      ? {
          x: targetRect.left + targetRect.width / 2 - containerRect.left - coinSize / 2 - startLeft,
          y: targetRect.top + targetRect.height / 2 - containerRect.top - coinSize / 2 - startTop,
        }
      : null;
    let completed = 0;
    const finishCoin = () => {
      completed += 1;
      if (completed === count) onCollect?.(amount);
    };

    for (let i = 0; i < count; i++) {
      const img = document.createElement('img');
      img.src = coinImg;
      img.style.cssText = `
        position: absolute;
        left: ${startLeft}px;
        top: ${startTop}px;
        width: ${coinSize}px; height: ${coinSize}px;
        object-fit: contain;
        pointer-events: none;
        will-change: transform, opacity;
        filter: drop-shadow(0 2px 6px rgba(234,179,8,0.55));
      `;
      container.appendChild(img);

      // Fan coins across a ~170° upper arc
      let angle;
      if (count === 1) {
        angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;
      } else {
        const spreadRad = Math.PI * 0.94; // ~170°
        const startAngle = -Math.PI / 2 - spreadRad / 2;
        angle = startAngle + (i / (count - 1)) * spreadRad + (Math.random() - 0.5) * 0.18;
      }

      const launchDist = 52 + Math.random() * 32;
      const peakX = Math.cos(angle) * launchDist;
      const peakY = Math.sin(angle) * launchDist; // negative = upward
      const rot = (Math.random() - 0.5) * 40;

      const tl = gsap.timeline({ delay: i * 0.05 });

      // Phase 1: pop in and ascend to peak
      tl.fromTo(img,
        { x: 0, y: 0, scale: 0, rotation: 0, opacity: 1 },
        {
          x: peakX * 0.55, y: peakY,
          scale: 1.2, rotation: rot * 0.5,
          duration: 0.26,
          ease: 'back.out(2.0)',
        }
      )
      // Phase 2: fly toward the top-right coin counter, then fade out there.
      .to(img, {
        x: targetOffset ? targetOffset.x + (Math.random() - 0.5) * 10 : peakX,
        y: targetOffset ? targetOffset.y + (Math.random() - 0.5) * 8 : peakY + 60,
        scale: targetOffset ? 0.45 : 0.7,
        rotation: rot,
        opacity: 0,
        duration: targetOffset ? 0.52 : 0.40,
        ease: targetOffset ? 'power2.inOut' : 'power2.in',
        onComplete: () => {
          img.remove();
          finishCoin();
        },
      });
    }
  }, [trigger, targetRef, onCollect]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 30,
        overflow: 'visible',
      }}
    />
  );
}

