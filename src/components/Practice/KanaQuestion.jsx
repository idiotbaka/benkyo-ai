import { useCallback, useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { createGojuonAudioUrl, getGojuonAudioEntry } from '../../lib/gojuon-audio';

gsap.registerPlugin(useGSAP);

function SpeakerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9.5v5h3.4L12 18V6L7.4 9.5H4Z" fill="currentColor" />
      <path
        d="M15.2 8.7a4.7 4.7 0 0 1 0 6.6M17.8 6a8.4 8.4 0 0 1 0 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function KanaQuestion({ question, onAnswer, feedbackState, selectedAnswer }) {
  const cardRef = useRef(null);
  const optionRefs = useRef([]);
  const audioRef = useRef(null);
  const audioUrlRef = useRef('');
  const playSeqRef = useRef(0);
  const [locked, setLocked] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioKana = question.audioKana;
  const audioButtonStyle = {
    background: 'white',
    border: `2px solid ${isPlayingAudio ? 'var(--tp-bdr)' : '#E7E7E7'}`,
    color: isPlayingAudio ? 'var(--tp)' : '#7C72E0',
    boxShadow: isPlayingAudio ? '0 4px 0 var(--tp-bdr)' : '0 4px 0 #E7E7E7',
    transform: isPlayingAudio ? 'translateY(-1px)' : undefined,
    transition: 'border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease, transform 0.16s ease',
  };

  const cleanupAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = '';
    }
  }, []);

  const playAudio = useCallback(async () => {
    if (!audioKana || !getGojuonAudioEntry(audioKana)) return;
    const releaseAudio = () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = '';
      }
    };

    const playSeq = playSeqRef.current + 1;
    playSeqRef.current = playSeq;
    releaseAudio();
    setIsPlayingAudio(true);

    try {
      const url = await createGojuonAudioUrl(audioKana);
      if (playSeqRef.current !== playSeq) {
        URL.revokeObjectURL(url);
        return;
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;

      const finish = () => {
        if (playSeqRef.current !== playSeq) return;
        releaseAudio();
        setIsPlayingAudio(false);
      };

      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', finish, { once: true });
      await audio.play();
    } catch {
      if (playSeqRef.current === playSeq) {
        releaseAudio();
        setIsPlayingAudio(false);
      }
    }
  }, [audioKana]);

  useEffect(() => () => {
    playSeqRef.current += 1;
    cleanupAudio();
  }, [cleanupAudio]);

  useEffect(() => {
    if (!question?.autoPlayAudio) return undefined;
    const timer = setTimeout(() => {
      void playAudio();
    }, 260);
    return () => clearTimeout(timer);
  }, [playAudio, question?.autoPlayAudio, question?.id]);

  useEffect(() => {
    if (feedbackState !== 'wrong') return undefined;
    const timer = setTimeout(() => {
      void playAudio();
    }, 180);
    return () => clearTimeout(timer);
  }, [feedbackState, playAudio]);

  useGSAP(() => {
    gsap.set(cardRef.current, { opacity: 0 });
  });

  useGSAP(() => {
    gsap.fromTo(
      cardRef.current,
      { y: 24, opacity: 0, scale: 0.96 },
      { y: 0, opacity: 1, scale: 1, duration: 0.36, ease: 'back.out(1.5)' },
    );
  }, { dependencies: [question.id] });

  const handleOptionClick = (option, idx) => {
    if (feedbackState !== null || locked) return;
    setLocked(true);

    const btn = optionRefs.current[idx];
    if (btn) {
      gsap.timeline()
        .to(btn, { scale: 0.9, duration: 0.08, ease: 'power2.in' })
        .to(btn, { scale: 1.04, duration: 0.14, ease: 'back.out(2.3)' })
        .to(btn, { scale: 1, duration: 0.08, onComplete: () => onAnswer(option.value) });
      return;
    }

    onAnswer(option.value);
  };

  const getOptionClass = (option) => {
    let cls = 'word-btn flex min-h-[72px] w-full items-center justify-center text-center';
    if (!feedbackState) return cls;
    if (option.value === question.correctAnswer) return `${cls} show-correct`;
    if (option.value === selectedAnswer && feedbackState === 'wrong') return `${cls} wrong`;
    return `${cls} dimmed`;
  };

  const hasAudio = Boolean(question?.audioKana && getGojuonAudioEntry(question.audioKana));

  return (
    <div ref={cardRef} className="flex h-full select-none flex-col">
      <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
        {question.prompt}
      </p>

      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-7 text-center">
          {question.type === 'kana-audio-to-kana' ? (
            <>
              <p className="mb-4 text-xs font-bold text-[#9CA3AF]">日本語の音</p>
              <button
                type="button"
                className="btn-press mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] border-0 text-white"
                onClick={() => void playAudio()}
                disabled={!hasAudio}
                aria-label="重播假名读音"
                data-sfx="none"
                style={{
                  ...audioButtonStyle,
                  opacity: hasAudio ? 1 : 0.45,
                  cursor: hasAudio ? 'pointer' : 'not-allowed',
                }}
              >
                <SpeakerIcon />
              </button>
            </>
          ) : question.type === 'kana-to-romaji' ? (
            <>
              <div className="mb-3 flex justify-center">
                <button
                  type="button"
                  className="btn-press flex h-10 w-10 items-center justify-center rounded-full"
                  onClick={() => void playAudio()}
                  disabled={!hasAudio}
                  aria-label={`播放「${question.displayKana}」`}
                  data-sfx="none"
                  style={audioButtonStyle}
                >
                  <SpeakerIcon />
                </button>
              </div>
              <p className="mb-2 text-xs font-bold text-[#9CA3AF]">假名</p>
              <div className="jp text-[72px] font-black leading-none text-[#1E1B4B]">
                {question.displayKana}
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex justify-center">
                <button
                  type="button"
                  className="btn-press flex h-10 w-10 items-center justify-center rounded-full"
                  onClick={() => void playAudio()}
                  disabled={!hasAudio}
                  aria-label={`播放「${question.romaji}」`}
                  data-sfx="none"
                  style={audioButtonStyle}
                >
                  <SpeakerIcon />
                </button>
              </div>
              <p className="mb-2 text-xs font-bold text-[#9CA3AF]">读音</p>
              <div className="text-[48px] font-black leading-none text-[#1E1B4B]">
                {question.romaji}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3" style={{ transform: 'translateY(-8px)' }}>
        {question.options.map((option, idx) => (
          <button
            key={`${question.id}-${option.value}-${idx}`}
            ref={el => { optionRefs.current[idx] = el; }}
            type="button"
            onClick={() => handleOptionClick(option, idx)}
            disabled={feedbackState !== null || locked}
            className={getOptionClass(option)}
          >
            <span className={question.optionMode === 'kana' ? 'jp text-3xl font-black leading-none' : 'text-xl font-black'}>
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
