import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useGameStore from '../../store/gameStore';
import useUserStore, { MAX_HEARTS } from '../../store/userStore';
import heartImg from '../../assets/icons/ui/heart.png';
import heartYellowImg from '../../assets/icons/ui/heart_yellow.png';
import logoImg32 from '../../assets/icons/logo_32.png';
import WordFillQuestion from './WordFillQuestion';
import SentenceTranslateQuestion from './SentenceTranslateQuestion';
import WordMatchQuestion from './WordMatchQuestion';
import FeedbackPanel from './FeedbackPanel';
import LessonComplete from './LessonComplete';
import LessonFailed from './LessonFailed';
import ReviveSheet from './ReviveSheet';
import CoinBurst from '../UI/CoinBurst';
import { stopJapaneseSpeech } from '../../lib/japanese-speech-player';

gsap.registerPlugin(useGSAP);

// Small heart component — supports temporary hearts (> MAX_HEARTS) shown in yellow
function HeartRow({ hearts }) {
  const totalSlots = Math.max(MAX_HEARTS, hearts);
  return (
    <div className="flex gap-1">
      {Array.from({ length: totalSlots }).map((_, i) => {
        const filled = i < hearts;
        const isTemp = i >= MAX_HEARTS;
        return (
          <img
            key={i}
            src={isTemp ? heartYellowImg : heartImg}
            alt="heart"
            width={24}
            height={24}
            style={{
              objectFit: 'contain',
              filter: filled ? 'none' : 'grayscale(1)',
              opacity: filled ? 1 : 0.3,
              transition: 'all 0.3s',
            }}
          />
        );
      })}
    </div>
  );
}

const CAKE_PRICE = 80;

export default function LessonScreen() {
  const navigate = useNavigate();
  const { lesson, submitAnswer, nextQuestion, exitLesson, deductHeart, awardPairCoin, overturnWrongAnswer } = useGameStore();
  const inventory = useUserStore(s => s.inventory);
  const coins     = useUserStore(s => s.coins);
  const progressRef = useRef(null);
  const mascotRef = useRef(null);

  const handleExit = () => {
    stopJapaneseSpeech();
    exitLesson();
    navigate('/');
  };

  const handleContinue = () => {
    stopJapaneseSpeech();
    nextQuestion();
  };

  // Animate progress bar fill on question advance
  useGSAP(() => {
    if (!lesson || !progressRef.current) return;
    const pct = (lesson.currentIndex / lesson.questions.length) * 100;
    gsap.to(progressRef.current, {
      width: `${pct}%`,
      duration: 0.5,
      ease: 'elastic.out(1, 0.6)',
    });
  }, { dependencies: [lesson?.currentIndex] });

  // Mascot reaction on feedback
  useGSAP(() => {
    if (!mascotRef.current || !lesson?.feedbackState) return;
    if (lesson.feedbackState === 'correct') {
      gsap.timeline()
        .to(mascotRef.current, { scale: 1.3, rotate: -10, duration: 0.15, ease: 'power2.out' })
        .to(mascotRef.current, { scale: 1.1, rotate: 10, duration: 0.15 })
        .to(mascotRef.current, { scale: 1, rotate: 0, duration: 0.2, ease: 'elastic.out(1, 0.5)' });
    } else if (lesson.feedbackState === 'wrong') {
      gsap.timeline()
        .to(mascotRef.current, { scale: 0.85, rotate: 5, duration: 0.15 })
        .to(mascotRef.current, { scale: 1, rotate: 0, duration: 0.3, ease: 'elastic.out(1, 0.4)' });
    }
  }, { dependencies: [lesson?.feedbackState] });

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
  const progress = (lesson.currentIndex / lesson.questions.length) * 100;
  // Question ids repeat across generated levels (for example every level has q1).
  // Include the lesson position so copied review questions always get fresh local state.
  const questionInstanceKey = `${lesson.currentIndex}-${q.id}`;

  return (
    <div className="flex flex-col h-full relative bg-[#F5F3FF]">
      {/* Coin burst animation overlay — lives outside overflow:hidden areas */}
      <CoinBurst trigger={lesson?.coinPop} />
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-[#E5E0FF]">
        {/* Exit button */}
        <button
          onClick={handleExit}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F5F3FF] transition-colors text-[#9CA3AF] hover:text-[var(--tp)]"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>

        {/* Progress bar */}
        <div className="flex-1 progress-track">
          <div ref={progressRef} className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Hearts */}
        <HeartRow hearts={lesson.hearts} />
      </div>

      {/* ── Main question area ── */}
      <div className="flex-1 flex flex-col px-5 py-4 overflow-hidden">

        {/* Mascot + question number */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold text-[#9CA3AF]">
            {lesson.currentIndex + 1} / {lesson.questions.length}
          </div>
          <img
            ref={mascotRef}
            src={logoImg32}
            alt="日学"
            width={40}
            height={40}
            className="mascot-idle select-none"
            style={{ objectFit: 'contain' }}
          />
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
          {q.type === 'word-fill' && (
            <WordFillQuestion
              key={questionInstanceKey}
              question={q}
              onAnswer={submitAnswer}
              feedbackState={lesson.feedbackState}
              selectedAnswer={lesson.selectedAnswer}
            />
          )}
          {q.type === 'sentence-translate' && (
            <SentenceTranslateQuestion
              key={questionInstanceKey}
              question={q}
              onAnswer={submitAnswer}
              feedbackState={lesson.feedbackState}
            />
          )}
          {q.type === 'word-match' && (
            <WordMatchQuestion
              key={questionInstanceKey}
              question={q}
              onComplete={() => {
                stopJapaneseSpeech();
                submitAnswer('matched');
              }}
              onWrongMatch={deductHeart}
              onPairMatched={awardPairCoin}
            />
          )}
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
    </div>
  );
}
