import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useUserStore from './userStore';
import useCourseStore from './courseStore';
import useVocabStore from './vocabStore';

export const XP_PER_LEVEL = 200;
export const BASE_XP = 60;
export const computeLevel = (totalXp) => Math.floor(totalXp / XP_PER_LEVEL) + 1;

const findLevel = (chapterId, levelId) => {
  const chapters = useCourseStore.getState().chapters;
  const chapter = chapters.find(c => c.id === chapterId);
  return chapter?.levels.find(l => l.id === levelId) ?? null;
};

const useGameStore = create(
  persist(
    (set, get) => ({
      // Persisted
      levelProgress: {},
      totalXp: 0,

      // Ephemeral: current active lesson state (not persisted)
      lesson: null,

      // ── Actions ──────────────────────────────────────

      startLesson(chapterId, levelId) {
        const level = findLevel(chapterId, levelId);
        if (!level || !level.questions.length) return;

        const questions = [...level.questions].sort(() => Math.random() - 0.5);

        // 非第一章：随机从前面章节取一道题作为巩固复习题（排除 word-match）
        const chapters = useCourseStore.getState().chapters;
        const chapterIdx = chapters.findIndex(c => c.id === chapterId);
        let reviewQuestion = null;
        if (chapterIdx > 0) {
          const prevQs = chapters
            .slice(0, chapterIdx)
            .flatMap(ch => ch.levels.flatMap(lv =>
              (lv.questions ?? []).filter(q => q.type !== 'word-match')
            ));
          if (prevQs.length > 0) {
            const picked = prevQs[Math.floor(Math.random() * prevQs.length)];
            reviewQuestion = { ...picked, _isReview: true };
          }
        }
        const finalQuestions = reviewQuestion ? [...questions, reviewQuestion] : questions;

        // Sync regen before reading hearts
        useUserStore.getState().syncHearts();
        const currentHearts = useUserStore.getState().hearts;

        set({
          lesson: {
            chapterId,
            levelId,
            questions: finalQuestions,
            currentIndex: 0,
            hearts: currentHearts,
            correctCount: 0,
            reviewCorrect: false,
            selectedAnswer: null,
            feedbackState: null,
            isComplete: false,
            isFailed: false,
            coinsEarned: 0,
            coinPop: null,
            finalStars: 0,
            finalXp: 0,
            finalCoins: 0,
            leveledUp: false,
            oldLevel: 1,
            newLevel: 1,
          },
        });
      },

      submitAnswer(answer) {
        const { lesson } = get();
        if (!lesson || lesson.feedbackState !== null) return;

        const question = lesson.questions[lesson.currentIndex];

        let isCorrect;
        if (question.type === 'sentence-translate') {
          // answer is an array of selected words; compare joined strings
          isCorrect = Array.isArray(answer) && answer.join('') === question.answers.join('');
        } else if (question.type === 'word-match') {
          // called only after all pairs matched — always correct
          isCorrect = true;
        } else {
          isCorrect = question.answers[0] === answer;
        }

        // 巩固复习题：答错不扣心心，正确/错误不计入 correctCount
        if (question._isReview) {
          let newCoinsEarned = lesson.coinsEarned;
          let coinPop = null;
          if (isCorrect && question.type !== 'word-match') {
            useUserStore.getState().addCoins(5);
            newCoinsEarned += 5;
            coinPop = { amount: 5, uid: Date.now() };
          }
          set({
            lesson: {
              ...lesson,
              selectedAnswer: answer,
              feedbackState: isCorrect ? 'correct' : 'wrong',
              reviewCorrect: isCorrect,
              coinsEarned: newCoinsEarned,
              coinPop,
              // hearts & correctCount 不变
            },
          });
          return;
        }

        const newHearts = isCorrect ? lesson.hearts : Math.max(0, lesson.hearts - 1);
        if (!isCorrect) useUserStore.getState().deductHeart();

        // Award 5 coins immediately for correct non-word-match answers
        let newCoinsEarned = lesson.coinsEarned;
        let coinPop = null;
        if (isCorrect && question.type !== 'word-match') {
          useUserStore.getState().addCoins(5);
          newCoinsEarned += 5;
          coinPop = { amount: 5, uid: Date.now() };
        }

        set({
          lesson: {
            ...lesson,
            selectedAnswer: answer,
            feedbackState: isCorrect ? 'correct' : 'wrong',
            hearts: newHearts,
            correctCount: isCorrect ? lesson.correctCount + 1 : lesson.correctCount,
            coinsEarned: newCoinsEarned,
            coinPop,
          },
        });
      },

      nextQuestion() {
        const { lesson, levelProgress, totalXp } = get();
        if (!lesson) return;

        // ── Hearts depleted → lesson failed ────────────────
        if (lesson.hearts === 0) {
          const ratio = lesson.correctCount / lesson.questions.length;
          const rawXp = BASE_XP * ratio;
          const partialXp = rawXp > 0 ? Math.ceil(rawXp / 5) * 5 : 0;
          set({
            totalXp: totalXp + partialXp,
            lesson: { ...lesson, isFailed: true, finalXp: partialXp, finalCoins: lesson.coinsEarned },
          });
          return;
        }

        const nextIndex = lesson.currentIndex + 1;
        const isComplete = nextIndex >= lesson.questions.length;

        if (isComplete) {
          // 排除巩固复习题，仅用普通题目数计算星数
          const normalQCount = lesson.questions.filter(q => !q._isReview).length;
          const wrongCount = normalQCount - lesson.correctCount;
          const stars = wrongCount === 0 ? 3 : wrongCount === 1 ? 2 : 1;

          // Apply active XP boost (card must still be valid at settlement time)
          const boost = useUserStore.getState().xpBoost;
          const boostMult = (boost && Date.now() < boost.expiresAt) ? boost.multiplier : 1;
          const xp = Math.round(BASE_XP * stars * boostMult);

          // Perfect clear bonus: +10 coins
          const bonusCoins = stars === 3 ? 10 : 0;
          if (bonusCoins > 0) useUserStore.getState().addCoins(bonusCoins);
          const finalCoins = lesson.coinsEarned + bonusCoins;

          const oldLevel = computeLevel(totalXp);
          const newTotalXp = totalXp + xp;
          const newLevel = computeLevel(newTotalXp);

          const prevProgress = levelProgress[lesson.levelId] ?? {};
          const newProgress = {
            ...levelProgress,
            [lesson.levelId]: {
              completed: true,
              stars: Math.max(stars, prevProgress.stars ?? 0),
              bestXp: Math.max(xp, prevProgress.bestXp ?? 0),
            },
          };

          // 收集 word-match 题型的单词到单词本
          const wordMatchPairs = lesson.questions
            .filter(q => q.type === 'word-match')
            .flatMap(q => q.pairs || []);
          if (wordMatchPairs.length > 0) {
            useVocabStore.getState().addWordsFromLevel(lesson.levelId, wordMatchPairs);
          }

          set({
            levelProgress: newProgress,
            totalXp: newTotalXp,
            lesson: {
              ...lesson,
              currentIndex: nextIndex,
              selectedAnswer: null,
              feedbackState: null,
              isComplete: true,
              finalStars: stars,
              finalXp: xp,
              finalXpMultiplier: boostMult,
              finalCoins,
              leveledUp: newLevel > oldLevel,
              oldLevel,
              newLevel,
            },
          });
        } else {
          set({
            lesson: {
              ...lesson,
              currentIndex: nextIndex,
              selectedAnswer: null,
              feedbackState: null,
            },
          });
        }
      },

      exitLesson() {
        set({ lesson: null });
      },

      // Called when AI overturns a wrong answer on sentence-translate:
      // fixes correctCount so star calculation treats it as correct,
      // and restores the heart deducted for that wrong answer.
      overturnWrongAnswer() {
        const { lesson } = get();
        if (!lesson) return;
        useUserStore.getState().restoreHeart();
        set({
          lesson: {
            ...lesson,
            correctCount: lesson.correctCount + 1,
            hearts: lesson.hearts + 1,
          },
        });
      },

      // Restore lesson after user uses a Cake item to revive mid-lesson.
      // The userStore side (useCake / purchaseItem) is handled by ReviveSheet before calling this.
      reviveLesson() {
        const { lesson } = get();
        if (!lesson) return;
        set({
          lesson: {
            ...lesson,
            isFailed: false,
            hearts: 3,
          },
        });
      },

      // Deduct one heart without showing FeedbackPanel (used by word-match per wrong attempt)
      deductHeart() {
        const { lesson, totalXp } = get();
        if (!lesson || lesson.hearts <= 0) return;
        const newHearts = Math.max(0, lesson.hearts - 1);
        useUserStore.getState().deductHeart();

        if (newHearts === 0) {
          // Word-match has no FeedbackPanel → fail immediately
          const ratio = lesson.correctCount / lesson.questions.length;
          const rawXp = BASE_XP * ratio;
          const partialXp = rawXp > 0 ? Math.ceil(rawXp / 5) * 5 : 0;
          set({
            totalXp: totalXp + partialXp,
            lesson: { ...lesson, hearts: 0, isFailed: true, finalXp: partialXp, finalCoins: lesson.coinsEarned },
          });
        } else {
          set({ lesson: { ...lesson, hearts: newHearts } });
        }
      },

      // Award 1 coin per correct word-match pair (called by WordMatchQuestion)
      awardPairCoin() {
        const { lesson } = get();
        if (!lesson) return;
        useUserStore.getState().addCoins(1);
        set({
          lesson: {
            ...lesson,
            coinsEarned: lesson.coinsEarned + 1,
            coinPop: { amount: 1, uid: Date.now() },
          },
        });
      },
    }),
    {
      name: 'jplearn-progress',
      partialize: (state) => ({
        levelProgress: state.levelProgress,
        totalXp: state.totalXp,
      }),
    }
  )
);

export default useGameStore;
