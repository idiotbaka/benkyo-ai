import { useRef, useState, useCallback, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useAiStore from '../../store/aiStore';
import { judgeAnswer } from '../../lib/judge-answer';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';
import heartImg from '../../assets/icons/ui/heart.png';
import correctFeedbackImg from '../../assets/icons/sd/sd2_corrent.png';
import wrongFeedbackImg from '../../assets/icons/sd/sd2_wrong.png';

export default function FeedbackPanel({ feedbackState, question, userAnswer, correctAnswer, hint, onContinue, onOverturn, isReview }) {
  const panelRef = useRef(null);
  const btnRef = useRef(null);

  // Appeal state — local to this panel instance (reset on each new feedback)
  const [appealStatus, setAppealStatus] = useState(null); // null | 'loading' | 'overturned' | 'rejected'
  const [appealReason, setAppealReason] = useState('');
  const [appealError, setAppealError] = useState('');

  const aiConfig = useAiStore(s => s.getConfig)();
  const isAiReady = Boolean(aiConfig.provider && aiConfig.apiKey?.trim() && aiConfig.modelId?.trim());

  useEffect(() => {
    if (feedbackState === 'correct') {
      playSoundEffect(SOUND_EFFECT_TYPES.ANSWER_CORRECT);
    } else if (feedbackState === 'wrong') {
      playSoundEffect(SOUND_EFFECT_TYPES.ANSWER_WRONG);
    }
  }, [feedbackState]);

  useGSAP(() => {
    if (!feedbackState || !panelRef.current) return;
    gsap.fromTo(
      panelRef.current,
      { y: '100%' },
      { y: '0%', duration: 0.38, ease: 'back.out(1.3)' }
    );
    // Button entrance
    gsap.fromTo(
      btnRef.current,
      { scale: 0.7, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.3, delay: 0.15, ease: 'back.out(2)' }
    );
  }, { dependencies: [feedbackState] });

  const handleAppeal = useCallback(async () => {
    if (!isAiReady || !question || appealStatus !== null) return;
    setAppealStatus('loading');
    setAppealError('');
    try {
      const result = await judgeAnswer(aiConfig, question, userAnswer ?? []);
      if (result.correct) {
        setAppealStatus('overturned');
        playSoundEffect(SOUND_EFFECT_TYPES.ANSWER_CORRECT);
        onOverturn?.(); // fix correctCount + restore heart in stores
      } else {
        setAppealStatus('rejected');
        setAppealReason(result.reason);
      }
    } catch (err) {
      setAppealStatus(null);
      setAppealError('AI 裁定失败，请稍后重试');
      console.error('[FeedbackPanel] judgeAnswer error:', err);
    }
  }, [isAiReady, question, userAnswer, appealStatus, aiConfig, onOverturn]);

  if (!feedbackState) return null;

  const isOverturned = appealStatus === 'overturned';
  const isCorrect = feedbackState === 'correct' || isOverturned;
  const isReviewWrong = isReview && feedbackState === 'wrong';
  const showAppealBtn =
    feedbackState === 'wrong' &&
    !isReview &&
    question?.type === 'sentence-translate' &&
    isAiReady &&
    appealStatus === null;
  const showRejectedReason = appealStatus === 'rejected' && appealReason;

  // Determine header content
  let titleText, subText;
  if (isOverturned) {
    titleText = 'AI 确认正确！';
    subText = <span className="inline-flex items-center gap-1 flex-wrap">你的翻译也是对的，<img src={heartImg} alt="heart" width={16} height={16} style={{ objectFit: 'contain', verticalAlign: 'middle' }} /> 已为你补回</span>;
  } else if (isCorrect) {
    titleText = 'よくできました！';
    subText = '完全正确！继续加油';
  } else if (isReviewWrong) {
    titleText = '没有扣心心～';
    subText = '巩固练习不扣心心，下次一定！';
  } else {
    titleText = '惜しい！';
    subText = null;
  }
  const feedbackCharacterImg = isCorrect ? correctFeedbackImg : wrongFeedbackImg;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-0 left-0 right-0 z-20 rounded-t-3xl px-5 pt-5 pb-6 shadow-2xl"
      style={{
        background: isCorrect ? '#F0FDF4' : isReviewWrong ? '#FFFBEB' : '#FFF1F2',
        borderTop: `3px solid ${isCorrect ? '#86EFAC' : isReviewWrong ? '#FCD34D' : '#FCA5A5'}`,
      }}
    >
      <img
        src={feedbackCharacterImg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-0 z-10 select-none object-contain"
        style={{
          top: 'calc(clamp(132px, 34vw, 176px) / -2)',
          width: 'clamp(132px, 34vw, 176px)',
        }}
      />

      {/* Header row */}
      <div className="relative z-20 ml-[34%] min-h-[64px] mb-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3
              className="font-extrabold text-lg leading-tight"
              style={{ color: isCorrect ? '#15803D' : isReviewWrong ? '#92400E' : '#B91C1C' }}
            >
              {titleText}
            </h3>
            {subText && (
              <p className="text-sm font-medium mt-0.5" style={{ color: isCorrect ? '#16A34A' : isReviewWrong ? '#B45309' : '#DC2626' }}>
                {subText}
              </p>
            )}
            {/* Wrong state: show correct answer */}
            {!isCorrect && correctAnswer && (
              <p className="text-sm font-medium mt-0.5" style={{ color: isReviewWrong ? '#92400E' : '#DC2626' }}>
                正解：<span className="jp font-bold text-base">{correctAnswer}</span>
              </p>
            )}
            {/* Hint */}
            {!isCorrect && hint && (
              <p className="text-xs text-[#9CA3AF] mt-0.5">{hint}</p>
            )}
            {/* Rejected reason */}
            {showRejectedReason && (
              <div
                className="mt-2 px-3 py-2 rounded-xl text-sm"
                style={{ background: '#FEE2E2', color: '#991B1B', fontWeight: 600 }}
              >
                {appealReason}
              </div>
            )}
            {/* Appeal error */}
            {appealError && (
              <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{appealError}</p>
            )}
          </div>
          {/* 误判? button — only for wrong sentence-translate with AI ready */}
          {showAppealBtn && (
            <button
              onClick={handleAppeal}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                borderRadius: 20,
                border: '1.5px solid #FCA5A5',
                background: '#FFF1F2',
                color: '#B91C1C',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              误判?
            </button>
          )}
          {/* Loading spinner */}
          {appealStatus === 'loading' && (
            <div
              style={{
                flexShrink: 0,
                width: 22, height: 22,
                border: '2.5px solid #FCA5A5',
                borderTopColor: '#EF4444',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
        </div>
      </div>

      {/* Continue button */}
      <button
        ref={btnRef}
        onClick={onContinue}
        className={`w-full py-4 rounded-2xl font-bold text-white text-lg ${
          isCorrect ? 'btn-success' : 'btn-danger'
        }`}
        style={{
          background: isCorrect ? '#22C55E' : isReviewWrong ? '#F59E0B' : '#EF4444',
          boxShadow: `0 4px 0 ${isCorrect ? '#15803D' : isReviewWrong ? '#D97706' : '#B91C1C'}`,
        }}
      >
        つぎへ →
      </button>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
