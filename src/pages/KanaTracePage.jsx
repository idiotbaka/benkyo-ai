import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import useKanaPracticeStore from '../store/kanaPracticeStore';
import { createGojuonAudioUrl, getGojuonAudioEntry } from '../lib/gojuon-audio';
import { flattenGojuon, normalizeKanaScript } from '../lib/kana-practice';
import {
  getKanaTraceGlyphs,
  loadKanaTraceData,
  pointsToSvgPath,
  sampleSvgPath,
  scoreTraceStroke,
} from '../lib/kana-trace';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../lib/sound-effects';

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

function getSvgPoint(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;

  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

function getStrokeStartPoint(stroke) {
  const d = stroke?.d ?? '';
  const match = d.match(/M\s*(-?\d+(?:\.\d+)?),?\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const start = {
    x: Number(match[1]),
    y: Number(match[2]),
  };
  return Number.isFinite(start.x) && Number.isFinite(start.y) ? start : null;
}

function getGlyphLayout(index, count) {
  if (count <= 1) {
    return {
      transform: '',
      strokeWidth: 6.6,
      guideStrokeWidth: 1.6,
      guideDash: '2 3',
      startRadius: 2,
    };
  }

  const scale = 0.63;
  const y = (109 - 109 * scale) / 2;
  const x = index === 0 ? -4 : 44;

  return {
    transform: `translate(${x} ${y}) scale(${scale})`,
    strokeWidth: 7.2,
    guideStrokeWidth: 2,
    guideDash: '2.4 3.2',
    startRadius: 2.4,
  };
}

function sampleRenderedSvgPath(pathElement, svgElement, count = 64) {
  const points = sampleSvgPath(pathElement, count);
  const pathMatrix = pathElement?.getScreenCTM?.();
  const svgMatrix = svgElement?.getScreenCTM?.();
  if (!pathMatrix || !svgMatrix) return points;

  const inverseSvgMatrix = svgMatrix.inverse();
  return points.map((point) => {
    const svgPoint = svgElement.createSVGPoint();
    svgPoint.x = point.x;
    svgPoint.y = point.y;
    const screenPoint = svgPoint.matrixTransform(pathMatrix);
    const localPoint = screenPoint.matrixTransform(inverseSvgMatrix);
    return { x: localPoint.x, y: localPoint.y };
  });
}

function TraceGlyphBoard({
  glyphs,
  activeComponentIndex,
  completedCounts,
  onStrokeAccepted,
  onStrokeRejected,
}) {
  const svgRef = useRef(null);
  const pathRefs = useRef([]);
  const pointerIdRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const activeGlyph = activeComponentIndex >= 0 ? glyphs[activeComponentIndex] : null;
  const activeCompletedCount = activeComponentIndex >= 0 ? completedCounts[activeComponentIndex] ?? 0 : 0;
  const activeStroke = activeGlyph?.strokes?.[activeCompletedCount] ?? null;
  const isComplete = glyphs.every((glyph, index) => (completedCounts[index] ?? 0) >= glyph.strokes.length);
  const isActive = Boolean(activeStroke);
  const userStrokeWidth = glyphs.length > 1 ? 4.4 : 6.2;
  const currentUserPath = pointsToSvgPath(points);
  const strokeStartPoint = isActive ? getStrokeStartPoint(activeStroke) : null;

  const appendPoint = useCallback((event) => {
    const svg = svgRef.current;
    if (!svg) return;

    const point = getSvgPoint(svg, event);
    if (!point) return;

    setPoints((current) => {
      const previous = current[current.length - 1];
      if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 0.45) return current;
      return [...current, point];
    });
  }, []);

  const handlePointerDown = useCallback((event) => {
    if (!isActive || !activeStroke || isComplete) return;

    event.preventDefault();
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrawing(true);
    setPoints([]);
    appendPoint(event);
  }, [activeStroke, appendPoint, isActive, isComplete]);

  const handlePointerMove = useCallback((event) => {
    if (!drawing || pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    appendPoint(event);
  }, [appendPoint, drawing]);

  const finishStroke = useCallback((event) => {
    if (!drawing || pointerIdRef.current !== event.pointerId) return;
    event.preventDefault();

    const svgElement = svgRef.current;
    const pathElement = pathRefs.current[activeComponentIndex]?.[activeCompletedCount];
    const targetPoints = sampleRenderedSvgPath(pathElement, svgElement, 64);
    const result = scoreTraceStroke(points, targetPoints);

    pointerIdRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDrawing(false);
    setPoints([]);

    if (result.passed) {
      onStrokeAccepted(activeComponentIndex);
    } else {
      onStrokeRejected();
    }
  }, [activeCompletedCount, activeComponentIndex, drawing, onStrokeAccepted, onStrokeRejected, points]);

  const cancelStroke = useCallback((event) => {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDrawing(false);
    setPoints([]);
  }, []);

  return (
    <div
      style={{
        minWidth: 0,
        borderRadius: 24,
        background: isActive ? '#FFFFFF' : '#F8FAFC',
        border: `2px solid ${isActive ? 'var(--tp-bdr)' : '#E5E7EB'}`,
        boxShadow: isActive ? '0 6px 0 var(--tp-bdr)' : '0 5px 0 #E5E7EB',
        padding: 8,
        transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
      }}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 109 109"
        role="img"
        aria-label={`${glyphs.map(glyph => glyph.char).join('')} 跟写区`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={cancelStroke}
        style={{
          display: 'block',
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 18,
          background: '#FFFFFF',
          touchAction: 'none',
          userSelect: 'none',
          cursor: isActive && !isComplete ? 'crosshair' : 'default',
        }}
      >
        <line x1="0" y1="54.5" x2="109" y2="54.5" stroke="#E5E7EB" strokeWidth="0.9" strokeDasharray="2.4 2.4" />
        <line x1="54.5" y1="0" x2="54.5" y2="109" stroke="#E5E7EB" strokeWidth="0.9" strokeDasharray="2.4 2.4" />

        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {glyphs.map((glyph, glyphIndex) => {
            const layout = getGlyphLayout(glyphIndex, glyphs.length);
            const completedCount = completedCounts[glyphIndex] ?? 0;
            const glyphActiveStroke = glyphIndex === activeComponentIndex ? activeStroke : null;
            const glyphStrokeStartPoint = glyphIndex === activeComponentIndex ? strokeStartPoint : null;

            return (
              <g key={`${glyph.char}-${glyphIndex}`} transform={layout.transform}>
                {glyph.strokes.map((stroke, strokeIndex) => (
                  <path
                    key={stroke.id}
                    ref={(node) => {
                      if (!pathRefs.current[glyphIndex]) pathRefs.current[glyphIndex] = [];
                      pathRefs.current[glyphIndex][strokeIndex] = node;
                    }}
                    d={stroke.d}
                    stroke={strokeIndex < completedCount ? '#111827' : '#E4E4E7'}
                    strokeWidth={layout.strokeWidth}
                    opacity={strokeIndex < completedCount ? 1 : 0.78}
                  />
                ))}

                {glyphActiveStroke && (
                  <path
                    d={glyphActiveStroke.d}
                    stroke="var(--tp)"
                    strokeWidth={layout.guideStrokeWidth}
                    strokeDasharray={layout.guideDash}
                    opacity="0.6"
                  />
                )}

                {glyphStrokeStartPoint && (
                  <circle
                    cx={glyphStrokeStartPoint.x}
                    cy={glyphStrokeStartPoint.y}
                    r={layout.startRadius}
                    opacity="0.8"
                    fill="var(--tp)"
                  />
                )}
              </g>
            );
          })}

          {currentUserPath && (
            <path
              d={currentUserPath}
              stroke="var(--tp)"
              strokeWidth={userStrokeWidth}
              opacity="0.9"
            />
          )}
        </g>
      </svg>
    </div>
  );
}

function buildTraceItems(traceData, script, newKana) {
  const items = flattenGojuon(script);
  const itemByKana = new Map(items.map(item => [item.kana, item]));
  const itemByDisplayKana = new Map(items.map(item => [item.displayKana, item]));

  return (newKana ?? [])
    .map((kana) => {
      const item = itemByKana.get(kana) ?? itemByDisplayKana.get(kana);
      if (!item) return null;

      const glyphs = getKanaTraceGlyphs(traceData, script, item.displayKana);
      if (glyphs.length === 0) return null;

      return {
        kana: item.kana,
        displayKana: item.displayKana,
        romaji: item.romaji,
        audioKana: item.audioKana,
        sectionTitle: item.sectionTitle,
        glyphs,
      };
    })
    .filter(Boolean);
}

export default function KanaTracePage() {
  const navigate = useNavigate();
  const { script: routeScript } = useParams();
  const [searchParams] = useSearchParams();
  const reviewKana = searchParams.get('kana') || '';
  const isReviewMode = Boolean(reviewKana);
  const practice = useKanaPracticeStore(s => s.practice);
  const exit = useKanaPracticeStore(s => s.exit);
  const routeScriptNormalized = normalizeKanaScript(routeScript);
  const script = isReviewMode ? routeScriptNormalized : practice?.session?.script ?? routeScriptNormalized;
  const [traceData, setTraceData] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [traceProgress, setTraceProgress] = useState({ key: '', values: [] });
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [loadingAudioKey, setLoadingAudioKey] = useState('');
  const [playingAudioKey, setPlayingAudioKey] = useState('');
  const audioRef = useRef(null);
  const audioUrlRef = useRef('');
  const playSeqRef = useRef(0);
  const feedbackTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadKanaTraceData()
      .then((data) => {
        if (!cancelled) setTraceData(data);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => { cancelled = true; };
  }, []);

  const cleanupAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = '';
    }
  }, []);

  const traceItems = useMemo(() => (
    traceData && (isReviewMode || practice)
      ? buildTraceItems(traceData, script, isReviewMode ? [reviewKana] : practice.session?.newKana)
      : []
  ), [isReviewMode, practice, reviewKana, script, traceData]);
  const currentItem = traceItems[currentIndex] ?? null;
  const currentItemKey = currentItem?.displayKana ?? '';
  const strokeProgress = useMemo(() => {
    if (!currentItem) return [];
    if (traceProgress.key === currentItemKey && traceProgress.values.length === currentItem.glyphs.length) {
      return traceProgress.values;
    }
    return currentItem.glyphs.map(() => 0);
  }, [currentItem, currentItemKey, traceProgress]);
  const activeComponentIndex = currentItem
    ? strokeProgress.findIndex((count, index) => count < currentItem.glyphs[index].strokes.length)
    : -1;
  const isKanaComplete = Boolean(currentItem) && activeComponentIndex === -1;
  const activeStrokeNumber = activeComponentIndex >= 0 ? strokeProgress[activeComponentIndex] + 1 : 0;
  const activeStrokeTotal = activeComponentIndex >= 0 ? currentItem.glyphs[activeComponentIndex].strokes.length : 0;
  const audioDisabled = !currentItem || !getGojuonAudioEntry(currentItem.audioKana);
  const audioActive = currentItem && (loadingAudioKey === currentItem.audioKana || playingAudioKey === currentItem.audioKana);

  useEffect(() => () => {
    playSeqRef.current += 1;
    cleanupAudio();
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, [cleanupAudio]);

  useEffect(() => {
    if (isKanaComplete) {
      playSoundEffect(SOUND_EFFECT_TYPES.ANSWER_CORRECT);
    }
  }, [isKanaComplete, currentItemKey]);

  useEffect(() => {
    if (isReviewMode) return;

    if (!practice) {
      navigate(`/vocab/japanese-intro?tab=${normalizeKanaScript(routeScript)}`, { replace: true });
      return;
    }

    if ((practice.session?.newKana?.length ?? 0) === 0) {
      navigate(`/practice/kana/${script}`, { replace: true });
    }
  }, [isReviewMode, navigate, practice, routeScript, script]);

  useEffect(() => {
    if (!(traceData || loadFailed)) return;

    if (isReviewMode && traceItems.length === 0) {
      navigate(`/vocab/japanese-intro?tab=${script}`, { replace: true });
      return;
    }

    if (!isReviewMode && practice && traceItems.length === 0) {
      navigate(`/practice/kana/${script}`, { replace: true });
    }
  }, [isReviewMode, loadFailed, navigate, practice, script, traceData, traceItems.length]);

  const showRetryMessage = useCallback(() => {
    setFeedbackMessage('再试一次吧~');
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackMessage('');
    }, 1100);
  }, []);

  const handleStrokeAccepted = useCallback((componentIndex) => {
    setTraceProgress((current) => {
      const base = current.key === currentItemKey && current.values.length === currentItem.glyphs.length
        ? current.values
        : currentItem.glyphs.map(() => 0);
      const next = [...base];
      const glyph = currentItem?.glyphs?.[componentIndex];
      next[componentIndex] = Math.min((next[componentIndex] ?? 0) + 1, glyph?.strokes?.length ?? 0);
      return { key: currentItemKey, values: next };
    });
    setFeedbackMessage('');
  }, [currentItem, currentItemKey]);

  const handleStrokeRejected = useCallback(() => {
    playSoundEffect(SOUND_EFFECT_TYPES.ANSWER_WRONG);
    showRetryMessage();
  }, [showRetryMessage]);

  const handlePlayKana = useCallback(async () => {
    const audioKey = currentItem?.audioKana;
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
  }, [cleanupAudio, currentItem?.audioKana, loadingAudioKey, playingAudioKey]);

  const handleBack = () => {
    cleanupAudio();
    if (!isReviewMode) exit();
    navigate(-1);
  };

  const handleNext = () => {
    if (!isKanaComplete) return;

    cleanupAudio();
    if (isReviewMode) {
      navigate(-1);
      return;
    }

    if (currentIndex + 1 < traceItems.length) {
      setFeedbackMessage('');
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      setCurrentIndex(index => index + 1);
      return;
    }

    navigate(`/practice/kana/${script}`, { replace: true });
  };

  if (!traceData || !currentItem) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F5F3FF] px-6 text-center text-sm font-extrabold text-[#7C72E0]">
        准备跟写中...
      </div>
    );
  }

  return (
    <div data-ui-click-sfx className="h-full overflow-y-auto scroll-y" style={{ background: '#F5F3FF' }}>
      <div style={{ minHeight: '100%', padding: '18px 16px calc(106px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="kana-trace-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <button
              type="button"
              className="btn-press"
              onClick={handleBack}
              aria-label="返回日语入门"
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
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ margin: 0, color: '#1E1B4B', fontSize: 24, fontWeight: 900, lineHeight: 1.18 }}>
                假名跟写
              </h1>
              <p style={{ margin: '5px 0 0', color: '#8A8A94', fontSize: 13, fontWeight: 800, lineHeight: 1.45 }}>
                {isReviewMode ? '复习这个假名的写法' : `第 ${currentIndex + 1} / ${traceItems.length} 个新假名`}
              </p>
            </div>
          </div>

          <div key={currentItemKey} className="kana-trace-stage">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '88px minmax(0, 1fr) 52px',
                gap: 12,
                alignItems: 'center',
                borderRadius: 24,
                background: 'white',
                border: '1.5px solid #E5E7EB',
                boxShadow: '0 8px 24px rgba(91,79,233,0.08)',
                padding: '12px 13px',
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  minHeight: 82,
                  borderRadius: 20,
                  background: '#F3F2FF',
                  border: '1.5px solid #DDD6FE',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                }}
              >
                <span className="jp" style={{ color: '#1E1B4B', fontSize: currentItem.displayKana.length > 1 ? 28 : 38, fontWeight: 900, lineHeight: 1 }}>
                  {currentItem.displayKana}
                </span>
                <span style={{ color: 'var(--tp)', fontSize: 13, fontWeight: 900, lineHeight: 1 }}>
                  {currentItem.romaji}
                </span>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span
                    style={{
                      borderRadius: 999,
                      background: '#EEF2FF',
                      color: '#4F46E5',
                      fontSize: 12,
                      fontWeight: 900,
                      padding: '3px 9px',
                    }}
                  >
                    {currentItem.sectionTitle}
                  </span>
                  <span
                    style={{
                      borderRadius: 999,
                      background: isKanaComplete ? '#ECFDF5' : '#F0F9FF',
                      color: isKanaComplete ? '#059669' : '#0284C7',
                      fontSize: 12,
                      fontWeight: 900,
                      padding: '3px 9px',
                    }}
                  >
                    {isKanaComplete ? '完成' : `第 ${activeStrokeNumber} / ${activeStrokeTotal} 笔`}
                  </span>
                </div>
                <p className="jp" style={{ margin: 0, color: '#64748B', fontSize: 14, fontWeight: 800, lineHeight: 1.45 }}>
                  {currentItem.displayKana} / {currentItem.romaji}
                </p>
              </div>

              <button
                type="button"
                className="btn-press"
                onClick={handlePlayKana}
                disabled={audioDisabled}
                aria-label={audioDisabled ? `暂无「${currentItem.displayKana}」音频` : `播放「${currentItem.displayKana}」`}
                data-sfx="none"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  border: `2px solid ${audioActive ? 'var(--tp-bdr)' : '#E7E7E7'}`,
                  background: 'white',
                  color: audioActive ? 'var(--tp)' : '#7C72E0',
                  boxShadow: audioActive ? '0 3px 0 var(--tp-bdr)' : '0 3px 0 #E7E7E7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: audioDisabled ? 'not-allowed' : 'pointer',
                  opacity: audioDisabled ? 0.42 : 1,
                }}
              >
                <SpeakerIcon />
              </button>
            </div>

            <div
              className="kana-trace-glyph-wrap"
              data-compound={currentItem.glyphs.length > 1 ? 'true' : 'false'}
              style={{
                width: '100%',
                maxWidth: '100%',
                margin: '0 auto',
              }}
            >
              <TraceGlyphBoard
                key={currentItem.displayKana}
                glyphs={currentItem.glyphs}
                activeComponentIndex={activeComponentIndex}
                completedCounts={strokeProgress}
                onStrokeAccepted={handleStrokeAccepted}
                onStrokeRejected={handleStrokeRejected}
              />
            </div>

            <div
              aria-live="polite"
              style={{
                minHeight: 42,
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {feedbackMessage && (
                <div
                  style={{
                    borderRadius: 999,
                    background: '#FFF7ED',
                    border: '1.5px solid #FED7AA',
                    color: '#EA580C',
                    fontSize: 14,
                    fontWeight: 900,
                    padding: '8px 14px',
                    boxShadow: '0 4px 0 #FED7AA',
                  }}
                >
                  {feedbackMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
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
          onClick={handleNext}
          disabled={!isKanaComplete}
          style={{
            width: 'min(100%, 720px)',
            height: 58,
            border: 'none',
            borderRadius: 18,
            background: isKanaComplete ? 'linear-gradient(135deg, var(--tp-from), var(--tp))' : '#E5E7EB',
            color: isKanaComplete ? 'white' : '#9CA3AF',
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 0,
            boxShadow: isKanaComplete
              ? '0 6px 0 var(--tp-deep), 0 14px 28px color-mix(in srgb, var(--tp) 28%, transparent)'
              : '0 5px 0 #D1D5DB',
            cursor: isKanaComplete ? 'pointer' : 'not-allowed',
            pointerEvents: 'auto',
            transition: 'background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
          }}
        >
          {isReviewMode ? '完成' : currentIndex + 1 < traceItems.length ? '下一步' : '进入关卡'}
        </button>
      </div>

      <style>{`
        .kana-trace-header {
          animation: kana-trace-header-in 0.3s ease-out both;
        }

        .kana-trace-stage {
          animation: kana-trace-stage-in 0.34s cubic-bezier(0.2, 0.9, 0.2, 1.1) both;
          transform-origin: center top;
        }

        @keyframes kana-trace-header-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes kana-trace-stage-in {
          from {
            opacity: 0;
            transform: translateX(18px) translateY(8px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateX(0) translateY(0) scale(1);
          }
        }

        @media (max-width: 520px) {
          .kana-trace-glyph-wrap[data-compound="true"] {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
