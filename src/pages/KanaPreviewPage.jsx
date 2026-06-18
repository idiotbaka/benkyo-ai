import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { getKanaMnemonic } from '../data/kanaMnemonics';
import useKanaPracticeStore from '../store/kanaPracticeStore';
import { createGojuonAudioUrl, getGojuonAudioEntry } from '../lib/gojuon-audio';
import { useIcon } from '../lib/icons';
import { flattenGojuon, normalizeKanaScript } from '../lib/kana-practice';

gsap.registerPlugin(useGSAP);

function SpeakerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function KanaPreviewRow({ item, script, isLoading, isPlaying, onPlay }) {
  const mnemonic = getKanaMnemonic(script, item.kana);
  const active = isLoading || isPlaying;
  const disabled = !getGojuonAudioEntry(item.audioKana);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '72px minmax(0, 1fr) 46px',
        gap: 12,
        alignItems: 'center',
        background: 'white',
        border: `2px solid ${active ? 'var(--tp-bdr)' : '#E7E7E7'}`,
        borderRadius: 18,
        boxShadow: active ? '0 4px 0 var(--tp-bdr)' : '0 4px 0 #E7E7E7',
        padding: '12px 12px 13px',
        transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
      }}
    >
      <div
        style={{
          minHeight: 72,
          borderRadius: 17,
          background: active ? '#F3F2FF' : '#F8FAFC',
          border: `1.5px solid ${active ? '#DDD6FE' : '#E5E7EB'}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <span className="jp" style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color: active ? 'var(--tp-deep)' : '#1E1B4B' }}>
          {item.displayKana}
        </span>
        <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1, color: active ? 'var(--tp)' : '#9CA3AF' }}>
          {item.romaji}
        </span>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, minWidth: 0 }}>
          <span
            style={{
              borderRadius: 999,
              background: '#F3F2FF',
              color: 'var(--tp)',
              fontSize: 11,
              fontWeight: 900,
              padding: '2px 8px',
              whiteSpace: 'nowrap',
            }}
          >
            {item.sectionTitle}
          </span>
          <span className="jp" style={{ color: '#64748B', fontSize: 13, fontWeight: 800, minWidth: 0 }}>
            {item.displayKana} / {item.romaji}
          </span>
        </div>
        {mnemonic ? (
          <p style={{ margin: 0, color: '#4B5563', fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
            {mnemonic}
          </p>
        ) : (
          <p style={{ margin: 0, color: '#9CA3AF', fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
            先熟悉它的写法和读音，进入关卡后会反复练习。
          </p>
        )}
      </div>

      <button
        type="button"
        className="btn-press"
        onClick={onPlay}
        disabled={disabled}
        aria-label={disabled ? `暂无「${item.displayKana}」音频` : `播放「${item.displayKana}」`}
        data-sfx="none"
        style={{
          width: 46,
          height: 46,
          borderRadius: 16,
          border: `2px solid ${active ? 'var(--tp-bdr)' : '#E7E7E7'}`,
          background: 'white',
          color: active ? 'var(--tp)' : '#7C72E0',
          boxShadow: active ? '0 3px 0 var(--tp-bdr)' : '0 3px 0 #E7E7E7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.42 : 1,
          transition: 'border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease',
        }}
      >
        <SpeakerIcon />
      </button>
    </div>
  );
}

export default function KanaPreviewPage() {
  const navigate = useNavigate();
  const { script: routeScript } = useParams();
  const practice = useKanaPracticeStore(s => s.practice);
  const exit = useKanaPracticeStore(s => s.exit);
  const learnImg = useIcon('sd/sd_learn.png');
  const routeScriptNormalized = normalizeKanaScript(routeScript);
  const script = practice?.session?.script ?? routeScriptNormalized;
  const [loadingAudioKey, setLoadingAudioKey] = useState('');
  const [playingAudioKey, setPlayingAudioKey] = useState('');
  const headerRef = useRef(null);
  const listRef = useRef(null);
  const btnRef = useRef(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef('');
  const playSeqRef = useRef(0);

  const allItems = flattenGojuon(script);
  const itemByKana = new Map(allItems.map(item => [item.kana, item]));
  const previewItems = (practice?.session?.newKana ?? [])
    .map(kana => itemByKana.get(kana))
    .filter(Boolean);

  const cleanupAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = '';
    }
  }, []);

  useEffect(() => () => {
    playSeqRef.current += 1;
    cleanupAudio();
  }, [cleanupAudio]);

  useEffect(() => {
    if (!practice) {
      navigate(`/vocab/japanese-intro?tab=${routeScriptNormalized}`, { replace: true });
      return;
    }

    if ((practice.session?.newKana?.length ?? 0) === 0) {
      navigate(`/practice/kana/${script}`, { replace: true });
    }
  }, [navigate, practice, routeScriptNormalized, script]);

  useGSAP(() => {
    gsap.set([headerRef.current, listRef.current, btnRef.current], { opacity: 0, y: 18 });
  });

  useGSAP(() => {
    gsap.to(headerRef.current, { opacity: 1, y: 0, duration: 0.34, ease: 'back.out(1.8)' });
    gsap.to(listRef.current, { opacity: 1, y: 0, duration: 0.34, ease: 'back.out(1.6)', delay: 0.08 });
    gsap.to(btnRef.current, { opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.7)', delay: 0.16 });
  }, []);

  const handlePlayKana = useCallback(async (audioKey) => {
    if (!audioKey || !getGojuonAudioEntry(audioKey)) return;

    if (playingAudioKey === audioKey || loadingAudioKey === audioKey) {
      playSeqRef.current += 1;
      cleanupAudio();
      setPlayingAudioKey('');
      setLoadingAudioKey('');
      return;
    }

    const playSeq = playSeqRef.current + 1;
    playSeqRef.current = playSeq;
    cleanupAudio();
    setPlayingAudioKey('');
    setLoadingAudioKey(audioKey);

    try {
      const url = await createGojuonAudioUrl(audioKey);
      if (playSeqRef.current !== playSeq) {
        URL.revokeObjectURL(url);
        return;
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;

      const finish = () => {
        if (playSeqRef.current !== playSeq) return;
        cleanupAudio();
        setPlayingAudioKey('');
        setLoadingAudioKey('');
      };

      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', finish, { once: true });

      await audio.play();
      if (playSeqRef.current === playSeq) {
        setPlayingAudioKey(audioKey);
        setLoadingAudioKey('');
      }
    } catch {
      if (playSeqRef.current === playSeq) {
        cleanupAudio();
        setPlayingAudioKey('');
        setLoadingAudioKey('');
      }
    }
  }, [cleanupAudio, loadingAudioKey, playingAudioKey]);

  const handleExit = () => {
    cleanupAudio();
    exit();
    navigate(`/vocab/japanese-intro?tab=${script}`);
  };

  const handleEnterPractice = () => {
    cleanupAudio();
    navigate(`/practice/kana/${script}/trace`);
  };

  if (!practice || previewItems.length === 0) return null;

  return (
    <div data-ui-click-sfx className="h-full overflow-y-auto scroll-y" style={{ background: '#F5F3FF' }}>
      <div style={{ minHeight: '100%', padding: '18px 16px calc(104px + env(safe-area-inset-bottom))' }}>
        <div ref={headerRef} style={{ maxWidth: 720, margin: '0 auto 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <button
              type="button"
              className="btn-press"
              onClick={handleExit}
              aria-label="返回假名表"
              style={{
                width: 38,
                height: 38,
                borderRadius: 13,
                border: 'none',
                background: 'white',
                color: 'var(--tp)',
                fontSize: 22,
                fontWeight: 900,
                lineHeight: 1,
                boxShadow: '0 3px 0 #E7E7E7',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ‹
            </button>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, color: '#1E1B4B', fontSize: 24, fontWeight: 900, lineHeight: 1.18 }}>
                本关新假名
              </h1>
              <p style={{ margin: '5px 0 0', color: '#8A8A94', fontSize: 13, fontWeight: 800, lineHeight: 1.45 }}>
                先听一遍、看一遍，再进入关卡练习
              </p>
            </div>
          </div>

          <div
            style={{
              height: 172,
              borderRadius: 24,
              background: 'linear-gradient(180deg, #FFFFFF 0%, #EEF2FF 100%)',
              border: '1.5px solid #E5E7EB',
              boxShadow: '0 8px 24px rgba(91,79,233,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              overflow: 'hidden',
            }}
          >
            <img
              src={learnImg}
              alt=""
              aria-hidden="true"
              width={162}
              height={162}
              className="sd-hop"
              style={{ objectFit: 'contain' }}
            />
          </div>

          <div
            style={{
              borderRadius: 20,
              background: 'linear-gradient(135deg, #FFFFFF, #F8FAFC)',
              border: '1.5px solid #E5E7EB',
              padding: '12px 14px',
              color: '#64748B',
              fontSize: 13,
              fontWeight: 800,
              lineHeight: 1.5,
            }}
          >
            本课会有 {previewItems.length} 个新假名需要学习。它们会在接下来的题目中反复出现，尝试先记忆一下吧~
          </div>
        </div>

        <div ref={listRef} style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 12 }}>
          {previewItems.map(item => (
            <KanaPreviewRow
              key={item.kana}
              item={item}
              script={script}
              isLoading={loadingAudioKey === item.audioKana}
              isPlaying={playingAudioKey === item.audioKana}
              onPlay={() => handlePlayKana(item.audioKana)}
            />
          ))}
        </div>
      </div>

      <div
        ref={btnRef}
        style={{
          position: 'fixed',
          left: 16,
          right: 16,
          bottom: 'calc(24px + env(safe-area-inset-bottom))',
          zIndex: 18,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <button
          type="button"
          className="btn-press"
          onClick={handleEnterPractice}
          style={{
            width: 'min(100%, 720px)',
            height: 58,
            border: 'none',
            borderRadius: 18,
            background: 'linear-gradient(135deg, var(--tp-from), var(--tp))',
            color: 'white',
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 0,
            boxShadow: '0 6px 0 var(--tp-deep), 0 14px 28px color-mix(in srgb, var(--tp) 28%, transparent)',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
        >
          开始跟写
        </button>
      </div>
    </div>
  );
}
