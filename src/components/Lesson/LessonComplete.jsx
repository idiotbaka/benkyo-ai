import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useGameStore from '../../store/gameStore';
import LevelUpModal from './LevelUpModal';
import heartImg from '../../assets/icons/ui/heart.png';
import lvUpImg from '../../assets/icons/ui/level_up.png';
import coinImg from '../../assets/icons/item/coin.png';
import sdCompleteImg from '../../assets/icons/sd/sd_complete.png';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';

export default function LessonComplete() {
  const navigate = useNavigate();
  const { lesson, exitLesson, totalXp } = useGameStore();
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [displayCoins, setDisplayCoins] = useState(0);
  const coinsProxy = useRef({ value: 0 });

  const containerRef = useRef(null);
  const star1Ref = useRef(null);
  const star2Ref = useRef(null);
  const star3Ref = useRef(null);
  const xpRef = useRef(null);
  const titleRef = useRef(null);
  const btnRef = useRef(null);
  const coinRef = useRef(null);

  const starRefs = [star1Ref, star2Ref, star3Ref];
  const { finalStars = 0, finalXp = 0, finalCoins = 0, leveledUp = false, oldLevel = 1, newLevel = 1 } = lesson ?? {};
  const bonusCoins = finalStars === 3 ? 10 : 0;

  // Prevent FOUC
  useGSAP(() => {
    gsap.set([titleRef.current, xpRef.current, coinRef.current, btnRef.current], { opacity: 0 });
    starRefs.forEach(r => gsap.set(r.current, { scale: 0, opacity: 0 }));
  });

  useGSAP(() => {
    const tl = gsap.timeline();

    tl.fromTo(
      titleRef.current,
      { y: -30, opacity: 0, scale: 0.85 },
      { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }
    );

    const earnedStars = starRefs.slice(0, finalStars).map(r => r.current);
    if (earnedStars.length) {
      tl.fromTo(
        earnedStars,
        { scale: 0, rotate: -25, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.35, stagger: 0.08, ease: 'back.out(2.5)' },
        '+=0.05'
      );
    }

    tl.fromTo(
      xpRef.current,
      { scale: 0.6, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' },
      '-=0.05'
    );

    tl.fromTo(
      coinRef.current,
      { scale: 0.6, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' },
      '-=0.05'
    );

    tl.fromTo(
      btnRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.28, ease: 'back.out(1.7)' },
      '+=0.05'
    );

  }, [finalStars]);

  // Rolling coin counter — starts ~1s after entrance
  useGSAP(() => {
    if (finalCoins <= 0) return;
    coinsProxy.current.value = 0;
    gsap.to(coinsProxy.current, {
      value: finalCoins,
      duration: Math.min(1.6, 0.4 + finalCoins * 0.06),
      ease: 'power2.out',
      delay: 1.0,
      onUpdate: () => setDisplayCoins(Math.round(coinsProxy.current.value)),
    });
  }, [finalCoins]);

  // Trigger level-up overlay after animation finishes (~2s)
  useEffect(() => {
    if (!leveledUp) return;
    const timer = setTimeout(() => setShowLevelUp(true), 2000);
    return () => clearTimeout(timer);
  }, [leveledUp]);

  useEffect(() => {
    const timer = setTimeout(() => {
      playSoundEffect(SOUND_EFFECT_TYPES.LEVEL_COMPLETE);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    exitLesson();
    navigate('/');
  };

  const getMessage = () => {
    if (finalStars === 3) return { text: '完璧です！', sub: '满分通关！' };
    if (finalStars === 2) return { text: 'よくできました！', sub: '不错！继续加油' };
    return { text: 'がんばりました！', sub: '完成了！再接再厉' };
  };

  const msg = getMessage();

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full items-center justify-center px-6 page-enter"
      style={{ background: '#F5F3FF' }}
    >
      {/* Completion illustration */}
      <div ref={titleRef} className="text-center mb-6">
        <img
          src={sdCompleteImg}
          alt="闯关完成"
          width={136}
          height={136}
          className="sd-hop"
          style={{ objectFit: 'contain', margin: '0 auto 4px' }}
        />
        <h1 className="text-3xl font-extrabold jp text-[#1E1B4B] leading-tight">
          {msg.text}
        </h1>
        <p className="text-[#6B7280] font-medium mt-2 text-base">{msg.sub}</p>
      </div>

      {/* Stars row */}
      <div className="flex gap-4 mb-8">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            ref={starRefs[i]}
            className="text-5xl"
            style={{
              filter: i < finalStars ? 'none' : 'grayscale(1)',
              opacity: i < finalStars ? 1 : 0.2,
            }}
          >
            ⭐
          </span>
        ))}
      </div>

      {/* XP badge */}
      <div
        ref={xpRef}
        className="flex items-center gap-2 bg-white rounded-2xl px-6 py-4 shadow-md mb-3"
      >
        <img src={lvUpImg} alt="XP" width={32} height={32} style={{ objectFit: 'contain' }} />
        <div>
          <p className="text-xs text-[#9CA3AF] font-semibold uppercase tracking-wider">获得经验</p>
          <p className="text-3xl font-extrabold text-[#F59E0B]">+{finalXp} XP</p>
        </div>
      </div>

      {/* Coin badge */}
      <div
        ref={coinRef}
        className="flex items-center gap-3 bg-white rounded-2xl px-6 py-4 shadow-md mb-8"
      >
        <img src={coinImg} alt="金币" width={28} height={28} style={{ objectFit: 'contain' }} />
        <div className="flex-1">
          <p className="text-xs text-[#9CA3AF] font-semibold uppercase tracking-wider">本关金币</p>
          <p className="text-3xl font-extrabold text-[#D97706]">+{displayCoins}</p>
        </div>
        {bonusCoins > 0 && (
          <div
            className="flex items-center gap-1 rounded-xl px-3 py-1"
            style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', border: '1.5px solid #FCD34D' }}
          >
            <span className="text-xs">🏆</span>
            <span className="text-xs font-extrabold text-[#92400E]">+10 完美奖励</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-8 w-full">
        <div className="flex-1 bg-white rounded-2xl p-4 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-[var(--tp)]">
            {lesson?.correctCount ?? 0}/{lesson?.questions?.length ?? 0}
          </p>
          <p className="text-xs text-[#9CA3AF] font-medium mt-1">答对题目</p>
        </div>
        <div className="flex-1 bg-white rounded-2xl p-4 text-center shadow-sm">
          <p className="text-2xl font-extrabold" style={{ color: finalStars >= 2 ? '#22C55E' : '#EF4444' }}>
            <span className="inline-flex items-center gap-1">{lesson?.hearts ?? 0} <img src={heartImg} alt="heart" width={22} height={22} style={{ objectFit: 'contain', verticalAlign: 'middle' }} /></span>
          </p>
          <p className="text-xs text-[#9CA3AF] font-medium mt-1">剩余爱心</p>
        </div>
      </div>

      {/* Continue button — only shown when no level-up overlay */}
      <button
        ref={btnRef}
        onClick={handleContinue}
        className="w-full py-4 rounded-2xl font-bold text-white text-lg"
        style={{ background: 'var(--tp)', boxShadow: '0 5px 0 var(--tp-deep)' }}
        onMouseDown={e => gsap.to(e.currentTarget, { translateY: 4, boxShadow: '0 1px 0 var(--tp-deep)', duration: 0.08 })}
        onMouseUp={e => gsap.to(e.currentTarget, { translateY: 0, boxShadow: '0 5px 0 var(--tp-deep)', duration: 0.15, ease: 'back.out(2)' })}
      >
        继续学习 →
      </button>

      {/* Level-up overlay — appears on top when leveled up */}
      {showLevelUp && (
        <LevelUpModal
          oldLevel={oldLevel}
          newLevel={newLevel}
          totalXp={totalXp}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}
