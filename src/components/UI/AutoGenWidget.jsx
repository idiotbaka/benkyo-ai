import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useAutoGenStore from '../../store/autoGenStore';
import useCourseStore from '../../store/courseStore';
import useAiStore from '../../store/aiStore';

gsap.registerPlugin(useGSAP);

const GUIDE_DISMISSED_KEY = 'jplearn-autogen-guide-dismissed-v1';

function hasDismissedGuide() {
  try {
    return localStorage.getItem(GUIDE_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistGuideDismissal() {
  try {
    localStorage.setItem(GUIDE_DISMISSED_KEY, 'true');
  } catch {
    // The guide can still close when local storage is unavailable.
  }
}

/**
 * AutoGenWidget — 首页左下角悬浮的「后台自动生成题目」开关。
 * 仅当有待生成关卡且 AI 已配置时显示。
 * 位置：fixed，bottom 76px（底部导航上方），left 16px。
 */
export default function AutoGenWidget() {
  const { enabled, running, currentMsg, totalPending, doneCount, overallProgress, toggle } = useAutoGenStore();
  const chapters    = useCourseStore(s => s.chapters);
  const getConfig   = useAiStore(s => s.getConfig);
  const aiConfig    = getConfig();
  const guideRef    = useRef(null);
  const bubbleRefs  = useRef([]);
  const [guideDismissed, setGuideDismissed] = useState(hasDismissedGuide);

  // 统计所有章节中还没有题目的关卡数量
  const pendingCount = chapters.reduce((sum, ch) => {
    if (ch.locked) return sum;
    return sum + ch.levels.filter(lv => (lv.questions?.length ?? 0) === 0).length;
  }, 0);

  const isAiConfigured = !!(aiConfig.provider && aiConfig.apiKey?.trim() && aiConfig.modelId?.trim());
  const isActive = enabled || running;
  const showGuide = pendingCount > 0 && !isActive && !guideDismissed;

  useGSAP(() => {
    if (!showGuide || !guideRef.current) return;
    gsap.fromTo(
      guideRef.current,
      { opacity: 0, y: 12, scale: 0.92 },
      { opacity: 1, y: 0, scale: 1, duration: 0.48, ease: 'back.out(1.7)' }
    );

    const configs = [
      { x: -10, y: 12, duration: 6.8, delay: 0 },
      { x: 12, y: -9, duration: 8.4, delay: 0.7 },
      { x: -8, y: -12, duration: 7.5, delay: 1.4 },
    ];

    bubbleRefs.current.forEach((bubble, index) => {
      if (!bubble) return;
      const config = configs[index];
      gsap.to(bubble, {
        x: config.x,
        y: config.y,
        duration: config.duration,
        delay: config.delay,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });
  }, { dependencies: [showGuide] });

  const handleDismissGuide = () => {
    persistGuideDismissal();
    if (!guideRef.current) {
      setGuideDismissed(true);
      return;
    }
    gsap.to(guideRef.current, {
      opacity: 0,
      y: 8,
      scale: 0.96,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => setGuideDismissed(true),
    });
  };

  // 无可生成内容且未在运行时，不显示
  if (!isAiConfigured || (pendingCount === 0 && !isActive)) return null;

  // 进度文案
  const labelText = running
    ? currentMsg === '等待新章节生成…'
      ? currentMsg
      : `第 ${Math.min(doneCount + 1, totalPending)} 关 / 共 ${totalPending} 关 · 预计 ${Math.round(overallProgress * 100)}%`
    : pendingCount > 0
    ? `${pendingCount} 关待生成`
    : '已全部生成';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 120,
        left: 16,
        zIndex: 45,
        pointerEvents: 'auto',
      }}
    >
      {showGuide && (
        <div
          ref={guideRef}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 15px)',
            left: 0,
            width: 'min(326px, calc(100vw - 32px))',
            padding: '15px 16px 14px',
            borderRadius: 18,
            background: 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(248,247,255,0.98))',
            border: '1.5px solid color-mix(in srgb, var(--tp) 24%, white)',
            boxShadow: '0 12px 34px rgba(30,27,75,0.20), 0 3px 10px color-mix(in srgb, var(--tp) 15%, transparent)',
            backdropFilter: 'blur(14px)',
            transformOrigin: 'bottom left',
          }}
        >
          {/* Clipped decorative bubbles */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}>
            <div
              ref={el => { bubbleRefs.current[0] = el; }}
              style={{
                position: 'absolute', width: 70, height: 70,
                top: -20, right: -10, borderRadius: '50%',
                background: 'color-mix(in srgb, var(--tp) 13%, transparent)',
              }}
            />
            <div
              ref={el => { bubbleRefs.current[1] = el; }}
              style={{
                position: 'absolute', width: 42, height: 42,
                bottom: 18, left: -12, borderRadius: '50%',
                background: 'color-mix(in srgb, var(--tp-from) 9%, transparent)',
              }}
            />
            <div
              ref={el => { bubbleRefs.current[2] = el; }}
              style={{
                position: 'absolute', width: 30, height: 30,
                top: 64, right: 30, borderRadius: '50%',
                background: 'color-mix(in srgb, var(--tp) 7%, transparent)',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, position: 'relative', zIndex: 1 }}>
            <span style={{
              width: 26, height: 26, borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, var(--tp-from), var(--tp))',
              color: 'white', fontSize: 14,
              boxShadow: '0 3px 8px color-mix(in srgb, var(--tp) 28%, transparent)',
            }}>
              ✨
            </span>
            <span style={{ color: '#1E1B4B', fontSize: 14, fontWeight: 900 }}>
              一键生成剩余关卡
            </span>
          </div>

          <p style={{
            margin: '0 0 12px',
            color: '#6B7280',
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.7,
            position: 'relative',
            zIndex: 1,
          }}>
            你可以点击这里一次性 AI 生成所有章节中，尚未准备好题目的关卡。<br/>生成过程会在后台自动执行；期间如果新章节加入，也会继续把新关卡一起准备好。
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative', zIndex: 1 }}>
            <button
              type="button"
              onClick={handleDismissGuide}
              className="btn-press"
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '6px 13px',
                background: 'linear-gradient(135deg, var(--tp-from), var(--tp))',
                color: 'white',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 800,
                boxShadow: '0 3px 8px color-mix(in srgb, var(--tp) 24%, transparent)',
              }}
            >
              我知道了
            </button>
          </div>

          {/* Downward pointer aimed at the floating generation button */}
          <div style={{
            position: 'absolute',
            bottom: -8,
            left: 24,
            width: 16,
            height: 16,
            background: 'rgba(248,247,255,0.98)',
            borderRight: '1.5px solid color-mix(in srgb, var(--tp) 24%, white)',
            borderBottom: '1.5px solid color-mix(in srgb, var(--tp) 24%, white)',
            transform: 'rotate(45deg)',
          }} />
        </div>
      )}

      <button
        onClick={toggle}
        className="btn-press"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 14px 8px 10px',
          borderRadius: 24,
          border: 'none',
          background: isActive
            ? 'linear-gradient(135deg, #10B981, #059669)'
            : 'color-mix(in srgb, var(--tp) 88%, transparent)',
          color: 'white',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: isActive
            ? '0 3px 14px rgba(16,185,129,0.45)'
            : '0 3px 14px color-mix(in srgb, var(--tp) 38%, transparent)',
          backdropFilter: 'blur(10px)',
          transition: 'background 0.22s ease, box-shadow 0.22s ease',
          whiteSpace: 'nowrap',
        }}
      >
        {/* 图标：运行中显示旋转 spinner，空闲显示 ⚡ */}
        {running ? (
          <span
            className="animate-spin"
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: '2px solid rgba(255,255,255,0.35)',
              borderTopColor: 'white',
              borderRadius: '50%',
              flexShrink: 0,
            }}
          />
        ) : (
          <span style={{ fontSize: 13, lineHeight: 1 }}>⚡</span>
        )}

        {/* 主文案 */}
        <span>{labelText}</span>

        {/* 运行中提示可点击停止 */}
        {isActive && (
          <span style={{ opacity: 0.72, fontSize: 11 }}>· 停止</span>
        )}
      </button>
    </div>
  );
}
