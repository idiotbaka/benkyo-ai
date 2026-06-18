import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useKanaPracticeStore from '../store/kanaPracticeStore';
import CoinBurst from '../components/UI/CoinBurst';
import BattleArena from '../components/Lesson/BattleArena';
import FeedbackPanel from '../components/Lesson/FeedbackPanel';
import KanaQuestion from '../components/Practice/KanaQuestion';
import KanaPracticeComplete from '../components/Practice/KanaPracticeComplete';
import { normalizeKanaScript } from '../lib/kana-practice';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../lib/sound-effects';
import { useIcon } from '../lib/icons';

gsap.registerPlugin(useGSAP);

export default function KanaPracticePage() {
  const navigate = useNavigate();
  const { script: routeScript } = useParams();
  const practice = useKanaPracticeStore(s => s.practice);
  const script = normalizeKanaScript(routeScript);

  useEffect(() => {
    if (!practice) navigate(`/vocab/japanese-intro?tab=${script}`, { replace: true });
  }, [navigate, practice, script]);

  if (!practice) return null;

  return (
    <div className="flex h-full flex-col">
      <KanaPracticeScreen />
    </div>
  );
}

function KanaPracticeScreen() {
  const navigate = useNavigate();
  const practice = useKanaPracticeStore(s => s.practice);
  const submitAnswer = useKanaPracticeStore(s => s.submitAnswer);
  const nextQuestion = useKanaPracticeStore(s => s.nextQuestion);
  const exit = useKanaPracticeStore(s => s.exit);
  const coinImg = useIcon('item/coin.png');
  const progressRef = useRef(null);
  const enemyHpRef = useRef(null);
  const coinTargetRef = useRef(null);
  const [coinDisplay, setCoinDisplay] = useState(0);

  const handleExit = () => {
    const script = practice?.session?.script ?? 'hiragana';
    exit();
    navigate(`/vocab/japanese-intro?tab=${script}`);
  };

  const handleContinue = () => {
    nextQuestion();
  };

  useEffect(() => {
    if (practice?.feedbackState !== 'correct') return undefined;

    playSoundEffect(SOUND_EFFECT_TYPES.ANSWER_CORRECT);
    const timer = setTimeout(() => {
      nextQuestion();
    }, 420);

    return () => clearTimeout(timer);
  }, [nextQuestion, practice?.currentIndex, practice?.feedbackState]);

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
    if (!practice || !progressRef.current) return;
    const completedCount = practice.currentIndex + (practice.feedbackState ? 1 : 0);
    const progressPct = (completedCount / practice.questions.length) * 100;
    gsap.to(progressRef.current, {
      width: `${progressPct}%`,
      duration: 0.32,
      ease: 'power2.out',
    });
  }, { dependencies: [practice?.currentIndex, practice?.feedbackState] });

  useGSAP(() => {
    if (!practice || !enemyHpRef.current) return;
    const completedCount = practice.currentIndex + (practice.feedbackState ? 1 : 0);
    const enemyHp = 100 - (completedCount / practice.questions.length) * 100;
    gsap.to(enemyHpRef.current, {
      width: `${enemyHp}%`,
      duration: 0.5,
      ease: 'elastic.out(1, 0.6)',
    });
  }, { dependencies: [practice?.currentIndex, practice?.feedbackState] });

  if (!practice) return null;
  if (practice.isComplete) return <KanaPracticeComplete />;

  const q = practice.questions[practice.currentIndex];
  const questionInstanceKey = `${practice.currentIndex}-${q.id}`;
  const script = practice.session?.script ?? 'hiragana';
  const title = script === 'katakana' ? '片假名学习' : '平假名学习';
  const detailText = q.optionMode === 'kana' ? q.romaji : q.displayKana;
  const detailLabel = q.optionMode === 'kana' ? '读音' : '假名';
  const completedCount = practice.currentIndex + (practice.feedbackState ? 1 : 0);
  const enemyHp = 100 - (completedCount / practice.questions.length) * 100;
  const battleState = practice.feedbackState ?? 'idle';

  return (
    <div className="relative flex h-full flex-col bg-[#F5F3FF]">
      <CoinBurst trigger={practice.coinPop} targetRef={coinTargetRef} onCollect={handleCoinCollect} />

      <div className="flex items-center gap-3 border-b border-[#E5E0FF] bg-white/80 px-4 py-2 backdrop-blur-sm">
        <button
          type="button"
          onClick={handleExit}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-[#F5F3FF] hover:text-[var(--tp)]"
          aria-label="退出假名学习"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        <h1 className="min-w-0 flex-1 truncate text-center text-sm font-extrabold text-[#312E81]">
          {title}
        </h1>
        <div
          ref={coinTargetRef}
          className="flex h-8 w-[76px] shrink-0 items-center justify-end gap-1 rounded-full bg-[#FFFBEB] px-2.5 ring-1 ring-[#FDE68A]"
          aria-label={`本课已获得 ${coinDisplay} 金币`}
        >
          <img src={coinImg} alt="金币" width={18} height={18} style={{ objectFit: 'contain' }} />
          <span className="min-w-[1.4em] text-right text-sm font-extrabold tabular-nums text-[#D97706]">
            {coinDisplay}
          </span>
        </div>
      </div>

      <div className="px-5 pb-2 pt-3">
        <div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-[#9CA3AF]">
          <span>第 {practice.currentIndex + 1} / {practice.questions.length} 题</span>
          <span>不消耗心心</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white shadow-inner">
          <div
            ref={progressRef}
            className="h-full rounded-full"
            style={{ width: '0%', background: 'linear-gradient(90deg, var(--tp-from), var(--tp))' }}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-3 pt-2">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-white p-5 shadow-md">
          <BattleArena
            battleState={battleState}
            hearts={0}
            enemyHp={enemyHp}
            enemyHpRef={enemyHpRef}
            showHearts={false}
          />
          <div className="lesson-answer-scroll min-h-0 flex-1 overflow-y-auto pt-4">
            <KanaQuestion
              key={questionInstanceKey}
              question={q}
              onAnswer={submitAnswer}
              feedbackState={practice.feedbackState}
              selectedAnswer={practice.selectedAnswer}
            />
          </div>
        </div>
      </div>

      {practice.feedbackState === 'wrong' && (
        <FeedbackPanel
          key={questionInstanceKey}
          feedbackState={practice.feedbackState}
          question={q}
          userAnswer={practice.selectedAnswer}
          correctAnswer={q.correctAnswerLabel}
          correctAnswerLabel="正解"
          detailText={detailText}
          detailLabel={detailLabel}
          showCorrectAnswerOnCorrect
          onContinue={handleContinue}
        />
      )}

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
