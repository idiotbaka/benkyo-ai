import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const JAPANESE_INTRO_PROGRESS_KEY = 'benkyo-ai-japanese-intro-progress';

function normalizeTopicId(topicId) {
  return String(topicId ?? '').trim();
}

function normalizeQuizId(quizId) {
  return String(quizId ?? '').trim();
}

function normalizeQuizIds(quizIds) {
  return Array.isArray(quizIds)
    ? quizIds.map(normalizeQuizId).filter(Boolean)
    : [];
}

function isResultCorrect(result) {
  return Boolean(result?.correct);
}

function isCompleteFromResults(results, topicId, quizIds) {
  const normalizedTopicId = normalizeTopicId(topicId);
  const requiredQuizIds = normalizeQuizIds(quizIds);
  if (!normalizedTopicId || requiredQuizIds.length === 0) return false;

  const topicResults = results?.[normalizedTopicId] ?? {};
  return requiredQuizIds.every(quizId => isResultCorrect(topicResults[quizId]));
}

const useJapaneseIntroProgressStore = create(
  persist(
    (set, get) => ({
      quizResults: {},
      completedTopics: {},

      markMiniQuizCorrect(topicId, quizId, answerId, requiredQuizIds = []) {
        const normalizedTopicId = normalizeTopicId(topicId);
        const normalizedQuizId = normalizeQuizId(quizId);
        if (!normalizedTopicId || !normalizedQuizId) return;

        set((state) => {
          const now = Date.now();
          const topicResults = {
            ...(state.quizResults[normalizedTopicId] ?? {}),
            [normalizedQuizId]: {
              correct: true,
              answerId,
              updatedAt: now,
            },
          };
          const quizResults = {
            ...state.quizResults,
            [normalizedTopicId]: topicResults,
          };
          const completed = isCompleteFromResults(quizResults, normalizedTopicId, requiredQuizIds);

          return {
            quizResults,
            completedTopics: completed
              ? {
                  ...state.completedTopics,
                  [normalizedTopicId]: { completedAt: now },
                }
              : state.completedTopics,
          };
        });
      },

      isMiniQuizCorrect(topicId, quizId) {
        const normalizedTopicId = normalizeTopicId(topicId);
        const normalizedQuizId = normalizeQuizId(quizId);
        if (!normalizedTopicId || !normalizedQuizId) return false;

        return isResultCorrect(get().quizResults?.[normalizedTopicId]?.[normalizedQuizId]);
      },

      isTopicComplete(topicId, requiredQuizIds = []) {
        return isCompleteFromResults(get().quizResults, topicId, requiredQuizIds);
      },
    }),
    {
      name: JAPANESE_INTRO_PROGRESS_KEY,
      partialize: (state) => ({
        quizResults: state.quizResults,
        completedTopics: state.completedTopics,
      }),
    },
  ),
);

export default useJapaneseIntroProgressStore;
