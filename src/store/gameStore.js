import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useUserStore from './userStore';
import useCourseStore from './courseStore';
import useVocabStore from './vocabStore';
import useWrongQuestionStore, { getWrongQuestionId } from './wrongQuestionStore';
import useDailyTaskStore, { DAILY_TASK_EVENTS } from './dailyTaskStore';
import useBadgeStore from './badgeStore';
import { applyEmaStarFloor, canUseSakuraPetalShield, canUseUmbrellaShield, getPerfectClearBonusCoins, getXpStars } from '../lib/equipment-effects';

export const XP_PER_LEVEL = 400;
export const BASE_XP = 60;
export const computeLevel = (totalXp) => Math.floor(totalXp / XP_PER_LEVEL) + 1;

let coinPopSeq = 0;
const createCoinPop = (amount) => ({ amount, uid: `${Date.now()}-${coinPopSeq += 1}` });

const recordDailyTaskEvent = (eventType, amount) => {
  useDailyTaskStore.getState().recordEvent(eventType, amount);
};

const getActiveXpMultiplier = () => {
  const boost = useUserStore.getState().xpBoost;
  return (boost && Date.now() < boost.expiresAt) ? boost.multiplier : 1;
};

const awardBoostedCoins = (amount) => useUserStore.getState().addBoostedCoins(amount);

const findLevel = (chapterId, levelId) => {
  const chapters = useCourseStore.getState().chapters;
  const chapter = chapters.find(c => c.id === chapterId);
  return chapter?.levels.find(l => l.id === levelId) ?? null;
};

const shouldTrackWrongQuestion = (lesson, question) => (
  Boolean(lesson && question?.type && !lesson.isPractice && !question._isReview)
);

const addWrongQuestionFromLesson = (lesson, question) => {
  if (!shouldTrackWrongQuestion(lesson, question)) return;
  useWrongQuestionStore.getState().addWrongQuestion({
    chapterId: lesson.chapterId,
    levelId: lesson.levelId,
    question,
  });
};

const removeWrongQuestionFromLesson = (lesson, question) => {
  if (lesson?.practiceType === 'wrong-review' && question?._wrongQuestionId) {
    useWrongQuestionStore.getState().removeWrongQuestion(question._wrongQuestionId);
    return;
  }

  if (!shouldTrackWrongQuestion(lesson, question)) return;
  useWrongQuestionStore.getState().removeWrongQuestion(
    getWrongQuestionId(lesson.chapterId, lesson.levelId, question)
  );
};

const normalizeSentenceAnswer = (answer) => (
  Array.isArray(answer) ? answer.join('') : String(answer ?? '')
);

const getSentenceAnswerCacheKey = (lesson, question) => {
  if (question?.type !== 'sentence-translate') return null;

  const chapterId = question._sourceChapterId ?? lesson?.chapterId;
  const levelId = question._sourceLevelId ?? lesson?.levelId;
  if (!chapterId || !levelId || chapterId === '__practice__') return null;

  const questionId = question._sourceQuestionId ?? question.id;
  if (questionId === undefined || questionId === null || questionId === '') return null;

  return `${String(chapterId)}::${String(levelId)}::${String(questionId)}`;
};

const hasAcceptedSentenceAnswer = (acceptedSentenceAnswers, lesson, question, answer) => {
  const cacheKey = getSentenceAnswerCacheKey(lesson, question);
  if (!cacheKey) return false;
  const normalizedAnswer = normalizeSentenceAnswer(answer);
  return Array.isArray(acceptedSentenceAnswers?.[cacheKey]) && acceptedSentenceAnswers[cacheKey].includes(normalizedAnswer);
};

