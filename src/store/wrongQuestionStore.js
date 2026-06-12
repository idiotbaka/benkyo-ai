import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const WRONG_QUESTION_STORE_KEY = 'benkyo-ai-wrong-questions';

export function getWrongQuestionId(chapterId, levelId, question) {
  const questionKey = question?.id ? String(question.id) : fingerprintQuestion(question);
  return `${String(chapterId ?? '')}::${String(levelId ?? '')}::${questionKey}`;
}

function cloneQuestion(question) {
  const cloned = JSON.parse(JSON.stringify(question ?? {}));
  delete cloned._isReview;
  delete cloned._wrongQuestionId;
  delete cloned._sourceChapterId;
  delete cloned._sourceLevelId;
  delete cloned._sourceQuestionId;
  return cloned;
}

function fingerprintQuestion(question) {
  const payload = stableStringify({
    type: question?.type,
    prompt: question?.prompt,
    sentence: question?.sentence,
    parts: question?.parts,
    answers: question?.answers,
    pairs: question?.pairs,
  });

  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  }
  return `fp-${Math.abs(hash).toString(36)}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const useWrongQuestionStore = create(
  persist(
    (set) => ({
      questions: [],

      addWrongQuestion({ chapterId, levelId, question }) {
        if (!chapterId || !levelId || !question?.type) return;

        const id = getWrongQuestionId(chapterId, levelId, question);
        const now = Date.now();
        const cleanQuestion = cloneQuestion(question);

        set(state => {
          const existing = state.questions.find(item => item.id === id);
          if (existing) {
            return {
              questions: state.questions.map(item => (
                item.id === id
                  ? {
                      ...item,
                      question: cleanQuestion,
                      lastWrongAt: now,
                      wrongCount: (item.wrongCount ?? 1) + 1,
                    }
                  : item
              )),
            };
          }

          return {
            questions: [
              {
                id,
                chapterId,
                levelId,
                question: cleanQuestion,
                addedAt: now,
                lastWrongAt: now,
                wrongCount: 1,
              },
              ...state.questions,
            ],
          };
        });
      },

      removeWrongQuestion(id) {
        if (!id) return;
        set(state => ({
          questions: state.questions.filter(item => item.id !== id),
        }));
      },
    }),
    {
      name: WRONG_QUESTION_STORE_KEY,
    }
  )
);

export default useWrongQuestionStore;
