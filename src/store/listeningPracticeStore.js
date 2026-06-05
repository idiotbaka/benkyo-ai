import { create } from 'zustand';
import useGameStore from './gameStore';
import useUserStore from './userStore';
import { normalizeListeningSentence } from '../lib/listening-practice';

const PRACTICE_HEARTS = 3;
const COINS_PER_QUESTION = 5;
const XP_PER_STAR = 30;

let coinPopSeq = 0;
const createCoinPop = (amount) => ({ amount, uid: `${Date.now()}-${coinPopSeq += 1}` });

const useListeningPracticeStore = create((set, get) => ({
  practice: null,

  start(questions) {
    if (!Array.isArray(questions) || questions.length === 0) return;
    set({
      practice: {
        questions,
        currentIndex: 0,
        hearts: PRACTICE_HEARTS,
        correctCount: 0,
        selectedAnswer: null,
        feedbackState: null,
        isComplete: false,
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
      useUserStore.getState().addCoins(COINS_PER_QUESTION);
      coinsEarned += COINS_PER_QUESTION;
      coinPop = createCoinPop(COINS_PER_QUESTION);
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

    const nextIndex = practice.currentIndex + 1;
    const isComplete = nextIndex >= practice.questions.length;

    if (isComplete) {
      const wrongCount = practice.questions.length - practice.correctCount;
      const stars = wrongCount === 0 ? 3 : wrongCount === 1 ? 2 : 1;
      const xp = stars * XP_PER_STAR;
      const levelResult = useGameStore.getState().awardPracticeXp(xp);

      set({
        practice: {
          ...practice,
          currentIndex: nextIndex,
          selectedAnswer: null,
          feedbackState: null,
          isComplete: true,
          finalStars: stars,
          finalXp: xp,
          finalCoins: practice.coinsEarned,
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
}));

export default useListeningPracticeStore;
