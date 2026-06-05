import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useGameStore from '../../store/gameStore';
import HeartDisplay from '../UI/HeartDisplay';
import { useIcon } from '../../lib/icons';

gsap.registerPlugin(useGSAP);

export default function LessonFailed() {
  const navigate = useNavigate();
  const { lesson, exitLesson } = useGameStore();
  const lvUpImg = useIcon('ui/level_up.png');
  const coinImg = useIcon('item/coin.png');
  const sdFailedImg = useIcon('sd/sd_failed.png');

  const { finalXp = 0, finalCoins = 0, correctCount = 0, questions = [] } = lesson ?? {};
  const total = questions.length;
  const coinsProxy = useRef({ value: 0 });

  const containerRef = useRef(null);
  const iconRef      = useRef(null);
  const titleRef     = useRef(null);
  const statsRef     = useRef(null);
  const xpRef        = useRef(null);
  const coinRef      = useRef(null);
  const btnRef       = useRef(null);
  const [displayCoins, setDisplayCoins] = useState(0);

  // FOUC prevention
  useGSAP(() => {
    gsap.set(
      [iconRef.current, titleRef.current, statsRef.current, xpRef.current, coinRef.current, btnRef.current],
      { opacity: 0 }
    );
  });

  // Entrance sequence
  useGSAP(() => {
    const tl = gsap.timeline();

    tl.fromTo(
      iconRef.current,
      { scale: 0, rotate: -20, opacity: 0 },
      { scale: 1, rotate: 0, opacity: 1, duration: 0.5, ease: 'back.out(2)' }
    );
    tl.fromTo(
      titleRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.35, ease: 'back.out(1.7)' },
      '-=0.1'
    );
    tl.fromTo(
      statsRef.current,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' },
      '-=0.05'
    );
    tl.fromTo(
      xpRef.current,
      { scale: 0.7, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' },
      '+=0.05'
    );
    tl.fromTo(
      coinRef.current,
      { scale: 0.7, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' },
      '-=0.05'
    );
    tl.fromTo(
      btnRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.28, ease: 'back.out(1.7)' },
      '+=0.08'
    );
  }, []);

  // Rolling coin counter
  useGSAP(() => {
    if (finalCoins <= 0) return;
    coinsProxy.current.value = 0;
    gsap.to(coinsProxy.current, {
      value: finalCoins,
      duration: Math.min(1.4, 0.4 + finalCoins * 0.06),
      ease: 'power2.out',
      delay: 1.0,
      onUpdate: () => setDisplayCoins(Math.round(coinsProxy.current.value)),
    });
  }, [finalCoins]);

  const handleRetry = () => {
    exitLesson();
    navigate(lesson?.returnPath ?? '/');
  };
  const returnLabel = lesson?.returnPath === '/vocab' ? '回到练习中心' : '回到首页';

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full items-center justify-center px-6"
      style={{ background: '#FFF1F2' }}
    >
      {/* Failure illustration */}
      <div ref={iconRef} className="mb-3">
        <img
          src={sdFailedImg}
          alt="闯关失败"
          width={148}
          height={148}
          className="sd-hop"
          style={{ objectFit: 'contain' }}
        />
      </div>

      {/* Title */}
      <div ref={titleRef} className="text-center mb-6">
        <h1 className="text-3xl font-extrabold jp text-[#991B1B] leading-tight mb-2">
          闯关失败
        </h1>
        <p className="text-[#EF4444] font-medium text-sm">
          生命值耗尽了！再接再厉吧～
        </p>
      </div>

      {/* Stats: correct count */}
      <div
        ref={statsRef}
        className="flex items-center gap-3 bg-white rounded-2xl px-6 py-3 mb-4"
        style={{ boxShadow: '0 2px 12px rgba(239,68,68,0.12)' }}
      >
        <span className="text-2xl">📝</span>
        <div className="text-center">
          <div className="text-xs text-[#9CA3AF] font-semibold mb-0.5">答对题目</div>
          <div className="font-extrabold text-[#1E1B4B]">
            <span className="text-2xl text-[var(--tp)]">{correctCount}</span>
            <span className="text-sm text-[#9CA3AF]"> / {total}</span>
          </div>
        </div>
      </div>

      {/* Partial XP badge */}
      <div
        ref={xpRef}
        className="flex items-center gap-2 bg-white rounded-2xl px-6 py-4 mb-2"
        style={{ boxShadow: '0 2px 12px rgba(239,68,68,0.12)' }}
      >
        <img src={lvUpImg} alt="XP" width={32} height={32} style={{ objectFit: 'contain' }} />
        <div>
          <div className="text-xs text-[#9CA3AF] font-semibold">获得经验</div>
          <div className="font-extrabold text-[#D97706] text-xl">
            {finalXp} <span className="text-sm font-bold">XP</span>
          </div>
        </div>
      </div>

      {/* Coins earned badge */}
      <div
        ref={coinRef}
        className="flex items-center gap-2 bg-white rounded-2xl px-6 py-4 mb-2"
        style={{ boxShadow: '0 2px 12px rgba(239,68,68,0.10)' }}
      >
        <img src={coinImg} alt="金币" width={28} height={28} style={{ objectFit: 'contain' }} />
        <div>
          <div className="text-xs text-[#9CA3AF] font-semibold">本关金币</div>
          <div className="font-extrabold text-[#D97706] text-xl">{displayCoins}</div>
        </div>
      </div>

      {/* Hearts status + next regen */}
      <div className="mb-8 mt-3">
        <HeartDisplay size="md" />
      </div>

      {/* CTA */}
      <div ref={btnRef} className="w-full flex flex-col gap-3">
        <button
          onClick={handleRetry}
          className="w-full py-4 rounded-2xl font-extrabold text-base text-white"
          style={{
            background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
            boxShadow: '0 4px 0 #991B1B',
          }}
        >
          {returnLabel}
        </button>
      </div>
    </div>
  );
}
