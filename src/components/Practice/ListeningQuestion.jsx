import { useLayoutEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import JapaneseSpeechButton from '../UI/JapaneseSpeechButton';
import { toKanaReading } from '../../lib/japanese-text';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';
import { animateWordChipLayout, captureWordChipRects } from '../../lib/word-chip-motion';
import useAppearanceStore from '../../store/appearanceStore';

gsap.registerPlugin(useGSAP);

export default function ListeningQuestion({ question, onAnswer, feedbackState }) {
  const wordChipMotion = useAppearanceStore(s => s.wordChipMotion);
  const shouldAnimateWordChips = wordChipMotion !== 'none';
  const [selectedWords, setSelectedWords] = useState([]);
  const cardRef = useRef(null);
  const previousChipRectsRef = useRef(null);
  const zoneRef = useRef(null);

  const [shuffledSegments] = useState(() => {
    const arr = [...(question.segments ?? [])];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  useGSAP(() => {
    gsap.set(cardRef.current, { opacity: 0 });
  });

  useGSAP(() => {
    gsap.fromTo(
      cardRef.current,
      { y: 30, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }
    );
  }, { dependencies: [question.id] });

  useGSAP(() => {
    if (feedbackState !== 'wrong' || !zoneRef.current) return;
    gsap.timeline()
      .to(zoneRef.current, { x: -8, duration: 0.07 })
      .to(zoneRef.current, { x: 8, duration: 0.07 })
      .to(zoneRef.current, { x: -6, duration: 0.06 })
      .to(zoneRef.current, { x: 6, duration: 0.06 })
      .to(zoneRef.current, { x: 0, duration: 0.05 });
  }, { dependencies: [feedbackState] });

  useLayoutEffect(() => {
    if (!shouldAnimateWordChips) return;
    animateWordChipLayout(cardRef.current, previousChipRectsRef.current);
    previousChipRectsRef.current = null;
  }, [selectedWords, shouldAnimateWordChips]);

  const captureChipLayout = () => {
    if (!shouldAnimateWordChips) return;
    previousChipRectsRef.current = captureWordChipRects(cardRef.current);
  };

  const handleBankClick = (word, idx) => {
    if (feedbackState !== null) return;
    captureChipLayout();
    playSoundEffect(SOUND_EFFECT_TYPES.WORD_SELECTED);
    setSelectedWords(prev => [
      ...prev,
      { word, bankIdx: idx, uid: `bank-${idx}` },
    ]);
  };

  const handleZoneClick = (uid) => {
    if (feedbackState !== null) return;
    captureChipLayout();
    playSoundEffect(SOUND_EFFECT_TYPES.WORD_UNSELECTED);
    setSelectedWords(prev => prev.filter(w => w.uid !== uid));
  };

  const handleSubmit = () => {
    if (feedbackState !== null || selectedWords.length === 0) return;
    onAnswer(selectedWords.map(w => w.word));
  };

  const usedBankIndices = new Set(selectedWords.map(w => w.bankIdx));
  const availableSegments = shuffledSegments
    .map((word, idx) => ({ word, idx }))
    .filter(({ idx }) => shouldAnimateWordChips ? !usedBankIndices.has(idx) : true);
  const zoneCorrect = feedbackState === 'correct';
  const zoneWrong = feedbackState === 'wrong';

  return (
    <div ref={cardRef} className="flex h-full select-none flex-col">
      <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
        {question.prompt}
      </p>

      <div className="mb-5 flex flex-col items-center justify-center gap-2 text-center">
        <JapaneseSpeechButton
          text={question.sentence}
          spokenText={toKanaReading(question.sentence, question.ruby)}
          label="播放听力句子"
          autoPlay
        />
        <p className="text-sm font-bold text-[#6B7280]">
          听音频，拼出完整日语句子
        </p>
        {question.translation && (
          <p className="max-w-full rounded-2xl bg-[#F5F3FF] px-3 py-2 text-sm font-bold leading-relaxed text-[#4B5563]">
            {question.translation}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <div
          ref={zoneRef}
          className={[
            'mb-4 flex min-h-[64px] flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed px-3 py-2.5',
            'transition-colors duration-200',
            zoneCorrect ? 'border-[#86EFAC] bg-[#F0FDF4]'
              : zoneWrong ? 'border-[#FCA5A5] bg-[#FFF1F2]'
              : 'border-[var(--tp-bdr)] bg-[#F9F7FF]',
          ].join(' ')}
        >
          {selectedWords.length === 0 ? (
            <span className="w-full text-center text-sm text-[var(--tp-bdr)]">
              点击下方词语，在此组成日语句子
            </span>
          ) : (
            selectedWords.map(({ word, uid }) => (
              <button
                key={uid}
                onClick={() => handleZoneClick(uid)}
                disabled={feedbackState !== null}
                data-word-chip-id={uid}
                className={[
                  'zone-chip jp',
                  zoneCorrect ? 'zone-chip--correct' : '',
                  zoneWrong ? 'zone-chip--wrong' : '',
                ].filter(Boolean).join(' ')}
              >
                {word}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap justify-center gap-2">
        {availableSegments.map(({ word, idx }) => (
          <button
            key={idx}
            onClick={() => handleBankClick(word, idx)}
            disabled={feedbackState !== null || usedBankIndices.has(idx)}
            data-word-chip-id={`bank-${idx}`}
            className={`bank-chip jp ${!shouldAnimateWordChips && usedBankIndices.has(idx) ? 'bank-chip--used' : ''}`}
          >
            {word}
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={feedbackState !== null || selectedWords.length === 0}
        className="w-full rounded-2xl py-3 text-base font-bold transition-all duration-150"
        style={{
          background: selectedWords.length > 0 && !feedbackState ? 'var(--tp)' : 'var(--tp-lite)',
          color: selectedWords.length > 0 && !feedbackState ? 'white' : '#A78BFA',
          boxShadow: selectedWords.length > 0 && !feedbackState ? '0 3px 0 var(--tp-deep)' : 'none',
          cursor: selectedWords.length > 0 && !feedbackState ? 'pointer' : 'default',
        }}
      >
        提交答案
      </button>
    </div>
  );
}
