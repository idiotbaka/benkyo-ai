import { useState, useEffect, useCallback } from 'react';
import useUserStore, { MAX_HEARTS } from '../../store/userStore';
import heartImg from '../../assets/icons/ui/heart.png';
import heartYellowImg from '../../assets/icons/ui/heart_yellow.png';

/**
 * HeartDisplay — shows ❤️ count + countdown timer for next regen.
 * size: 'sm' | 'md'  (default 'md')
 */
export default function HeartDisplay({ size = 'md' }) {
  const { hearts, nextHeartAt, syncHearts } = useUserStore();
  const [, tick] = useState(0);

  // Sync regen on mount and tick the countdown every second
  useEffect(() => {
    syncHearts();
    if (hearts >= MAX_HEARTS || !nextHeartAt) return;
    const id = setInterval(() => {
      syncHearts();
      tick(n => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [hearts, nextHeartAt, syncHearts]);

  const getCountdown = useCallback(() => {
    if (!nextHeartAt || hearts >= MAX_HEARTS) return null;
    const remaining = Math.max(0, nextHeartAt - Date.now());
    const min = Math.floor(remaining / 60000);
    const sec = Math.floor((remaining % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }, [nextHeartAt, hearts]);

  const countdown = getCountdown();
  const imgSize = size === 'sm' ? 20 : 24;
  const textSize  = size === 'sm' ? 'text-[10px]' : 'text-xs';

  // Extra slots appear when temporary hearts (from Cake) push count above MAX_HEARTS
  const totalSlots = Math.max(MAX_HEARTS, hearts);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: totalSlots }).map((_, i) => {
        const filled = i < hearts;
        const isTemp = i >= MAX_HEARTS; // beyond normal cap → yellow
        return (
          <img
            key={i}
            src={isTemp ? heartYellowImg : heartImg}
            alt="heart"
            width={imgSize}
            height={imgSize}
            style={{
              objectFit: 'contain',
              filter:  filled ? 'none' : 'grayscale(1)',
              opacity: filled ? 1 : 0.3,
              transition: 'all 0.3s',
            }}
          />
        );
      })}
      {countdown && (
        <span className={`${textSize} font-mono text-red-400 ml-1 tabular-nums`}>
          {countdown}
        </span>
      )}
    </div>
  );
}
