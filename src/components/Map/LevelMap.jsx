import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useGameStore from '../../store/gameStore';
import useUserStore, { MAX_HEARTS } from '../../store/userStore';
import useCourseStore from '../../store/courseStore';
import useAiStore from '../../store/aiStore';
import useAutoGenStore from '../../store/autoGenStore';
import useNextChapterGenStore from '../../store/nextChapterGenStore';
import ChapterBanner from './ChapterBanner';
import LevelNode from './LevelNode';
import CreateCourseSheet from './CreateCourseSheet';
import GenerateNextChapterSheet from './GenerateNextChapterSheet';
import { generateLevelQuestions } from '../../lib/generate-chapter';
import { acquireKeepScreenAwake, releaseKeepScreenAwake } from '../../lib/keep-screen-awake';
import EstimatedProgressBar from '../UI/EstimatedProgressBar';
import { useIcon } from '../../lib/icons';

gsap.registerPlugin(useGSAP);

// Vertical distance between node centers
const ROW_H = 140;
// Node circle radius (w-16 = 64px → r = 32)
const NODE_R = 32;
// Zigzag x positions as percentage of container (0–100 in viewBox units)
const X_PATTERN = [30, 70, 30, 70, 30, 70];

function buildCurvePath(positions) {
  if (positions.length < 2) return '';
  let d = `M ${positions[0].x} ${positions[0].y}`;
  for (let i = 0; i < positions.length - 1; i++) {
    const p = positions[i];
    const q = positions[i + 1];
    const midY = (p.y + q.y) / 2;
    // Cubic bezier: leave p going straight down, arrive q going straight down
    d += ` C ${p.x} ${midY}, ${q.x} ${midY}, ${q.x} ${q.y}`;
  }
  return d;
}

