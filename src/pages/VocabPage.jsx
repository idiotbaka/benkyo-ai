import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useVocabStore from '../store/vocabStore';
import useCourseStore from '../store/courseStore';
import useTtsStore from '../store/ttsStore';
import useGameStore from '../store/gameStore';
import useUserStore from '../store/userStore';
import useListeningPracticeStore from '../store/listeningPracticeStore';
import useWordReviewPracticeStore from '../store/wordReviewPracticeStore';
import useWrongQuestionStore from '../store/wrongQuestionStore';
import { getTtsConfigError } from '../lib/tts';
import {
  TAURI_LISTENING_REQUIRED_MESSAGE,
  buildListeningPracticeQuestions,
  getListeningPracticeQuestionCount,
  isNativeJapaneseSegmenterAvailable,
} from '../lib/listening-practice';
import { buildCourseReviewPracticeQuestions, getCourseReviewPracticeQuestionCount } from '../lib/course-review-practice';
import { buildWordReviewPracticeQuestions, getWordReviewPracticeQuestionCount } from '../lib/word-review-practice';
import { buildWrongReviewPracticeQuestions } from '../lib/wrong-review-practice';
import { useIcon } from '../lib/icons';

gsap.registerPlugin(useGSAP);

const PRACTICE_ENTRIES = [
  {
    id: 'japanese-intro',
    label: '日语入门',
    desc: '基础知识和五十音',
    icon: 'sd/sd_cake.png',
  },
  {
    id: 'listening',
    label: '听力练习',
    desc: '日语听辨训练',
    icon: 'sd/sd_lc_listening.png',
  },
  {
    id: 'course-review',
    label: '课程巩固',
    desc: '复习已学关卡',
    icon: 'sd/sd_learn.png',
  },
  {
    id: 'word-review',
    label: '单词复习',
    desc: '强化词汇记忆',
    icon: 'sd/sd_lc_word.png',
  },
  {
    id: 'mistakes',
    label: '错题重练',
    desc: '回看薄弱题目',
    icon: 'sd/sd_lc_incorrect.png',
  },
];

