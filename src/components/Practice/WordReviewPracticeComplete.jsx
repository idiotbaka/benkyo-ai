import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useGameStore from '../../store/gameStore';
import useWordReviewPracticeStore from '../../store/wordReviewPracticeStore';
import LevelUpModal from '../Lesson/LevelUpModal';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';
import { useIcon } from '../../lib/icons';

gsap.registerPlugin(useGSAP);

export default function WordReviewPracticeComplete() {
  const navigate = useNavigate();
  const practice = useWordReviewPracticeStore(s => s.practice);
  const exit = useWordReviewPracticeStore(s => s.exit);
  const totalXp = useGameStore(s => s.totalXp);
  const lvUpImg = useIcon('ui/level_up.png');
  const coinImg = useIcon('item/coin.png');
  const heartImg = useIcon('ui/heart.png');
  const sdCompleteImg = useIcon('sd/sd_complete.png');
  const collectStarImg = useIcon('ui/collect_star.png');

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
    tl.fromTo(titleRef.current, { y: 18, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.34, ease: 'back.out(1.8)' });

    const earnedStars = starsRef.current.slice(0, finalStars).filter(Boolean);
    if (earnedStars.length) {
      tl.fromTo(earnedStars, { scale: 0, rotate: -18, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.32, stagger: 0.08, ease: 'back.out(2.4)' }, '+=0.05');
    }

    tl.fromTo(xpRef.current, { y: 14, scale: 0.95, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.28, ease: 'back.out(1.8)' }, '-=0.05');
    tl.fromTo(coinRef.current, { y: 14, scale: 0.95, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.28, ease: 'back.out(1.8)' }, '-=0.18');
    tl.fromTo(statsRef.current, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: 'back.out(1.7)' }, '-=0.02');
    tl.fromTo(btnRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: 'back.out(1.7)' }, '+=0.05');
  }, [finalStars]);

  useGSAP(() => {
    if (finalCoins <= 0) return;
    coinsProxy.current.value = 0;
    gsap.to(coinsProxy.current, {
      value: finalCoins,
      duration: Math.min(1.4, 0.4 + finalCoins * 0.08),
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
    <div className="page-enter flex h-full flex-col items-center justify-center overflow-y-auto scroll-y px-5 py-6" style={{ background: '#F5F3FF' }}>
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
              alt="单词复习完成"
              width={118}
              height={118}
              className="sd-hop"
              style={{ objectFit: 'contain' }}
            />
          </div>
          <h1 className="jp text-[28px] font-extrabold leading-tight text-[#1E1B4B]">
            覚えました！
          </h1>
          <p className="mt-2 text-sm font-bold text-[#9CA3AF]">单词复习完成</p>
        </div>

        <div className="mb-5 flex items-center justify-center gap-4 rounded-2xl bg-white px-4 py-3" style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              ref={el => { starsRef.current[i] = el; }}
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

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div ref={xpRef} className="rounded-2xl bg-white p-4 text-center" style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}>
            <div className="mb-1 flex items-center justify-center gap-2">
              <img src={lvUpImg} alt="XP" width={28} height={28} style={{ objectFit: 'contain' }} />
              <p className="text-[26px] font-extrabold leading-none text-[#F59E0B]">{finalXp}</p>
            </div>
            <p className="mt-1 text-xs font-medium text-[#9CA3AF]">获得经验</p>
          </div>

          <div ref={coinRef} className="rounded-2xl bg-white p-4 text-center" style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}>
            <div className="mb-1 flex items-center justify-center gap-2">
              <img src={coinImg} alt="金币" width={26} height={26} style={{ objectFit: 'contain' }} />
              <p className="text-[26px] font-extrabold leading-none text-[#D97706]">{displayCoins}</p>
            </div>
            <p className="mt-1 text-xs font-medium text-[#9CA3AF]">本关金币</p>
          </div>
        </div>

        <div ref={statsRef} className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 text-center" style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}>
            <p className="text-2xl font-extrabold text-[var(--tp)]">
              {correctCount}/{questions.length}
            </p>
            <p className="mt-1 text-xs font-medium text-[#9CA3AF]">答对题目</p>
          </div>
          <div className="rounded-2xl bg-white p-4 text-center" style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}>
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
          className="btn-press w-full rounded-2xl py-4 text-base font-extrabold text-white"
          style={{ background: 'linear-gradient(135deg, var(--tp-from), var(--tp))', boxShadow: '0 4px 0 var(--tp-deep)' }}
        >
          回到练习中心
        </button>
      </div>

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
