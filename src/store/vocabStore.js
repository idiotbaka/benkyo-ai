import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useVocabStore = create(
  persist(
    (set, get) => ({
      words: [],

      /**
       * 将 word-match 题型的 pairs 添加到单词本，按 jp 文本去重
       * @param {string} levelId
       * @param {Array<{jp:string, cn:string, ruby:object}>} pairs
       */
      addWordsFromLevel(levelId, pairs) {
        const existing = new Set(get().words.map(w => w.id));
        const now = Date.now();
        const newWords = pairs
          .filter(p => p.jp && !existing.has(p.jp))
          .map((p, i) => ({
            id: p.jp,        // 去重 key：jp 文本
            jp: p.jp,
            ruby: p.ruby || {},
            cn: p.cn || '',
            levelId,
            addedAt: now + i, // 同批次保留顺序
          }));
        if (newWords.length > 0) {
          set(s => ({ words: [...s.words, ...newWords] }));
        }
      },

      clearAll() {
        set({ words: [] });
      },
    }),
    {
      name: 'jplearn-vocab',
    }
  )
);

export default useVocabStore;
