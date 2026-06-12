import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useBadgeStore from './badgeStore';

export const DAILY_TASK_STORE_KEY = 'benkyo-ai-daily-tasks';

export const DAILY_TASK_EVENTS = {
  WORD_REVIEW_COMPLETE: 'word-review-complete',
  COURSE_REVIEW_COMPLETE: 'course-review-complete',
  LISTENING_COMPLETE: 'listening-complete',
  CAKE_USED: 'cake-used',
  MAINLINE_LEVEL_COMPLETE: 'mainline-level-complete',
  MAINLINE_THREE_STAR: 'mainline-three-star',
  XP_EARNED: 'xp-earned',
};

export const DAILY_TASK_DIFFICULTIES = ['small', 'medium', 'large'];

export const DAILY_TASK_META = {
  small: {
    label: '小宝箱',
    chestClosed: 'ui/chest_1_close.png',
    chestOpen: 'ui/chest_1_open.png',
    color: '#D97706',
    bg: '#FFF7ED',
    border: '#FED7AA',
  },
  medium: {
    label: '中宝箱',
    chestClosed: 'ui/chest_2_close.png',
    chestOpen: 'ui/chest_2_open.png',
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
  },
  large: {
    label: '大宝箱',
    chestClosed: 'ui/chest_3_close.png',
    chestOpen: 'ui/chest_3_open.png',
    color: '#BE123C',
    bg: '#FFF1F2',
    border: '#FECDD3',
  },
};

export const DAILY_TASK_REWARD_POOLS = {
  small: [
    { type: 'coins', amount: 200, label: '金币', iconPath: 'item/coin.png' },
    { type: 'item', itemId: 'cake', amount: 1, label: '蛋糕', iconPath: 'item/cake.png' },
    { type: 'item', itemId: 'cake', amount: 2, label: '蛋糕', iconPath: 'item/cake.png' },
  ],
  medium: [
    { type: 'coins', amount: 300, label: '金币', iconPath: 'item/coin.png' },
    { type: 'item', itemId: 'xp2x_15', amount: 1, label: '双倍经验卡', iconPath: 'item/exp2.png' },
    { type: 'item', itemId: 'xp3x_15', amount: 1, label: '三倍经验卡', iconPath: 'item/exp3.png' },
  ],
  large: [
    { type: 'coins', amount: 400, label: '金币', iconPath: 'item/coin.png' },
    { type: 'item', itemId: 'xp3x_15', amount: 1, label: '三倍经验卡', iconPath: 'item/exp3.png' },
    { type: 'item', itemId: 'cake', amount: 5, label: '蛋糕', iconPath: 'item/cake.png' },
  ],
};

const TASK_POOLS = {
  small: [
    {
      id: 'word-review-1',
      title: '完成1次单词复习',
      event: DAILY_TASK_EVENTS.WORD_REVIEW_COMPLETE,
      target: 1,
    },
    {
      id: 'course-review-1',
      title: '完成1次课程巩固',
      event: DAILY_TASK_EVENTS.COURSE_REVIEW_COMPLETE,
      target: 1,
    },
    {
      id: 'listening-1',
      title: '完成1次听力练习',
      event: DAILY_TASK_EVENTS.LISTENING_COMPLETE,
      target: 1,
    },
    {
      id: 'cake-1',
      title: '吃掉1个蛋糕',
      event: DAILY_TASK_EVENTS.CAKE_USED,
      target: 1,
    },
  ],
  medium: [
    {
      id: 'mainline-complete-2',
      title: '完成2次主线关卡',
      event: DAILY_TASK_EVENTS.MAINLINE_LEVEL_COMPLETE,
      target: 2,
    },
    {
      id: 'mainline-three-star-1',
      title: '主线关卡获得三颗星1次',
      event: DAILY_TASK_EVENTS.MAINLINE_THREE_STAR,
      target: 1,
    },
    {
      id: 'xp-200',
      title: '获得200XP',
      event: DAILY_TASK_EVENTS.XP_EARNED,
      target: 200,
    },
  ],
  large: [
    {
      id: 'mainline-three-star-2',
      title: '主线关卡获得三颗星2次',
      event: DAILY_TASK_EVENTS.MAINLINE_THREE_STAR,
      target: 2,
    },
    {
      id: 'mainline-complete-3',
      title: '完成3次主线关卡',
      event: DAILY_TASK_EVENTS.MAINLINE_LEVEL_COMPLETE,
      target: 3,
    },
    {
      id: 'course-review-3',
      title: '完成3次课程巩固',
      event: DAILY_TASK_EVENTS.COURSE_REVIEW_COMPLETE,
      target: 3,
    },
    {
      id: 'listening-3',
      title: '完成3次听力练习',
      event: DAILY_TASK_EVENTS.LISTENING_COMPLETE,
      target: 3,
    },
  ],
};

