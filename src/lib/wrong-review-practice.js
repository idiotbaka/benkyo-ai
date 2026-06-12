export const WRONG_REVIEW_QUESTION_COUNT = 9;

export function buildWrongReviewPracticeQuestions(wrongQuestions, count = WRONG_REVIEW_QUESTION_COUNT) {
  const candidates = collectWrongQuestionCandidates(wrongQuestions);
  if (candidates.length < count) return [];

  return shuffle(candidates).slice(0, count).map((record, index) => ({
    ...cloneQuestion(record.question),
    id: `wrong-review-${index}-${record.id}`,
    _wrongQuestionId: record.id,
    _sourceChapterId: record.chapterId,
    _sourceLevelId: record.levelId,
    _sourceQuestionId: record.question?.id ?? record.id.split('::').slice(2).join('::'),
  }));
}

function collectWrongQuestionCandidates(wrongQuestions) {
  return (Array.isArray(wrongQuestions) ? wrongQuestions : [])
    .filter(record => record?.id && record?.question?.type);
}

function cloneQuestion(question) {
  const cloned = JSON.parse(JSON.stringify(question ?? {}));
  delete cloned._isReview;
  delete cloned._wrongQuestionId;
  delete cloned._sourceQuestionId;
  return cloned;
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
