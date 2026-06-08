import { create } from 'zustand';
import useAiStore from './aiStore';
import useCourseStore from './courseStore';
import useUserStore from './userStore';
import { generateNextChapter } from '../lib/generate-chapter';
import { acquireKeepScreenAwake, releaseKeepScreenAwake } from '../lib/keep-screen-awake';

const INITIAL_STATE = {
  status: 'idle',
  requestId: 0,
  request: null,
  checkpoint: null,
  stepIndex: 0,
  message: '',
  progress: 0,
  error: '',
};

let _requestSeq = 0;

function getNextChapterId(chapters) {
  return `ch${(chapters?.length ?? 0) + 1}`;
}

function getRequestKey({ selectedTopic, extraNote = '', chapterId, baseChapterCount }) {
  return JSON.stringify({
    chapterId,
    baseChapterCount,
    selectedTopic,
    extraNote,
  });
}

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

    const chapterId = getNextChapterId(chapters);
    const requestKey = getRequestKey({
      selectedTopic,
      extraNote,
      chapterId,
      baseChapterCount: chapters.length,
    });

    const requestId = ++_requestSeq;
    const existingCheckpoint = get().checkpoint;
    const request = { selectedTopic, extraNote, chapterId, requestKey, baseChapterCount: chapters.length };
    const checkpoint = existingCheckpoint?.meta?.requestKey === requestKey
      ? existingCheckpoint
      : null;
    const resumeStep = checkpoint?.data?.grammarSections ? 2 : checkpoint?.data?.scaffold ? 1 : 0;
    set({
      status: 'generating',
      requestId,
      request,
      checkpoint,
      stepIndex: resumeStep,
      message: resumeStep === 2 ? '📝 生成第一关题目' : resumeStep === 1 ? '📚 生成语法讲解' : '🏗️ 规划课程结构',
      progress: checkpoint?.data?.grammarSections ? 2 / 3 : checkpoint?.data?.scaffold ? 1 / 3 : 0,
      error: '',
    });

    void get()._run({
      requestId,
      request,
      aiConfig,
      chapters,
      checkpoint,
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

  async _run({ requestId, request, aiConfig, chapters, checkpoint, learningProfile }) {
    const keepAwakeToken = acquireKeepScreenAwake('next-chapter-generation');

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
        resumeState: checkpoint?.data,
        onCheckpoint: nextCheckpoint => {
          if (get().requestId !== requestId) return;
          set(state => ({
            checkpoint: {
              meta: {
                requestKey: request.requestKey,
                chapterId: request.chapterId,
                baseChapterCount: request.baseChapterCount,
              },
              data: {
                ...(state.checkpoint?.data ?? {}),
                ...nextCheckpoint,
              },
            },
          }));
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
        checkpoint: null,
        error: '',
      });
    } catch (err) {
      if (get().requestId !== requestId) return;
      console.error('[NextChapterGen] generation error:', err);
      set({
        status: 'error',
        error: err?.message || '章节生成失败，请检查 AI 配置后重试。',
      });
    } finally {
      releaseKeepScreenAwake(keepAwakeToken);
    }
  },
}));

export default useNextChapterGenStore;
