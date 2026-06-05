import { useEffect, useMemo, useState } from 'react';
import useDailyTaskStore, {
  DAILY_TASK_META,
} from '../../store/dailyTaskStore';
import useUserStore from '../../store/userStore';
import { useIcon } from '../../lib/icons';
import RewardModal from '../UI/RewardModal';

function getMsUntilTomorrow() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  return Math.max(0, tomorrow.getTime() - now.getTime());
}

function formatResetTime(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours} 小时`;
  return `${Math.max(1, minutes)} 分钟`;
}

export default function DailyTaskSection() {
  const tasks = useDailyTaskStore(s => s.tasks);
  const ensureToday = useDailyTaskStore(s => s.ensureToday);
  const claimTask = useDailyTaskStore(s => s.claimTask);
  const grantReward = useUserStore(s => s.grantReward);
  const [resetMs, setResetMs] = useState(getMsUntilTomorrow);
  const [rewardModal, setRewardModal] = useState(null);

  useEffect(() => {
    ensureToday();
    const timer = setInterval(() => {
      setResetMs(getMsUntilTomorrow());
      ensureToday();
    }, 60000);
    return () => clearInterval(timer);
  }, [ensureToday]);

  const resetLabel = useMemo(() => formatResetTime(resetMs), [resetMs]);

  const handleClaim = (task) => {
    if (!task.completed || task.claimed) return;

    const claim = claimTask(task.instanceId);
    if (!claim?.reward) return;

    grantReward(claim.reward);
    setRewardModal(claim);
  };

  return (
    <section className="daily-task-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0 }}>
          每日特别任务
        </h3>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#9CA3AF', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
          <span className="daily-task-clock" />
          <span>{resetLabel}</span>
        </div>
      </div>

      <div className="daily-task-list">
        {tasks.map(task => (
          <DailyTaskCard key={task.instanceId} task={task} onClaim={handleClaim} />
        ))}
      </div>

      {rewardModal && (
        <RewardModal
          reward={rewardModal.reward}
          title="宝箱开启！"
          subtitle="奖励已发放"
          sourceLabel={rewardModal.chestLabel}
          onDismiss={() => setRewardModal(null)}
        />
      )}
    </section>
  );
}

function DailyTaskCard({ task, onClaim }) {
  const meta = DAILY_TASK_META[task.difficulty] ?? DAILY_TASK_META.small;
  const closedChest = useIcon(meta.chestClosed);
  const openChest = useIcon(meta.chestOpen);
  const chestImg = task.claimed ? openChest : closedChest;
  const progress = Math.min(task.progress ?? 0, task.target);
  const pct = task.target > 0 ? (progress / task.target) * 100 : 0;
  const isReady = task.completed && !task.claimed;
  const statusLabel = task.claimed ? '已领取' : isReady ? '可领取' : null;

  return (
    <button
      type="button"
      className={isReady ? 'daily-task-card daily-task-card--ready' : 'daily-task-card'}
      onClick={() => onClaim(task)}
      disabled={!isReady}
      aria-label={isReady ? `领取${task.title}奖励` : task.title}
      style={{
        '--daily-task-accent': meta.color,
        '--daily-task-bg': meta.bg,
        '--daily-task-border': meta.border,
      }}
    >
      <div style={{ minWidth: 0, flex: 1, paddingRight: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span
            style={{
              flexShrink: 0,
              borderRadius: 999,
              background: meta.bg,
              border: `1px solid ${meta.border}`,
              color: meta.color,
              fontSize: 9,
              fontWeight: 900,
              lineHeight: '16px',
              padding: '0 7px',
            }}
          >
            {meta.label}
          </span>
          {statusLabel && (
            <span className={task.claimed ? 'daily-task-claimed-label' : 'daily-task-ready-label'}>
              {statusLabel}
            </span>
          )}
        </div>

        <div style={{ fontSize: 13, fontWeight: 900, color: '#1F2937', lineHeight: 1.25, marginBottom: 7 }}>
          {task.title}
        </div>

        <div className="daily-task-progress" aria-label={`${task.title} ${progress}/${task.target}`}>
          <div
            className="daily-task-progress__fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="daily-task-chest-wrap">
        {isReady && (
          <div className="daily-task-particles" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, index) => (
              <span key={index} style={{ '--particle-i': index }} />
            ))}
          </div>
        )}
        <img
          src={chestImg}
          alt={meta.label}
          className={isReady ? 'daily-task-chest daily-task-chest--ready' : 'daily-task-chest'}
        />
      </div>
    </button>
  );
}
