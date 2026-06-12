import { BADGES } from '../data/badges';

const XP_PER_LEVEL = 400;

function sumInventory(inventory) {
  if (!inventory || typeof inventory !== 'object') return 0;
  return Object.values(inventory).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
}

function computeLevel(totalXp) {
  return Math.floor((Number(totalXp) || 0) / XP_PER_LEVEL) + 1;
}

function hasPerfectChapter(chapters, levelProgress) {
  if (!Array.isArray(chapters) || chapters.length === 0) return false;

  return chapters.some((chapter) => {
    const levels = Array.isArray(chapter.levels) ? chapter.levels : [];
    return levels.length > 0 && levels.every(level => (
      (levelProgress?.[level.id]?.stars ?? 0) >= 3
    ));
  });
}

export function buildBadgeProgress({
  inventory,
  words,
  totalXp,
  levelProgress,
  chapters,
  counters,
  unlocked,
}) {
  const counterState = counters ?? {};
  const progressById = {
    collector: sumInventory(inventory),
    course: Array.isArray(words) ? words.length : 0,
    explorer: computeLevel(totalXp),
    mission_master: counterState.dailyTasksCompleted ?? 0,
    monopoly: counterState.totalCoinsEarned ?? 0,
    overeat: counterState.cakesEaten ?? 0,
    perfect: hasPerfectChapter(chapters, levelProgress) ? 1 : 0,
    phoenix: counterState.appealSuccess ?? 0,
    scriptwriter: Array.isArray(chapters) ? chapters.length : 0,
  };

  return BADGES.map((badge) => {
    const current = Math.max(0, Number(progressById[badge.id]) || 0);
    const target = Math.max(1, Number(badge.target) || 1);
    const isUnlocked = Boolean(unlocked?.[badge.id]) || current >= target;

    return {
      ...badge,
      current: Math.min(current, target),
      rawCurrent: current,
      target,
      unlocked: isUnlocked,
      progressText: `${Math.min(current, target)}/${target}`,
    };
  });
}

export function getUnlockableBadgeIds(badges, unlocked) {
  return badges
    .filter(badge => badge.rawCurrent >= badge.target && !unlocked?.[badge.id])
    .map(badge => badge.id);
}
