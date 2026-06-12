import { create } from 'zustand';
import useGameStore from './gameStore';
import useUserStore from './userStore';
import useDailyTaskStore, { DAILY_TASK_EVENTS } from './dailyTaskStore';
import { normalizeListeningSentence } from '../lib/listening-practice';
import { applyEmaStarFloor, getPerfectClearBonusCoins, getXpStars } from '../lib/equipment-effects';

const COINS_PER_QUESTION = 5;
const XP_PER_STAR = 30;

let coinPopSeq = 0;
const createCoinPop = (amount) => ({ amount, uid: `${Date.now()}-${coinPopSeq += 1}` });

const useListeningPracticeStore = create((set, get) => ({
  practice: null,

  start(questions) {
    if (!Array.isArray(questions) || questions.length === 0) return;
    useUserStore.getState().syncHearts();
    const currentHearts = useUserStore.getState().hearts;
    if (currentHearts <= 0) return false;

    set({
      practice: {
        questions,
        currentIndex: 0,
        hearts: currentHearts,
        correctCount: 0,
        selectedAnswer: null,
        feedbackState: null,
        isComplete: false,
        isFailed: false,
        coinsEarned: 0,
        coinPop: null,
        finalStars: 0,
        finalXp: 0,
        finalBaseXp: 0,
        finalXpMultiplier: 1,
        finalCoins: 0,
        leveledUp: false,
        oldLevel: 1,
        newLevel: 1,
      },
    });
    return true;
  },

  submitAnswer(answerSegments) {
    const { practice } = get();
    if (!practice || practice.feedbackState !== null) return;

    const question = practice.questions[practice.currentIndex];
    const answerText = normalizeListeningSentence(
      Array.isArray(answerSegments) ? answerSegments.join('') : ''
    );
    const isCorrect = answerText === question.answerText;

    let coinsEarned = practice.coinsEarned;
    let coinPop = null;
    if (isCorrect) {
      const awardedCoins = useUserStore.getState().addBoostedCoins(COINS_PER_QUESTION);
      coinsEarned += awardedCoins;
      coinPop = createCoinPop(awardedCoins);
    }

    if (!isCorrect) {
      useUserStore.getState().deductHeart();
    }

    set({
      practice: {
        ...practice,
        selectedAnswer: answerSegments,
        feedbackState: isCorrect ? 'correct' : 'wrong',
        hearts: isCorrect ? practice.hearts : Math.max(0, practice.hearts - 1),
        correctCount: isCorrect ? practice.correctCount + 1 : practice.correctCount,
        coinsEarned,
        coinPop,
      },
    });
  },

  nextQuestion() {
    const { practice } = get();
    if (!practice) return;

    if (practice.hearts === 0) {
      const ratio = practice.correctCount / practice.questions.length;
      const rawXp = XP_PER_STAR * ratio;
      const partialXp = rawXp > 0 ? Math.ceil(rawXp / 5) * 5 : 0;
      const levelResult = useGameStore.getState().awardPartialPracticeXp(partialXp);
      set({
        practice: {
          ...practice,
          isFailed: true,
          finalXp: levelResult.xp,
          finalBaseXp: levelResult.baseXp,
          finalXpMultiplier: levelResult.multiplier,
          finalCoins: practice.coinsEarned,
          leveledUp: levelResult.leveledUp,
          oldLevel: levelResult.oldLevel,
          newLevel: levelResult.newLevel,
        },
      });
      return;
    }

    const nextIndex = practice.currentIndex + 1;
    const isComplete = nextIndex >= practice.questions.length;

    if (isComplete) {
      const wrongCount = practice.questions.length - practice.correctCount;
      const rawStars = wrongCount === 0 ? 3 : wrongCount === 1 ? 2 : 1;
      const equippedItems = useUserStore.getState().equippedItems;
      const stars = applyEmaStarFloor(rawStars, equippedItems);
      const xpStars = getXpStars(stars, equippedItems);
      const xp = xpStars * XP_PER_STAR;
      const levelResult = useGameStore.getState().awardPracticeXp(xp);
      const bonusCoins = getPerfectClearBonusCoins(stars, equippedItems);
      if (bonusCoins > 0) useUserStore.getState().addCoins(bonusCoins);
      useDailyTaskStore.getState().recordEvent(DAILY_TASK_EVENTS.LISTENING_COMPLETE, 1);

      set({
        practice: {
          ...practice,
          currentIndex: nextIndex,
          selectedAnswer: null,
          feedbackState: null,
          isComplete: true,
          finalStars: stars,
          finalXp: levelResult.xp,
          finalBaseXp: levelResult.baseXp,
          finalXpMultiplier: levelResult.multiplier,
          finalCoins: practice.coinsEarned + bonusCoins,
          leveledUp: levelResult.leveledUp,
          oldLevel: levelResult.oldLevel,
          newLevel: levelResult.newLevel,
        },
      });
      return;
    }

    set({
      practice: {
        ...practice,
        currentIndex: nextIndex,
        selectedAnswer: null,
        feedbackState: null,
      },
    });
  },

  exit() {
    set({ practice: null });
  },

  revive() {
    const { practice } = get();
    if (!practice) return;
    set({
      practice: {
        ...practice,
        isFailed: false,
        hearts: 3,
      },
    });
  },
}));

export default useListeningPracticeStore;
