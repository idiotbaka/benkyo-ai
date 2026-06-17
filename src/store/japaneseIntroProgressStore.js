import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  clampNumber,
  computeMasteryDelta,
  createDefaultKanaProgress,
  normalizeKanaProgressRecord,
  normalizeKanaScript,
} from '../lib/kana-practice';

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

function createEmptyKanaProgress() {
  return {
    hiragana: {},
    katakana: {},
  };
}

function createEmptyKanaMistakes() {
  return {
    hiragana: {},
    katakana: {},
  };
}

function createEmptyKanaStudyStats() {
  return {
    hiragana: {
      sessionCount: 0,
      completedQuestionCount: 0,
      lastStudiedAt: null,
    },
    katakana: {
      sessionCount: 0,
      completedQuestionCount: 0,
      lastStudiedAt: null,
    },
  };
}

function normalizeKanaKey(kana) {
  return String(kana ?? '').trim();
}

function getScriptBucket(state, field, script) {
  return state?.[field]?.[script] ?? {};
}

function getKanaStudyStats(state, script) {
  const current = state?.kanaStudyStats?.[script] ?? {};
  return {
    sessionCount: Math.max(0, Math.round(Number(current.sessionCount) || 0)),
    completedQuestionCount: Math.max(0, Math.round(Number(current.completedQuestionCount) || 0)),
    lastStudiedAt: Number.isFinite(Number(current.lastStudiedAt)) ? Number(current.lastStudiedAt) : null,
  };
}

function updateBoxAndEase(previous, kanaResult) {
  const wrong = Math.max(0, Number(kanaResult?.wrong) || 0);
  const correct = Math.max(0, Number(kanaResult?.correct) || 0);

  if (wrong > 0) {
    return {
      box: Math.max(0, previous.box - 1 - (wrong >= 2 ? 1 : 0)),
      ease: clampNumber(previous.ease - (0.08 * wrong), 0.7, 1.4),
      currentCorrectStreak: 0,
      currentWrongStreak: previous.currentWrongStreak + wrong,
    };
  }

  if (correct > 0) {
    return {
      box: Math.min(6, previous.box + 1),
      ease: clampNumber(previous.ease + 0.03, 0.7, 1.4),
      currentCorrectStreak: previous.currentCorrectStreak + correct,
      currentWrongStreak: 0,
    };
  }

  return {
    box: previous.box,
    ease: previous.ease,
    currentCorrectStreak: previous.currentCorrectStreak,
    currentWrongStreak: previous.currentWrongStreak,
  };
}

