import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useWordReviewPracticeStore from '../store/wordReviewPracticeStore';
import useUserStore from '../store/userStore';
import BattleArena from '../components/Lesson/BattleArena';
import FeedbackPanel from '../components/Lesson/FeedbackPanel';
import ReviveSheet from '../components/Lesson/ReviveSheet';
import { LessonFailedContent } from '../components/Lesson/LessonFailed';
import CoinBurst from '../components/UI/CoinBurst';
import WordReviewQuestion from '../components/Practice/WordReviewQuestion';
import WordReviewPracticeComplete from '../components/Practice/WordReviewPracticeComplete';
import { stopJapaneseSpeech } from '../lib/japanese-speech-player';
import { useIcon } from '../lib/icons';

gsap.registerPlugin(useGSAP);

const CAKE_PRICE = 80;

export default function WordReviewPracticePage() {
  const navigate = useNavigate();
  const practice = useWordReviewPracticeStore(s => s.practice);

  useEffect(() => {
    if (!practice) navigate('/vocab', { replace: true });
  }, [navigate, practice]);

  if (!practice) return null;

  return (
    <div className="flex h-full flex-col">
      <WordReviewPracticeScreen />
    </div>
  );
}

function WordReviewPracticeScreen() {
  const navigate = useNavigate();
  const practice = useWordReviewPracticeStore(s => s.practice);
  const submitAnswer = useWordReviewPracticeStore(s => s.submitAnswer);
  const nextQuestion = useWordReviewPracticeStore(s => s.nextQuestion);
  const revive = useWordReviewPracticeStore(s => s.revive);
  const exit = useWordReviewPracticeStore(s => s.exit);
  const inventory = useUserStore(s => s.inventory);
  const coins = useUserStore(s => s.coins);
  const coinImg = useIcon('item/coin.png');
  const enemyHpRef = useRef(null);
  const coinTargetRef = useRef(null);
  const [coinDisplay, setCoinDisplay] = useState(0);

  const handleExit = () => {
    stopJapaneseSpeech();
    exit();
    navigate(-1);
  };

  const handleContinue = () => {
    stopJapaneseSpeech();
    nextQuestion();
  };

  const handleCoinCollect = useCallback((amount) => {
    const gained = Number(amount) || 0;
    if (gained <= 0) return;
    setCoinDisplay(value => value + gained);

    const target = coinTargetRef.current;
    if (!target) return;

    gsap.killTweensOf(target);
    gsap.timeline()
      .to(target, { scale: 1.12, duration: 0.08, ease: 'power2.out' })
      .to(target, { x: -2, duration: 0.04, ease: 'power1.inOut' })
      .to(target, { x: 2, duration: 0.04, repeat: 2, yoyo: true, ease: 'power1.inOut' })
      .to(target, { x: 0, scale: 1, duration: 0.12, ease: 'back.out(2)' });
  }, []);

  useGSAP(() => {
    if (!practice || !enemyHpRef.current) return;
    const completedCount = practice.currentIndex + (practice.feedbackState ? 1 : 0);
    const hpPct = 100 - (completedCount / practice.questions.length) * 100;
    gsap.to(enemyHpRef.current, {
      width: `${hpPct}%`,
      duration: 0.5,
      ease: 'elastic.out(1, 0.6)',
    });
  }, { dependencies: [practice?.currentIndex, practice?.feedbackState] });

  if (!practice) return null;
  if (practice.isFailed) {
    const cakeCount = inventory?.cake ?? 0;
    const hasCake = cakeCount > 0;
    const canBuyCake = coins >= CAKE_PRICE;
    if (hasCake || canBuyCake) {
      return (
        <ReviveSheet
          hasCake={hasCake}
          cakeCount={cakeCount}
          canBuyCake={canBuyCake}
          coins={coins}
          session={practice}
          onRevive={revive}
          onExit={handleExit}
          returnPath="/vocab"
        />
      );
    }
    return <LessonFailedContent session={practice} onExit={handleExit} returnPath="/vocab" />;
  }

  if (practice.isComplete) return <WordReviewPracticeComplete />;

  const q = practice.questions[practice.currentIndex];
  const completedCount = practice.currentIndex + (practice.feedbackState ? 1 : 0);
  const enemyHp = 100 - (completedCount / practice.questions.length) * 100;
  const questionInstanceKey = `${practice.currentIndex}-${q.id}`;
  const battleState = practice.feedbackState ?? 'idle';

  return (
    <div className="relative flex h-full flex-col bg-[#F5F3FF]">
      <CoinBurst trigger={practice.coinPop} targetRef={coinTargetRef} onCollect={handleCoinCollect} />

      <div className="flex items-center gap-3 border-b border-[#E5E0FF] bg-white/80 px-4 py-2 backdrop-blur-sm">
        <button
          onClick={handleExit}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-[#F5F3FF] hover:text-[var(--tp)]"
          aria-label="退出单词复习"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        <h1 className="min-w-0 flex-1 truncate text-center text-sm font-extrabold text-[#312E81]">
          单词复习
        </h1>
        <div
          ref={coinTargetRef}
          className="flex h-8 w-[76px] shrink-0 items-center justify-end gap-1 rounded-full bg-[#FFFBEB] px-2.5 ring-1 ring-[#FDE68A]"
          aria-label={`本关已获得 ${coinDisplay} 金币`}
        >
          <img src={coinImg} alt="金币" width={18} height={18} style={{ objectFit: 'contain' }} />
          <span className="min-w-[1.4em] text-right text-sm font-extrabold tabular-nums text-[#D97706]">
            {coinDisplay}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden px-5 pb-3 pt-2">
        <div className="mb-2 px-1 text-xs font-bold text-[#9CA3AF]">
          第 {practice.currentIndex + 1} / {practice.questions.length} 题
        </div>

        <div className="relative flex flex-1 flex-col overflow-hidden rounded-3xl bg-white p-5 shadow-md">
          <BattleArena
            battleState={battleState}
            hearts={practice.hearts}
            enemyHp={enemyHp}
            enemyHpRef={enemyHpRef}
          />
          <div className="lesson-answer-scroll min-h-0 flex-1 overflow-y-auto pt-4">
            <WordReviewQuestion
              key={questionInstanceKey}
              question={q}
              onAnswer={submitAnswer}
              feedbackState={practice.feedbackState}
              selectedAnswer={practice.selectedAnswer}
            />
          </div>
        </div>
      </div>

      <FeedbackPanel
        key={questionInstanceKey}
        feedbackState={practice.feedbackState}
        question={q}
        userAnswer={practice.selectedAnswer}
        correctAnswer={q.correctAnswer}
        showCorrectAnswerOnCorrect
        onContinue={handleContinue}
      />

      <style>{`
        .lesson-answer-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .lesson-answer-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
