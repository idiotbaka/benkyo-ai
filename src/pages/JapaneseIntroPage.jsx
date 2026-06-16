import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { JAPANESE_INTRO_BASICS } from '../data/japaneseIntroBasics';
import { useIcon } from '../lib/icons';

gsap.registerPlugin(useGSAP);

const TABS = [
  { id: 'basics', label: '基础知识' },
  { id: 'hiragana', label: '平假名' },
  { id: 'katakana', label: '片假名' },
];

export default function JapaneseIntroPage() {
  const navigate = useNavigate();
  const cakeImg = useIcon('sd/sd_cake.png');
  const sdNoBooksImg = useIcon('sd/sd_no_books.png');
  const [activeTab, setActiveTab] = useState('basics');
  const headerRef = useRef(null);
  const contentRef = useRef(null);

  useGSAP(() => {
    gsap.set([headerRef.current, contentRef.current], { opacity: 0, y: 18 });
  });

  useGSAP(() => {
    gsap.to(headerRef.current, { opacity: 1, y: 0, duration: 0.38, ease: 'back.out(2)' });
    gsap.to(contentRef.current, { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.7)', delay: 0.08 });
  }, []);

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
                onClick={() => setActiveTab(tab.id)}
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

      <div ref={contentRef} style={{ padding: '16px 16px 28px' }}>
        {activeTab === 'basics' ? (
          <BasicsList onOpenTopic={(topicId) => navigate(`/vocab/japanese-intro/basic/${topicId}`)} />
        ) : (
          <ComingSoonPanel
            icon={sdNoBooksImg}
            title={activeTab === 'hiragana' ? '平假名' : '片假名'}
          />
        )}
      </div>
    </div>
  );
}

function BasicsList({ onOpenTopic }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {JAPANESE_INTRO_BASICS.map((topic, index) => (
        <button
          key={topic.id}
          type="button"
          className="btn-press"
          onClick={() => onOpenTopic(topic.id)}
          style={{
            width: '100%',
            border: '2px solid #E5E7EB',
            borderRadius: 14,
            background: 'white',
            boxShadow: '0 3px 0 #E5E7EB',
            padding: '14px 14px 15px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'grid',
            gap: 9,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 900, marginBottom: 4 }}>
                第 {String(index + 1).padStart(2, '0')} 讲
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: '#1E1B4B', margin: 0, lineHeight: 1.3 }}>
                {topic.title}
              </h2>
            </div>
            <span
              aria-hidden="true"
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: '#F3F2FF',
                color: 'var(--tp)',
                fontSize: 18,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              ›
            </span>
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
      ))}
    </div>
  );
}

function ComingSoonPanel({ icon, title }) {
  return (
    <div
      style={{
        background: 'white',
        border: '1.5px dashed #DDD6FE',
        borderRadius: 18,
        padding: '44px 22px',
        minHeight: 260,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 12,
      }}
    >
      <img src={icon} alt="" width={128} height={128} style={{ objectFit: 'contain' }} />
      <div style={{ fontSize: 17, fontWeight: 900, color: '#1E1B4B' }}>{title}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF' }}>内容准备中</div>
    </div>
  );
}
