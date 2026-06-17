import { create } from 'zustand';
import useGameStore from './gameStore';
import useJapaneseIntroProgressStore from './japaneseIntroProgressStore';
import useDailyTaskStore, { DAILY_TASK_EVENTS } from './dailyTaskStore';
import useUserStore from './userStore';
import {
  applyEmaStarFloor,
  getPerfectClearBonusCoins,
  getXpStars,
} from '../lib/equipment-effects';
import {
  computeKanaSessionResult,
  getSelectedKanaFromQuestion,
  normalizeKanaScript,
} from '../lib/kana-practice';

const COINS_PER_QUESTION = 2;
const XP_PER_STAR = 10;

let coinPopSeq = 0;
const createCoinPop = (amount) => ({ amount, uid: `${Date.now()}-${coinPopSeq += 1}` });

const useKanaPracticeStore = create((set, get) => ({
  practice: null,

  start(session) {
    if (!session || !Array.isArray(session.questions) || session.questions.length === 0) return false;

    set({
      practice: {
        session: {
          ...session,
          script: normalizeKanaScript(session.script),
        },
        questions: session.questions,
        currentIndex: 0,
        correctCount: 0,
        selectedAnswer: null,
        feedbackState: null,
        answers: [],
        isComplete: false,
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
        masteryChanges: [],
        sessionResult: null,
      },
    });

    return true;
  },

  submitAnswer(answer) {
    const { practice } = get();
    if (!practice || practice.feedbackState !== null || practice.isComplete) return;

    const question = practice.questions[practice.currentIndex];
    if (!question) return;

    const selectedAnswer = String(answer ?? '');
    const isCorrect = selectedAnswer === question.correctAnswer;
    const selectedKana = getSelectedKanaFromQuestion(question, selectedAnswer);

    let coinsEarned = practice.coinsEarned;
    let coinPop = null;
    if (isCorrect) {
      const awardedCoins = useUserStore.getState().addBoostedCoins(COINS_PER_QUESTION);
      coinsEarned += awardedCoins;
      coinPop = createCoinPop(awardedCoins);
    }

    set({
      practice: {
        ...practice,
        selectedAnswer,
        feedbackState: isCorrect ? 'correct' : 'wrong',
        correctCount: isCorrect ? practice.correctCount + 1 : practice.correctCount,
        coinsEarned,
        coinPop,
        answers: [
          ...practice.answers,
          {
            questionId: question.id,
            targetKana: question.targetKana,
            selectedAnswer,
            selectedKana,
            isCorrect,
            answeredAt: Date.now(),
          },
        ],
      },
    });
  },

  nextQuestion() {
    const { practice } = get();
    if (!practice) return;

    const nextIndex = practice.currentIndex + 1;
    const isComplete = nextIndex >= practice.questions.length;

    if (isComplete) {
      const sessionResult = computeKanaSessionResult(practice.session, practice.answers);
      const masteryChanges = useJapaneseIntroProgressStore.getState().applyKanaSessionResult(sessionResult);
      const wrongCount = practice.questions.length - practice.correctCount;
      const rawStars = wrongCount === 0 ? 3 : wrongCount === 1 ? 2 : 1;
      const equippedItems = useUserStore.getState().equippedItems;
      const stars = applyEmaStarFloor(rawStars, equippedItems);
      const xpStars = getXpStars(stars, equippedItems);
      const xp = xpStars * XP_PER_STAR;
      const levelResult = useGameStore.getState().awardPracticeXp(xp);
      const bonusCoins = getPerfectClearBonusCoins(stars, equippedItems);
      if (bonusCoins > 0) useUserStore.getState().addCoins(bonusCoins);
      useDailyTaskStore.getState().recordEvent(DAILY_TASK_EVENTS.KANA_STUDY_COMPLETE, 1);

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
          masteryChanges,
          sessionResult,
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
}));

export default useKanaPracticeStore;