function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function pickOne(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createReward(difficulty) {
  const reward = pickOne(DAILY_TASK_REWARD_POOLS[difficulty] ?? DAILY_TASK_REWARD_POOLS.small);
  return {
    ...reward,
    rewardId: `${difficulty}-${reward.type}-${reward.itemId ?? 'coins'}-${reward.amount}-${Date.now()}`,
  };
}

function createDailyTasks(dateKey = toLocalDateKey()) {
  return DAILY_TASK_DIFFICULTIES.map((difficulty) => {
    const task = pickOne(TASK_POOLS[difficulty]);
    return {
      ...task,
      instanceId: `${dateKey}-${difficulty}-${task.id}`,
      difficulty,
      progress: 0,
      completed: false,
      completedAt: null,
      claimed: false,
      claimedAt: null,
    };
  });
}

function hasValidTasks(dateKey, tasks) {
  return (
    Array.isArray(tasks) &&
    tasks.length === DAILY_TASK_DIFFICULTIES.length &&
    tasks.every((task, index) => (
      task?.instanceId?.startsWith(`${dateKey}-`) &&
      task.difficulty === DAILY_TASK_DIFFICULTIES[index] &&
      TASK_POOLS[task.difficulty]?.some(poolTask => poolTask.id === task.id)
    ))
  );
}

function createCompletionToast(task) {
  return {
    id: `${task.instanceId}-${Date.now()}`,
    taskId: task.instanceId,
    difficulty: task.difficulty,
    title: task.title,
    createdAt: Date.now(),
  };
}

function findTaskForDebug(tasks, selector) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;

  if (typeof selector === 'number') {
    return tasks[selector] ?? tasks[0];
  }

  const normalized = String(selector ?? 'small').trim().toLowerCase();
  if (/^\d+$/.test(normalized)) {
    return tasks[Number(normalized)] ?? tasks[0];
  }

  return tasks.find(task => (
    task.difficulty === normalized ||
    task.id === normalized ||
    task.instanceId === normalized ||
    task.title.includes(String(selector ?? ''))
  )) ?? tasks[0];
}

const useDailyTaskStore = create(
  persist(
    (set, get) => ({
      date: null,
      tasks: [],
      toastQueue: [],

      ensureToday() {
        const today = toLocalDateKey();
        const { date, tasks } = get();
        if (date === today && hasValidTasks(today, tasks)) return tasks;

        const nextTasks = createDailyTasks(today);
        set({
          date: today,
          tasks: nextTasks,
          toastQueue: [],
        });
        return nextTasks;
      },

      recordEvent(eventType, amount = 1) {
        const delta = Math.max(0, Number(amount) || 0);
        if (!eventType || delta <= 0) return;

        const beforeTasks = get().ensureToday();
        const completedBefore = new Set(
          beforeTasks.filter(task => task.completed).map(task => task.instanceId)
        );

        set((state) => {
          const today = toLocalDateKey();
          const baseTasks = state.date === today && hasValidTasks(today, state.tasks)
            ? state.tasks
            : createDailyTasks(today);

          let changed = state.tasks !== baseTasks || state.date !== today;
          const completedTasks = [];

          const nextTasks = baseTasks.map((task) => {
            if (task.event !== eventType || task.completed) return task;

            const nextProgress = Math.min(task.target, task.progress + delta);
            const didComplete = task.progress < task.target && nextProgress >= task.target;
            if (nextProgress !== task.progress || didComplete) changed = true;
            if (!changed) return task;

            const nextTask = {
              ...task,
              progress: nextProgress,
              completed: task.completed || didComplete,
              completedAt: didComplete ? Date.now() : task.completedAt,
            };
            if (didComplete) completedTasks.push(nextTask);
            return nextTask;
          });

          if (!changed && completedTasks.length === 0) return state;

          return {
            date: today,
            tasks: nextTasks,
            toastQueue: completedTasks.length > 0
              ? [
                  ...state.toastQueue,
                  ...completedTasks.map(createCompletionToast),
                ]
              : state.toastQueue,
          };
        });

        const newlyCompletedCount = get().tasks.filter(task => (
          task.completed && !completedBefore.has(task.instanceId)
        )).length;
        if (newlyCompletedCount > 0) {
          useBadgeStore.getState().recordDailyTaskCompleted(newlyCompletedCount);
        }
      },

      dismissToast(toastId) {
        set(state => ({
          toastQueue: state.toastQueue.filter(toast => toast.id !== toastId),
        }));
      },

      claimTask(taskId) {
        get().ensureToday();

        const { tasks } = get();
        const task = tasks.find(item => item.instanceId === taskId);
        if (!task || !task.completed || task.claimed) return null;

        const reward = createReward(task.difficulty);
        const claimedAt = Date.now();

        set(state => ({
          tasks: state.tasks.map(item => (
            item.instanceId === taskId
              ? {
                  ...item,
                  claimed: true,
                  claimedAt,
                  reward,
                }
              : item
          )),
        }));

        return {
          taskId,
          taskTitle: task.title,
          difficulty: task.difficulty,
          chestLabel: DAILY_TASK_META[task.difficulty]?.label ?? '宝箱',
          reward,
        };
      },

      debugCompleteToast(selector = 'small') {
        const tasks = get().ensureToday();
        const task = findTaskForDebug(tasks, selector);
        if (!task) return null;

        const toast = {
          ...createCompletionToast(task),
          id: `debug-${task.instanceId}-${Date.now()}`,
        };

        set(state => ({
          toastQueue: [...state.toastQueue, toast],
        }));

        return {
          task: task.title,
          difficulty: task.difficulty,
        };
      },

      debugResetAndCompleteTask(selector = 'small') {
        const tasks = get().ensureToday();
        const task = findTaskForDebug(tasks, selector);
        if (!task) return null;

        const completedAt = Date.now();
        set(state => ({
          tasks: state.tasks.map(item => (
            item.instanceId === task.instanceId
              ? {
                  ...item,
                  progress: item.target,
                  completed: true,
                  completedAt,
                  claimed: false,
                  claimedAt: null,
                  reward: null,
                }
              : item
          )),
        }));

        return {
          ok: true,
          task: task.title,
          difficulty: task.difficulty,
          instanceId: task.instanceId,
        };
      },
    }),
    {
      name: DAILY_TASK_STORE_KEY,
      partialize: (state) => ({
        date: state.date,
        tasks: state.tasks,
      }),
    }
  )
);

export default useDailyTaskStore;
