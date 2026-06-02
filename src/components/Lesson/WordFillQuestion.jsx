import { useState, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import RubyText from '../UI/RubyText';
import { playSavedJapaneseSpeech } from '../../lib/japanese-speech-player';

gsap.registerPlugin(useGSAP);

export default function WordFillQuestion({ question, onAnswer, feedbackState, selectedAnswer }) {
  const cardRef = useRef(null);
  const blankRef = useRef(null);
  const optionRefs = useRef([]);

  // Shuffle options once on mount (component is re-keyed per question)
  const [shuffledOptions] = useState(() => {
    const arr = [...question.options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  // Animate the blank slot when feedback arrives
  useGSAP(() => {
    if (!blankRef.current) return;

    if (feedbackState === 'correct') {
      gsap.timeline()
        .to(blankRef.current, { scale: 1.15, duration: 0.15, ease: 'power2.out' })
        .to(blankRef.current, { scale: 1, duration: 0.35, ease: 'elastic.out(1, 0.4)' });
    } else if (feedbackState === 'wrong') {
      gsap.timeline()
        .to(blankRef.current, { x: -10, duration: 0.07 })
        .to(blankRef.current, { x: 10, duration: 0.07 })
        .to(blankRef.current, { x: -7, duration: 0.06 })
        .to(blankRef.current, { x: 7, duration: 0.06 })
        .to(blankRef.current, { x: -4, duration: 0.05 })
        .to(blankRef.current, { x: 0, duration: 0.05 });
    }
  }, { dependencies: [feedbackState] });

  // Card entrance
  useGSAP(() => {
    gsap.fromTo(
      cardRef.current,
      { y: 30, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }
    );
  }, { dependencies: [question.id] });

  const handleOptionClick = (word, idx) => {
    if (feedbackState !== null) return;

    playRubyWord(word);

    const btn = optionRefs.current[idx];
    if (btn) {
      gsap.timeline()
        .to(btn, { scale: 0.88, duration: 0.08, ease: 'power2.in' })
        .to(btn, { scale: 1.06, duration: 0.15, ease: 'back.out(2.5)' })
        .to(btn, { scale: 1, duration: 0.1 });
    }
    onAnswer(word);
  };

  const playRubyWord = word => {
    void playSavedJapaneseSpeech(word).catch(() => {});
  };

  const getOptionClass = (word) => {
    let cls = 'word-btn w-full text-center';
    if (!feedbackState) return cls;
    if (word === question.answers[0]) return cls + ' show-correct';
    if (word === selectedAnswer && feedbackState === 'wrong') return cls + ' wrong';
    return cls + ' dimmed';
  };

  const blankClass = [
    'blank-slot',
    selectedAnswer ? 'filled' : '',
    feedbackState === 'correct' ? 'correct' : '',
    feedbackState === 'wrong' ? 'wrong' : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={cardRef} className="flex flex-col h-full select-none">

      {/* Prompt label */}
      <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest mb-5">
        {question.prompt}
      </p>

      {/* Sentence */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-center mb-3 leading-loose">
          {question.parts.map((part, i) =>
            part === '___' ? (
              <span key={i} ref={blankRef} className={blankClass}>
                <RubyText
                  text={selectedAnswer || '    '}
                  rubyMap={question.ruby || {}}
                  onRubyClick={playRubyWord}
                />
              </span>
            ) : (
              <span key={i} className="jp text-2xl font-bold text-[#1E1B4B]">
                <RubyText text={part} rubyMap={question.ruby || {}} onRubyClick={playRubyWord} />
              </span>
            )
          )}
        </div>

        {/* Chinese translation */}
        <p className="text-center text-sm text-[#9CA3AF] font-medium">
          {question.translation}
        </p>
      </div>

      {/* Word option grid */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {shuffledOptions.map((word, idx) => (
          <button
            key={word}
            ref={el => { optionRefs.current[idx] = el; }}
            className={getOptionClass(word)}
            disabled={feedbackState !== null}
            onClick={() => handleOptionClick(word, idx)}
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}
