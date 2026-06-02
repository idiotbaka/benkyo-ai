import { create } from 'zustand';
import useCourseStore from './courseStore';
import useAiStore from './aiStore';
import useNextChapterGenStore from './nextChapterGenStore';
import { generateLevelQuestions } from '../lib/generate-chapter';

// Module-level abort controller (non-serializable, lives outside Zustand state)
let _abortCtrl = null;
let _runSeq = 0;

function collectPendingLevels(skipped = new Set()) {
  const pending = [];
  for (const chapter of useCourseStore.getState().getChapters()) {
    if (chapter.locked) continue;
    for (let levelIdx = 0; levelIdx < chapter.levels.length; levelIdx++) {
      const key = `${chapter.id}:${levelIdx}`;
      if (
        !skipped.has(key) &&
        (chapter.levels[levelIdx].questions?.length ?? 0) === 0
      ) {
        pending.push({ chapterId: chapter.id, levelIdx, key });
      }
    }
  }
  return pending;
}

function getOverallProgress(doneCount, currentProgress, totalPending) {
  if (totalPending === 0) return 0;
  return Math.min(1, (doneCount + currentProgress) / totalPending);
}

function waitForNextScan() {
  return new Promise(resolve => setTimeout(resolve, 250));
}

/**
 * autoGenStore — 后台自动生成关卡题目的全局状态。
 * 不持久化：刷新页面后状态重置，但生成结果已保存在 courseStore 中。
 */
const useAutoGenStore = create((set, get) => ({
  enabled:          false,
  running:          false,
  currentChapterId: null,
  currentLevelIdx:  null,
  currentMsg:       '',
  currentProgress:  0,
  overallProgress:  0,
  totalPending:     0,
  doneCount:        0,

  /**
   * 切换自动生成开关。
   * - 关闭状态 → 开启：启动后台生成循环
   * - 开启/运行中 → 关闭：立即中断当前生成
   */
  toggle() {
    if (get().enabled || get().running) {
      get().stop();
    } else {
      const runId = ++_runSeq;
      set({ enabled: true });
      // fire-and-forget，不 await（后台运行）
      get()._run(runId).catch(err => {
        console.error('[AutoGen] unexpected error:', err);
        if (_runSeq === runId) {
          set({ enabled: false, running: false });
        }
      });
    }
  },

  /** 中断生成并重置所有状态。 */
  stop() {
    _runSeq += 1;
    if (_abortCtrl) {
      _abortCtrl.abort();
      _abortCtrl = null;
    }
    set({
      enabled:          false,
      running:          false,
      currentChapterId: null,
      currentLevelIdx:  null,
      currentMsg:       '',
      currentProgress:  0,
      overallProgress:  0,
      totalPending:     0,
      doneCount:        0,
    });
  },

  /** 内部：后台生成循环（外部通过 toggle 启动）。 */
  async _run(runId) {
    if (get().running) return;

    // 校验 AI 配置
    const aiConfig = useAiStore.getState().getConfig();
    if (!aiConfig.provider || !aiConfig.apiKey?.trim() || !aiConfig.modelId?.trim()) {
      set({ enabled: false });
      return;
    }

    // 动态扫描所有章节，运行期间新加入的章节也会继续补齐。
    const skipped = new Set();
    const initialPending = collectPendingLevels(skipped);

    if (
      initialPending.length === 0 &&
      useNextChapterGenStore.getState().status !== 'generating'
    ) {
      set({ enabled: false });
      return;
    }

    set({
      running: true,
      totalPending: initialPending.length,
      doneCount: 0,
      currentProgress: 0,
      overallProgress: 0,
    });

    while (get().enabled && _runSeq === runId) {
      const pending = collectPendingLevels(skipped);
      if (pending.length === 0) {
        if (useNextChapterGenStore.getState().status === 'generating') {
          set({
            currentChapterId: null,
            currentLevelIdx: null,
            currentMsg: '等待新章节生成…',
            currentProgress: 0,
            overallProgress: getOverallProgress(get().doneCount, 0, get().totalPending),
          });
          await waitForNextScan();
          continue;
        }
        break;
      }

      const totalPending = Math.max(get().totalPending, get().doneCount + pending.length);
      const { chapterId, levelIdx, key } = pending[0];

      // 重新读取最新章节（可能已被手动生成更新）
      const freshChapter = useCourseStore.getState().getChapters().find(c => c.id === chapterId);
      const freshLevel = freshChapter?.levels[levelIdx];
      // 已被手动生成过，跳过
      if (!freshChapter || (freshLevel?.questions?.length ?? 0) > 0) {
        continue;
      }

      set({
        currentChapterId: chapterId,
        currentLevelIdx:  levelIdx,
        currentMsg:       '准备中…',
        currentProgress:  0,
        overallProgress:  getOverallProgress(get().doneCount, 0, totalPending),
        totalPending,
      });

      _abortCtrl = new AbortController();
      const controller = _abortCtrl;

      try {
        const questions = await generateLevelQuestions(aiConfig, freshChapter, levelIdx, {
          onProgress: event => {
            if (get().enabled && _runSeq === runId) {
              set({
                currentMsg:      event.message ?? '',
                currentProgress: event.overallProgress,
                overallProgress: getOverallProgress(
                  get().doneCount,
                  event.overallProgress,
                  get().totalPending
                ),
              });
            }
          },
          signal: controller.signal,
        });

        // 用户可能在生成期间关闭了开关
        if (!get().enabled || _runSeq !== runId) break;

        // 将题目保存到 courseStore
        useCourseStore.getState().updateChapter(chapterId, ch => ({
          ...ch,
          levels: ch.levels.map((lv, idx) =>
            idx === levelIdx ? { ...lv, questions, locked: undefined } : lv
          ),
        }));

        const doneCount = get().doneCount + 1;
        set({
          doneCount,
          currentProgress: 1,
          overallProgress: getOverallProgress(doneCount, 0, get().totalPending),
        });
      } catch (err) {
        // AbortError 表示用户主动停止，直接退出循环
        if (err?.name === 'AbortError' || !get().enabled || _runSeq !== runId) break;
        // 其他错误：打印日志，跳过本关继续下一关
        console.error('[AutoGen] level generation failed:', chapterId, levelIdx, err);
        skipped.add(key);
        const doneCount = get().doneCount + 1;
        set({
          doneCount,
          currentProgress: 1,
          overallProgress: getOverallProgress(doneCount, 0, get().totalPending),
        });
      } finally {
        if (_abortCtrl === controller) {
          _abortCtrl = null;
        }
      }
    }

    if (_runSeq !== runId) return;

    // 全部完成或被停止，重置状态
    set({
      enabled:          false,
      running:          false,
      currentChapterId: null,
      currentLevelIdx:  null,
      currentMsg:       '',
      currentProgress:  0,
      overallProgress:  0,
      doneCount:        0,
      totalPending:     0,
    });
  },
}));

export default useAutoGenStore;
