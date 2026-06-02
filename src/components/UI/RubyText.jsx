/**
 * RubyText — 渲染带假名标注（振り仮名）的日语文本
 *
 * @param {string} text      - 原始日语文本
 * @param {object} rubyMap   - 汉字 → 读音映射，例如 { "私": "わたし", "田中": "たなか" }
 * @param {(word: string) => void} onRubyClick - 点击带注音词语时的可选回调
 */
export default function RubyText({ text, rubyMap = {}, onRubyClick }) {
  const keys = Object.keys(rubyMap);

  if (!text || keys.length === 0) {
    return <span>{text}</span>;
  }

  // 按长度降序排列，优先匹配最长词（避免「日本語」被「日本」先截走）
  const sortedKeys = [...keys].sort((a, b) => b.length - a.length);

  const segments = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliestIdx = -1;
    let earliestKey = null;

    for (const key of sortedKeys) {
      const idx = remaining.indexOf(key);
      if (idx !== -1 && (earliestIdx === -1 || idx < earliestIdx)) {
        earliestIdx = idx;
        earliestKey = key;
      }
    }

    if (earliestKey === null) {
      segments.push({ type: 'text', value: remaining });
      break;
    }

    if (earliestIdx > 0) {
      segments.push({ type: 'text', value: remaining.slice(0, earliestIdx) });
    }
    segments.push({ type: 'ruby', kanji: earliestKey, reading: rubyMap[earliestKey] });
    remaining = remaining.slice(earliestIdx + earliestKey.length);
  }

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'ruby' && onRubyClick ? (
          <button
            key={i}
            type="button"
            onClick={() => onRubyClick(seg.kanji)}
            aria-label={`播放「${seg.kanji}」`}
            title={`播放「${seg.kanji}」`}
            style={{
              display: 'inline-block',
              background: 'none',
              border: 'none',
              borderBottom: '1.5px dashed #9CA3AF',
              color: 'inherit',
              cursor: 'pointer',
              font: 'inherit',
              lineHeight: 'inherit',
              margin: '0 1px',
              padding: '0 1px 2px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <ruby>
              {seg.kanji}
              <rt>{seg.reading}</rt>
            </ruby>
          </button>
        ) : seg.type === 'ruby' ? (
          <ruby key={i}>
            {seg.kanji}
            <rt>{seg.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </>
  );
}
