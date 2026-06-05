import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useGameStore from '../../store/gameStore';
import useListeningPracticeStore from '../../store/listeningPracticeStore';
import LevelUpModal from '../Lesson/LevelUpModal';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';
import { useIcon } from '../../lib/icons';

gsap.registerPlugin(useGSAP);

export default function ListeningPracticeComplete() {
  const navigate = useNavigate();
  const practice = useListeningPracticeStore(s => s.practice);
  const exit = useListeningPracticeStore(s => s.exit);
  const totalXp = useGameStore(s => s.totalXp);
  const lvUpImg = useIcon('ui/level_up.png');
  const coinImg = useIcon('item/coin.png');
  const heartImg = useIcon('ui/heart.png');
  const sdCompleteImg = useIcon('sd/sd_complete.png');

  const [showLevelUp, setShowLevelUp] = useState(false);
  const [displayCoins, setDisplayCoins] = useState(0);
  const coinsProxy = useRef({ value: 0 });
  const titleRef = useRef(null);
  const starsRef = useRef([]);
  const xpRef = useRef(null);
  const coinRef = useRef(null);
  const statsRef = useRef(null);
  const btnRef = useRef(null);

  const {
    finalStars = 0,
    finalXp = 0,
    finalCoins = 0,
    correctCount = 0,
    questions = [],
    hearts = 0,
    leveledUp = false,
    oldLevel = 1,
    newLevel = 1,
  } = practice ?? {};

  useGSAP(() => {
    gsap.set([titleRef.current, xpRef.current, coinRef.current, statsRef.current, btnRef.current], { opacity: 0 });
    starsRef.current.filter(Boolean).forEach(el => gsap.set(el, { scale: 0, opacity: 0 }));
  });

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(titleRef.current, { y: -30, opacity: 0, scale: 0.85 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' });

    const earnedStars = starsRef.current.slice(0, finalStars).filter(Boolean);
    if (earnedStars.length) {
      tl.fromTo(earnedStars, { scale: 0, rotate: -25, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.35, stagger: 0.08, ease: 'back.out(2.5)' }, '+=0.05');
    }

    tl.fromTo(xpRef.current, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' }, '-=0.05');
    tl.fromTo(coinRef.current, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' }, '-=0.05');
    tl.fromTo(statsRef.current, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: 'back.out(1.7)' }, '-=0.02');
    tl.fromTo(btnRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: 'back.out(1.7)' }, '+=0.05');
  }, [finalStars]);

  useGSAP(() => {
    if (finalCoins <= 0) return;
    coinsProxy.current.value = 0;
    gsap.to(coinsProxy.current, {
      value: finalCoins,
      duration: Math.min(1.6, 0.4 + finalCoins * 0.06),
      ease: 'power2.out',
      delay: 0.9,
      onUpdate: () => setDisplayCoins(Math.round(coinsProxy.current.value)),
    });
  }, [finalCoins]);

  useEffect(() => {
    const timer = setTimeout(() => {
      playSoundEffect(SOUND_EFFECT_TYPES.LEVEL_COMPLETE);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!leveledUp) return;
    const timer = setTimeout(() => setShowLevelUp(true), 2000);
    return () => clearTimeout(timer);
  }, [leveledUp]);

  const handleContinue = () => {
    exit();
    navigate('/vocab');
  };

  return (
    <div className="page-enter flex h-full flex-col items-center justify-center px-6" style={{ background: '#F5F3FF' }}>
      <div ref={titleRef} className="mb-6 text-center">
        <img
          src={sdCompleteImg}
          alt="听力练习完成"
          width={136}
          height={136}
          className="sd-hop"
          style={{ objectFit: 'contain', margin: '0 auto 4px' }}
        />
        <h1 className="jp text-3xl font-extrabold leading-tight text-[#1E1B4B]">
          聞き取れました！
        </h1>
        <p className="mt-2 text-base font-medium text-[#6B7280]">听力练习完成</p>
      </div>

      <div className="mb-8 flex gap-4">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            ref={el => { starsRef.current[i] = el; }}
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

      <div ref={xpRef} className="mb-3 flex items-center gap-2 rounded-2xl bg-white px-6 py-4 shadow-md">
        <img src={lvUpImg} alt="XP" width={32} height={32} style={{ objectFit: 'contain' }} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">获得经验</p>
          <p className="text-3xl font-extrabold text-[#F59E0B]">+{finalXp} XP</p>
        </div>
      </div>

      <div ref={coinRef} className="mb-8 flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-md">
        <img src={coinImg} alt="金币" width={28} height={28} style={{ objectFit: 'contain' }} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">本关金币</p>
          <p className="text-3xl font-extrabold text-[#D97706]">+{displayCoins}</p>
        </div>
      </div>

      <div ref={statsRef} className="mb-8 flex w-full gap-4">
        <div className="flex-1 rounded-2xl bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-extrabold text-[var(--tp)]">
            {correctCount}/{questions.length}
          </p>
          <p className="mt-1 text-xs font-medium text-[#9CA3AF]">答对题目</p>
        </div>
        <div className="flex-1 rounded-2xl bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-extrabold" style={{ color: finalStars >= 2 ? '#22C55E' : '#EF4444' }}>
            <span className="inline-flex items-center gap-1">
              {hearts}
              <img src={heartImg} alt="heart" width={22} height={22} style={{ objectFit: 'contain', verticalAlign: 'middle' }} />
            </span>
          </p>
          <p className="mt-1 text-xs font-medium text-[#9CA3AF]">剩余爱心</p>
        </div>
      </div>

      <button
        ref={btnRef}
        onClick={handleContinue}
        className="w-full rounded-2xl py-4 text-lg font-bold text-white"
        style={{ background: 'var(--tp)', boxShadow: '0 5px 0 var(--tp-deep)' }}
        onMouseDown={e => gsap.to(e.currentTarget, { translateY: 4, boxShadow: '0 1px 0 var(--tp-deep)', duration: 0.08 })}
        onMouseUp={e => gsap.to(e.currentTarget, { translateY: 0, boxShadow: '0 5px 0 var(--tp-deep)', duration: 0.15, ease: 'back.out(2)' })}
      >
        回到练习中心 →
      </button>

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
