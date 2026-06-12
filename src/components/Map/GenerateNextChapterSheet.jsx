import { useState, useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import useUserStore from '../../store/userStore';
import useNextChapterGenStore from '../../store/nextChapterGenStore';
import useNextChapterRecommendationStore from '../../store/nextChapterRecommendationStore';
import { useIcon } from '../../lib/icons';
import EstimatedProgressBar from '../UI/EstimatedProgressBar';

// 生成进度步骤（与 CreateCourseSheet 保持一致）
const GEN_STEPS = [
  { icon: '🏗️', label: '规划课程结构' },
  { icon: '📚', label: '生成语法讲解' },
  { icon: '📝', label: '生成第一关题目' },
];

gsap.registerPlugin(useGSAP);

// ── Loading phase ─────────────────────────────────────────────────────────────

function LoadingPhase() {
  const sdGenerateImg = useIcon('sd/sd_generate.png');

  return (
    <div style={{ textAlign: 'center', padding: '32px 0 16px' }}>
      <div className="animate-pulse" style={{ marginBottom: 24, display: 'inline-block' }}>
        <img src={sdGenerateImg} alt="AI 正在生成推荐" width={148} height={148} style={{ objectFit: 'contain' }} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '0 0 10px' }}>
        AI 正在生成推荐…
      </h2>
      <p style={{ fontSize: 14, color: '#888', margin: '0 0 36px', lineHeight: 1.7 }}>
        正在分析你的学习进度，<br />为你推荐下一章节方向
      </p>
      <div
        className="animate-spin"
        style={{
          width: 44, height: 44,
          border: '4px solid #E5E0FF',
          borderTopColor: 'var(--tp)',
          borderRadius: '50%',
          margin: '0 auto',
        }}
      />
    </div>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────────

function RecommendCard({ rec, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="btn-press"
      style={{
        padding: '14px 13px',
        borderRadius: 16,
        cursor: 'pointer',
        border: selected ? '2px solid var(--tp)' : '2px solid #e8e8f0',
        background: selected ? '#f0eeff' : '#fafafa',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
    >
      {/* 章节名称 */}
      <div
        style={{
          fontWeight: 800,
          fontSize: 14,
          color: selected ? 'var(--tp)' : '#1a1a2e',
          lineHeight: 1.3,
        }}
      >
        {rec.title}
      </div>
      {/* 学习内容 */}
      <div
        style={{
          fontSize: 11,
          color: selected ? 'var(--tp-from)' : '#6B7280',
          lineHeight: 1.5,
        }}
      >
        {rec.topic}
      </div>
      {/* 推荐理由 */}
      {rec.description && (
        <div
          style={{
            fontSize: 11,
            color: selected ? '#9D95D8' : '#9CA3AF',
            lineHeight: 1.4,
            marginTop: 2,
            fontStyle: 'italic',
          }}
        >
          {rec.description}
        </div>
      )}
    </button>
  );
}

// ── Select phase ──────────────────────────────────────────────────────────────

function SelectPhase({ recommendations, selectedIdx, customTopic, onSelectCard, onCustomInput, canProceed, onBack, onNext }) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📚</div>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.7 }}>
          AI 为你推荐了以下学习方向<br />选择一个，或自定义想学的内容
        </p>
      </div>

      {/* 推荐卡片 2×2 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 20,
        }}
      >
        {recommendations.map((rec, i) => (
          <RecommendCard
            key={i}
            rec={rec}
            selected={selectedIdx === i}
            onSelect={() => onSelectCard(i)}
          />
        ))}
      </div>

      {/* 分割线 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
        <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>
          或者自定义
        </span>
        <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
      </div>

      {/* 自定义输入框 */}
      <input
        type="text"
        value={customTopic}
        onChange={(e) => onCustomInput(e.target.value)}
        placeholder="输入你自定义的章节名称或内容…"
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 14,
          border: `2px solid ${customTopic ? 'var(--tp)' : '#e8e8f0'}`,
          outline: 'none',
          fontSize: 14,
          color: '#1a1a2e',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          background: customTopic ? '#f8f7ff' : '#fff',
          transition: 'border-color 0.15s ease',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--tp)'; }}
        onBlur={(e) => { if (!customTopic) e.target.style.borderColor = '#e8e8f0'; }}
      />

      {/* 按钮 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button
          onClick={onBack}
          className="btn-press"
          style={{
            flex: 1, padding: '14px 0', borderRadius: 14,
            background: '#f0f0f5', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 15, color: '#555',
          }}
        >
          取消
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="btn-press"
          style={{
            flex: 2, padding: '14px 0', borderRadius: 14,
            background: canProceed ? 'var(--tp)' : '#d0d0e8',
            border: 'none',
            cursor: canProceed ? 'pointer' : 'not-allowed',
            fontWeight: 700, fontSize: 15, color: '#fff',
          }}
        >
          下一步 →
        </button>
      </div>
    </div>
  );
}

// ── Extra phase ───────────────────────────────────────────────────────────────

function ExtraPhase({ extraNote, onExtraChange, onBack, onConfirm }) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>
          还有想补充的吗？
        </h2>
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0, lineHeight: 1.7 }}>
          告诉 AI 你的额外需求，可以跳过
        </p>
      </div>

      <textarea
        value={extraNote}
        onChange={(e) => onExtraChange(e.target.value)}
        placeholder="例如：想多练习会话、重点学某个语法、结合动漫场景、出行旅游用…（可跳过）"
        rows={5}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 14,
          border: '2px solid #e8e8f0',
          outline: 'none',
          fontSize: 14,
          color: '#1a1a2e',
          resize: 'none',
          fontFamily: 'inherit',
          lineHeight: 1.6,
          boxSizing: 'border-box',
          transition: 'border-color 0.15s ease',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--tp)'; }}
        onBlur={(e) => { e.target.style.borderColor = '#e8e8f0'; }}
      />

      {/* 按钮 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button
          onClick={onBack}
          className="btn-press"
          style={{
            flex: 1, padding: '14px 0', borderRadius: 14,
            background: '#f0f0f5', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 14, color: '#555',
          }}
        >
          ← 上一步
        </button>
        <button
          onClick={onConfirm}
          className="btn-press"
          style={{
            flex: 2, padding: '14px 0', borderRadius: 14,
            background: 'linear-gradient(135deg, var(--tp-from) 0%, var(--tp) 100%)',
            border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 14, color: '#fff',
            boxShadow: '0 3px 0 var(--tp-deep)',
          }}
        >
          确认生成 🚀
        </button>
      </div>
    </div>
  );
}

// ── Error phase ───────────────────────────────────────────────────────────────

function ErrorPhase({ error, onRetry, onClose }) {
  const sdErrorImg = useIcon('sd/sd2_error.png');

  return (
    <div style={{ textAlign: 'center', padding: '24px 0 10px' }}>
      <img src={sdErrorImg} alt="推荐生成失败" width={132} height={132} style={{ display: 'block', objectFit: 'contain', margin: '0 auto 12px' }} />
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>
        推荐生成失败
      </h2>
      <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 28px', lineHeight: 1.7 }}>
        {error || '请检查 AI 配置是否正确后重试'}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onClose}
          className="btn-press"
          style={{
            flex: 1, padding: '14px 0', borderRadius: 14,
            background: '#f0f0f5', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 15, color: '#555',
          }}
        >
          取消
        </button>
        <button
          onClick={onRetry}
          className="btn-press"
          style={{
            flex: 2, padding: '14px 0', borderRadius: 14,
            background: 'var(--tp)', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 15, color: '#fff',
          }}
        >
          重新生成
        </button>
      </div>
    </div>
  );
}

// ── Generating phase ─────────────────────────────────────────────────────────

function GeneratingContent({ genStep, genMsg, genProgress, onClose }) {
  const sdGenerateImg = useIcon('sd/sd_generate.png');

  return (
    <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
      <div style={{ marginBottom: 24, animation: 'pulse 1.5s ease-in-out infinite' }}>
        <img src={sdGenerateImg} alt="AI 正在生成章节" width={148} height={148} style={{ objectFit: 'contain', margin: '0 auto' }} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>正在生成章节…</h2>
      <p style={{ fontSize: 14, color: '#888', margin: '0 0 32px', lineHeight: 1.7 }}>
        AI 正在为你定制新的日语章节。<br />你可以退出此界面，章节会在后台继续生成。
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {GEN_STEPS.map((s, i) => {
          const isDone   = i < genStep;
          const isActive = i === genStep;
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 12,
                background: isDone ? '#f0fdf4' : isActive ? '#f0eeff' : '#f8f8fc',
                border: isActive ? '1.5px solid var(--tp)' : '1.5px solid transparent',
                transition: 'all 0.3s ease',
              }}
            >
              <span style={{ fontSize: 20, minWidth: 28 }}>
                {isDone ? '✅' : isActive ? (
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                ) : s.icon}
              </span>
              <span style={{
                fontSize: 14, fontWeight: isActive ? 600 : 400,
                color: isDone ? '#16a34a' : isActive ? 'var(--tp)' : '#aaa',
              }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <EstimatedProgressBar progress={genProgress} label={genMsg} />

      <button
        onClick={onClose}
        className="btn-press"
        style={{
          width: '100%', marginTop: 24, padding: '13px 0', borderRadius: 14,
          background: '#f0eeff', border: '1.5px solid #ded9ff', cursor: 'pointer',
          fontWeight: 700, fontSize: 14, color: 'var(--tp)',
        }}
      >
        退出界面，后台继续生成
      </button>

      <style>{`
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Gen-error phase ───────────────────────────────────────────────────────────

function GenErrorPhase({ error, onRetry, onClose }) {
  const sdErrorImg = useIcon('sd/sd2_error.png');

  return (
    <div style={{ textAlign: 'center', padding: '24px 0 10px' }}>
      <img src={sdErrorImg} alt="章节生成失败" width={132} height={132} style={{ display: 'block', objectFit: 'contain', margin: '0 auto 12px' }} />
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>章节生成失败</h2>
      <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 28px', lineHeight: 1.7 }}>
        {error || '请检查 AI 配置是否正确后重试'}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} className="btn-press"
          style={{ flex: 1, padding: '14px 0', borderRadius: 14, background: '#f0f0f5', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 15, color: '#555' }}
        >取消</button>
        <button onClick={onRetry} className="btn-press"
          style={{ flex: 2, padding: '14px 0', borderRadius: 14, background: 'var(--tp)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#fff' }}
        >重试一次</button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * 生成下一章节的引导弹层（loading → select → extra → generating → done）
 *
 * @param {function} onClose - 用户取消 / 关闭
 * @param {function} onDone  - 章节生成成功后调用
 */
export default function GenerateNextChapterSheet({ onClose, onDone }) {
  const nextChapterStatus = useNextChapterGenStore(s => s.status);
  const genStep           = useNextChapterGenStore(s => s.stepIndex);
  const genMsg            = useNextChapterGenStore(s => s.message);
  const genProgress       = useNextChapterGenStore(s => s.progress);
  const genError          = useNextChapterGenStore(s => s.error);
  const startGeneration   = useNextChapterGenStore(s => s.start);
  const retryGeneration   = useNextChapterGenStore(s => s.retry);
  const resetGeneration   = useNextChapterGenStore(s => s.reset);
  const recStatus         = useNextChapterRecommendationStore(s => s.status);
  const recRecommendations = useNextChapterRecommendationStore(s => s.recommendations);
  const recError          = useNextChapterRecommendationStore(s => s.error);
  const ensureRecommendations = useNextChapterRecommendationStore(s => s.ensureForCurrentCourse);
  const retryRecommendations = useNextChapterRecommendationStore(s => s.retry);

  const [phase, setPhase] = useState(() => {
    if (nextChapterStatus === 'generating') return 'generating';
    if (nextChapterStatus === 'error') return 'genError';
    return 'loading';
  }); // 'loading'|'select'|'extra'|'generating'|'error'|'genError'
  const [selectedIdx, setSelectedIdx]   = useState(null);
  const [customTopic, setCustomTopic]   = useState('');
  const [extraNote, setExtraNote]       = useState(() => useUserStore.getState().learningProfile?.extra?.trim() ?? '');
  const recommendations = recRecommendations;
  const recommendationPhase = recStatus === 'error'
    ? 'error'
    : recStatus === 'success' && recommendations.length > 0
    ? 'select'
    : 'loading';
  const displayPhase = nextChapterStatus === 'generating'
    ? 'generating'
    : nextChapterStatus === 'error'
    ? 'genError'
    : phase === 'extra' && recommendationPhase === 'select'
    ? 'extra'
    : recommendationPhase;

  const overlayRef = useRef(null);
  const sheetRef   = useRef(null);
  const contentRef = useRef(null);

  // ── Entry animation ─────────────────────────────────────────────────────────
  useGSAP(() => {
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(sheetRef.current,   { y: '100%' });
  });

  useGSAP(() => {
    gsap.to(overlayRef.current, { opacity: 1, duration: 0.25 });
    gsap.to(sheetRef.current,   { y: '0%', duration: 0.35, ease: 'power3.out' });
  }, []);

  // ── Content fade on phase change ─────────────────────────────────────────────
  useGSAP(() => {
    if (!contentRef.current) return;
    gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }
    );
  }, [displayPhase]);

  // ── Close (with exit animation) ──────────────────────────────────────────────
  const doClose = useCallback(() => {
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2 });
    gsap.to(sheetRef.current, { y: '100%', duration: 0.28, ease: 'power3.in', onComplete: onClose });
  }, [onClose]);

  // ── Load AI recommendations ──────────────────────────────────────────────────
  const requestRecommendations = useCallback((force = false) => {
    return force
      ? retryRecommendations({ source: 'sheet' })
      : ensureRecommendations({ source: 'sheet' });
  }, [ensureRecommendations, retryRecommendations]);

  // 打开时自动开始加载
  useEffect(() => {
    if (nextChapterStatus !== 'idle') return;
    requestRecommendations();
  }, [nextChapterStatus, requestRecommendations]);

  // ── Selection logic ──────────────────────────────────────────────────────────
  const handleSelectCard = (idx) => {
    setSelectedIdx(idx);
    setCustomTopic('');
  };

  const handleCustomInput = (v) => {
    setCustomTopic(v);
    if (v.trim()) setSelectedIdx(null);
  };

  const canProceed = selectedIdx !== null || customTopic.trim().length > 0;

  const getSelected = () => {
    if (customTopic.trim()) {
      return { title: customTopic.trim(), topic: customTopic.trim(), description: '' };
    }
    if (selectedIdx !== null) return recommendations[selectedIdx];
    return null;
  };

  // ── doDone (成功后关闭) ───────────────────────────────────────────────────────
  const doDone = useCallback(() => {
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2 });
    gsap.to(sheetRef.current, {
      y: '100%',
      duration: 0.28,
      ease: 'power3.in',
      onComplete: () => {
        onClose();
        onDone?.();
        resetGeneration();
      },
    });
  }, [onClose, onDone, resetGeneration]);

  useEffect(() => {
    if (nextChapterStatus === 'success') {
      doDone();
    }
  }, [doDone, nextChapterStatus]);

  // ── Trigger generation ───────────────────────────────────────────────────────
  const handleGenerate = useCallback((extra) => {
    const selected = getSelected();
    if (!selected) return;

    setPhase('generating');
    startGeneration({ selectedTopic: selected, extraNote: extra ?? '' });
  }, [selectedIdx, customTopic, recommendations, startGeneration]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetryRecommendations = useCallback(() => {
    setPhase('loading');
    setSelectedIdx(null);
    setCustomTopic('');
    requestRecommendations(true);
  }, [requestRecommendations]);

  // ── Header info ──────────────────────────────────────────────────────────────
  const PHASE_TITLES = {
    loading:    'AI 推荐下一章',
    select:     '选择下一章节方向',
    extra:      '还有想补充的吗？',
    error:      '推荐生成失败',
    generating: '正在生成新章节',
    genError:   '章节生成失败',
  };

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.55)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) doClose(); }}
    >
      <div
        ref={sheetRef}
        style={{
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#1a1a2e' }}>
              ✨ {PHASE_TITLES[displayPhase]}
            </span>
            <button
              onClick={doClose}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#f0f0f5', border: 'none', cursor: 'pointer',
                fontSize: 16, color: '#666', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* 进度指示（仅 select / extra 阶段显示） */}
          {(displayPhase === 'select' || displayPhase === 'extra') && (
            <div style={{ display: 'flex', gap: 6, marginTop: 16, justifyContent: 'center' }}>
              {['select', 'extra'].map((p) => (
                <div
                  key={p}
                  style={{
                    width: p === displayPhase ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    background:
                      p === 'select' && displayPhase === 'extra'
                        ? 'var(--tp)'       // 已完成步骤
                        : p === displayPhase
                        ? 'var(--tp)'       // 当前步骤
                        : '#e0e0ef',      // 未到达步骤
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── 可滚动内容区 ────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 36px' }}>
          <div ref={contentRef}>
            {displayPhase === 'loading' && <LoadingPhase />}

            {displayPhase === 'select' && (
              <SelectPhase
                recommendations={recommendations}
                selectedIdx={selectedIdx}
                customTopic={customTopic}
                onSelectCard={handleSelectCard}
                onCustomInput={handleCustomInput}
                canProceed={canProceed}
                onBack={doClose}
                onNext={() => setPhase('extra')}
              />
            )}

            {displayPhase === 'extra' && (
              <ExtraPhase
                extraNote={extraNote}
                onExtraChange={setExtraNote}
                onBack={() => setPhase('select')}
                onConfirm={() => handleGenerate(extraNote.trim())}
              />
            )}

            {displayPhase === 'generating' && (
              <GeneratingContent
                genStep={genStep}
                genMsg={genMsg}
                genProgress={genProgress}
                onClose={doClose}
              />
            )}

            {displayPhase === 'error' && (
              <ErrorPhase
                error={recError}
                onRetry={handleRetryRecommendations}
                onClose={doClose}
              />
            )}

            {displayPhase === 'genError' && (
              <GenErrorPhase
                error={genError}
                onRetry={retryGeneration}
                onClose={doClose}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
