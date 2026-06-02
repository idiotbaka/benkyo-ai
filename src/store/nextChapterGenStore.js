import { create } from 'zustand';
import useAiStore from './aiStore';
import useCourseStore from './courseStore';
import useUserStore from './userStore';
import { generateNextChapter } from '../lib/generate-chapter';

const INITIAL_STATE = {
  status: 'idle',
  requestId: 0,
  request: null,
  stepIndex: 0,
  message: '',
  progress: 0,
  error: '',
};

let _requestSeq = 0;

/**
 * 下一章节生成任务的全局运行态。
 * 不持久化：页面切换不会中断任务，生成结果会持久化到 courseStore。
 */
const useNextChapterGenStore = create((set, get) => ({
  ...INITIAL_STATE,

  start({ selectedTopic, extraNote = '' }) {
    if (get().status === 'generating') return false;

    const aiConfig = useAiStore.getState().getConfig();
    if (!aiConfig.provider || !aiConfig.apiKey?.trim() || !aiConfig.modelId?.trim()) {
      set({
        ...INITIAL_STATE,
        status: 'error',
        error: '请先配置 AI 模型后再生成下一章节。',
      });
      return false;
    }

    const chapters = useCourseStore.getState().getChapters();
    if (chapters.length === 0) {
      set({
        ...INITIAL_STATE,
        status: 'error',
        error: '当前还没有可衔接的章节，请先创建第一章课程。',
      });
      return false;
    }

    const requestId = ++_requestSeq;
    const request = { selectedTopic, extraNote };
    set({
      status: 'generating',
      requestId,
      request,
      stepIndex: 0,
      message: '🏗️ 规划课程结构',
      progress: 0,
      error: '',
    });

    void get()._run({
      requestId,
      request,
      aiConfig,
      chapters,
      learningProfile: useUserStore.getState().learningProfile,
    });
    return true;
  },

  retry() {
    const { request, status } = get();
    if (!request || status === 'generating') return false;
    return get().start(request);
  },

  reset() {
    if (get().status === 'generating') return;
    set({ ...INITIAL_STATE });
  },

  async _run({ requestId, request, aiConfig, chapters, learningProfile }) {
    try {
      const chapter = await generateNextChapter(aiConfig, {
        recentChapters: chapters,
        lastChapter: chapters[chapters.length - 1],
        selectedTopic: request.selectedTopic,
        extraNote: request.extraNote,
        userAnswers: learningProfile,
      }, {
        onProgress: ({ stepIndex, overallProgress, message }) => {
          if (get().requestId !== requestId) return;
          set({
            stepIndex,
            progress: overallProgress,
            message: message || '',
          });
        },
      });

      if (get().requestId !== requestId) return;

      const latestChapters = useCourseStore.getState().getChapters();
      if (!latestChapters.some(existing => existing.id === chapter.id)) {
        useCourseStore.getState().addChapter(chapter);
      }

      set({
        status: 'success',
        stepIndex: 2,
        message: '新章节已生成',
        progress: 1,
        error: '',
      });
    } catch (err) {
      if (get().requestId !== requestId) return;
      console.error('[NextChapterGen] generation error:', err);
      set({
        status: 'error',
        error: err?.message || '章节生成失败，请检查 AI 配置后重试。',
      });
    }
  },
}));

export default useNextChapterGenStore;
