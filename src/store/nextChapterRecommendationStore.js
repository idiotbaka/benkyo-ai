import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useAiStore from './aiStore';
import useCourseStore from './courseStore';
import useUserStore from './userStore';
import { generateChapterRecommendations } from '../lib/generate-chapter';
import { acquireKeepScreenAwake, releaseKeepScreenAwake } from '../lib/keep-screen-awake';

const RECOMMENDATION_TIMEOUT_MS = 180_000;

const INITIAL_RUNTIME_STATE = {
  status: 'idle',
  requestId: 0,
  activeKey: null,
  source: null,
  recommendations: [],
  error: '',
  startedAt: 0,
};

let _requestSeq = 0;

export function getNextChapterRecommendationKey(chapters) {
  return `ch${(chapters?.length ?? 0) + 1}`;
}

function isAiConfigured(aiConfig) {
  return !!(aiConfig.provider && aiConfig.apiKey?.trim() && aiConfig.modelId?.trim());
}

function normalizeRecommendations(recommendations) {
  if (!Array.isArray(recommendations)) return [];
  return recommendations
    .filter(rec => rec && typeof rec === 'object')
    .map(rec => ({
      title: String(rec.title ?? '').trim(),
      topic: String(rec.topic ?? '').trim(),
      description: String(rec.description ?? '').trim(),
    }))
    .filter(rec => rec.title && rec.topic)
    .slice(0, 4);
}

function sanitizeCache(cache) {
  if (!cache || typeof cache !== 'object') return {};

  return Object.fromEntries(
    Object.entries(cache)
      .map(([chapterKey, entry]) => {
        const recommendations = normalizeRecommendations(entry?.recommendations);
        if (!chapterKey || recommendations.length === 0) return null;
        return [chapterKey, {
          chapterKey,
          baseChapterCount: Number(entry?.baseChapterCount) || null,
          generatedAt: Number(entry?.generatedAt) || Date.now(),
          recommendations,
        }];
      })
      .filter(Boolean)
  );
}

function createTimeoutSignal() {
  return AbortSignal.timeout(RECOMMENDATION_TIMEOUT_MS);
}

/**
 * 下一章节推荐缓存与后台生成运行态。
 * 只持久化成功缓存；运行中状态保留在内存，避免重启后卡在 generating。
 */
const useNextChapterRecommendationStore = create(
  persist(
    (set, get) => ({
      cache: {},
      ...INITIAL_RUNTIME_STATE,

      getCache(chapterKey) {
        return get().cache?.[chapterKey] ?? null;
      },

      resetRuntimeState() {
        _requestSeq += 1;
        set({ ...INITIAL_RUNTIME_STATE });
      },

      ensureForCurrentCourse({ source = 'sheet', force = false } = {}) {
        const chapters = useCourseStore.getState().getChapters();
        if (chapters.length === 0) {
          if (source !== 'prefetch') {
            set({
              ...INITIAL_RUNTIME_STATE,
              status: 'error',
              source,
              error: '当前还没有可衔接的章节，请先创建第一章课程。',
            });
          }
          return { status: 'skipped', reason: 'empty-course' };
        }

        const chapterKey = getNextChapterRecommendationKey(chapters);
        const cached = get().cache[chapterKey];
        if (!force && cached?.recommendations?.length > 0) {
          set({
            ...INITIAL_RUNTIME_STATE,
            status: 'success',
            activeKey: chapterKey,
            source,
            recommendations: cached.recommendations,
          });
          return { status: 'cached', chapterKey, recommendations: cached.recommendations };
        }

        const state = get();
        if (state.status === 'generating' && state.activeKey === chapterKey) {
          set({ source, error: '' });
          return { status: 'generating', chapterKey };
        }

        if (state.status === 'generating') {
          return { status: 'skipped', reason: 'another-task-running', chapterKey: state.activeKey };
        }

        if (
          !force &&
          source === 'sheet' &&
          state.status === 'error' &&
          state.activeKey === chapterKey &&
          state.source !== 'prefetch'
        ) {
          return { status: 'error', chapterKey, error: state.error };
        }

        const aiConfig = useAiStore.getState().getConfig();
        if (!isAiConfigured(aiConfig)) {
          if (source !== 'prefetch') {
            set({
              ...INITIAL_RUNTIME_STATE,
              status: 'error',
              activeKey: chapterKey,
              source,
              error: '请先配置 AI 模型后再生成下一章节推荐。',
            });
          }
          return { status: 'skipped', reason: 'missing-ai-config', chapterKey };
        }

        const requestId = ++_requestSeq;
        const request = {
          chapterKey,
          baseChapterCount: chapters.length,
          recentChapters: chapters,
          lastChapter: chapters[chapters.length - 1],
          userAnswers: useUserStore.getState().learningProfile,
          source,
        };

        set({
          status: 'generating',
          requestId,
          activeKey: chapterKey,
          source,
          recommendations: [],
          error: '',
          startedAt: Date.now(),
        });

        void get()._run({ requestId, request, aiConfig });
        return { status: 'started', chapterKey };
      },

      prefetchForCurrentCourse() {
        return get().ensureForCurrentCourse({ source: 'prefetch' });
      },

      retry({ source = 'sheet' } = {}) {
        return get().ensureForCurrentCourse({ source, force: true });
      },

      async _run({ requestId, request, aiConfig }) {
        const keepAwakeToken = acquireKeepScreenAwake('next-chapter-recommendations');

        try {
          const recommendations = normalizeRecommendations(await generateChapterRecommendations(aiConfig, {
            recentChapters: request.recentChapters,
            lastChapter: request.lastChapter,
            userAnswers: request.userAnswers,
            signal: createTimeoutSignal(),
          }));

          if (get().requestId !== requestId) return;
          if (recommendations.length === 0) {
            throw new Error('推荐生成结果为空，请重试。');
          }

          const cacheEntry = {
            chapterKey: request.chapterKey,
            baseChapterCount: request.baseChapterCount,
            generatedAt: Date.now(),
            recommendations,
          };

          set(state => ({
            cache: {
              ...state.cache,
              [request.chapterKey]: cacheEntry,
            },
            status: 'success',
            requestId,
            activeKey: request.chapterKey,
            source: state.source ?? request.source,
            recommendations,
            error: '',
            startedAt: 0,
          }));
        } catch (err) {
          if (get().requestId !== requestId) return;

          const source = get().source ?? request.source;
          if (source === 'prefetch') {
            set({ ...INITIAL_RUNTIME_STATE });
            return;
          }

          const message = err?.name === 'TimeoutError'
            ? '推荐生成超时，请稍后重试。'
            : err?.message || '推荐生成失败，请重试。';

          console.error('[NextChapterRecommendation] generation error:', err);
          set({
            status: 'error',
            requestId,
            activeKey: request.chapterKey,
            source,
            recommendations: [],
            error: message,
            startedAt: 0,
          });
        } finally {
          releaseKeepScreenAwake(keepAwakeToken);
        }
      },
    }),
    {
      name: 'benkyo-ai-next-chapter-recommendations',
      partialize: state => ({
        cache: sanitizeCache(state.cache),
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        cache: sanitizeCache(persistedState?.cache),
      }),
    }
  )
);

export default useNextChapterRecommendationStore;
