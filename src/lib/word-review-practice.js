export const WORD_REVIEW_QUESTION_COUNT = 10;

const WORD_REVIEW_MODES = [
  'cn-to-jp',
  'cn-to-jp',
  'cn-to-jp',
  'cn-to-jp',
  'cn-to-jp',
  'jp-to-cn',
  'jp-to-cn',
  'jp-to-cn',
  'jp-to-cn',
  'jp-to-cn',
];

export function buildWordReviewPracticeQuestions(chapters, count = WORD_REVIEW_QUESTION_COUNT) {
  const words = collectWordMatchPairs(chapters);
  if (words.length < count) return [];

  const selectedWords = shuffle(words).slice(0, count);
  const modes = shuffle(WORD_REVIEW_MODES).slice(0, count);

  return selectedWords.map((word, index) => {
    const mode = modes[index];
    const options = buildOptions(words, word);
    return {
      id: `word-review-${index}-${word.id}`,
      type: 'word-review',
      mode,
      prompt: mode === 'cn-to-jp' ? '选择对应的日语单词' : '选择对应的中文释义',
      word,
      options,
      correctAnswer: mode === 'cn-to-jp' ? word.jp : word.cn,
    };
  });
}

export function getWordReviewPracticeQuestionCount(chapters) {
  return collectWordMatchPairs(chapters).length;
}

function collectWordMatchPairs(chapters) {
  const seen = new Set();
  const words = [];

  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    for (const level of Array.isArray(chapter?.levels) ? chapter.levels : []) {
      for (const question of level?.questions ?? []) {
        if (question?.type !== 'word-match') continue;
        for (const [pairIndex, pair] of (question.pairs ?? []).entries()) {
          const jp = String(pair?.jp ?? '').trim();
          const cn = String(pair?.cn ?? '').trim();
          if (!jp || !cn) continue;

          const key = `${jp}::${cn}`;
          if (seen.has(key)) continue;
          seen.add(key);

          words.push({
            id: `${level.id}-${question.id ?? 'wm'}-${pairIndex}-${jp}`,
            jp,
            cn,
            ruby: pair.ruby ?? {},
            levelId: level.id,
          });
        }
      }
    }
  }

  return words;
}

function buildOptions(allWords, correctWord) {
  const wrongOptions = shuffle(
    allWords.filter(word => word.jp !== correctWord.jp || word.cn !== correctWord.cn)
  ).slice(0, 3);

  return shuffle([correctWord, ...wrongOptions]);
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
