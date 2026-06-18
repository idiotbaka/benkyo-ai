import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useGameStore from '../../store/gameStore';
import useKanaPracticeStore from '../../store/kanaPracticeStore';
import useUserStore from '../../store/userStore';
import { toKatakanaText } from '../../data/gojuonKana';
import { drawWordReviewGiftboxReward } from '../../lib/giftbox-rewards';
import { LUCKY_CAT_PERFECT_CLEAR_BONUS_COINS, PERFECT_CLEAR_BONUS_COINS } from '../../lib/equipment-effects';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';
import { useIcon } from '../../lib/icons';
import LevelUpModal from '../Lesson/LevelUpModal';
import RewardModal from '../UI/RewardModal';

gsap.registerPlugin(useGSAP);

function formatKana(script, kana) {
  return script === 'katakana' ? toKatakanaText(kana) : kana;
}

function KanaChangePill({ change, script }) {
  const positive = change.delta > 0;
  const negative = change.delta < 0;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold"
      style={{
        background: positive ? '#ECFDF5' : negative ? '#FFF1F2' : '#F8FAFC',
        color: positive ? '#15803D' : negative ? '#BE123C' : '#64748B',
        border: `1px solid ${positive ? '#BBF7D0' : negative ? '#FECDD3' : '#E5E7EB'}`,
      }}
    >
      <span className="jp text-base leading-none">{formatKana(script, change.kana)}</span>
      <span>{change.delta > 0 ? `+${change.delta}%` : `${change.delta}%`}</span>
    </span>
  );
}

function KanaSummaryGroup({ title, items, script, itemKeyPrefix }) {
  if (!items?.length) return null;

  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-2 text-xs font-extrabold text-[#9CA3AF]">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map(change => (
          <KanaChangePill key={`${itemKeyPrefix}-${change.kana}`} change={change} script={script} />
        ))}
      </div>
    </div>
  );
}

