import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useGameStore from '../../store/gameStore';
import useUserStore from '../../store/userStore';
import useCourseStore from '../../store/courseStore';
import WordFillQuestion from './WordFillQuestion';
import SentenceTranslateQuestion from './SentenceTranslateQuestion';
import WordMatchQuestion from './WordMatchQuestion';
import BattleArena from './BattleArena';
import FeedbackPanel from './FeedbackPanel';
import LessonComplete from './LessonComplete';
import LessonFailed from './LessonFailed';
import ReviveSheet from './ReviveSheet';
import CoinBurst from '../UI/CoinBurst';
import { stopJapaneseSpeech } from '../../lib/japanese-speech-player';
import { useIcon } from '../../lib/icons';
import { EQUIPMENT_IDS, isEquipmentEquipped } from '../../lib/equipment-effects';

gsap.registerPlugin(useGSAP);

const CAKE_PRICE = 80;

export default function LessonScreen() {
  const navigate = useNavigate();
  const { lesson, submitAnswer, nextQuestion, exitLesson, deductHeart, awardPairCoin, overturnWrongAnswer } = useGameStore();
  const chapters = useCourseStore(s => s.chapters);
  const inventory = useUserStore(s => s.inventory);
  const coins     = useUserStore(s => s.coins);
  const equippedItems = useUserStore(s => s.equippedItems ?? {});
  const coinImg = useIcon('item/coin.png');
  const enemyHpRef = useRef(null);
  const coinTargetRef = useRef(null);
  const lessonKeyRef = useRef('');
  const matchBattleTimerRef = useRef(null);
  const [matchBattleState, setMatchBattleState] = useState(null);
  const [coinDisplay, setCoinDisplay] = useState({ lessonKey: '', value: 0 });
  const activeLessonKey = lesson ? `${lesson.chapterId}-${lesson.levelId}` : '';

  const handleExit = () => {
    stopJapaneseSpeech();
    exitLesson();
    navigate(lesson?.returnPath ?? '/');
  };

  const handleContinue = () => {
    stopJapaneseSpeech();
    clearTimeout(matchBattleTimerRef.current);
    setMatchBattleState(null);
    nextQuestion();
  };

  const handleSubmitAnswer = useCallback((answer) => {
    stopJapaneseSpeech();
    submitAnswer(answer);
  }, [submitAnswer]);

  const showTemporaryMatchBattleState = useCallback((battleState) => {
    clearTimeout(matchBattleTimerRef.current);
    setMatchBattleState(battleState);
    matchBattleTimerRef.current = setTimeout(() => {
      setMatchBattleState(null);
    }, 700);
  }, []);

  const handleWrongMatch = useCallback(() => {
    stopJapaneseSpeech();
    showTemporaryMatchBattleState('wrong');
    deductHeart();
  }, [deductHeart, showTemporaryMatchBattleState]);

  const handlePairMatched = useCallback(() => {
    stopJapaneseSpeech();
    showTemporaryMatchBattleState('correct');
    awardPairCoin();
  }, [awardPairCoin, showTemporaryMatchBattleState]);

  useEffect(() => () => {
    clearTimeout(matchBattleTimerRef.current);
  }, []);

  useEffect(() => {
    lessonKeyRef.current = activeLessonKey;
  }, [activeLessonKey]);

  const handleCoinCollect = useCallback((amount) => {
    const gained = Number(amount) || 0;
    if (gained <= 0) return;
    setCoinDisplay(prev => {
      const lessonKey = lessonKeyRef.current;
      const value = prev.lessonKey === lessonKey ? prev.value : 0;
      return { lessonKey, value: value + gained };
    });

    const target = coinTargetRef.current;
    if (!target) return;

    gsap.killTweensOf(target);
    gsap.timeline()
      .to(target, { scale: 1.12, duration: 0.08, ease: 'power2.out' })
      .to(target, { x: -2, duration: 0.04, ease: 'power1.inOut' })
      .to(target, { x: 2, duration: 0.04, repeat: 2, yoyo: true, ease: 'power1.inOut' })
      .to(target, { x: 0, scale: 1, duration: 0.12, ease: 'back.out(2)' });
  }, []);

  // Animate enemy HP depletion as soon as the current answer is settled.
  useGSAP(() => {
    if (!lesson || !enemyHpRef.current) return;
    const completedCount = lesson.currentIndex + (lesson.feedbackState ? 1 : 0);
    const hpPct = 100 - (completedCount / lesson.questions.length) * 100;
    gsap.to(enemyHpRef.current, {
      width: `${hpPct}%`,
      duration: 0.5,
      ease: 'elastic.out(1, 0.6)',
    });
  }, { dependencies: [lesson?.currentIndex, lesson?.feedbackState] });

  if (!lesson) return null;

  if (lesson.isFailed) {
    const cakeCount = inventory?.cake ?? 0;
    const hasCake = cakeCount > 0;
    const canBuyCake = coins >= CAKE_PRICE;
    if (hasCake || canBuyCake) {
      return <ReviveSheet hasCake={hasCake} cakeCount={cakeCount} canBuyCake={canBuyCake} coins={coins} />;
    }
    return <LessonFailed />;
  }

  if (lesson.isComplete) {
    return <LessonComplete />;
  }

  const q = lesson.questions[lesson.currentIndex];
  const completedCount = lesson.currentIndex + (lesson.feedbackState ? 1 : 0);
  const enemyHp = 100 - (completedCount / lesson.questions.length) * 100;
  // Question ids repeat across generated levels (for example every level has q1).
  // Include the lesson position so copied review questions always get fresh local state.
  const questionInstanceKey = `${lesson.currentIndex}-${q.id}`;
  const battleState = lesson.feedbackState ?? matchBattleState ?? 'idle';
  const shouldSlideBattleCharacters = matchBattleState === null;
  const currentLevel = chapters
    .find(chapter => chapter.id === lesson.chapterId)
    ?.levels.find(level => level.id === lesson.levelId);
  const displayLessonCoins = coinDisplay.lessonKey === activeLessonKey ? coinDisplay.value : 0;
  const lessonTitle = lesson.title ?? currentLevel?.title ?? '闯关练习';
  const showUmbrellaShield = !lesson.isPractice &&
    isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.UMBRELLA) &&
    !lesson.umbrellaShieldUsed;
  const showSakuraPetalShield = lesson.practiceType === 'wrong-review' &&
    isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.SAKURA_PETAL);

  return (
    <div className="flex flex-col h-full relative bg-[#F5F3FF]">
      {/* Coin burst animation overlay — lives outside overflow:hidden areas */}
      <CoinBurst trigger={lesson?.coinPop} targetRef={coinTargetRef} onCollect={handleCoinCollect} />
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 border-b border-[#E5E0FF] bg-white/80 px-4 py-2 backdrop-blur-sm">
        {/* Exit button */}
        <button
          onClick={handleExit}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-[#F5F3FF] hover:text-[var(--tp)]"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>

        <h1 className="min-w-0 flex-1 truncate text-center text-sm font-extrabold text-[#312E81]">
          {lessonTitle}
        </h1>
        <div
          ref={coinTargetRef}
          className="flex h-8 w-[76px] shrink-0 items-center justify-end gap-1 rounded-full bg-[#FFFBEB] px-2.5 ring-1 ring-[#FDE68A]"
          aria-label={`本关已获得 ${displayLessonCoins} 金币`}
        >
          <img src={coinImg} alt="金币" width={18} height={18} style={{ objectFit: 'contain' }} />
          <span className="min-w-[1.4em] text-right text-sm font-extrabold tabular-nums text-[#D97706]">
            {displayLessonCoins}
          </span>
        </div>
      </div>

      {/* ── Main question area ── */}
      <div className="flex-1 flex flex-col overflow-hidden px-5 pb-3 pt-2">

        {/* Question number */}
        <div className="mb-2 px-1 text-xs font-bold text-[#9CA3AF]">
          第 {lesson.currentIndex + 1} / {lesson.questions.length} 题
        </div>

        {/* Question card */}
        <div className="flex-1 bg-white rounded-3xl shadow-md p-5 flex flex-col relative overflow-hidden">
          {/* 巩固练习横幅 */}
          {q._isReview && (
            <div style={{
              background: 'linear-gradient(135deg, #FEF3C722, #FCD34D33)',
              border: '1.5px solid #FCD34D88',
              borderRadius: 10,
              padding: '7px 12px',
              marginBottom: 12,
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 800,
              color: '#92400E',
              letterSpacing: '0.02em',
            }}>
              ✨ 巩固练习~ 额外一题！
            </div>
          )}
          <BattleArena
            battleState={battleState}
            hearts={lesson.hearts}
            enemyHp={enemyHp}
            enemyHpRef={enemyHpRef}
            shouldSlide={shouldSlideBattleCharacters}
            showUmbrellaShield={showUmbrellaShield}
            showSakuraPetalShield={showSakuraPetalShield}
          />
          <div className="lesson-answer-scroll flex-1 min-h-0 overflow-y-auto pt-4">
            {q.type === 'word-fill' && (
              <WordFillQuestion
                key={questionInstanceKey}
                question={q}
                onAnswer={handleSubmitAnswer}
                feedbackState={lesson.feedbackState}
                selectedAnswer={lesson.selectedAnswer}
              />
            )}
            {q.type === 'sentence-translate' && (
              <SentenceTranslateQuestion
                key={questionInstanceKey}
                question={q}
                onAnswer={handleSubmitAnswer}
                feedbackState={lesson.feedbackState}
              />
            )}
            {q.type === 'word-match' && (
              <WordMatchQuestion
                key={questionInstanceKey}
                question={q}
                onComplete={() => {
                  handleSubmitAnswer('matched');
                }}
                onWrongMatch={handleWrongMatch}
                onPairMatched={handlePairMatched}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Feedback panel (slides up from bottom) ── */}
      <FeedbackPanel
        key={questionInstanceKey}
        feedbackState={lesson.feedbackState}
        question={q}
        userAnswer={lesson.selectedAnswer}
        correctAnswer={
          lesson.feedbackState
            ? (q.type === 'sentence-translate' ? q.translation
              : q.type === 'word-match' ? null
              : q.answers[0])
            : null
        }
        hint={lesson.feedbackState === 'wrong' ? q.hint : null}
        onContinue={handleContinue}
        onOverturn={overturnWrongAnswer}
        isReview={!!q._isReview}
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
