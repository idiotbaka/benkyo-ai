import { useLayoutEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import RubyText from '../UI/RubyText';
import JapaneseSpeechButton from '../UI/JapaneseSpeechButton';
import { playSavedJapaneseSpeech } from '../../lib/japanese-speech-player';
import { toKanaReading } from '../../lib/japanese-text';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';
import { animateWordChipLayout, captureWordChipRects } from '../../lib/word-chip-motion';
import useAppearanceStore from '../../store/appearanceStore';

gsap.registerPlugin(useGSAP);

export default function SentenceTranslateQuestion({ question, onAnswer, feedbackState }) {
  const wordChipMotion = useAppearanceStore(s => s.wordChipMotion);
  const shouldAnimateWordChips = wordChipMotion !== 'none';
  const [selectedWords, setSelectedWords] = useState([]);
  const cardRef = useRef(null);
  const previousChipRectsRef = useRef(null);
  const zoneRef = useRef(null);

  // Shuffle word bank once on mount (component is re-keyed per question)
  const [shuffledOptions] = useState(() => {
    const arr = [...question.options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  // Prevent FOUC
  useGSAP(() => {
    gsap.set(cardRef.current, { opacity: 0 });
  });

  // Card entrance — runs whenever question changes (component is re-keyed, so this runs on mount)
  useGSAP(() => {
    gsap.fromTo(
      cardRef.current,
      { y: 30, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }
    );
  }, { dependencies: [question.id] });

  // Zone shake on wrong answer
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
  const availableOptions = shuffledOptions
    .map((word, idx) => ({ word, idx }))
    .filter(({ idx }) => shouldAnimateWordChips ? !usedBankIndices.has(idx) : true);

  const zoneCorrect = feedbackState === 'correct';
  const zoneWrong = feedbackState === 'wrong';
  const playRubyWord = word => {
    void playSavedJapaneseSpeech(word).catch(() => {});
  };

  return (
    <div ref={cardRef} className="flex flex-col h-full select-none">

      {/* Prompt */}
      <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">
        {question.prompt}
      </p>

      {/* Japanese sentence */}
      <div className="flex items-center justify-center gap-2 text-center mb-4 leading-loose">
        <JapaneseSpeechButton
          text={question.sentence}
          spokenText={toKanaReading(question.sentence, question.ruby)}
          autoPlay
        />
        <span className="jp text-2xl font-bold text-[#1E1B4B]">
          <RubyText text={question.sentence} rubyMap={question.ruby || {}} onRubyClick={playRubyWord} />
        </span>
      </div>

      {/* Answer build zone */}
      <div className="flex-1 flex flex-col justify-center">
        <div
          ref={zoneRef}
          className={[
            'min-h-[56px] border-2 border-dashed rounded-2xl px-3 py-2.5',
            'flex flex-wrap gap-2 items-center mb-4 transition-colors duration-200',
            zoneCorrect ? 'border-[#86EFAC] bg-[#F0FDF4]'
              : zoneWrong ? 'border-[#FCA5A5] bg-[#FFF1F2]'
              : 'border-[var(--tp-bdr)] bg-[#F9F7FF]',
          ].join(' ')}
        >
          {selectedWords.length === 0 ? (
            <span className="text-sm text-[var(--tp-bdr)] w-full text-center">
              点击下方词语，在此组成翻译
            </span>
          ) : (
            selectedWords.map(({ word, uid }) => (
              <button
                key={uid}
                onClick={() => handleZoneClick(uid)}
                disabled={feedbackState !== null}
                data-word-chip-id={uid}
                className={[
                  'zone-chip',
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

      {/* Word bank */}
      <div className="flex flex-wrap gap-2 justify-center mb-3">
        {availableOptions.map(({ word, idx }) => (
          <button
            key={idx}
            onClick={() => handleBankClick(word, idx)}
            disabled={feedbackState !== null || usedBankIndices.has(idx)}
            data-word-chip-id={`bank-${idx}`}
            className={`bank-chip ${!shouldAnimateWordChips && usedBankIndices.has(idx) ? 'bank-chip--used' : ''}`}
          >
            {word}
          </button>
        ))}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={feedbackState !== null || selectedWords.length === 0}
        className="w-full py-3 rounded-2xl font-bold text-base transition-all duration-150"
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