export default function KanaPracticeComplete() {
  const navigate = useNavigate();
  const practice = useKanaPracticeStore(s => s.practice);
  const exit = useKanaPracticeStore(s => s.exit);
  const totalXp = useGameStore(s => s.totalXp);
  const grantReward = useUserStore(s => s.grantReward);
  const lvUpImg = useIcon('ui/level_up.png');
  const coinImg = useIcon('item/coin.png');
  const sdCompleteImg = useIcon('sd/sd_complete.png');
  const collectStarImg = useIcon('ui/collect_star.png');

  const [showLevelUp, setShowLevelUp] = useState(false);
  const [giftboxReward, setGiftboxReward] = useState(null);
  const [displayCoins, setDisplayCoins] = useState(0);
  const coinsProxy = useRef({ value: 0 });
  const giftboxHandledRef = useRef(false);
  const titleRef = useRef(null);
  const starsRef = useRef([]);
  const xpRef = useRef(null);
  const coinRef = useRef(null);
  const statsRef = useRef(null);
  const summaryRef = useRef(null);
  const btnRef = useRef(null);

  const {
    session = null,
    finalStars = 0,
    finalXp = 0,
    finalCoins = 0,
    correctCount = 0,
    questions = [],
    coinsEarned = 0,
    leveledUp = false,
    oldLevel = 1,
    newLevel = 1,
    masteryChanges = [],
  } = practice ?? {};
  const script = session?.script ?? 'hiragana';
  const title = script === 'katakana' ? '片假名学习完成' : '平假名学习完成';
  const bonusCoins = finalStars === 3 ? Math.max(0, finalCoins - coinsEarned) : 0;
  const bonusLabel = bonusCoins >= LUCKY_CAT_PERFECT_CLEAR_BONUS_COINS ? '招财猫奖励' : '完美奖励';

  const summary = useMemo(() => {
    const newKanaSet = new Set(session?.newKana ?? []);
    const newKana = masteryChanges.filter(change => newKanaSet.has(change.kana));
    const progressUp = [...masteryChanges]
      .filter(change => change.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 6);
    const needsReview = [...masteryChanges]
      .filter(change => change.delta < 0 || change.wrong > 0)
      .sort((a, b) => a.delta - b.delta || b.wrong - a.wrong)
      .slice(0, 6);

    return { newKana, progressUp, needsReview };
  }, [masteryChanges, session?.newKana]);
  const hasSummary = summary.newKana.length > 0 || summary.progressUp.length > 0 || summary.needsReview.length > 0;

  useGSAP(() => {
    gsap.set([titleRef.current, xpRef.current, coinRef.current, statsRef.current, summaryRef.current, btnRef.current].filter(Boolean), { opacity: 0 });
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
    if (summaryRef.current) {
      tl.fromTo(summaryRef.current, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: 'back.out(1.7)' }, '-=0.02');
    }
    tl.fromTo(btnRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: 'back.out(1.7)' }, '+=0.05');
  }, [finalStars, hasSummary]);

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
    if (!leveledUp) return undefined;
    const timer = setTimeout(() => setShowLevelUp(true), 2000);
    return () => clearTimeout(timer);
  }, [leveledUp]);

  const finishNavigation = () => {
    exit();
    navigate(`/vocab/japanese-intro?tab=${script}`);
  };

  const handleContinue = () => {
    if (!giftboxHandledRef.current) {
      giftboxHandledRef.current = true;
      const reward = drawWordReviewGiftboxReward();
      if (reward) {
        grantReward(reward);
        setGiftboxReward(reward);
        return;
      }
    }

    finishNavigation();
  };

  return (
    <div className="page-enter flex h-full flex-col items-center overflow-y-auto scroll-y px-5 py-6" style={{ background: '#F5F3FF' }}>
      <div style={{ width: '100%', maxWidth: 410 }}>
        <div ref={titleRef} className="mb-5 text-center">
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 34,
              background: 'linear-gradient(180deg, #FFFFFF 0%, #EEF2FF 100%)',
              boxShadow: '0 8px 26px rgba(91,79,233,0.13)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px',
            }}
          >
            <img
              src={sdCompleteImg}
              alt={title}
              width={118}
              height={118}
              className="sd-hop"
              style={{ objectFit: 'contain' }}
            />
          </div>
          <h1 className="jp text-[28px] font-extrabold leading-tight text-[#1E1B4B]">
            よくできました！
          </h1>
          <p className="mt-2 text-sm font-bold text-[#9CA3AF]">{title}</p>
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
            {bonusCoins > 0 && (
              <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-extrabold text-[#B45309]">
                <img src={collectStarImg} alt="" width={13} height={13} style={{ objectFit: 'contain' }} />
                +{bonusCoins || PERFECT_CLEAR_BONUS_COINS} {bonusLabel}
              </p>
            )}
            <p className="mt-1 text-xs font-medium text-[#9CA3AF]">本课金币</p>
          </div>
        </div>

        <div ref={statsRef} className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 text-center" style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}>
            <p className="text-2xl font-extrabold text-[var(--tp)]">
              {correctCount}/{questions.length}
            </p>
            <p className="mt-1 text-xs font-medium text-[#9CA3AF]">答对题目</p>
          </div>
          <div className="rounded-2xl bg-white p-4 text-center" style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}>
            <p className="text-2xl font-extrabold text-[#22C55E]">
              {Math.round((correctCount / Math.max(1, questions.length)) * 100)}%
            </p>
            <p className="mt-1 text-xs font-medium text-[#9CA3AF]">正确率</p>
          </div>
        </div>

        {hasSummary && (
          <div ref={summaryRef} className="mb-6 rounded-2xl bg-white p-4" style={{ boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}>
            <KanaSummaryGroup title="新学假名" items={summary.newKana} script={script} itemKeyPrefix="new" />
            <KanaSummaryGroup title="进步最多" items={summary.progressUp} script={script} itemKeyPrefix="up" />
            <KanaSummaryGroup title="需要复习" items={summary.needsReview} script={script} itemKeyPrefix="review" />
          </div>
        )}

        <button
          ref={btnRef}
          type="button"
          onClick={handleContinue}
          className="btn-press w-full rounded-2xl py-4 text-base font-extrabold text-white"
          style={{ background: 'linear-gradient(135deg, var(--tp-from), var(--tp))', boxShadow: '0 4px 0 var(--tp-deep)' }}
        >
          回到假名表
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
      {giftboxReward && (
        <RewardModal
          reward={giftboxReward}
          title="获得礼物！"
          subtitle="奖励已放入背包"
          sourceLabel="假名学习奖励"
          onDismiss={() => {
            setGiftboxReward(null);
            finishNavigation();
          }}
        />
      )}
    </div>
  );
}