export default function VocabPage() {
  const words = useVocabStore(s => s.words);
  const chapters = useCourseStore(s => s.chapters);
  const wrongQuestions = useWrongQuestionStore(s => s.questions);
  const startListeningPractice = useListeningPracticeStore(s => s.start);
  const startWordReviewPractice = useWordReviewPracticeStore(s => s.start);
  const startPracticeLesson = useGameStore(s => s.startPracticeLesson);
  const navigate = useNavigate();
  const bookImg = useIcon('ui/book.png');
  const headerRef = useRef(null);
  const contentRef = useRef(null);
  const [notice, setNotice] = useState(null);
  const [listeningStarting, setListeningStarting] = useState(false);
  const wrongQuestionCount = wrongQuestions.length;
  const practiceQuestionCounts = useMemo(() => ({
    listening: getListeningPracticeQuestionCount(chapters),
    courseReview: getCourseReviewPracticeQuestionCount(chapters),
    wordReview: getWordReviewPracticeQuestionCount(chapters),
  }), [chapters]);

  const hasHeartsForPractice = () => {
    useUserStore.getState().syncHearts();
    if (useUserStore.getState().hearts === 0) {
      setNotice('no-hearts');
      return false;
    }
    return true;
  };

  useGSAP(() => {
    const cards = contentRef.current?.querySelectorAll('[data-practice-card]');
    gsap.set([headerRef.current, contentRef.current], { opacity: 0, y: 18 });
    gsap.set(cards, { opacity: 0, y: 18, scale: 0.98 });
  });

  useGSAP(() => {
    const cards = contentRef.current?.querySelectorAll('[data-practice-card]');
    const sdImages = contentRef.current?.querySelectorAll('[data-practice-sd]');

    gsap.to(headerRef.current, { opacity: 1, y: 0, duration: 0.36, ease: 'back.out(2)' });
    gsap.to(contentRef.current, { opacity: 1, y: 0, duration: 0.34, ease: 'back.out(1.7)', delay: 0.08 });
    gsap.to(cards, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.42,
      ease: 'back.out(1.8)',
      stagger: 0.06,
      delay: 0.12,
    });
    gsap.to(sdImages, {
      y: -5,
      rotate: 1.5,
      repeat: -1,
      yoyo: true,
      duration: 2.6,
      ease: 'sine.inOut',
      stagger: 0.35,
      delay: 0.7,
    });

  }, []);

  const handleListeningPractice = async () => {
    if (listeningStarting) return;

    if (!isNativeJapaneseSegmenterAvailable()) {
      setNotice('tauri-required');
      return;
    }

    const ttsConfig = useTtsStore.getState().getConfig();
    if (getTtsConfigError(ttsConfig)) {
      setNotice('tts');
      return;
    }

    if (!hasHeartsForPractice()) return;

    setListeningStarting(true);
    let questions;
    try {
      questions = await buildListeningPracticeQuestions(chapters);
    } catch (error) {
      setNotice(error?.message === TAURI_LISTENING_REQUIRED_MESSAGE ? 'tauri-required' : 'segmenter-error');
      return;
    } finally {
      setListeningStarting(false);
    }

    if (questions.length === 0) {
      setNotice('too-few');
      return;
    }

    if (!startListeningPractice(questions)) {
      setNotice('no-hearts');
      return;
    }
    navigate('/practice/listening');
  };

  const handleCourseReviewPractice = () => {
    const questions = buildCourseReviewPracticeQuestions(chapters);
    if (questions.length === 0) {
      setNotice('too-few');
      return;
    }

    if (!hasHeartsForPractice()) return;

    startPracticeLesson({
      levelId: 'course-review',
      title: '课程巩固',
      questions,
      returnPath: '/vocab',
    });
    navigate('/practice/course-review');
  };

  const handleWordReviewPractice = () => {
    const questions = buildWordReviewPracticeQuestions(chapters);
    if (questions.length === 0) {
      setNotice('too-few');
      return;
    }

    if (!hasHeartsForPractice()) return;
    if (!startWordReviewPractice(questions)) {
      setNotice('no-hearts');
      return;
    }
    navigate('/practice/word-review');
  };

  const handleWrongReviewPractice = () => {
    const questions = buildWrongReviewPracticeQuestions(wrongQuestions);
    if (questions.length === 0) {
      setNotice('wrong-too-few');
      return;
    }

    if (!hasHeartsForPractice()) return;

    startPracticeLesson({
      levelId: 'wrong-review',
      title: '错题重练',
      questions,
      returnPath: '/vocab',
      practiceType: 'wrong-review',
    });
    navigate('/practice/wrong-review');
  };

  return (
    <div
      data-ui-click-sfx
      className="h-full overflow-y-auto scroll-y"
      style={{ background: '#F5F3FF', position: 'relative' }}
    >
      <div style={{ padding: '18px 16px 28px', position: 'relative', zIndex: 1 }}>
        <h1
          ref={headerRef}
          style={{ fontSize: 18, fontWeight: 900, color: '#4B5563', margin: '0 0 10px' }}
        >
          练习中心
        </h1>

        <div ref={contentRef}>
          <div style={{ display: 'grid', gap: 18 }}>
            {PRACTICE_ENTRIES.map(entry => (
              <PracticeEntry
                key={entry.id}
                entry={withPracticeEntryBadge(entry, practiceQuestionCounts, wrongQuestionCount)}
                onClick={
                  entry.id === 'listening'
                    ? handleListeningPractice
                    : entry.id === 'japanese-intro'
                    ? () => navigate('/vocab/japanese-intro')
                    : entry.id === 'course-review'
                    ? handleCourseReviewPractice
                    : entry.id === 'word-review'
                    ? handleWordReviewPractice
                    : entry.id === 'mistakes'
                    ? handleWrongReviewPractice
                    : undefined
                }
                loading={entry.id === 'listening' && listeningStarting}
              />
            ))}
          </div>

          <PracticeSection title="我的笔记" style={{ marginTop: 24 }}>
            <PracticeEntry
              entry={{
                id: 'vocab-book',
                label: '单词本',
                icon: 'ui/book.png',
                bg: 'var(--tp-lite)',
                badge: words.length > 0 ? String(words.length) : '',
              }}
              iconSrc={bookImg}
              onClick={() => navigate('/vocab/book')}
            />
          </PracticeSection>
        </div>
      </div>

      {notice === 'tts' && (
        <PracticeNoticeSheet
          type="tts"
          onClose={() => setNotice(null)}
          onGoSettings={() => {
            setNotice(null);
            navigate('/settings?panel=tts');
          }}
        />
      )}
      {notice === 'too-few' && (
        <PracticeNoticeSheet
          type="too-few"
          onClose={() => setNotice(null)}
        />
      )}
      {notice === 'wrong-too-few' && (
        <PracticeNoticeSheet
          type="wrong-too-few"
          onClose={() => setNotice(null)}
        />
      )}
      {notice === 'no-hearts' && (
        <PracticeNoticeSheet
          type="no-hearts"
          onClose={() => setNotice(null)}
        />
      )}
      {notice === 'tauri-required' && (
        <PracticeNoticeSheet
          type="tauri-required"
          onClose={() => setNotice(null)}
        />
      )}
      {notice === 'segmenter-error' && (
        <PracticeNoticeSheet
          type="segmenter-error"
          onClose={() => setNotice(null)}
        />
      )}
    </div>
  );
}

