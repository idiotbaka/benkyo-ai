export const LISTENING_QUESTION_COUNT = 6;

const PUNCTUATION_RE = /[\s。、，,.！？!?「」『』（）()［］[\]【】《》〈〉“”"‘’'・…‥:：;；]/g;
let japaneseWordSegmenter = null;

export function normalizeListeningSentence(sentence) {
  return String(sentence ?? '').replace(PUNCTUATION_RE, '');
}

export function segmentListeningSentence(sentence) {
  const normalized = normalizeListeningSentence(sentence);
  if (!normalized) return [];

  const segments = segmentWithIntl(normalized);
  if (isValidSegmentation(segments, normalized)) return segments;

  // Defensive fallback for old Android WebView / old desktop WebKit.
  // Modern supported runtimes should use Intl.Segmenter above.
  return Array.from(normalized);
}

export function buildListeningPracticeQuestions(chapters, count = LISTENING_QUESTION_COUNT) {
  const candidates = collectListeningQuestionCandidates(chapters);
  if (candidates.length < count) return [];
  return shuffle(candidates).slice(0, count).map((question, index) => ({
    ...question,
    number: index + 1,
  }));
}

export function getListeningPracticeQuestionCount(chapters) {
  return collectListeningQuestionCandidates(chapters).length;
}

function collectListeningQuestionCandidates(chapters) {
  const seen = new Set();
  const candidates = [];

  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    for (const level of Array.isArray(chapter?.levels) ? chapter.levels : []) {
      for (const [questionIndex, question] of (level?.questions ?? []).entries()) {
        if (question?.type !== 'sentence-translate') continue;
        const sentence = String(question.sentence ?? '').trim();
        const translation = String(question.translation ?? '').trim();
        const answerText = normalizeListeningSentence(sentence);
        const segments = segmentListeningSentence(sentence);

        if (!sentence || !translation || !answerText || segments.length < 2) continue;
        if (seen.has(answerText)) continue;
        seen.add(answerText);

        candidates.push({
          id: `listening-${chapter.id}-${level.id}-${question.id ?? questionIndex}`,
          type: 'listening-build',
          prompt: '听音频，拼出听到的日语句子',
          sentence,
          translation,
          ruby: question.ruby ?? {},
          answerText,
          segments,
        });
      }
    }
  }

  return candidates;
}

function segmentWithIntl(text) {
  try {
    const segmenter = getJapaneseWordSegmenter();
    if (!segmenter) return [];
    return cleanSegments([...segmenter.segment(text)].map(part => part.segment));
  } catch {
    return [];
  }
}

function getJapaneseWordSegmenter() {
  if (!globalThis.Intl?.Segmenter) return null;
  japaneseWordSegmenter ??= new Intl.Segmenter('ja-JP', { granularity: 'word' });
  return japaneseWordSegmenter;
}

function cleanSegments(segments) {
  return segments
    .map(segment => normalizeListeningSentence(segment))
    .filter(Boolean);
}

function isValidSegmentation(segments, normalized) {
  return Array.isArray(segments) && segments.length >= 2 && segments.join('') === normalized;
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
