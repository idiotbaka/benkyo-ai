import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useGameStore from '../../store/gameStore';
import useUserStore from '../../store/userStore';
import { useIcon } from '../../lib/icons';

gsap.registerPlugin(useGSAP);

const CAKE_PRICE = 80;

export default function ReviveSheet({ hasCake, cakeCount, canBuyCake, coins, session, onRevive, onExit, returnPath }) {
  const navigate = useNavigate();
  const lesson       = useGameStore(s => s.lesson);
  const reviveLesson = useGameStore(s => s.reviveLesson);
  const exitLesson   = useGameStore(s => s.exitLesson);
  const consumeCake  = useUserStore(s => s.useCake);
  const purchaseItem = useUserStore(s => s.purchaseItem);
  const cakeImg = useIcon('item/cake.png');
  const coinImg = useIcon('item/coin.png');
  const sdCakeImg = useIcon('sd/sd_cake.png');

  const iconRef  = useRef(null);
  const cardRef  = useRef(null);
  const btnRef   = useRef(null);
  const quitRef  = useRef(null);
  const activeSession = session ?? lesson;

  // FOUC prevention
  useGSAP(() => {
    gsap.set([iconRef.current, cardRef.current, btnRef.current, quitRef.current], { opacity: 0 });
  });

  // Entrance animation
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(
      iconRef.current,
      { scale: 0.5, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.2)' }
    );
    tl.fromTo(
      cardRef.current,
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.38, ease: 'back.out(1.6)' },
      '-=0.15'
    );
    tl.fromTo(
      btnRef.current,
      { scale: 0.8, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.32, ease: 'back.out(2)' },
      '-=0.1'
    );
    tl.fromTo(
      quitRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.22 },
      '-=0.1'
    );
  }, []);

  const handleRevive = () => {
    if (hasCake) {
      consumeCake();
    } else if (canBuyCake) {
      // Buy and immediately consume
      purchaseItem('cake', CAKE_PRICE);
      consumeCake();
    }
    if (onRevive) {
      onRevive();
    } else {
      reviveLesson();
    }
  };

  const handleQuit = () => {
    if (onExit) {
      onExit();
      return;
    }
    exitLesson();
    navigate(activeSession?.returnPath ?? '/');
  };
  const targetPath = returnPath ?? activeSession?.returnPath;
  const returnLabel = targetPath === '/vocab' ? '回到练习中心' : '回到首页';

  return (
    <div
      className="flex flex-col h-full items-center justify-center px-6"
      style={{ background: 'linear-gradient(160deg, #FFF7F0 0%, #FFF1F2 100%)' }}
    >
      {/* Cake illustration + heading */}
      <div ref={iconRef} className="mb-4 text-center">
        <img
          src={sdCakeImg}
          alt="吃蛋糕恢复心心"
          width={152}
          height={152}
          className="sd-hop"
          style={{ objectFit: 'contain', margin: '0 auto 2px' }}
        />
        <h2 className="text-2xl font-extrabold text-[#9D174D]">别灰心！</h2>
        <p className="text-sm text-[#EC4899] mt-1">
          {hasCake
            ? '背包里有蛋糕，用它恢复心心继续吧～'
            : `花费 ${CAKE_PRICE} 金币购买蛋糕，立即复活！`}
        </p>
      </div>

      {/* Cake detail card */}
      <div
        ref={cardRef}
        className="w-full rounded-2xl p-4 mb-6 flex items-center gap-4"
        style={{ background: 'white', boxShadow: '0 2px 16px rgba(219,39,119,0.12)' }}
      >
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: '#FCE7F3' }}
        >
          <img src={cakeImg} alt="蛋糕" width={48} height={48} style={{ objectFit: 'contain' }} />
        </div>
        <div className="flex-1">
          <div className="font-extrabold text-[#1E1B4B] text-base">蛋糕</div>
          <div className="text-sm text-[#6B7280]">恢复 3 颗心❤️，立即继续</div>
        </div>
        {/* Right badge: inventory count OR price */}
        <div className="flex-shrink-0 text-right">
          {hasCake ? (
            <div
              aria-label={`背包中有 ${cakeCount} 个蛋糕`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 9px',
                borderRadius: 999,
                background: 'linear-gradient(135deg, #ECFDF5 0%, #DCFCE7 100%)',
                border: '1px solid #BBF7D0',
                boxShadow: '0 2px 8px rgba(22,163,74,0.12)',
                color: '#166534',
                fontSize: 12,
                fontWeight: 900,
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.72)',
                  color: '#15803D',
                  fontSize: 11,
                  boxShadow: 'inset 0 0 0 1px rgba(187,247,208,0.8)',
                }}
              >
                背包
              </span>
              <span style={{ color: '#16A34A', fontSize: 13 }}>
                ×{cakeCount}
              </span>
            </div>
          ) : (
            <div className="font-extrabold text-[#DB2777] text-base" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <img src={coinImg} alt="金币" width={16} height={16} style={{ objectFit: 'contain' }} /> {CAKE_PRICE}
            </div>
          )}
        </div>
      </div>

      {/* Coins display when buying */}
      {!hasCake && canBuyCake && (
        <div
          className="w-full flex items-center justify-between mb-4 px-4 py-2 rounded-xl"
          style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
        >
          <span className="text-sm text-[#92400E]">当前金币</span>
          <span className="font-extrabold text-[#D97706]" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><img src={coinImg} alt="金币" width={16} height={16} style={{ objectFit: 'contain' }} /> {coins}</span>
        </div>
      )}

      {/* Revive CTA + quit */}
      <div ref={btnRef} className="w-full">
        <button
          onClick={handleRevive}
          className="w-full py-4 rounded-2xl font-extrabold text-white text-lg btn-press"
          style={{
            background: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
            boxShadow: '0 4px 0 #9D174D',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <img src={cakeImg} alt="蛋糕" width={24} height={24} style={{ objectFit: 'contain' }} /> 复活并继续！
        </button>
      </div>

      <div ref={quitRef} className="mt-4 text-center">
        <button
          onClick={handleQuit}
          className="text-sm text-[#9CA3AF] py-2 px-4 btn-press"
        >
          放弃，{returnLabel}
        </button>
      </div>
    </div>
  );
}
