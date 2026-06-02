import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { repairGrammarSections } from '../lib/course-wire.js';

function repairChapter(chapter) {
  const sections = chapter?.grammar?.sections;
  if (!Array.isArray(sections)) return chapter;

  try {
    return {
      ...chapter,
      grammar: {
        ...chapter.grammar,
        sections: repairGrammarSections(sections),
      },
    };
  } catch (error) {
    console.warn('[courseStore] failed to repair persisted grammar sections:', error);
    return chapter;
  }
}

function repairChapters(chapters) {
  return Array.isArray(chapters) ? chapters.map(repairChapter) : [];
}

/**
 * 存储 AI 生成的课程章节数据，持久化到 localStorage。
 * 数据结构与 src/data/courses.json 完全一致，作为动态版本使用。
 */
const useCourseStore = create(
  persist(
    (set, get) => ({
      chapters: [], // AI 生成的章节列表，初始为空

      setChapters(chapters) {
        set({ chapters: repairChapters(chapters) });
      },

      addChapter(chapter) {
        set(s => ({ chapters: [...s.chapters, repairChapter(chapter)] }));
      },

      updateChapter(chapterId, updater) {
        set(s => ({
          chapters: s.chapters.map(ch =>
            ch.id === chapterId ? repairChapter(updater(ch)) : ch
          ),
        }));
      },

      getChapters() {
        return get().chapters;
      },
    }),
    {
      name: 'jplearn-courses',
      merge: (persistedState, currentState) => {
        const merged = {
          ...currentState,
          ...(persistedState && typeof persistedState === 'object' ? persistedState : {}),
        };
        return {
          ...merged,
          chapters: repairChapters(merged.chapters),
        };
      },
    }
  )
);

export default useCourseStore;
