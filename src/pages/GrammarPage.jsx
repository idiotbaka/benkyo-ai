import { useParams, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useCourseStore from '../store/courseStore';
import JapaneseSpeechButton from '../components/UI/JapaneseSpeechButton';
import sdLearnImg from '../assets/icons/sd/sd_learn.png';

gsap.registerPlugin(useGSAP);

// ── Ruby (furigana) renderer ─────────────────────────────────────────────────
function Ruby({ parts }) {
  return (
    <span style={{ lineHeight: 2.2 }}>
      {(parts || []).map((p, i) =>
        p.k ? (
          <ruby key={i} style={{ rubyAlign: 'center' }}>
            {p.t}
            <rt style={{ fontSize: '0.58em', letterSpacing: '0.02em' }}>{p.k}</rt>
          </ruby>
        ) : (
          <span key={i}>{p.t}</span>
        )
      )}
    </span>
  );
}

function getExampleText(parts) {
  return (parts || []).map(part => typeof part === 'string' ? part : part?.t || '').join('');
}

// ── POS badge colors ─────────────────────────────────────────────────────────
const POS_COLOR = {
  代词: { bg: 'var(--tp-lite)', color: 'var(--tp)' },
  名词: { bg: '#DBEAFE', color: '#1D4ED8' },
  动词: { bg: '#DCFCE7', color: '#15803D' },
  助词: { bg: '#FEF9C3', color: '#92400E' },
  助动词: { bg: '#FCE7F3', color: '#9D174D' },
};

// ── Section renderers ────────────────────────────────────────────────────────

function IntroSection({ section, chapterColor }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      padding: '16px 18px',
      borderLeft: `4px solid ${chapterColor}`,
      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    }}>
      <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, margin: 0 }}>
        {section.content}
      </p>
    </div>
  );
}

