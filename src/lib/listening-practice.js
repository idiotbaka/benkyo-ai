import { invoke } from '@tauri-apps/api/core';

export const LISTENING_QUESTION_COUNT = 6;
export const TAURI_LISTENING_REQUIRED_MESSAGE = '需要在 Tauri 客户端中使用';

const PUNCTUATION_RE = /[\s。、，,.！？!?「」『』（）()［］[\]【】《》〈〉“”"‘’'・…‥:：;；]/g;

export function normalizeListeningSentence(sentence) {
  return String(sentence ?? '').replace(PUNCTUATION_RE, '');
}

export function isNativeJapaneseSegmenterAvailable() {
  return Boolean(globalThis.__TAURI_INTERNALS__);
}

export async function segmentListeningSentence(sentence) {
  const normalized = normalizeListeningSentence(sentence);
  if (!normalized) return [];

  if (!isNativeJapaneseSegmenterAvailable()) {
    throw new Error(TAURI_LISTENING_REQUIRED_MESSAGE);
  }

  const segments = cleanSegments(await invoke('segment_japanese_sentence', { text: sentence }));
  if (isValidSegmentation(segments, normalized)) return segments;

  throw new Error('日语分词结果不可用');
}

export async function buildListeningPracticeQuestions(chapters, count = LISTENING_QUESTION_COUNT) {
  if (!isNativeJapaneseSegmenterAvailable()) {
    throw new Error(TAURI_LISTENING_REQUIRED_MESSAGE);
  }

  const candidates = shuffle(collectListeningQuestionCandidates(chapters));
  if (candidates.length < count) return [];

  const questions = [];
  for (const question of candidates) {
    const segments = await segmentListeningSentence(question.sentence);
    if (!isValidSegmentation(segments, question.answerText)) continue;
    questions.push({
      ...question,
      segments,
      number: questions.length + 1,
    });

    if (questions.length >= count) break;
  }

  return questions.length >= count ? questions : [];
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

        if (!sentence || !translation || !answerText) continue;
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
        });
      }
    }
  }

  return candidates;
}

function cleanSegments(segments) {
  return (Array.isArray(segments) ? segments : [])
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