const addAcceptedSentenceAnswer = (acceptedSentenceAnswers, lesson, question, answer) => {
  const cacheKey = getSentenceAnswerCacheKey(lesson, question);
  if (!cacheKey) return acceptedSentenceAnswers;

  const normalizedAnswer = normalizeSentenceAnswer(answer);
  if (!normalizedAnswer) return acceptedSentenceAnswers;

  const currentAnswers = Array.isArray(acceptedSentenceAnswers?.[cacheKey]) ? acceptedSentenceAnswers[cacheKey] : [];
  if (currentAnswers.includes(normalizedAnswer)) return acceptedSentenceAnswers;

  return {
    ...acceptedSentenceAnswers,
    [cacheKey]: [...currentAnswers, normalizedAnswer],
  };
};

const useGameStore = create(
  persist(
    (set, get) => ({
      // Persisted
      levelProgress: {},
      totalXp: 0,
      acceptedSentenceAnswers: {},

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
            umbrellaShieldUsed: false,
            umbrellaShieldQuestionIndex: null,
            sakuraPetalShieldedQuestionIndex: null,
            finalStars: 0,
            finalXp: 0,
            finalCoins: 0,
            leveledUp: false,
            oldLevel: 1,
            newLevel: 1,
          },
        });
      },

      startPracticeLesson({ levelId, title, questions, returnPath = '/vocab', practiceType = null }) {
        if (!Array.isArray(questions) || questions.length === 0) return;

        useUserStore.getState().syncHearts();
        const currentHearts = useUserStore.getState().hearts;

        set({
          lesson: {
            chapterId: '__practice__',
            levelId,
            title,
            returnPath,
            isPractice: true,
            practiceType,
            questions,
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
            sakuraPetalShieldedQuestionIndex: null,
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
        const { lesson, acceptedSentenceAnswers } = get();
        if (!lesson || lesson.feedbackState !== null) return;

        const question = lesson.questions[lesson.currentIndex];

        let isCorrect;
        if (question.type === 'sentence-translate') {
          // answer is an array of selected words; compare joined strings
          isCorrect =
            Array.isArray(answer) && answer.join('') === question.answers.join('') ||
            hasAcceptedSentenceAnswer(acceptedSentenceAnswers, lesson, question, answer);
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
            const awardedCoins = awardBoostedCoins(5);
            newCoinsEarned += awardedCoins;
            coinPop = createCoinPop(awardedCoins);
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

        const equippedItems = useUserStore.getState().equippedItems;
        const shouldUseUmbrellaShield = !isCorrect && canUseUmbrellaShield(lesson, question, equippedItems);
        const shouldUseSakuraPetalShield = !isCorrect && canUseSakuraPetalShield(lesson, question, equippedItems);
        const shouldPreventHeartLoss = shouldUseUmbrellaShield || shouldUseSakuraPetalShield;
        const newHearts = isCorrect || shouldPreventHeartLoss ? lesson.hearts : Math.max(0, lesson.hearts - 1);
        if (isCorrect) {
          if (lesson.practiceType === 'wrong-review') {
            removeWrongQuestionFromLesson(lesson, question);
          }
        } else {
          addWrongQuestionFromLesson(lesson, question);
          if (!shouldPreventHeartLoss) {
            useUserStore.getState().deductHeart();
          }
        }

        // Award 5 coins immediately for correct non-word-match answers
        let newCoinsEarned = lesson.coinsEarned;
        let coinPop = null;
        if (isCorrect && question.type !== 'word-match') {
          const awardedCoins = awardBoostedCoins(5);
          newCoinsEarned += awardedCoins;
          coinPop = createCoinPop(awardedCoins);
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
            umbrellaShieldUsed: shouldUseUmbrellaShield ? true : lesson.umbrellaShieldUsed,
            umbrellaShieldQuestionIndex: shouldUseUmbrellaShield ? lesson.currentIndex : lesson.umbrellaShieldQuestionIndex,
            sakuraPetalShieldedQuestionIndex: shouldUseSakuraPetalShield ? lesson.currentIndex : lesson.sakuraPetalShieldedQuestionIndex,
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
          recordDailyTaskEvent(DAILY_TASK_EVENTS.XP_EARNED, partialXp);
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
          const rawStars = wrongCount === 0 ? 3 : wrongCount === 1 ? 2 : 1;
          const equippedItems = useUserStore.getState().equippedItems;
          const stars = applyEmaStarFloor(rawStars, equippedItems);

          // Apply active XP boost (card must still be valid at settlement time)
          const boostMult = getActiveXpMultiplier();
          const xpStars = getXpStars(stars, equippedItems);
          const xp = Math.round(BASE_XP * xpStars * boostMult);

          const bonusCoins = getPerfectClearBonusCoins(stars, equippedItems);
          if (bonusCoins > 0) useUserStore.getState().addCoins(bonusCoins);
          const finalCoins = lesson.coinsEarned + bonusCoins;

          const oldLevel = computeLevel(totalXp);
          const newTotalXp = totalXp + xp;
          const newLevel = computeLevel(newTotalXp);
          recordDailyTaskEvent(DAILY_TASK_EVENTS.XP_EARNED, xp);

          let newProgress = levelProgress;
          if (!lesson.isPractice) {
            const prevProgress = levelProgress[lesson.levelId] ?? {};
            newProgress = {
              ...levelProgress,
              [lesson.levelId]: {
                completed: true,
                stars: Math.max(stars, prevProgress.stars ?? 0),
                bestXp: Math.max(xp, prevProgress.bestXp ?? 0),
              },
            };
            recordDailyTaskEvent(DAILY_TASK_EVENTS.MAINLINE_LEVEL_COMPLETE, 1);
            if (stars === 3) {
              recordDailyTaskEvent(DAILY_TASK_EVENTS.MAINLINE_THREE_STAR, 1);
            }
          } else if (lesson.levelId === 'course-review') {
            recordDailyTaskEvent(DAILY_TASK_EVENTS.COURSE_REVIEW_COMPLETE, 1);
          }

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
      // restores the deducted heart when one was actually deducted, and
      // updates the visible feedback state so the lesson UI reacts as correct.
      overturnWrongAnswer() {
        const { lesson, acceptedSentenceAnswers } = get();
        if (!lesson) return { restoredHeart: false };
        const question = lesson.questions[lesson.currentIndex];
        const wasUmbrellaShieldedWrong = Boolean(
          lesson.umbrellaShieldUsed &&
          lesson.umbrellaShieldQuestionIndex === lesson.currentIndex
        );
        const wasSakuraPetalShieldedWrong = lesson.sakuraPetalShieldedQuestionIndex === lesson.currentIndex;
        const shouldRestoreHeart = !wasUmbrellaShieldedWrong && !wasSakuraPetalShieldedWrong;
        removeWrongQuestionFromLesson(lesson, question);
        if (shouldRestoreHeart) {
          useUserStore.getState().restoreHeart();
        }
        useBadgeStore.getState().recordAppealSuccess(1);
        set({
          acceptedSentenceAnswers: addAcceptedSentenceAnswer(
            acceptedSentenceAnswers,
            lesson,
            question,
            lesson.selectedAnswer
          ),
          lesson: {
            ...lesson,
            correctCount: lesson.correctCount + 1,
            hearts: shouldRestoreHeart ? lesson.hearts + 1 : lesson.hearts,
            feedbackState: 'correct',
            umbrellaShieldUsed: wasUmbrellaShieldedWrong ? false : lesson.umbrellaShieldUsed,
            umbrellaShieldQuestionIndex: wasUmbrellaShieldedWrong ? null : lesson.umbrellaShieldQuestionIndex,
            sakuraPetalShieldedQuestionIndex: wasSakuraPetalShieldedWrong ? null : lesson.sakuraPetalShieldedQuestionIndex,
          },
        });
        return {
          restoredHeart: shouldRestoreHeart,
          noRestoreReason: wasUmbrellaShieldedWrong
            ? 'umbrella'
            : wasSakuraPetalShieldedWrong
              ? 'sakura-petal'
              : null,
        };
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
        const question = lesson.questions[lesson.currentIndex];
        addWrongQuestionFromLesson(lesson, question);
        const equippedItems = useUserStore.getState().equippedItems;
        const shouldUseUmbrellaShield = canUseUmbrellaShield(lesson, question, equippedItems);
        const shouldUseSakuraPetalShield = canUseSakuraPetalShield(lesson, question, equippedItems);
        const shouldPreventHeartLoss = shouldUseUmbrellaShield || shouldUseSakuraPetalShield;
        const newHearts = shouldPreventHeartLoss ? lesson.hearts : Math.max(0, lesson.hearts - 1);
        if (!shouldPreventHeartLoss) {
          useUserStore.getState().deductHeart();
        }

        if (newHearts === 0) {
          // Word-match has no FeedbackPanel → fail immediately
          const ratio = lesson.correctCount / lesson.questions.length;
          const rawXp = BASE_XP * ratio;
          const partialXp = rawXp > 0 ? Math.ceil(rawXp / 5) * 5 : 0;
          recordDailyTaskEvent(DAILY_TASK_EVENTS.XP_EARNED, partialXp);
          set({
            totalXp: totalXp + partialXp,
            lesson: { ...lesson, hearts: 0, isFailed: true, finalXp: partialXp, finalCoins: lesson.coinsEarned },
          });
        } else {
          set({
            lesson: {
              ...lesson,
              hearts: newHearts,
              umbrellaShieldUsed: shouldUseUmbrellaShield ? true : lesson.umbrellaShieldUsed,
              umbrellaShieldQuestionIndex: shouldUseUmbrellaShield ? lesson.currentIndex : lesson.umbrellaShieldQuestionIndex,
              sakuraPetalShieldedQuestionIndex: shouldUseSakuraPetalShield ? lesson.currentIndex : lesson.sakuraPetalShieldedQuestionIndex,
            },
          });
        }
      },

      // Award 1 coin per correct word-match pair (called by WordMatchQuestion)
      awardPairCoin() {
        const { lesson } = get();
        if (!lesson) return;
        const awardedCoins = awardBoostedCoins(1);
        set({
          lesson: {
            ...lesson,
            coinsEarned: lesson.coinsEarned + awardedCoins,
            coinPop: createCoinPop(awardedCoins),
          },
        });
      },

      awardPracticeXp(amount) {
        const baseXp = Math.max(0, Number(amount) || 0);
        const boostMult = getActiveXpMultiplier();
        const xp = Math.round(baseXp * boostMult);
        const { totalXp } = get();
        const oldLevel = computeLevel(totalXp);
        const newTotalXp = totalXp + xp;
        const newLevel = computeLevel(newTotalXp);

        set({ totalXp: newTotalXp });
        recordDailyTaskEvent(DAILY_TASK_EVENTS.XP_EARNED, xp);
        return {
          xp,
          baseXp,
          multiplier: boostMult,
          totalXp: newTotalXp,
          oldLevel,
          newLevel,
          leveledUp: newLevel > oldLevel,
        };
      },

      awardPartialPracticeXp(amount) {
        const xp = Math.max(0, Number(amount) || 0);
        const { totalXp } = get();
        const oldLevel = computeLevel(totalXp);
        const newTotalXp = totalXp + xp;
        const newLevel = computeLevel(newTotalXp);

        set({ totalXp: newTotalXp });
        recordDailyTaskEvent(DAILY_TASK_EVENTS.XP_EARNED, xp);
        return {
          xp,
          baseXp: xp,
          multiplier: 1,
          totalXp: newTotalXp,
          oldLevel,
          newLevel,
          leveledUp: newLevel > oldLevel,
        };
      },
    }),
    {
      name: 'benkyo-ai-progress',
      partialize: (state) => ({
        levelProgress: state.levelProgress,
        totalXp: state.totalXp,
        acceptedSentenceAnswers: state.acceptedSentenceAnswers,
      }),
    }
  )
);

export default useGameStore;