const useJapaneseIntroProgressStore = create(
  persist(
    (set, get) => ({
      quizResults: {},
      completedTopics: {},
      kanaProgress: createEmptyKanaProgress(),
      kanaMistakes: createEmptyKanaMistakes(),
      kanaStudyStats: createEmptyKanaStudyStats(),

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

      getKanaProgress(script, kana) {
        const normalizedScript = normalizeKanaScript(script);
        const normalizedKana = normalizeKanaKey(kana);
        if (!normalizedKana) return createDefaultKanaProgress();

        return normalizeKanaProgressRecord(getScriptBucket(get(), 'kanaProgress', normalizedScript)?.[normalizedKana]);
      },

      getKanaDisplayProgress(script, kana) {
        return Math.round(get().getKanaProgress(script, kana).masteryPct);
      },

      getKanaStats(script) {
        return getKanaStudyStats(get(), normalizeKanaScript(script));
      },

      applyKanaSessionResult(sessionResult) {
        const normalizedScript = normalizeKanaScript(sessionResult?.script);
        const completedAt = Number(sessionResult?.completedAt) || Date.now();
        const startedAt = Number(sessionResult?.startedAt) || completedAt;
        const perKana = sessionResult?.perKana ?? {};
        const changes = [];

        const currentState = get();
        const currentKanaProgress = currentState.kanaProgress ?? createEmptyKanaProgress();
        const currentKanaMistakes = currentState.kanaMistakes ?? createEmptyKanaMistakes();
        const currentKanaStudyStats = currentState.kanaStudyStats ?? createEmptyKanaStudyStats();
        const currentScriptProgress = currentKanaProgress[normalizedScript] ?? {};
        const currentScriptMistakes = currentKanaMistakes[normalizedScript] ?? {};
        const nextScriptProgress = { ...currentScriptProgress };
        const nextScriptMistakes = { ...currentScriptMistakes };

        Object.entries(perKana).forEach(([rawKana, kanaResult]) => {
          const kana = normalizeKanaKey(rawKana);
          if (!kana) return;

          const previous = normalizeKanaProgressRecord(nextScriptProgress[kana]);
          const delta = computeMasteryDelta(kanaResult, previous);
          const nextMasteryPct = Math.round(clampNumber(previous.masteryPct + delta, 0, 100));
          const seen = Math.max(0, Number(kanaResult?.seen) || 0);
          const correct = Math.max(0, Number(kanaResult?.correct) || 0);
          const wrong = Math.max(0, Number(kanaResult?.wrong) || 0);
          const reviewState = updateBoxAndEase(previous, kanaResult);

          nextScriptProgress[kana] = {
            ...previous,
            ...reviewState,
            masteryPct: nextMasteryPct,
            seenCount: previous.seenCount + seen,
            correctCount: previous.correctCount + correct,
            wrongCount: previous.wrongCount + wrong,
            introducedAt: previous.introducedAt ?? startedAt,
            lastSeenAt: seen > 0 ? completedAt : previous.lastSeenAt,
            lastCorrectAt: correct > 0 ? completedAt : previous.lastCorrectAt,
            lastWrongAt: wrong > 0 ? completedAt : previous.lastWrongAt,
            lastSessionId: sessionResult?.sessionId ?? previous.lastSessionId,
          };

          const wrongOptions = kanaResult?.wrongOptions ?? {};
          if (wrong > 0 && Object.keys(wrongOptions).length > 0) {
            const nextMistakesForKana = { ...(nextScriptMistakes[kana] ?? {}) };
            Object.entries(wrongOptions).forEach(([wrongKana, count]) => {
              const normalizedWrongKana = normalizeKanaKey(wrongKana);
              const deltaCount = Math.max(0, Number(count) || 0);
              if (!normalizedWrongKana || deltaCount <= 0) return;
              nextMistakesForKana[normalizedWrongKana] = (nextMistakesForKana[normalizedWrongKana] ?? 0) + deltaCount;
            });
            nextScriptMistakes[kana] = nextMistakesForKana;
          }

          changes.push({
            kana,
            before: previous.masteryPct,
            after: nextMasteryPct,
            delta: nextMasteryPct - previous.masteryPct,
            seen,
            correct,
            wrong,
          });
        });

        const currentStats = getKanaStudyStats(currentState, normalizedScript);
        const nextStats = {
          ...currentStats,
          sessionCount: currentStats.sessionCount + 1,
          completedQuestionCount: currentStats.completedQuestionCount + Math.max(0, Number(sessionResult?.questionsTotal) || 0),
          lastStudiedAt: completedAt,
        };

        set({
          kanaProgress: {
            ...currentKanaProgress,
            [normalizedScript]: nextScriptProgress,
          },
          kanaMistakes: {
            ...currentKanaMistakes,
            [normalizedScript]: nextScriptMistakes,
          },
          kanaStudyStats: {
            ...currentKanaStudyStats,
            [normalizedScript]: nextStats,
          },
        });

        return changes;
      },

      resetKanaProgress(script) {
        const normalizedScript = normalizeKanaScript(script);
        set((state) => ({
          kanaProgress: {
            ...(state.kanaProgress ?? createEmptyKanaProgress()),
            [normalizedScript]: {},
          },
          kanaMistakes: {
            ...(state.kanaMistakes ?? createEmptyKanaMistakes()),
            [normalizedScript]: {},
          },
          kanaStudyStats: {
            ...(state.kanaStudyStats ?? createEmptyKanaStudyStats()),
            [normalizedScript]: createEmptyKanaStudyStats()[normalizedScript],
          },
        }));
      },

      debugSetKanaProgress(script, kana, pct) {
        const normalizedScript = normalizeKanaScript(script);
        const normalizedKana = normalizeKanaKey(kana);
        if (!normalizedKana) return null;

        const masteryPct = Math.round(clampNumber(pct, 0, 100));
        const now = Date.now();
        set((state) => {
          const currentKanaProgress = state.kanaProgress ?? createEmptyKanaProgress();
          const currentScriptProgress = currentKanaProgress[normalizedScript] ?? {};
          const previous = normalizeKanaProgressRecord(currentScriptProgress[normalizedKana]);

          return {
            kanaProgress: {
              ...currentKanaProgress,
              [normalizedScript]: {
                ...currentScriptProgress,
                [normalizedKana]: {
                  ...previous,
                  masteryPct,
                  seenCount: masteryPct > 0 ? Math.max(1, previous.seenCount) : previous.seenCount,
                  introducedAt: masteryPct > 0 ? (previous.introducedAt ?? now) : previous.introducedAt,
                  lastSeenAt: masteryPct > 0 ? now : previous.lastSeenAt,
                },
              },
            },
          };
        });

        return get().getKanaProgress(normalizedScript, normalizedKana);
      },
    }),
    {
      name: JAPANESE_INTRO_PROGRESS_KEY,
      partialize: (state) => ({
        quizResults: state.quizResults,
        completedTopics: state.completedTopics,
        kanaProgress: state.kanaProgress,
        kanaMistakes: state.kanaMistakes,
        kanaStudyStats: state.kanaStudyStats,
      }),
    },
  ),
);

export default useJapaneseIntroProgressStore;
