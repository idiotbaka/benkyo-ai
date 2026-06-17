import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { JAPANESE_INTRO_BASICS, getJapaneseIntroMiniQuizzes } from '../data/japaneseIntroBasics';
import { GOJUON_SECTIONS, toKatakanaText } from '../data/gojuonKana';
import { buildKanaPracticeSession, getKanaDisplayProgressColor } from '../lib/kana-practice';
import { createGojuonAudioUrl, getGojuonAudioEntry } from '../lib/gojuon-audio';
import { useIcon } from '../lib/icons';
import useKanaPracticeStore from '../store/kanaPracticeStore';
import useJapaneseIntroProgressStore from '../store/japaneseIntroProgressStore';

gsap.registerPlugin(useGSAP);

const TABS = [
  { id: 'basics', label: '基础知识' },
  { id: 'hiragana', label: '平假名' },
  { id: 'katakana', label: '片假名' },
];

function getTabFromSearch(search) {
  const tab = new URLSearchParams(search).get('tab');
  return TABS.some(item => item.id === tab) ? tab : 'basics';
}

export default function JapaneseIntroPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const cakeImg = useIcon('sd/sd_cake.png');
  const activeTab = getTabFromSearch(location.search);
  const headerRef = useRef(null);
  const contentRef = useRef(null);

  useGSAP(() => {
    gsap.set([headerRef.current, contentRef.current], { opacity: 0, y: 18 });
  });

  useGSAP(() => {
    gsap.to(headerRef.current, { opacity: 1, y: 0, duration: 0.38, ease: 'back.out(2)' });
    gsap.to(contentRef.current, { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.7)', delay: 0.08 });
  }, []);

  const handleTabChange = useCallback((tabId) => {
    navigate(tabId === 'basics' ? '/vocab/japanese-intro' : `/vocab/japanese-intro?tab=${tabId}`, { replace: true });
  }, [navigate]);

  const handleStartKanaPractice = useCallback((script) => {
    const progressState = useJapaneseIntroProgressStore.getState();
    const session = buildKanaPracticeSession(script, progressState);
    const started = useKanaPracticeStore.getState().start(session);
    if (!started) return;
    navigate(session.newKana?.length > 0 ? `/practice/kana/${script}/preview` : `/practice/kana/${script}`);
  }, [navigate]);

  return (
    <div data-ui-click-sfx className="h-full overflow-y-auto scroll-y" style={{ background: '#F5F3FF' }}>
      <div
        ref={headerRef}
        style={{
          background: 'white',
          padding: '14px 20px 12px',
          boxShadow: '0 2px 12px rgba(91,79,233,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button
            type="button"
            className="btn-press"
            onClick={() => navigate('/vocab')}
            aria-label="返回练习中心"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: 'none',
              background: '#F3F2FF',
              color: 'var(--tp)',
              fontSize: 22,
              fontWeight: 900,
              lineHeight: 1,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ‹
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <img src={cakeImg} alt="" width={30} height={30} style={{ objectFit: 'contain' }} />
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B', margin: 0 }}>日语入门</h1>
          </div>
          <div
            style={{
              background: 'var(--tp-lite)',
              color: 'var(--tp)',
              fontSize: 12,
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: 20,
              flexShrink: 0,
            }}
          >
            入门
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className="btn-press"
                onClick={() => handleTabChange(tab.id)}
                style={{
                  height: 34,
                  borderRadius: 999,
                  border: 'none',
                  background: active ? 'var(--tp)' : '#F3F2FF',
                  color: active ? 'white' : '#7C72E0',
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={contentRef} style={{ padding: `16px 16px ${activeTab === 'basics' ? 28 : 132}px` }}>
        {activeTab === 'basics' ? (
          <BasicsList onOpenTopic={(topicId) => navigate(`/vocab/japanese-intro/basic/${topicId}`)} />
        ) : (
          <KanaStudyPanel script={activeTab} />
        )}
      </div>
      {activeTab !== 'basics' && <StartStudyButton onStart={() => handleStartKanaPractice(activeTab)} />}
    </div>
  );
}

function BasicsList({ onOpenTopic }) {
  const quizResults = useJapaneseIntroProgressStore(s => s.quizResults);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {JAPANESE_INTRO_BASICS.map((topic, index) => {
        const quizzes = getJapaneseIntroMiniQuizzes(topic.id);
        const isComplete = quizzes.length > 0 && quizzes.every(quiz => quizResults?.[topic.id]?.[quiz.id]?.correct);

        return (
          <button
            key={topic.id}
            type="button"
            className="btn-press"
            onClick={() => onOpenTopic(topic.id)}
            style={{
              width: '100%',
              border: `2px solid ${isComplete ? '#BBF7D0' : '#E5E7EB'}`,
              borderRadius: 14,
              background: isComplete ? 'linear-gradient(135deg, #FFFFFF, #F0FDF4)' : 'white',
              boxShadow: `0 3px 0 ${isComplete ? '#BBF7D0' : '#E5E7EB'}`,
              padding: '14px 14px 15px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'grid',
              gap: 9,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 900, marginBottom: 4 }}>
                  第 {String(index + 1).padStart(2, '0')} 讲
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 900, color: '#1E1B4B', margin: 0, lineHeight: 1.3 }}>
                  {topic.title}
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                {isComplete && (
                  <span
                    style={{
                      border: '1.5px solid #86EFAC',
                      borderRadius: 999,
                      padding: '3px 9px',
                      fontSize: 11,
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                      background: '#DCFCE7',
                      color: '#15803D',
                      boxShadow: '0 2px 0 #BBF7D0',
                    }}
                  >
                    已完成
                  </span>
                )}
                <span
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: isComplete ? '#DCFCE7' : '#F3F2FF',
                    color: isComplete ? '#15803D' : 'var(--tp)',
                    fontSize: 18,
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ›
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.55, margin: 0, fontWeight: 600 }}>
              {topic.summary}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {topic.keywords.map(keyword => (
                <span
                  key={keyword}
                  style={{
                    borderRadius: 999,
                    background: '#F8FAFC',
                    border: '1px solid #E5E7EB',
                    color: '#64748B',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                  }}
                >
                  {keyword}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function KanaStudyPanel({ script }) {
  useJapaneseIntroProgressStore(s => s.kanaProgress?.[script]);
  const getKanaDisplayProgress = useJapaneseIntroProgressStore(s => s.getKanaDisplayProgress);
  const [loadingAudioKey, setLoadingAudioKey] = useState('');
  const [playingAudioKey, setPlayingAudioKey] = useState('');
  const audioRef = useRef(null);
  const audioUrlRef = useRef('');
  const playSeqRef = useRef(0);

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

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 18 }}>
      {GOJUON_SECTIONS.map(section => (
        <KanaSection
          key={section.id}
          section={section}
          script={script}
          loadingAudioKey={loadingAudioKey}
          playingAudioKey={playingAudioKey}
          getKanaDisplayProgress={getKanaDisplayProgress}
          onPlayKana={handlePlayKana}
        />
      ))}
    </div>
  );
}

function KanaSection({ section, script, loadingAudioKey, playingAudioKey, getKanaDisplayProgress, onPlayKana }) {
  return (
    <section
      style={{
        background: 'white',
        borderTop: '1.5px solid #E5E7EB',
        borderBottom: '1.5px solid #E5E7EB',
        marginInline: -16,
        padding: '22px 16px 24px',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h3 style={{ color: '#2F2F35', fontSize: 22, fontWeight: 900, lineHeight: 1.25, margin: '0 0 8px' }}>
          {section.title}
        </h3>
        <p style={{ color: '#8A8A94', fontSize: 15, lineHeight: 1.5, fontWeight: 700, margin: '0 0 18px' }}>
          {section.subtitle}
        </p>

        {section.rowLayout ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {section.rows.map((row, rowIndex) => (
              <div
                key={`${section.id}-${rowIndex}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))`,
                  gap: 9,
                }}
              >
                {row.map((item, index) => item ? (
                  <KanaCard
                    key={item.kana}
                    item={item}
                    script={script}
                    columns={section.columns}
                    style={{ gridColumn: `${index + 1}` }}
                    isLoading={loadingAudioKey === item.kana}
                    isPlaying={playingAudioKey === item.kana}
                    progressPct={getKanaDisplayProgress(script, item.kana)}
                    onPlay={() => onPlayKana(item.kana)}
                  />
                ) : null)}
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))`,
              gap: section.columns === 3 ? 12 : 9,
            }}
          >
            {section.rows.flat().map(item => (
              <KanaCard
                key={item.kana}
                item={item}
                script={script}
                columns={section.columns}
                isLoading={loadingAudioKey === item.kana}
                isPlaying={playingAudioKey === item.kana}
                progressPct={getKanaDisplayProgress(script, item.kana)}
                onPlay={() => onPlayKana(item.kana)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function KanaCard({ item, script, columns, isLoading, isPlaying, progressPct = 0, onPlay, style }) {
  const displayKana = script === 'katakana' ? toKatakanaText(item.kana) : item.kana;
  const disabled = !getGojuonAudioEntry(item.kana);
  const isWide = columns === 3;
  const active = isLoading || isPlaying;
  const normalizedProgress = Math.max(0, Math.min(100, Math.round(progressPct)));
  const progressColor = getKanaDisplayProgressColor(normalizedProgress);
  const showProgress = normalizedProgress < 100;
  const isComplete = normalizedProgress >= 100;
  const borderColor = active ? 'var(--tp-bdr)' : isComplete ? '#BBF7D0' : '#E7E7E7';
  const shadowColor = active ? 'var(--tp-bdr)' : isComplete ? '#BBF7D0' : '#E7E7E7';

  return (
    <button
      type="button"
      className="btn-press"
      onClick={onPlay}
      disabled={disabled}
      aria-label={disabled ? `暂无「${displayKana}」音频` : `播放「${displayKana}」`}
      aria-description={`学习进度 ${normalizedProgress}%`}
      style={{
        ...style,
        background: !active && isComplete ? 'linear-gradient(135deg, #FFFFFF, #F0FDF4)' : 'white',
        border: `2px solid ${borderColor}`,
        borderRadius: isWide ? 18 : 17,
        boxShadow: `0 4px 0 ${shadowColor}`,
        minHeight: isWide ? 90 : 96,
        padding: isWide ? '13px 11px 12px' : '10px 8px 11px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.42 : 1,
        transform: active ? 'translateY(-1px)' : undefined,
        transition: 'border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, transform 0.16s ease',
      }}
    >
      <span
        className="jp"
        style={{
          color: active ? 'var(--tp-deep)' : '#34343A',
          fontSize: isWide ? 26 : 27,
          fontWeight: 800,
          lineHeight: 1.12,
          letterSpacing: 0,
          minHeight: 31,
        }}
      >
        {displayKana}
      </span>
      <span
        style={{
          color: active ? 'var(--tp)' : '#A3A3A3',
          fontSize: isWide ? 18 : 17,
          fontWeight: 800,
          lineHeight: 1,
          minHeight: 19,
        }}
      >
        {item.romaji}
      </span>
      <span
        aria-hidden="true"
        style={{
          width: '82%',
          height: isWide ? 8 : 7,
          borderRadius: 999,
          background: '#E8E8E8',
          overflow: 'hidden',
          display: 'block',
          marginTop: 4,
          visibility: showProgress ? 'visible' : 'hidden',
        }}
      >
        <span
          style={{
            display: 'block',
            width: `${normalizedProgress}%`,
            height: '100%',
            borderRadius: 999,
            background: progressColor,
            transition: 'width 0.26s ease, background-color 0.26s ease',
          }}
        />
      </span>
    </button>
  );
}

function StartStudyButton({ onStart }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'calc(130px + env(safe-area-inset-bottom))',
        zIndex: 18,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        className="btn-press japanese-intro-start-button"
        onClick={onStart}
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
          position: 'relative',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
      >
        <span className="japanese-intro-start-button__shine" aria-hidden="true" />
        <span style={{ position: 'relative', zIndex: 1 }}>开始学习～♥</span>
      </button>
    </div>
  );
}