function GrammarRuleSection({ section }) {
  const badgeColor = section.badgeColor || 'var(--tp)';
  return (
    <div style={{
      background: 'white',
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    }}>
      {/* Card header */}
      <div style={{
        background: badgeColor + '0F',
        borderBottom: `1.5px solid ${badgeColor}22`,
        padding: '14px 18px 12px',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <div style={{
          background: badgeColor,
          color: 'white',
          fontSize: 11, fontWeight: 800,
          borderRadius: 8, padding: '3px 9px',
          flexShrink: 0, marginTop: 3,
        }}>
          {section.badge}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1E1B4B', letterSpacing: '-0.5px' }}>
            {section.title}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500, marginTop: 2, fontStyle: 'italic' }}>
            {section.reading}
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 18px 18px' }}>
        {/* Description */}
        <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.75, marginBottom: 14 }}>
          {section.description}
        </p>

        {/* Pattern visualizer */}
        <div style={{
          background: '#F8F7FF',
          border: '1.5px solid #E9E6FF',
          borderRadius: 12,
          padding: '11px 14px',
          display: 'flex', alignItems: 'center', flexWrap: 'wrap',
          gap: 6, marginBottom: 14,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginRight: 4 }}>句型</span>
          {(section.pattern || []).map((slot, i) =>
            slot.label ? (
              <span key={i} style={{
                background: slot.color + '1A',
                border: `1.5px solid ${slot.color}55`,
                borderRadius: 8, padding: '3px 10px',
                fontSize: 13, fontWeight: 700, color: slot.color,
              }}>
                {slot.label}
              </span>
            ) : (
              <span key={i} style={{ fontSize: 15, fontWeight: 800, color: '#1E1B4B' }}>
                {slot.text}
              </span>
            )
          )}
        </div>

        {/* Casual form note */}
        {section.casual && (
          <div style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: 10, padding: '7px 12px',
            fontSize: 12, color: '#166534', fontWeight: 600,
            marginBottom: 14,
          }}>
            💬 {section.casual}
          </div>
        )}

        {/* Examples */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(section.examples || []).map((ex, i) => (
            <div key={i} style={{
              background: i === 0 ? '#FAFAFA' : 'white',
              border: '1.5px solid #F3F4F6',
              borderRadius: 12, padding: '11px 14px',
              position: 'relative',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <JapaneseSpeechButton text={getExampleText(ex.parts)} />
              <div style={{ flex: 1, minWidth: 0 }}>
              {ex.note && (
                <span style={{
                  position: 'absolute', top: 8, right: 10,
                  fontSize: 10, fontWeight: 700,
                  background: 'var(--tp-lite)', color: 'var(--tp-deep)',
                  borderRadius: 6, padding: '1px 7px',
                }}>
                  {ex.note}
                </span>
              )}
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1E1B4B', marginBottom: 5 }}>
                <Ruby parts={ex.parts} />
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>
                {ex.cn}
              </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VocabularySection({ section }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 18,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px 12px',
        borderBottom: '1.5px solid #F3F4F6',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>📚</span>
        <span style={{ fontSize: 16, fontWeight: 900, color: '#1E1B4B' }}>{section.title}</span>
      </div>

      {/* Word grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 10, padding: '14px 14px 16px',
      }}>
        {(section.words || []).map((w, i) => {
          const posStyle = POS_COLOR[w.pos] || { bg: '#F3F4F6', color: '#6B7280' };
          const sameAsKana = w.jp === w.kana; // pure kana word
          return (
            <div key={i} style={{
              background: '#FAFAFA',
              border: '1.5px solid #F3F4F6',
              borderRadius: 14, padding: '12px 12px 10px',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <JapaneseSpeechButton text={w.jp} />
              <div style={{ flex: 1, minWidth: 0 }}>
              {/* Kana */}
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500, minHeight: 16 }}>
                {sameAsKana ? '' : w.kana}
              </div>
              {/* Kanji */}
              <div style={{ fontSize: 22, fontWeight: 900, color: '#1E1B4B', lineHeight: 1.2 }}>
                {w.jp}
              </div>
              {/* Chinese + POS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 13, color: '#4B5563', fontWeight: 600 }}>{w.cn}</span>
                <span style={{
                  fontSize: 9, fontWeight: 800,
                  background: posStyle.bg, color: posStyle.color,
                  borderRadius: 5, padding: '1px 6px',
                }}>
                  {w.pos}
                </span>
              </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TipSection({ section }) {
  return (
    <div style={{
      background: '#FFFBEB',
      border: '1.5px solid #FDE68A',
      borderRadius: 16,
      padding: '14px 16px',
      display: 'flex', gap: 12,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{section.icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#92400E', marginBottom: 5 }}>
          {section.title}
        </div>
        <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.75 }}>
          {section.content}
        </div>
      </div>
    </div>
  );
}

// ── Section type dispatcher ──────────────────────────────────────────────────
function Section({ section, chapterColor }) {
  switch (section.type) {
    case 'intro':         return <IntroSection section={section} chapterColor={chapterColor} />;
    case 'grammar-rule':  return <GrammarRuleSection section={section} />;
    case 'vocabulary':    return <VocabularySection section={section} />;
    case 'tip':           return <TipSection section={section} />;
    default:              return null;
  }
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function GrammarPage() {
  const { chapterId } = useParams();
  const navigate      = useNavigate();
  const contentRef    = useRef(null);
  const chapters      = useCourseStore(s => s.chapters);

  const chapter = chapters.find(c => c.id === chapterId);

  useGSAP(() => {
    const cards = contentRef.current?.querySelectorAll('.grammar-section');
    if (!cards?.length) return;
    gsap.fromTo(cards,
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.08, duration: 0.45, ease: 'back.out(1.6)', delay: 0.1 }
    );
  }, []);

  if (!chapter || !chapter.grammar) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>
        暂无语法内容
      </div>
    );
  }

  const [fromColor, toColor] = chapter.gradient;
  const sections = chapter.grammar.sections || [];

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#F5F3FF', paddingBottom: 48 }}>
      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(155deg, ${fromColor}, ${toColor})`,
        padding: '0 0 28px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 110, height: 110, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
        }} />
        <div style={{
          position: 'absolute', bottom: -10, left: 20,
          width: 70, height: 70, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
        }} />
        <img
          src={sdLearnImg}
          alt=""
          aria-hidden="true"
          width={178}
          height={178}
          style={{
            position: 'absolute',
            right: -16,
            bottom: -8,
            objectFit: 'contain',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* Back button row */}
        <div style={{ padding: '14px 16px 0', position: 'relative', zIndex: 2 }}>
          <button
            className="btn-press"
            onClick={() => navigate(-1)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.18)',
              border: 'none', borderRadius: 12,
              padding: '7px 14px',
              color: 'white', fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← 返回
          </button>
        </div>

        {/* Chapter info */}
        <div style={{ padding: '18px 20px 0', position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>{chapter.icon}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em', marginBottom: 4 }}>
            {chapter.title} · 语法教程
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'white', margin: '0 0 6px', lineHeight: 1.2 }}>
            {chapter.subtitle}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {sections.filter(s => s.type === 'grammar-rule').length} 个语法点 ·{' '}
            {(sections.find(s => s.type === 'vocabulary')?.words || []).length} 个单词
          </p>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div ref={contentRef} style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sections.map((section, i) => (
          <div key={i} className="grammar-section">
            <Section section={section} chapterColor={chapter.color} />
          </div>
        ))}
      </div>
    </div>
  );
}
