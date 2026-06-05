import { useState, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import RubyText from '../UI/RubyText';
import JapaneseSpeechButton from '../UI/JapaneseSpeechButton';
import { playSavedJapaneseSpeech } from '../../lib/japanese-speech-player';
import { toKanaReading } from '../../lib/japanese-text';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';

gsap.registerPlugin(useGSAP);

export default function WordReviewQuestion({ question, onAnswer, feedbackState, selectedAnswer }) {
  const cardRef = useRef(null);
  const optionRefs = useRef([]);
  const [locked, setLocked] = useState(false);
  const isJapaneseAnswer = question.mode === 'cn-to-jp';

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

  const handleOptionClick = (option, idx) => {
    if (feedbackState !== null || locked) return;
    const answer = isJapaneseAnswer ? option.jp : option.cn;
    setLocked(true);

    playSoundEffect(
      answer === question.correctAnswer
        ? SOUND_EFFECT_TYPES.ANSWER_CORRECT
        : SOUND_EFFECT_TYPES.ANSWER_WRONG
    );

    void playSavedJapaneseSpeech(toKanaReading(question.word.jp, question.word.ruby)).catch(() => {});

    const btn = optionRefs.current[idx];
    if (btn) {
      gsap.timeline()
        .to(btn, { scale: 0.88, duration: 0.08, ease: 'power2.in' })
        .to(btn, { scale: 1.04, duration: 0.15, ease: 'back.out(2.5)' })
        .to(btn, { scale: 1, duration: 0.08, onComplete: () => onAnswer(answer) });
      return;
    }

    onAnswer(answer);
  };

  const getOptionClass = (option) => {
    const optionAnswer = isJapaneseAnswer ? option.jp : option.cn;
    let cls = 'word-btn w-full text-center';
    if (!feedbackState) return cls;
    if (optionAnswer === question.correctAnswer) return `${cls} show-correct`;
    if (optionAnswer === selectedAnswer && feedbackState === 'wrong') return `${cls} wrong`;
    return `${cls} dimmed`;
  };

  return (
    <div ref={cardRef} className="flex h-full select-none flex-col">
      <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
        {question.prompt}
      </p>

      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-6 text-center">
          {question.mode === 'cn-to-jp' ? (
            <>
              <p className="mb-2 text-xs font-bold text-[#9CA3AF]">中文释义</p>
              <div className="text-3xl font-black text-[#1E1B4B]">
                {question.word.cn}
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex justify-center">
                <JapaneseSpeechButton
                  text={question.word.jp}
                  spokenText={toKanaReading(question.word.jp, question.word.ruby)}
                  label={`播放「${question.word.jp}」`}
                  autoPlay
                />
              </div>
              <p className="mb-2 text-xs font-bold text-[#9CA3AF]">日本語</p>
              <div className="jp text-3xl font-black leading-loose text-[#1E1B4B]">
                <RubyText text={question.word.jp} rubyMap={question.word.ruby || {}} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3" style={{ transform: 'translateY(-8px)' }}>
        {question.options.map((option, idx) => (
          <button
            key={`${option.jp}-${option.cn}-${idx}`}
            ref={el => { optionRefs.current[idx] = el; }}
            onClick={() => handleOptionClick(option, idx)}
            disabled={feedbackState !== null || locked}
            className={getOptionClass(option)}
          >
            {isJapaneseAnswer ? (
              <span className="jp text-lg font-black leading-loose">
                <RubyText text={option.jp} rubyMap={option.ruby || {}} />
              </span>
            ) : (
              <span className="text-base font-black">{option.cn}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
