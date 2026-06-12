import { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useCourseStore from '../store/courseStore';
import JapaneseSpeechButton from '../components/UI/JapaneseSpeechButton';
import RubyText from '../components/UI/RubyText';
import { useIcon } from '../lib/icons';
import { toKanaReading } from '../lib/japanese-text';

gsap.registerPlugin(useGSAP);

function buildWordFillSentence(question) {
  let answerIndex = 0;
  return (question.parts || []).map(part => {
    if (part !== '___') return part || '';
    const answer = question.answers?.[answerIndex] || '';
    answerIndex += 1;
    return answer;
  }).join('');
}

function getLevelExamples(questions) {
  return (questions || [])
    .filter(question => question.type === 'word-fill' || question.type === 'sentence-translate')
    .map(question => ({
      id: question.id,
      text: question.type === 'word-fill' ? buildWordFillSentence(question) : question.sentence,
      translation: question.translation || question.answers?.join('') || '',
      hint: question.hint || '',
      ruby: question.ruby || {},
    }))
    .filter(example => example.text);
}

function getLevelWords(questions) {
  const seen = new Set();
  const words = [];

  for (const question of questions || []) {
    if (question.type !== 'word-match') continue;
    for (const pair of question.pairs || []) {
      const key = `${pair.jp}::${pair.cn}`;
      if (!pair.jp || seen.has(key)) continue;
      seen.add(key);
      words.push({
        jp: pair.jp,
        cn: pair.cn || '',
        ruby: pair.ruby || {},
      });
    }
  }

  return words;
}

function EmptyBlock({ children }) {
  return (
    <div style={{
      background: 'white',
      border: '1.5px dashed #DDD6FE',
      borderRadius: 16,
      padding: '20px 16px',
      color: '#9CA3AF',
      fontSize: 13,
      fontWeight: 700,
      textAlign: 'center',
    }}>
      {children}
    </div>
  );
}

function ExamplesSection({ examples }) {
  return (
    <section className="level-knowledge-section" style={{
      background: 'white',
      borderRadius: 18,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px 12px',
        borderBottom: '1.5px solid #F3F4F6',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>📕</span>
        <span style={{ fontSize: 16, fontWeight: 900, color: '#1E1B4B' }}>本关例句</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 14px 16px' }}>
        {examples.length === 0 ? (
          <EmptyBlock>这一关暂时没有可展示的例句</EmptyBlock>
        ) : examples.map((example, index) => {
          const spokenText = toKanaReading(example.text, example.ruby);
          return (
            <div key={`${example.id || 'example'}-${index}`} style={{
              background: index === 0 ? '#FAFAFA' : 'white',
              border: '1.5px solid #F3F4F6',
              borderRadius: 12,
              padding: example.hint ? '11px 14px 32px' : '11px 14px',
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}>
              <JapaneseSpeechButton text={example.text} spokenText={spokenText} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="jp" style={{ fontSize: 18, fontWeight: 800, color: '#1E1B4B', lineHeight: 2.05, marginBottom: 5 }}>
                  <RubyText text={example.text} rubyMap={example.ruby} />
                </div>
                {example.translation && (
                  <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, lineHeight: 1.55 }}>
                    {example.translation}
                  </div>
                )}
                {example.hint && (
                  <span style={{
                    position: 'absolute',
                    right: 10,
                    bottom: 8,
                    fontSize: 10,
                    fontWeight: 800,
                    background: 'var(--tp-lite)',
                    color: 'var(--tp-deep)',
                    borderRadius: 6,
                    padding: '1px 7px',
                  }}>
                    {example.hint}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WordsSection({ words }) {
  return (
    <section className="level-knowledge-section" style={{
      background: 'white',
      borderRadius: 18,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px 12px',
        borderBottom: '1.5px solid #F3F4F6',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>📚</span>
        <span style={{ fontSize: 16, fontWeight: 900, color: '#1E1B4B' }}>本关单词</span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 10,
        padding: '14px 14px 16px',
      }}>
        {words.length === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <EmptyBlock>这一关暂时没有可展示的单词</EmptyBlock>
          </div>
        ) : words.map((word, index) => {
          const kana = toKanaReading(word.jp, word.ruby);
          return (
            <div key={`${word.jp}-${word.cn}-${index}`} style={{
              background: '#FAFAFA',
              border: '1.5px solid #F3F4F6',
              borderRadius: 14,
              padding: '10px 12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ marginTop: 7, flexShrink: 0 }}>
                  <JapaneseSpeechButton text={word.jp} spokenText={kana} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500, minHeight: 16 }}>
                    {sameAsKana ? '' : kana}
                  </div> */}
                  <div className="jp" style={{ fontSize: 22, fontWeight: 900, color: '#1E1B4B', lineHeight: 1.45 }}>
                    <RubyText text={word.jp} rubyMap={word.ruby} />
                  </div>
                  <div style={{ fontSize: 13, color: '#4B5563', fontWeight: 700, marginTop: 2 }}>
                    {word.cn}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function LevelKnowledgePage() {
  const { chapterId, levelId } = useParams();
  const navigate = useNavigate();
  const sdLearnImg = useIcon('sd/sd_learn.png');
  const contentRef = useRef(null);
  const chapters = useCourseStore(s => s.chapters);

  const chapter = chapters.find(item => item.id === chapterId);
  const level = chapter?.levels.find(item => item.id === levelId);
  const questions = level?.questions || [];
  const examples = getLevelExamples(questions);
  const words = getLevelWords(questions);

  useGSAP(() => {
    const cards = contentRef.current?.querySelectorAll('.level-knowledge-section');
    if (!cards?.length) return;
    gsap.fromTo(cards,
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.08, duration: 0.45, ease: 'back.out(1.6)', delay: 0.1 }
    );
  }, [examples.length, words.length]);

  if (!chapter || !level || questions.length === 0) {
    return (
      <div style={{ height: '100vh', overflowY: 'auto', background: '#F5F3FF', padding: 24 }}>
        <button
          className="btn-press"
          onClick={() => navigate(-1)}
          style={{
            background: 'white',
            border: '1.5px solid #E5E7EB',
            borderRadius: 12,
            padding: '8px 14px',
            color: '#6B7280',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            marginBottom: 24,
          }}
        >
          ← 返回
        </button>
        <EmptyBlock>这一关还没有生成知识讲解内容</EmptyBlock>
      </div>
    );
  }

  const [fromColor, toColor] = chapter.gradient || [chapter.color || 'var(--tp-from)', chapter.color || 'var(--tp)'];
  const grammarPoints = Array.isArray(level.grammar) ? level.grammar : [];

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#F5F3FF', paddingBottom: 48 }}>
      <div style={{
        background: `linear-gradient(155deg, ${fromColor}, ${toColor})`,
        padding: '0 0 28px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -10,
          left: 20,
          width: 70,
          height: 70,
          borderRadius: '50%',
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

        <div style={{ padding: '14px 16px 0', position: 'relative', zIndex: 2 }}>
          <button
            className="btn-press"
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.18)',
              border: 'none',
              borderRadius: 12,
              padding: '7px 14px',
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← 返回
          </button>
        </div>

        <div style={{ padding: '18px 20px 0', position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>{level.icon ?? chapter.icon ?? '📖'}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em', marginBottom: 4 }}>
            {chapter.title} · 第 {level.number} 关知识讲解
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'white', margin: '0 0 6px', lineHeight: 1.2 }}>
            {level.title}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', margin: 0, lineHeight: 1.65, maxWidth: 270 }}>
            {level.topic}
          </p>
          {grammarPoints.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, maxWidth: 290 }}>
              {grammarPoints.map((point, index) => (
                <span key={`${point}-${index}`} style={{
                  background: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 10,
                  padding: '4px 10px',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 800,
                }}>
                  {point}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={contentRef} style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ExamplesSection examples={examples} />
        <WordsSection words={words} />
      </div>
    </div>
  );
}