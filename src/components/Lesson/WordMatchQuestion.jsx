import { useState, useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import RubyText from '../UI/RubyText';
import { playSavedJapaneseSpeech } from '../../lib/japanese-speech-player';
import { toKanaReading } from '../../lib/japanese-text';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';

gsap.registerPlugin(useGSAP);

export default function WordMatchQuestion({ question, onComplete, onWrongMatch, onPairMatched }) {
  const { pairs, prompt } = question;

  // Shuffle both columns once on mount (component is re-keyed per question)
  const [leftOrder] = useState(() => {
    const arr = pairs.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  const [rightOrder] = useState(() => {
    const arr = pairs.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  const [leftSelected, setLeftSelected]   = useState(null); // pair index
  const [rightSelected, setRightSelected] = useState(null); // right column position
  const [matched, setMatched]             = useState(new Set());
  const [locked, setLocked]               = useState(false);

  const cardRef  = useRef(null);
  const leftRefs = useRef([]);   // ref per pair index
  const rightRefs = useRef([]);  // ref per right column position

  // ── FOUC prevention ──────────────────────────────────
  useGSAP(() => {
    gsap.set(cardRef.current, { opacity: 0 });
  });

  // ── Card entrance ─────────────────────────────────────
  useGSAP(() => {
    gsap.fromTo(
      cardRef.current,
      { y: 30, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.5)' }
    );
  }, { dependencies: [question.id] });

  // ── Completion detection ──────────────────────────────
  useEffect(() => {
    if (matched.size === pairs.length && pairs.length > 0) {
      const timer = setTimeout(() => onComplete(), 350);
      return () => clearTimeout(timer);
    }
  }, [matched.size, pairs.length, onComplete]);

  // ── Match logic ───────────────────────────────────────
  const attemptMatch = (pairIdx, rightColPos) => {
    setLocked(true);
    const isCorrect = pairIdx === rightOrder[rightColPos];
    const leftEl  = leftRefs.current[pairIdx];
    const rightEl = rightRefs.current[rightColPos];
    gsap.killTweensOf([leftEl, rightEl]);

    if (isCorrect) {
      playSoundEffect(SOUND_EFFECT_TYPES.ANSWER_CORRECT);
      onPairMatched?.(); // award 1 coin immediately
      gsap.timeline()
        .to([leftEl, rightEl], {
          scale: 1.08,
          borderColor: '#86EFAC',
          backgroundColor: '#F0FDF4',
          color: '#15803D',
          duration: 0.12,
          ease: 'power2.out',
        })
        .to([leftEl, rightEl], {
          scale: 0,
          opacity: 0,
          y: -12,
          duration: 0.28,
          ease: 'back.in(1.5)',
          onComplete: () => {
            setMatched(prev => {
              const s = new Set(prev);
              s.add(pairIdx);
              return s;
            });
            setLeftSelected(null);
            setRightSelected(null);
            setLocked(false);
          },
        });
    } else {
      playSoundEffect(SOUND_EFFECT_TYPES.ANSWER_WRONG);
      gsap.timeline()
        .to([leftEl, rightEl], {
          borderColor: '#FCA5A5',
          backgroundColor: '#FFF1F2',
          color: '#B91C1C',
          duration: 0.08,
        })
        .to([leftEl, rightEl], { x: -9, duration: 0.07 })
        .to([leftEl, rightEl], { x: 9,  duration: 0.07 })
        .to([leftEl, rightEl], { x: -7, duration: 0.06 })
        .to([leftEl, rightEl], { x: 7,  duration: 0.06 })
        .to([leftEl, rightEl], { x: 0,  duration: 0.05 })
        .to([leftEl, rightEl], {
          borderColor: 'var(--tp-bdr)',
          backgroundColor: 'white',
          color: '#1E1B4B',
          duration: 0.22,
          onComplete: () => {
            setLocked(false);
            setLeftSelected(null);
            setRightSelected(null);
            onWrongMatch();
          },
        });
    }
  };

  // ── Click handlers ────────────────────────────────────
  const handleLeftClick = (pairIdx) => {
    if (locked || matched.has(pairIdx)) return;
    playSoundEffect(SOUND_EFFECT_TYPES.WORD_SELECTED);
    void playSavedJapaneseSpeech(toKanaReading(pairs[pairIdx].jp, pairs[pairIdx].ruby)).catch(() => {});
    if (leftSelected === pairIdx) {
      setLeftSelected(null);
      return;
    }
    setLeftSelected(pairIdx);
    if (rightSelected !== null) {
      attemptMatch(pairIdx, rightSelected);
    }
  };

  const handleRightClick = (rightColPos) => {
    const pairIdx = rightOrder[rightColPos];
    if (locked || matched.has(pairIdx)) return;
    playSoundEffect(SOUND_EFFECT_TYPES.WORD_SELECTED);
    if (rightSelected === rightColPos) {
      setRightSelected(null);
      return;
    }
    setRightSelected(rightColPos);
    if (leftSelected !== null) {
      attemptMatch(leftSelected, rightColPos);
    }
  };

  // ── Class helpers ─────────────────────────────────────
  const leftClass = (pairIdx) =>
    'match-card w-full' + (leftSelected === pairIdx ? ' match-card--selected' : '');

  const rightClass = (rightColPos) =>
    'match-card w-full' + (rightSelected === rightColPos ? ' match-card--selected' : '');

  return (
    <div ref={cardRef} className="flex h-full flex-col px-2 pb-2 select-none">

      {/* Prompt */}
      <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest mb-4">
        {prompt}
      </p>

      {/* Card group — vertically centered in remaining space */}
      <div className="flex-1 flex flex-col justify-center gap-3">

        {/* Column headers */}
        <div className="flex gap-8 px-1">
          <div className="flex-1 text-center">
            <span className="text-[0.65rem] font-bold tracking-widest text-[var(--tp-from)] uppercase">日本語</span>
          </div>
          <div className="flex-1 text-center">
            <span className="text-[0.65rem] font-bold tracking-widest text-[var(--tp-from)] uppercase">中文</span>
          </div>
        </div>

        {/* Match grid */}
        <div className="flex gap-8">

          {/* Left — Japanese words */}
          <div className="flex-1 flex flex-col gap-3">
            {leftOrder.map((pairIdx) => (
              <button
                key={pairIdx}
                ref={el => { leftRefs.current[pairIdx] = el; }}
                onClick={() => handleLeftClick(pairIdx)}
                disabled={locked || matched.has(pairIdx)}
                className={leftClass(pairIdx)}
              >
                <span className="jp font-bold text-base">
                  <RubyText text={pairs[pairIdx].jp} rubyMap={pairs[pairIdx].ruby || {}} />
                </span>
              </button>
            ))}
          </div>

          {/* Right — Chinese translations */}
          <div className="flex-1 flex flex-col gap-3">
            {rightOrder.map((pairIdx, rightColPos) => (
              <button
                key={rightColPos}
                ref={el => { rightRefs.current[rightColPos] = el; }}
                onClick={() => handleRightClick(rightColPos)}
                disabled={locked || matched.has(pairIdx)}
                className={rightClass(rightColPos)}
              >
                <span className="font-semibold text-sm">{pairs[pairIdx].cn}</span>
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
