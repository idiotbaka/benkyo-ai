import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useGameStore from '../../store/gameStore';
import LevelUpModal from './LevelUpModal';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';
import { useIcon } from '../../lib/icons';

export default function LessonComplete() {
  const navigate = useNavigate();
  const { lesson, exitLesson, totalXp } = useGameStore();
  const heartImg = useIcon('ui/heart.png');
  const lvUpImg = useIcon('ui/level_up.png');
  const coinImg = useIcon('item/coin.png');
  const sdCompleteImg = useIcon('sd/sd_complete.png');
  const collectStarImg = useIcon('ui/collect_star.png');
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
  const statsRef = useRef(null);

  const starRefs = [star1Ref, star2Ref, star3Ref];
  const { finalStars = 0, finalXp = 0, finalCoins = 0, leveledUp = false, oldLevel = 1, newLevel = 1 } = lesson ?? {};
  const bonusCoins = finalStars === 3 ? 10 : 0;

  // Prevent FOUC
  useGSAP(() => {
    gsap.set([titleRef.current, xpRef.current, coinRef.current, statsRef.current, btnRef.current], { opacity: 0 });
    starRefs.forEach(r => gsap.set(r.current, { scale: 0, opacity: 0 }));
  });

  useGSAP(() => {
    const tl = gsap.timeline();

    tl.fromTo(
      titleRef.current,
      { y: 18, opacity: 0, scale: 0.96 },
      { y: 0, opacity: 1, scale: 1, duration: 0.34, ease: 'back.out(1.8)' }
    );

    const earnedStars = starRefs.slice(0, finalStars).map(r => r.current);
    if (earnedStars.length) {
      tl.fromTo(
        earnedStars,
        { scale: 0, rotate: -18, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.32, stagger: 0.08, ease: 'back.out(2.4)' },
        '+=0.05'
      );
    }

    tl.fromTo(
      xpRef.current,
      { y: 14, scale: 0.95, opacity: 0 },
      { y: 0, scale: 1, opacity: 1, duration: 0.28, ease: 'back.out(1.8)' },
      '-=0.05'
    );

    tl.fromTo(
      coinRef.current,
      { y: 14, scale: 0.95, opacity: 0 },
      { y: 0, scale: 1, opacity: 1, duration: 0.28, ease: 'back.out(1.8)' },
      '-=0.18'
    );

    tl.fromTo(
      statsRef.current,
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.26, ease: 'back.out(1.7)' },
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
    navigate(lesson?.returnPath ?? '/');
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
      className="page-enter flex h-full flex-col items-center justify-center overflow-y-auto scroll-y px-5 py-6"
      style={{ background: '#F5F3FF' }}
    >
      {/* Completion illustration */}
      <div style={{ width: '100%', maxWidth: 390 }}>
        <div ref={titleRef} className="mb-5 text-center">
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 34,
              background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF7ED 100%)',
              boxShadow: '0 8px 26px rgba(251,146,60,0.13)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px',
            }}
          >
            <img
              src={sdCompleteImg}
              alt="闯关完成"
              width={118}
              height={118}
              className="sd-hop"
              style={{ objectFit: 'contain' }}
            />
          </div>
          <h1 className="jp text-[28px] font-extrabold leading-tight text-[#1E1B4B]">
            {msg.text}
          </h1>
          <p className="mt-2 text-sm font-bold text-[#9CA3AF]">{msg.sub}</p>
        </div>

        {/* Stars row */}
        <div
          className="mb-5 flex items-center justify-center gap-4 rounded-2xl bg-white px-4 py-3"
          style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}
        >
          {[0, 1, 2].map(i => (
            <span
              key={i}
              ref={starRefs[i]}
              style={{
                width: 54,
                height: 54,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: i < finalStars ? 'none' : 'grayscale(1)',
                opacity: i < finalStars ? 1 : 0.22,
              }}
            >
              <img src={collectStarImg} alt="星星" width={54} height={54} style={{ objectFit: 'contain' }} />
            </span>
          ))}
        </div>

        {/* Rewards */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div
            ref={xpRef}
            className="rounded-2xl bg-white p-4 text-center"
            style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}
          >
            <div className="mb-1 flex items-center justify-center gap-2">
              <img src={lvUpImg} alt="XP" width={28} height={28} style={{ objectFit: 'contain' }} />
              <p className="text-[26px] font-extrabold leading-none text-[#F59E0B]">{finalXp}</p>
            </div>
            <p className="mt-1 text-xs font-medium text-[#9CA3AF]">获得经验</p>
          </div>

          <div
            ref={coinRef}
            className="rounded-2xl bg-white p-4 text-center"
            style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}
          >
            <div className="mb-1 flex items-center justify-center gap-2">
              <img src={coinImg} alt="金币" width={26} height={26} style={{ objectFit: 'contain' }} />
              <p className="text-[26px] font-extrabold leading-none text-[#D97706]">{displayCoins}</p>
            </div>
            {bonusCoins > 0 && (
              <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-extrabold text-[#B45309]">
                <img src={collectStarImg} alt="" width={13} height={13} style={{ objectFit: 'contain' }} />
                +10 完美奖励
              </p>
            )}
            <p className="mt-1 text-xs font-medium text-[#9CA3AF]">本关金币</p>
          </div>
        </div>

        {/* Stats */}
        <div ref={statsRef} className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 text-center" style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}>
            <p className="text-2xl font-extrabold text-[var(--tp)]">
              {lesson?.correctCount ?? 0}/{lesson?.questions?.length ?? 0}
            </p>
            <p className="mt-1 text-xs font-medium text-[#9CA3AF]">答对题目</p>
          </div>
          <div className="rounded-2xl bg-white p-4 text-center" style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}>
            <p className="text-2xl font-extrabold" style={{ color: finalStars >= 2 ? '#22C55E' : '#EF4444' }}>
              <span className="inline-flex items-center gap-1">{lesson?.hearts ?? 0} <img src={heartImg} alt="heart" width={22} height={22} style={{ objectFit: 'contain', verticalAlign: 'middle' }} /></span>
            </p>
            <p className="mt-1 text-xs font-medium text-[#9CA3AF]">剩余爱心</p>
          </div>
        </div>

        {/* Continue button — only shown when no level-up overlay */}
        <button
          ref={btnRef}
          onClick={handleContinue}
          className="btn-press w-full rounded-2xl py-4 text-base font-extrabold text-white"
          style={{ background: 'linear-gradient(135deg, var(--tp-from), var(--tp))', boxShadow: '0 4px 0 var(--tp-deep)' }}
        >
          继续学习
        </button>
      </div>

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