function PracticeNoticeSheet({ type, onClose, onGoSettings }) {
  const overlayRef = useRef(null);
  const sheetRef = useRef(null);
  const sdFallImg = useIcon('sd/sd_fall.png');
  const sdNoBooksImg = useIcon('sd/sd_no_books.png');
  const isTts = type === 'tts';
  const isTauriRequired = type === 'tauri-required';
  const isSegmenterError = type === 'segmenter-error';
  const isWrongTooFew = type === 'wrong-too-few';
  const isTooFew = type === 'too-few' || isWrongTooFew;

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
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        style={{
          width: '100%',
          background: 'white',
          borderRadius: '24px 24px 0 0',
          padding: '0 20px 36px',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.20)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E5E0FF', margin: '12px auto 22px' }} />
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img
            src={isTooFew ? sdNoBooksImg : sdFallImg}
            alt=""
            width={148}
            height={148}
            style={{ objectFit: 'contain', margin: '0 auto 6px' }}
          />
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1E1B4B', marginBottom: 8 }}>
            {isTts
              ? '尚未配置音频模型'
              : isTauriRequired
              ? '请使用客户端'
              : isSegmenterError
              ? '听力练习暂不可用'
              : isWrongTooFew
              ? '错题还不够'
              : isTooFew
              ? '题库还不够'
              : '生命值耗尽'}
          </h2>
          <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, margin: '0 8px' }}>
            {isTts ? (
              <>
                听力练习需要先配置音频模型。<br />
                请前往 <strong>「我的」→「设置」</strong> 中填写 TTS 配置。
              </>
            ) : isTauriRequired ? (
              '需要在 Tauri 客户端中使用'
            ) : isSegmenterError ? (
              '日语分词初始化失败，请重新启动 Tauri 客户端后再试。'
            ) : isTooFew ? (
              isWrongTooFew ? '当前错题太少啦，以后再回来吧~' : '当前题库太少啦，多闯几关后再回来吧~'
            ) : (
              '心心恢复后再回来练习吧~'
            )}
          </p>
        </div>
        {isTts && (
          <button
            onClick={onGoSettings}
            className="btn-press"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 18,
              border: 'none',
              background: 'linear-gradient(135deg, var(--tp-from), var(--tp))',
              color: 'white',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            前往设置 →
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 18,
            border: '1.5px solid #E5E7EB',
            background: 'white',
            color: '#6B7280',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {isTts ? '稍后再说' : '知道啦'}
        </button>
      </div>
    </div>
  );
}

