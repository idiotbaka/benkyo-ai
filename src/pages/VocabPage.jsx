import { useState, useMemo, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useVocabStore from '../store/vocabStore';
import RubyText from '../components/UI/RubyText';
import JapaneseSpeechButton from '../components/UI/JapaneseSpeechButton';
import bookImg from '../assets/icons/ui/book.png';
import sdNoBooksImg from '../assets/icons/sd/sd_no_books.png';

gsap.registerPlugin(useGSAP);

const SORT_OPTIONS = [
  { id: 'newest', label: '由新到旧' },
  { id: 'oldest', label: '由旧到新' },
  { id: 'gojuon', label: '五十音' },
];

/** 将 jp 文字中的汉字替换为假名读音，用于五十音排序 */
function getKanaReading(jp, ruby) {
  if (!ruby || Object.keys(ruby).length === 0) return jp;
  let result = jp;
  for (const [kanji, reading] of Object.entries(ruby)) {
    result = result.split(kanji).join(reading);
  }
  return result;
}

export default function VocabPage() {
  const words = useVocabStore(s => s.words);
  const [sort, setSort] = useState('newest');

  const headerRef = useRef(null);
  const contentRef = useRef(null);

  useGSAP(() => {
    gsap.set([headerRef.current, contentRef.current], { opacity: 0, y: 18 });
  });

  useGSAP(() => {
    gsap.to(headerRef.current, { opacity: 1, y: 0, duration: 0.38, ease: 'back.out(2)' });
    gsap.to(contentRef.current, { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.7)', delay: 0.08 });
  }, []);

  const sorted = useMemo(() => {
    const arr = [...words];
    switch (sort) {
      case 'newest': return arr.sort((a, b) => b.addedAt - a.addedAt);
      case 'oldest': return arr.sort((a, b) => a.addedAt - b.addedAt);
      case 'gojuon':  return arr.sort((a, b) => {
        const ak = getKanaReading(a.jp, a.ruby);
        const bk = getKanaReading(b.jp, b.ruby);
        return ak.localeCompare(bk, 'ja');
      });
      default: return arr;
    }
  }, [words, sort]);

  return (
    <div
      data-ui-click-sfx
      className="h-full overflow-y-auto"
      style={{ background: '#F5F3FF' }}
    >
      {/* 顶部标题栏 */}
      <div
        ref={headerRef}
        style={{
          background: 'white',
          padding: '18px 20px 14px',
          boxShadow: '0 2px 12px rgba(91,79,233,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={bookImg} alt="单词本" width={28} height={28} style={{ objectFit: 'contain' }} />
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B', margin: 0 }}>单词本</h1>
          </div>
          {words.length > 0 && (
            <div
              style={{
                background: 'var(--tp-lite)',
                color: 'var(--tp)',
                fontSize: 12,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 20,
              }}
            >
              {words.length} 个词
            </div>
          )}
        </div>

        {/* 排序选择器 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className="btn-press"
              onClick={() => setSort(opt.id)}
              style={{
                padding: '5px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
                background: sort === opt.id ? 'var(--tp)' : '#F3F2FF',
                color: sort === opt.id ? 'white' : '#7C72E0',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <div ref={contentRef} style={{ padding: '16px 16px 24px' }}>

        {/* 空状态 */}
        {words.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '56px 24px',
              gap: 16,
              textAlign: 'center',
            }}
          >
            <img
              src={sdNoBooksImg}
              alt="空书架"
              width={160}
              height={160}
              style={{ objectFit: 'contain', marginBottom: -4 }}
            />
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#1E1B4B', marginBottom: 6 }}>
                还没有收录单词
              </div>
              <div style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.6 }}>
                完成关卡中的「单词对对碰」后
                <br />
                单词会自动加入单词本
              </div>
            </div>
          </div>
        ) : (
          /* 单词卡片网格 */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            {sorted.map(word => (
              <WordCard key={word.id} word={word} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WordCard({ word }) {
  return (
    <div
      style={{
        background: 'white',
        border: '1.5px solid #F3F2FF',
        borderRadius: 16,
        padding: '14px 12px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        boxShadow: '0 2px 8px rgba(91,79,233,0.06)',
      }}
    >
      {/* 日语单词（含假名标注） */}
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: '#1E1B4B',
          lineHeight: 2.2,
          textAlign: 'center',
        }}
      >
        <RubyText text={word.jp} rubyMap={word.ruby} />
      </div>

      {/* 中文释义 */}
      <div
        style={{
          fontSize: 13,
          color: '#4B5563',
          fontWeight: 600,
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      >
        {word.cn}
      </div>

      <JapaneseSpeechButton text={word.jp} />
    </div>
  );
}