// ── No-Hearts Modal ──────────────────────────────────────────────────────────
function NoHeartsModal({ nextHeartAt, onClose }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const getCountdown = useCallback(() => {
    if (!nextHeartAt) return null;
    const remaining = Math.max(0, nextHeartAt - Date.now());
    const min = Math.floor(remaining / 60000);
    const sec = Math.floor((remaining % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }, [nextHeartAt]);

  const countdown = getCountdown();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl px-6 pt-8 pb-10"
        style={{ background: 'white', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-[#E5E0FF] mx-auto mb-6" />

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: '#FEE2E2', boxShadow: '0 4px 0 #FECACA' }}
          >
            <span className="text-4xl">💔</span>
          </div>
        </div>

        {/* Text */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-extrabold text-[#1E1B4B] mb-2">生命值耗尽！</h2>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            每颗 ❤️ 每 5 分钟恢复一次
            <br />稍作休息，一会儿再来挑战吧～
          </p>
        </div>

        {/* Hearts + countdown */}
        <div
          className="flex items-center justify-between rounded-2xl px-5 py-3 mb-6"
          style={{ background: '#FFF1F2', border: '1.5px solid #FECACA' }}
        >
          <div className="flex gap-1">
            {Array.from({ length: MAX_HEARTS }).map((_, i) => (
              <span key={i} style={{ filter: 'grayscale(1)', opacity: 0.3 }} className="text-xl">❤️</span>
            ))}
          </div>
          {countdown && (
            <div className="text-right">
              <div className="text-[10px] text-[#9CA3AF] font-semibold mb-0.5">下颗❤️恢复</div>
              <div className="font-mono font-extrabold text-[#EF4444] text-lg tabular-nums">
                {countdown}
              </div>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl font-extrabold text-sm"
          style={{
            background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
            color: 'white',
            boxShadow: '0 4px 0 #991B1B',
          }}
        >
          知道了
        </button>
      </div>
    </div>
  );
}

// ── Level Info Sheet ────────────────────────────────────────────────────────
function LevelInfoSheet({ info, onClose, onEnter, onKnowledge, onGenerate, isAutoGenerating, autoGenMsg, autoGenProgress }) {
  const sheetRef   = useRef(null);
  const overlayRef = useRef(null);
  const completedLevelsImg = useIcon('ui/completed_levels.png');
  const levelUpImg = useIcon('ui/level_up.png');
  const [generating, setGenerating] = useState(false);
  const [genMsg,     setGenMsg]     = useState('');
  const [genProgress, setGenProgress] = useState(0);
  const [genError,   setGenError]   = useState(null);

  const doClose = useCallback(() => {
    if (generating) return;
    if (!sheetRef.current || !overlayRef.current) return;
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, ease: 'power2.in' });
    gsap.to(sheetRef.current, { y: '110%', duration: 0.28, ease: 'power3.in', onComplete: onClose });
  }, [onClose, generating]);

  useGSAP(() => {
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(sheetRef.current,   { y: '100%' });
    gsap.to(overlayRef.current, { opacity: 1, duration: 0.22 });
    gsap.to(sheetRef.current,   { y: 0, duration: 0.38, ease: 'back.out(1.3)' });
  }, []);

  const { level, chapterColor } = info;
  // 从 courseStore 实时读取最新 questions（后台生成完毕后能立即反映）
  const allChapters = useCourseStore(s => s.chapters);
  const liveChapter = allChapters.find(c => c.id === info.chapterId);
  const liveLevel   = liveChapter?.levels.find(lv => lv.id === level.id) ?? level;
  const hasQuestions = (liveLevel.questions?.length ?? 0) > 0;
  // 非第一章时，关卡预览题目数额外 +1（巩固练习）
  const chapterIdx = allChapters.findIndex(c => c.id === info.chapterId);
  const hasReviewBonus = chapterIdx > 0;
  const displayQCount = hasQuestions ? liveLevel.questions.length + (hasReviewBonus ? 1 : 0) : 0;

  // 合并本地生成状态和外部（autoGen）状态
  const showGenerating = generating || isAutoGenerating;
  const displayMsg     = genMsg || autoGenMsg || '';
  const displayProgress = generating ? genProgress : autoGenProgress;

  const handleGenerate = useCallback(async () => {
    if (!onGenerate || generating) return;
    setGenerating(true);
    setGenError(null);
    setGenMsg('准备中…');
    setGenProgress(0);
    try {
      await onGenerate(event => {
        setGenMsg(event.message);
        setGenProgress(event.overallProgress);
      });
      setGenerating(false);
    } catch (err) {
      setGenerating(false);
      setGenError(err?.message || '生成失败，请重试');
    }
  }, [onGenerate, generating]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={doClose}
    >
      <div
        ref={sheetRef}
        style={{
          width: '100%', background: 'white',
          borderRadius: '24px 24px 0 0',
          padding: '0 20px 36px',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.20)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E5E0FF', margin: '12px auto 22px' }} />

        {/* Level header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 58, height: 58, borderRadius: 20,
            background: chapterColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, flexShrink: 0,
            boxShadow: `0 4px 0 ${chapterColor}88`,
          }}>
            {level.icon ?? '📖'}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B', lineHeight: 1.2 }}>
              {level.title}
            </div>
            <div style={{ fontSize: 14, color: '#6B7280', fontWeight: 600, marginTop: 4, fontFamily: 'var(--font-jp)' }}>
              {level.topic}
            </div>
          </div>
        </div>

        {/* Grammar points */}
        {level.grammar?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.08em', marginBottom: 8 }}>
              语法要点
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {level.grammar.map((g, i) => (
                <span key={i} style={{
                  background: chapterColor + '15',
                  border: `1.5px solid ${chapterColor}44`,
                  borderRadius: 10, padding: '5px 13px',
                  fontSize: 13, fontWeight: 700, color: chapterColor,
                  fontFamily: 'var(--font-jp)',
                }}>
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {showGenerating ? (
          <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
            <div
              className="animate-spin"
              style={{
                width: 44, height: 44,
                border: '4px solid #E5E0FF',
                borderTopColor: chapterColor,
                borderRadius: '50%',
                margin: '0 auto 16px',
              }}
            />
            <p style={{ fontSize: 15, fontWeight: 800, color: '#1E1B4B', margin: '0 0 6px' }}>
              正在生成关卡…
            </p>
            <EstimatedProgressBar
              progress={displayProgress}
              label={displayMsg}
              color={chapterColor}
              compact
            />
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <div style={{
                flex: 1, background: '#F5F3FF', borderRadius: 16,
                padding: '14px 10px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}>
                <img
                  src={completedLevelsImg}
                  alt=""
                  width={28}
                  height={28}
                  style={{ objectFit: 'contain' }}
                />
                {hasQuestions
                  ? <span style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B' }}>{displayQCount}</span>
                  : <span style={{ fontSize: 14, fontWeight: 800, color: chapterColor }}>AI 生成</span>
                }
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF' }}>道题目</span>
              </div>
              <div style={{
                flex: 1, background: '#FFFBEB', borderRadius: 16,
                padding: '14px 10px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}>
                <img
                  src={levelUpImg}
                  alt=""
                  width={28}
                  height={28}
                  style={{ objectFit: 'contain' }}
                />
                <span style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B' }}>60</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF' }}>XP 奖励</span>
              </div>
            </div>

            {/* Error message */}
            {genError && (
              <div style={{
                background: '#FEF2F2', border: '1.5px solid #FECACA',
                borderRadius: 12, padding: '10px 14px', marginBottom: 12,
                fontSize: 13, color: '#DC2626', fontWeight: 600,
              }}>
                ⚠️ {genError}
              </div>
            )}

            {/* CTA */}
            {hasQuestions ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn-press"
                  onClick={onKnowledge}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '15px 8px',
                    borderRadius: 18,
                    border: `1.5px solid ${chapterColor}55`,
                    background: chapterColor + '12',
                    color: chapterColor,
                    fontSize: 16,
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: `0 4px 0 ${chapterColor}22`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  知识讲解
                </button>
                <button
                  className="btn-press"
                  onClick={onEnter}
                  style={{
                    flex: 3,
                    minWidth: 0,
                    padding: '15px',
                    borderRadius: 18,
                    border: 'none',
                    background: `linear-gradient(135deg, ${chapterColor}DD, ${chapterColor})`,
                    color: 'white',
                    fontSize: 16,
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: `0 4px 0 ${chapterColor}88`,
                  }}
                >
                  进入关卡 →
                </button>
              </div>
            ) : (
              <button
                className="btn-press"
                onClick={handleGenerate}
                style={{
                  width: '100%', padding: '15px',
                  borderRadius: 18, border: 'none',
                  background: `linear-gradient(135deg, ${chapterColor}DD, ${chapterColor})`,
                  color: 'white', fontSize: 16, fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: `0 4px 0 ${chapterColor}88`,
                }}
              >
                ✨ 生成关卡
              </button>
            )}
          </>
        )}
        {/* 当后台自动生成完成后，hasQuestions 会变为 true，CTA 按钮自动变为「进入关卡」 */}
      </div>
    </div>
  );
}

// ── No-AI-Config Modal ──────────────────────────────────────────────────────
function NoAiConfigModal({ onClose, onGoSettings }) {
  const sdFallImg = useIcon('sd/sd_fall.png');
  const overlayRef = useRef(null);
  const sheetRef = useRef(null);

  useGSAP(() => {
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(sheetRef.current, { opacity: 0, y: '100%' });
  });

  useGSAP(() => {
    gsap.to(overlayRef.current, { opacity: 1, duration: 0.15 });
    gsap.to(sheetRef.current, { opacity: 1, y: '0%', duration: 0.2, ease: 'power3.out' });
  }, []);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        style={{
          width: '100%', background: 'white',
          borderRadius: '24px 24px 0 0',
          padding: '0 20px 36px',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.20)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E5E0FF', margin: '12px auto 22px' }} />
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img
            src={sdFallImg}
            alt="需要配置 AI 模型"
            width={148}
            height={148}
            style={{ objectFit: 'contain', margin: '0 auto 6px' }}
          />
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1E1B4B', marginBottom: 8 }}>尚未配置 AI 模型</h2>
          <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: '0 8px' }}>
            生成课程需要先配置 AI 模型。<br />
            请前往 <strong>「我的」→「设置」</strong> 中填写提供商和密钥。
          </p>
        </div>
        <button
          onClick={onGoSettings}
          className="btn-press"
          style={{
            width: '100%', padding: '14px',
            borderRadius: 18, border: 'none',
            background: 'linear-gradient(135deg, var(--tp-from), var(--tp))',
            color: 'white', fontSize: 15, fontWeight: 800,
            cursor: 'pointer', marginBottom: 10,
          }}
        >
          前往设置 →
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 18, border: '1.5px solid #E5E7EB',
            background: 'white', color: '#6B7280',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          稍后再说
        </button>
      </div>
    </div>
  );
}

// ── Beginner Kana Guide Modal ───────────────────────────────────────────────
function BeginnerKanaGuideModal({ onClose, onBeginner, onContinue }) {
  const sdLearnImg = useIcon('sd/sd_learn.png');
  const overlayRef = useRef(null);
  const sheetRef = useRef(null);

  useGSAP(() => {
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(sheetRef.current, { opacity: 0, y: '100%' });
  });

  useGSAP(() => {
    gsap.to(overlayRef.current, { opacity: 1, duration: 0.15 });
    gsap.to(sheetRef.current, { opacity: 1, y: '0%', duration: 0.2, ease: 'power3.out' });
  }, []);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        style={{
          width: '100%', background: 'white',
          borderRadius: '24px 24px 0 0',
          padding: '0 20px 36px',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.20)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E5E0FF', margin: '12px auto 22px' }} />
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img
            src={sdLearnImg}
            alt="五十音学习引导"
            width={148}
            height={148}
            style={{ objectFit: 'contain', margin: '0 auto 6px' }}
          />
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1E1B4B', marginBottom: 8 }}>是否学习过五十音呢～？</h2>
          <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: '0 8px' }}>
            如果还不熟悉，可以先前往 <strong>「练习中心 → 日语入门」</strong>，<br />学习基础知识和平假名、片假名。
          </p>
        </div>
        <button
          onClick={onBeginner}
          className="btn-press"
          style={{
            width: '100%', padding: '14px',
            borderRadius: 18, border: 'none',
            background: 'linear-gradient(135deg, var(--tp-from), var(--tp))',
            color: 'white', fontSize: 15, fontWeight: 800,
            cursor: 'pointer', marginBottom: 10,
          }}
        >
          我是初学者
        </button>
        <button
          onClick={onContinue}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 18, border: '1.5px solid #E5E7EB',
            background: 'white', color: '#6B7280',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          我已学会
        </button>
      </div>
    </div>
  );
}

export default function LevelMap() {
  const navigate = useNavigate();
  const sdNoBooksImg = useIcon('sd/sd_no_books.png');
  const levelProgress = useGameStore(s => s.levelProgress);
  const { nextHeartAt, syncHearts } = useUserStore();
  const chapters = useCourseStore(s => s.chapters);
  const aiConfig = useAiStore(s => s.getConfig)();
  const autoGenRunning    = useAutoGenStore(s => s.running);
  const autoGenChapterId  = useAutoGenStore(s => s.currentChapterId);
  const autoGenLevelIdx   = useAutoGenStore(s => s.currentLevelIdx);
  const autoGenMsg        = useAutoGenStore(s => s.currentMsg);
  const autoGenProgress   = useAutoGenStore(s => s.currentProgress);
  const nextChapterStatus = useNextChapterGenStore(s => s.status);
  const resetNextChapterGeneration = useNextChapterGenStore(s => s.reset);
  const [showNoHearts,  setShowNoHearts]  = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [showNoAiConfig, setShowNoAiConfig] = useState(false);
  const [showBeginnerKanaGuide, setShowBeginnerKanaGuide] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showNextChapterSheet, setShowNextChapterSheet] = useState(false);

  // ── Scroll navigation refs ──────────────────────────────────────────────
  const scrollRef      = useRef(null);
  const chapterRefsMap = useRef({});
  const levelRefsMap   = useRef({});

  // 进入首页时自动滚动到「最新解锁的一关」
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const { chapters: chs } = useCourseStore.getState();
      const { levelProgress: lp } = useGameStore.getState();
      if (chs.length === 0) return;

      let targetEl = null;
      outer: for (const ch of chs) {
        for (let i = 0; i < ch.levels.length; i++) {
          const lv = ch.levels[i];
          const prevDone = i === 0 || lp[ch.levels[i - 1].id]?.completed === true;
          const unlocked = !ch.locked && prevDone;
          const done = lp[lv.id]?.completed === true;
          if (unlocked && !done) {
            targetEl = levelRefsMap.current[lv.id];
            break outer;
          }
        }
      }
      // 全部完成时定位到最后一关
      if (!targetEl) {
        const lastCh = chs[chs.length - 1];
        const lastLv = lastCh?.levels[lastCh.levels.length - 1];
        if (lastLv) targetEl = levelRefsMap.current[lastLv.id];
      }

      if (targetEl && scrollRef.current) {
        const container = scrollRef.current;
        const cRect = container.getBoundingClientRect();
        const eRect = targetEl.getBoundingClientRect();
        const topInContainer = eRect.top - cRect.top + container.scrollTop;
        container.scrollTo({ top: Math.max(0, topInContainer - container.clientHeight / 3), behavior: 'smooth' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []); // 仅挂载时执行一次

  // 上一章按钮：滚动到当前视口正上方的章节横幅
  const handleScrollToPrevChapter = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const positions = Object.entries(chapterRefsMap.current)
      .map(([id, el]) => ({
        id,
        top: el.getBoundingClientRect().top - cRect.top + scrollTop,
      }))
      .sort((a, b) => a.top - b.top);
    // 找到所有已滚过的章节（顶部位于视口上方 + 80px 以内）
    const above = positions.filter(p => p.top < scrollTop + 80);
    if (above.length > 1) {
      const prev = above[above.length - 2];
      container.scrollTo({ top: Math.max(0, prev.top - 8), behavior: 'smooth' });
    } else {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // 到底部按钮
  const handleScrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  // Sync regen whenever the map is visible
  useEffect(() => { syncHearts(); }, [syncHearts]);

  const handleLevelClick = (chapterId, level, chapterColor, levelIdx) => {
    // Skip hearts check if the level has no questions yet (generation doesn't need hearts)
    const needsGeneration = (level.questions?.length ?? 0) === 0;
    if (!needsGeneration) {
      syncHearts();
      if (useUserStore.getState().hearts === 0) {
        setShowNoHearts(true);
        return;
      }
    }
    setSelectedLevel({ chapterId, level, chapterColor, levelIdx });
  };

  const handleEnterLesson = useCallback(() => {
    if (selectedLevel) {
      navigate(`/lesson/${selectedLevel.chapterId}/${selectedLevel.level.id}`);
    }
  }, [navigate, selectedLevel]);

  const handleOpenLevelKnowledge = useCallback(() => {
    if (selectedLevel) {
      navigate(`/level-knowledge/${selectedLevel.chapterId}/${selectedLevel.level.id}`);
    }
  }, [navigate, selectedLevel]);

  const handleGenerateLevel = useCallback(async (onProgress) => {
    if (!selectedLevel) return;
    const { chapterId, levelIdx } = selectedLevel;
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) throw new Error('章节不存在');

    const aiCfg = useAiStore.getState().getConfig();
    const keepAwakeToken = acquireKeepScreenAwake('level-generation');

    try {
      const questions = await generateLevelQuestions(aiCfg, chapter, levelIdx, {
        onProgress,
        signal: AbortSignal.timeout(300_000),
      });

      // Save to courseStore: add questions + unlock the level
      useCourseStore.getState().updateChapter(chapterId, ch => ({
        ...ch,
        levels: ch.levels.map((lv, idx) =>
          idx === levelIdx ? { ...lv, questions, locked: undefined } : lv
        ),
      }));

    } finally {
      releaseKeepScreenAwake(keepAwakeToken);
    }
  }, [selectedLevel, chapters]);

  const isLevelUnlocked = (chapter, levelIdx) => {
    if (chapter.locked) return false;
    const chapterIdx = chapters.findIndex(ch => ch.id === chapter.id);
    if (chapterIdx > 0) {
      const previousChapter = chapters[chapterIdx - 1];
      const previousLastLevel = previousChapter.levels[previousChapter.levels.length - 1];
      if (!previousLastLevel || levelProgress[previousLastLevel.id]?.completed !== true) {
        return false;
      }
    }
    if (levelIdx === 0) return true;
    const prevLevel = chapter.levels[levelIdx - 1];
    return levelProgress[prevLevel.id]?.completed === true;
  };

  const continueCreateFirstCourse = useCallback(() => {
    const isAiConfigured = aiConfig.provider && aiConfig.apiKey?.trim() && aiConfig.modelId?.trim();
    if (!isAiConfigured) {
      setShowNoAiConfig(true);
      return;
    }
    // 等待按压弹回动画结束后再弹出底部弹层
    setTimeout(() => setShowCreateSheet(true), 150);
  }, [aiConfig]);

  const handleCreateFirstCourse = () => {
    setShowBeginnerKanaGuide(true);
  };

  const handleBeginnerKanaContinue = () => {
    setShowBeginnerKanaGuide(false);
    setTimeout(() => continueCreateFirstCourse(), 120);
  };

  const handleBeginnerKanaStart = () => {
    setShowBeginnerKanaGuide(false);
    navigate('/vocab');
  };

  const latestChapter = chapters[chapters.length - 1];
  const lockedLevelCount = latestChapter?.levels.filter(
    (_, levelIdx) => !isLevelUnlocked(latestChapter, levelIdx)
  ).length ?? 0;
  const canGenerateNextChapter = !!(
    latestChapter?.levels.length > 0 &&
    lockedLevelCount <= 3
  );
  const showNextChapterButton =
    canGenerateNextChapter ||
    nextChapterStatus === 'generating' ||
    nextChapterStatus === 'error';

  const handleOpenNextChapterSheet = () => {
    if (nextChapterStatus === 'generating' || nextChapterStatus === 'error') {
      setShowNextChapterSheet(true);
      return;
    }

    if (nextChapterStatus === 'success') {
      resetNextChapterGeneration();
    }

    const isAiConfigured = aiConfig.provider && aiConfig.apiKey?.trim() && aiConfig.modelId?.trim();
    if (!isAiConfigured) {
      setShowNoAiConfig(true);
      return;
    }
    setShowNextChapterSheet(true);
  };

  // ── Empty state: no AI-generated courses yet ──────────────────────────────
  if (chapters.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px', gap: 0,
      }}>
        {showNoAiConfig && (
          <NoAiConfigModal
            onClose={() => setShowNoAiConfig(false)}
            onGoSettings={() => { setShowNoAiConfig(false); navigate('/settings?panel=ai'); }}
          />
        )}
        {showBeginnerKanaGuide && (
          <BeginnerKanaGuideModal
            onClose={() => setShowBeginnerKanaGuide(false)}
            onBeginner={handleBeginnerKanaStart}
            onContinue={handleBeginnerKanaContinue}
          />
        )}
        {showCreateSheet && (
          <CreateCourseSheet
            onClose={() => setShowCreateSheet(false)}
            onDone={() => setShowCreateSheet(false)}
          />
        )}
        <img
          src={sdNoBooksImg}
          alt="空书架"
          width={180}
          height={180}
          style={{ objectFit: 'contain', marginBottom: 8 }}
        />
        <h2 style={{
          fontSize: 20, fontWeight: 900, color: '#1E1B4B',
          marginBottom: 10, textAlign: 'center',
        }}>
          还没有课程
        </h2>
        <p style={{
          fontSize: 14, color: '#9CA3AF', textAlign: 'center',
          lineHeight: 1.7, marginBottom: 32, maxWidth: 260,
        }}>
          让 AI 根据你的需求生成专属日语课程，从现在开始学习！
        </p>
        <button
          onClick={handleCreateFirstCourse}
          className="btn-press"
          style={{
            padding: '16px 36px',
            borderRadius: 20, border: 'none',
            background: 'linear-gradient(135deg, var(--tp-from) 0%, var(--tp) 100%)',
            color: 'white', fontSize: 15, fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 6px 0 var(--tp-deep), 0 8px 20px rgba(91,79,233,0.35)',
          }}
        >
          ✨ 让我们创建第一课吧！
        </button>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="scroll-y flex-1 px-4 py-4">
      {selectedLevel && (
        <LevelInfoSheet
          info={selectedLevel}
          onClose={() => setSelectedLevel(null)}
          onEnter={handleEnterLesson}
          onKnowledge={handleOpenLevelKnowledge}
          onGenerate={handleGenerateLevel}
          isAutoGenerating={
            autoGenRunning &&
            autoGenChapterId === selectedLevel.chapterId &&
            autoGenLevelIdx  === selectedLevel.levelIdx
          }
          autoGenMsg={autoGenMsg}
          autoGenProgress={autoGenProgress}
        />
      )}
      {showNoHearts && (
        <NoHeartsModal nextHeartAt={nextHeartAt} onClose={() => setShowNoHearts(false)} />
      )}
      {showNoAiConfig && (
        <NoAiConfigModal
          onClose={() => setShowNoAiConfig(false)}
          onGoSettings={() => { setShowNoAiConfig(false); navigate('/settings?panel=ai'); }}
        />
      )}
      {chapters.map((chapter) => {
        const positions = chapter.levels.map((_, i) => ({
          x: X_PATTERN[i % X_PATTERN.length],
          // y is the center of the node circle
          y: i * ROW_H + NODE_R,
        }));

        // Container height: last node center + radius + label area
        const totalH = (chapter.levels.length - 1) * ROW_H + NODE_R * 2 + 60;
        const pathColor = chapter.color || 'var(--tp)';
        const curvePath = buildCurvePath(positions);

        return (
          <div
            key={chapter.id}
            ref={el => { if (el) chapterRefsMap.current[chapter.id] = el; else delete chapterRefsMap.current[chapter.id]; }}
            className="mb-8"
          >
            <ChapterBanner chapter={chapter} />

            <div className="mt-6 relative" style={{ height: totalH }}>
              {/* SVG curved path connecting all nodes */}
              {chapter.levels.length > 1 && (
                <svg
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: totalH,
                    pointerEvents: 'none',
                    overflow: 'visible',
                  }}
                  viewBox={`0 0 100 ${totalH}`}
                  preserveAspectRatio="none"
                >
                  {/* Thick glow/background track */}
                  <path
                    d={curvePath}
                    fill="none"
                    stroke={pathColor}
                    strokeOpacity="0.12"
                    strokeLinecap="round"
                    strokeWidth="18"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Dashed foreground line */}
                  <path
                    d={curvePath}
                    fill="none"
                    stroke={pathColor}
                    strokeOpacity="0.5"
                    strokeLinecap="round"
                    strokeWidth="4"
                    strokeDasharray="12 9"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}

              {/* Level nodes at absolute positions */}
              {chapter.levels.map((level, idx) => {
                const isCompleted = levelProgress[level.id]?.completed === true;
                const isUnlocked = isLevelUnlocked(chapter, idx);
                const stars = levelProgress[level.id]?.stars ?? 0;

                return (
                  <div
                    key={level.id}
                    ref={el => { if (el) levelRefsMap.current[level.id] = el; else delete levelRefsMap.current[level.id]; }}
                    style={{
                      position: 'absolute',
                      // Center the node horizontally on the path x position
                      left: `${positions[idx].x}%`,
                      // Top edge = node center - radius
                      top: positions[idx].y - NODE_R,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <LevelNode
                      level={level}
                      index={idx}
                      chapterColor={chapter.color}
                      isCompleted={isCompleted}
                      isUnlocked={isUnlocked}
                      stars={stars}
                      onClick={() => handleLevelClick(chapter.id, level, chapter.color, idx)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {/* 最新章节仅剩 3 个以内待解锁关卡时，即可提前生成下一章节。 */}
      {showNextChapterButton && (
          <div style={{ textAlign: 'center', padding: '8px 16px 4px' }}>
            <button
              onClick={handleOpenNextChapterSheet}
              className="btn-press"
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 20,
                border: 'none',
                background: 'linear-gradient(135deg, var(--tp-from) 0%, var(--tp) 100%)',
                color: 'white',
                fontSize: 16,
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 5px 0 var(--tp-deep), 0 8px 24px rgba(91,79,233,0.30)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {nextChapterStatus === 'generating' ? (
                <span
                  className="animate-spin"
                  style={{
                    display: 'inline-block',
                    width: 16,
                    height: 16,
                    border: '2px solid rgba(255,255,255,0.45)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                  }}
                />
              ) : (
                <span>✨</span>
              )}
              <span>
                {nextChapterStatus === 'generating'
                  ? '正在生成下一章节'
                  : nextChapterStatus === 'error'
                  ? '下一章节生成失败，点击查看'
                  : '生成下一章关卡'}
              </span>
            </button>
          </div>
        )}

      {showNextChapterSheet && (
        <GenerateNextChapterSheet
          onClose={() => setShowNextChapterSheet(false)}
          onDone={() => setShowNextChapterSheet(false)}
        />
      )}

      {/* ── 悬浮导航按钮：上一章 + 到底部 ── */}
      <div style={{
        position: 'fixed',
        bottom: 120,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 30,
      }}>
        <button
          onClick={handleScrollToPrevChapter}
          className="btn-press"
          title="上一章"
          style={{
            width: 44, height: 44,
            borderRadius: 14,
            border: 'none',
            background: 'white',
            color: 'var(--tp)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 12px rgba(91,79,233,0.22), 0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15l-6-6-6 6"/>
            <path d="M18 20l-6-6-6 6" opacity="0.4"/>
          </svg>
        </button>
        <button
          onClick={handleScrollToBottom}
          className="btn-press"
          title="到底部"
          style={{
            width: 44, height: 44,
            borderRadius: 14,
            border: 'none',
            background: 'white',
            color: 'var(--tp)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 12px rgba(91,79,233,0.22), 0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6"/>
            <path d="M6 4l6 6 6-6" opacity="0.4"/>
          </svg>
        </button>
      </div>

      <div className="h-8" />
    </div>
  );
}