function PracticeSection({ title, style, children }) {
  return (
    <section style={style}>
      <h2 style={{ fontSize: 18, fontWeight: 900, color: '#4B5563', margin: '0 0 10px' }}>
        {title}
      </h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function withPracticeEntryBadge(entry, practiceQuestionCounts, wrongQuestionCount) {
  if (entry.id === 'mistakes') {
    return {
      ...entry,
      badge: `错题 ${wrongQuestionCount}`,
      badgeTone: wrongQuestionCount > 0 ? 'danger' : 'muted',
    };
  }

  const countById = {
    listening: practiceQuestionCounts.listening,
    'course-review': practiceQuestionCounts.courseReview,
    'word-review': practiceQuestionCounts.wordReview,
  };

  if (!(entry.id in countById)) return entry;
  const count = countById[entry.id] ?? 0;
  return {
    ...entry,
    badge: `题库 ${count}`,
    badgeTone: count > 0 ? 'info' : 'muted',
  };
}

function PracticeEntry({ entry, iconSrc, onClick, loading = false }) {
  const resolvedIcon = useIcon(entry.icon);
  const src = iconSrc || resolvedIcon;
  const badgeStyle = getPracticeBadgeStyle(entry.badgeTone);
  const disabled = loading || !onClick;

  if (entry.desc) {
    return (
      <div
        data-practice-card
        style={{
          height: 126,
          paddingTop: 18,
          position: 'relative',
        }}
      >
        <button
          type="button"
          className="btn-press"
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          style={{
            width: '100%',
            minHeight: 108,
            background: 'white',
            border: '2px solid #E5E7EB',
            borderRadius: 12,
            padding: '18px 132px 18px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: 6,
            boxShadow: '0 3px 0 #E5E7EB',
            cursor: disabled ? 'default' : 'pointer',
            opacity: loading ? 0.78 : 1,
            position: 'relative',
            overflow: 'visible',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
            <span style={{ fontSize: 17, fontWeight: 900, color: '#4B5563', whiteSpace: 'nowrap' }}>
              {entry.label}
            </span>
            {entry.badge && (
              <span
                style={{
                  height: 22,
                  padding: '0 9px',
                  borderRadius: 999,
                  border: `1.5px solid ${badgeStyle.border}`,
                  background: badgeStyle.background,
                  color: badgeStyle.color,
                  fontSize: 11,
                  fontWeight: 900,
                  lineHeight: '19px',
                  whiteSpace: 'nowrap',
                  boxShadow: badgeStyle.shadow,
                }}
              >
                {entry.badge}
              </span>
            )}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', lineHeight: 1.35 }}>
            {loading ? '准备题目中...' : entry.desc}
          </span>
          <img
            data-practice-sd
            src={src}
            alt=""
            width={126}
            height={126}
            style={{
              position: 'absolute',
              right: 4,
              bottom: -4,
              width: 126,
              height: 126,
              objectFit: 'contain',
              pointerEvents: 'none',
            }}
          />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn-press"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 74,
        background: 'white',
        border: '2px solid #E5E7EB',
        borderRadius: 12,
        padding: '12px 14px 12px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        boxShadow: '0 2px 0 #E5E7EB',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 900, color: '#4B5563', whiteSpace: 'nowrap' }}>
        {entry.label}
      </span>
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: entry.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <img src={src} alt="" width={42} height={42} style={{ objectFit: 'contain' }} />
      </span>
      {entry.badge && (
        <span
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 20,
            height: 20,
            borderRadius: 999,
            background: '#EF4444',
            color: 'white',
            fontSize: 11,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
            border: '2px solid white',
          }}
        >
          {entry.badge}
        </span>
      )}
    </button>
  );
}

function getPracticeBadgeStyle(tone) {
  if (tone === 'danger') {
    return {
      border: '#FDA4AF',
      background: '#FFF1F2',
      color: '#E11D48',
      shadow: '0 2px 0 #FFE4E6',
    };
  }

  if (tone === 'info') {
    return {
      border: 'var(--tp-bdr)',
      background: 'var(--tp-lite)',
      color: 'var(--tp)',
      shadow: '0 2px 0 color-mix(in srgb, var(--tp-bdr) 60%, white)',
    };
  }

  return {
    border: '#E5E7EB',
    background: '#F9FAFB',
    color: '#9CA3AF',
    shadow: 'none',
  };
}
