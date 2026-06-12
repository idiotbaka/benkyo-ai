export const COURSE_REVIEW_QUESTION_COUNT = 9;

export function buildCourseReviewPracticeQuestions(chapters, count = COURSE_REVIEW_QUESTION_COUNT) {
  const candidates = collectQuestionCandidates(chapters);
  if (candidates.length < count) return [];
  return shuffle(candidates).slice(0, count).map((question, index) => ({
    ...question,
    id: `course-review-${index}-${question.id ?? 'q'}`,
  }));
}

export function getCourseReviewPracticeQuestionCount(chapters) {
  return collectQuestionCandidates(chapters).length;
}

function collectQuestionCandidates(chapters) {
  const candidates = [];

  for (const chapter of Array.isArray(chapters) ? chapters : []) {
    for (const level of Array.isArray(chapter?.levels) ? chapter.levels : []) {
      for (const [questionIndex, question] of (level?.questions ?? []).entries()) {
        if (!question?.type) continue;
        const cleanQuestion = { ...question };
        delete cleanQuestion._isReview;
        candidates.push({
          ...cleanQuestion,
          id: `${chapter.id}-${level.id}-${question.id ?? questionIndex}`,
          _sourceChapterId: chapter.id,
          _sourceLevelId: level.id,
          _sourceQuestionId: question.id ?? questionIndex,
        });
      }
    }
  }

  return candidates;
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
