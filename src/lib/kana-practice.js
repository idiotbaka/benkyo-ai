import { GOJUON_SECTIONS, toKatakanaText } from '../data/gojuonKana';

export const KANA_SESSION_MIN = 15;
export const KANA_SESSION_DEFAULT = 18;
export const KANA_SESSION_MAX = 20;
export const MAX_NEW_KANA_PER_SESSION = 3;
export const MAX_GAIN_PER_KANA_SESSION = 20;
export const MAX_LOSS_PER_KANA_SESSION = 14;
export const MASTERED_REVIEW_RATIO = 0.15;
export const PHASE_UNLOCK_MASTERY = 60;
export const PHASE_UNLOCK_RATIO = 0.7;
export const LOW_MASTERY_THRESHOLD = 40;
export const ACTIVE_MASTERY_THRESHOLD = 80;

export const KANA_SCRIPTS = ['hiragana', 'katakana'];

const PHASE_ORDER = ['seion', 'dakuten-handakuten', 'yoon'];
const HALF_LIFE_BY_BOX_HOURS = [2, 6, 18, 48, 96, 168, 336];

const KANA_CONFUSION_GROUPS = {
  hiragana: [
    ['あ', 'お'],
    ['い', 'り'],
    ['さ', 'ち'],
    ['ぬ', 'め'],
    ['ね', 'れ', 'わ'],
    ['る', 'ろ'],
    ['は', 'ほ'],
    ['ま', 'も'],
  ],
  katakana: [
    ['し', 'つ', 'そ', 'ん'],
    ['く', 'け', 'た'],
    ['ふ', 'わ', 'う'],
    ['す', 'ぬ'],
    ['ち', 'て'],
    ['ま', 'む'],
    ['る', 'れ'],
    ['み', 'め'],
  ],
};

export function normalizeKanaScript(script) {
  return script === 'katakana' ? 'katakana' : 'hiragana';
}

export function isKanaScript(script) {
  return KANA_SCRIPTS.includes(script);
}

export function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function shuffle(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  const result = [];
  items.forEach((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
}

export function createDefaultKanaProgress() {
  return {
    masteryPct: 0,
    box: 0,
    ease: 1,
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    currentCorrectStreak: 0,
    currentWrongStreak: 0,
    introducedAt: null,
    lastSeenAt: null,
    lastCorrectAt: null,
    lastWrongAt: null,
    lastSessionId: null,
  };
}

export function normalizeKanaProgressRecord(record) {
  const defaults = createDefaultKanaProgress();
  if (!record || typeof record !== 'object') return defaults;

  return {
    masteryPct: clampNumber(record.masteryPct, 0, 100),
    box: Math.round(clampNumber(record.box, 0, 6)),
    ease: clampNumber(record.ease ?? 1, 0.7, 1.4),
    seenCount: Math.max(0, Math.round(Number(record.seenCount) || 0)),
    correctCount: Math.max(0, Math.round(Number(record.correctCount) || 0)),
    wrongCount: Math.max(0, Math.round(Number(record.wrongCount) || 0)),
    currentCorrectStreak: Math.max(0, Math.round(Number(record.currentCorrectStreak) || 0)),
    currentWrongStreak: Math.max(0, Math.round(Number(record.currentWrongStreak) || 0)),
    introducedAt: Number.isFinite(Number(record.introducedAt)) ? Number(record.introducedAt) : null,
    lastSeenAt: Number.isFinite(Number(record.lastSeenAt)) ? Number(record.lastSeenAt) : null,
    lastCorrectAt: Number.isFinite(Number(record.lastCorrectAt)) ? Number(record.lastCorrectAt) : null,
    lastWrongAt: Number.isFinite(Number(record.lastWrongAt)) ? Number(record.lastWrongAt) : null,
    lastSessionId: record.lastSessionId ? String(record.lastSessionId) : null,
  };
}

export function flattenGojuon(script = 'hiragana') {
  const normalizedScript = normalizeKanaScript(script);
  const items = [];
  let order = 0;

  GOJUON_SECTIONS.forEach((section, sectionIndex) => {
    section.rows.forEach((row, rowIndex) => {
      row.forEach((item, columnIndex) => {
        if (!item) return;
        items.push({
          ...item,
          script: normalizedScript,
          kana: item.kana,
          audioKana: item.kana,
          displayKana: normalizedScript === 'katakana' ? toKatakanaText(item.kana) : item.kana,
          sectionId: section.id,
          sectionTitle: section.title,
          sectionIndex,
          rowIndex,
          columnIndex,
          rowId: `${section.id}-${rowIndex}`,
          order,
        });
        order += 1;
      });
    });
  });

  return items;
}

export function getKanaProgressSnapshot(progressState, script = 'hiragana') {
  const normalizedScript = normalizeKanaScript(script);
  return progressState?.kanaProgress?.[normalizedScript] ?? {};
}

export function getKanaMistakeSnapshot(progressState, script = 'hiragana') {
  const normalizedScript = normalizeKanaScript(script);
  return progressState?.kanaMistakes?.[normalizedScript] ?? {};
}

export function getProgressForKana(progressState, script, kana) {
  const scriptProgress = getKanaProgressSnapshot(progressState, script);
  return normalizeKanaProgressRecord(scriptProgress?.[kana]);
}

export function estimateKanaRecall(progressRecord, now = Date.now()) {
  const item = normalizeKanaProgressRecord(progressRecord);
  if (!item.lastSeenAt || item.masteryPct <= 0) return 0;

  const box = Math.round(clampNumber(item.box, 0, HALF_LIFE_BY_BOX_HOURS.length - 1));
  const halfLifeHours = HALF_LIFE_BY_BOX_HOURS[box] * clampNumber(item.ease, 0.7, 1.4);
  const elapsedHours = Math.max(0, (now - item.lastSeenAt) / 3600000);
  const freshness = Math.pow(2, -elapsedHours / halfLifeHours);

  return clampNumber((item.masteryPct / 100) * freshness, 0, 1);
}

export function getKanaDueScore(progressRecord, now = Date.now()) {
  const item = normalizeKanaProgressRecord(progressRecord);
  const recall = estimateKanaRecall(item, now);
  const lowMastery = 1 - (item.masteryPct / 100);
  const wrongBoost = Math.min(0.35, item.currentWrongStreak * 0.12);
  const staleBoost = 1 - recall;
  const masteredReview = item.masteryPct >= 100 ? 0.08 : 0;
  const jitter = Math.random() * 0.04;

  return staleBoost * 0.45 + lowMastery * 0.35 + wrongBoost + masteredReview + jitter;
}

function isPhaseUnlocked(phaseId, allItems, progressState, script) {
  const phaseItems = allItems.filter(item => item.sectionId === phaseId);
  if (phaseItems.length === 0) return true;

  const masteredCount = phaseItems.filter((item) => {
    const progress = getProgressForKana(progressState, script, item.kana);
    return progress.masteryPct >= PHASE_UNLOCK_MASTERY;
  }).length;

  return masteredCount / phaseItems.length >= PHASE_UNLOCK_RATIO;
}

function getUnlockedPhaseItems(allItems, progressState, script) {
  const unlocked = new Set([PHASE_ORDER[0]]);

  for (let i = 0; i < PHASE_ORDER.length - 1; i += 1) {
    if (!unlocked.has(PHASE_ORDER[i])) break;
    if (isPhaseUnlocked(PHASE_ORDER[i], allItems, progressState, script)) {
      unlocked.add(PHASE_ORDER[i + 1]);
    } else {
      break;
    }
  }

  return allItems.filter((item) => {
    const progress = getProgressForKana(progressState, script, item.kana);
    return unlocked.has(item.sectionId) || progress.seenCount > 0;
  });
}

function getNewItemLimit(introducedItems, progressState, script) {
  const activeLearning = introducedItems.filter((item) => {
    const progress = getProgressForKana(progressState, script, item.kana);
    return progress.masteryPct < ACTIVE_MASTERY_THRESHOLD;
  });
  const fragileItems = introducedItems.filter((item) => {
    const progress = getProgressForKana(progressState, script, item.kana);
    return progress.masteryPct < LOW_MASTERY_THRESHOLD;
  });

  if (fragileItems.length >= 3) return 0;
  if (activeLearning.length >= 6) return 1;
  return Math.min(MAX_NEW_KANA_PER_SESSION, Math.max(0, 6 - activeLearning.length));
}

function sortByDue(items, progressState, script, now) {
  return [...items].sort((a, b) => {
    const aProgress = getProgressForKana(progressState, script, a.kana);
    const bProgress = getProgressForKana(progressState, script, b.kana);
    const dueDiff = getKanaDueScore(bProgress, now) - getKanaDueScore(aProgress, now);
    if (Math.abs(dueDiff) > 0.001) return dueDiff;
    if (aProgress.currentWrongStreak !== bProgress.currentWrongStreak) {
      return bProgress.currentWrongStreak - aProgress.currentWrongStreak;
    }
    if (aProgress.masteryPct !== bProgress.masteryPct) {
      return aProgress.masteryPct - bProgress.masteryPct;
    }
    return a.order - b.order;
  });
}

function weightedPick(items, getWeight, avoidKana = null) {
  const candidates = items.length > 1 && avoidKana
    ? items.filter(item => item.kana !== avoidKana)
    : items;
  const pool = candidates.length > 0 ? candidates : items;
  const weighted = pool.map(item => ({
    item,
    weight: Math.max(0.01, Number(getWeight(item)) || 0.01),
  }));
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return weighted[weighted.length - 1]?.item ?? null;
}

function allocateTargetItems({ allItems, phaseItems, introducedItems, newItems, count, progressState, script, now }) {
  const targetItems = [];
  const pushItem = (item, times = 1) => {
    for (let i = 0; i < times && targetItems.length < count; i += 1) {
      targetItems.push(item);
    }
  };

  newItems.forEach(item => pushItem(item, 2));

  const dueItems = sortByDue(introducedItems, progressState, script, now);
  const weakItems = dueItems.filter((item) => {
    const progress = getProgressForKana(progressState, script, item.kana);
    return progress.masteryPct < PHASE_UNLOCK_MASTERY || progress.currentWrongStreak > 0;
  });
  const strengtheningItems = dueItems.filter((item) => {
    const progress = getProgressForKana(progressState, script, item.kana);
    return progress.masteryPct >= PHASE_UNLOCK_MASTERY && progress.masteryPct < 100;
  });
  const masteredItems = dueItems.filter((item) => {
    const progress = getProgressForKana(progressState, script, item.kana);
    return progress.masteryPct >= 100;
  });
  const masteredTarget = masteredItems.length > 0
    ? Math.min(3, Math.max(1, Math.round(count * MASTERED_REVIEW_RATIO)))
    : 0;
  let masteredAdded = 0;

  while (targetItems.length < count) {
    const lastKana = targetItems[targetItems.length - 1]?.kana ?? null;
    const shouldAddMastered = masteredItems.length > 0 && masteredAdded < masteredTarget && (
      count - targetItems.length <= masteredTarget - masteredAdded + 2 ||
      (targetItems.length > count * 0.7 && Math.random() < 0.35)
    );

    let pool;
    if (shouldAddMastered) {
      pool = masteredItems;
      masteredAdded += 1;
    } else if (weakItems.length > 0) {
      pool = uniqueBy([...weakItems, ...newItems], item => item.kana);
    } else if (strengtheningItems.length > 0) {
      pool = strengtheningItems;
    } else if (newItems.length > 0) {
      pool = newItems;
    } else if (dueItems.length > 0) {
      pool = dueItems;
    } else {
      pool = phaseItems.length > 0 ? phaseItems : allItems;
    }

    const picked = weightedPick(
      pool,
      (item) => {
        const progress = getProgressForKana(progressState, script, item.kana);
        if (newItems.some(newItem => newItem.kana === item.kana)) return 1.3;
        return getKanaDueScore(progress, now) + 0.15;
      },
      lastKana,
    );
    if (!picked) break;
    targetItems.push(picked);
  }

  return targetItems.slice(0, count);
}

function getConfusionKana(item, script) {
  const groups = KANA_CONFUSION_GROUPS[normalizeKanaScript(script)] ?? [];
  const group = groups.find(entries => entries.includes(item.kana));
  return group ? group.filter(kana => kana !== item.kana) : [];
}

function buildCandidateKanaOptions(item, context, preferConfusion = false) {
  const { allItems, progressState, script, targetItems } = context;
  const byKana = new Map(allItems.map(entry => [entry.kana, entry]));
  const mistakes = getKanaMistakeSnapshot(progressState, script)?.[item.kana] ?? {};
  const candidates = [];
  const addKana = (kana) => {
    const candidate = byKana.get(kana);
    if (candidate && candidate.kana !== item.kana) candidates.push(candidate);
  };

  Object.entries(mistakes)
    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
    .forEach(([kana]) => addKana(kana));

  if (preferConfusion) {
    getConfusionKana(item, script).forEach(addKana);
  }

  allItems
    .filter(entry => entry.rowId === item.rowId)
    .sort((a, b) => a.order - b.order)
    .forEach(entry => addKana(entry.kana));

  if (!preferConfusion) {
    getConfusionKana(item, script).forEach(addKana);
  }

  allItems
    .filter(entry => entry.sectionId === item.sectionId)
    .sort((a, b) => a.order - b.order)
    .forEach(entry => addKana(entry.kana));

  uniqueBy(targetItems, entry => entry.kana).forEach(entry => addKana(entry.kana));

  allItems
    .sort((a, b) => a.order - b.order)
    .forEach(entry => addKana(entry.kana));

  return uniqueBy(candidates, entry => entry.kana);
}

function createKanaOptions(item, context, settings = {}) {
  const wrongOptions = buildCandidateKanaOptions(item, context, settings.preferConfusion).slice(0, 3);
  const options = shuffle([item, ...wrongOptions]).map(option => ({
    value: option.kana,
    label: option.displayKana,
    kana: option.kana,
    romaji: option.romaji,
  }));
  return options;
}

function createRomajiOptions(item, context) {
  const { allItems } = context;
  const candidates = [];
  const addRomaji = (romaji) => {
    if (romaji && romaji !== item.romaji) candidates.push({ value: romaji, label: romaji });
  };

  allItems
    .filter(entry => entry.rowId === item.rowId)
    .sort((a, b) => a.order - b.order)
    .forEach(entry => addRomaji(entry.romaji));

  allItems
    .filter(entry => entry.sectionId === item.sectionId)
    .sort((a, b) => a.order - b.order)
    .forEach(entry => addRomaji(entry.romaji));

  allItems
    .sort((a, b) => a.order - b.order)
    .forEach(entry => addRomaji(entry.romaji));

  const wrongOptions = uniqueBy(candidates, entry => entry.value).slice(0, 3);
  return shuffle([{ value: item.romaji, label: item.romaji }, ...wrongOptions]);
}

function hasConfusionOptions(item, script) {
  return getConfusionKana(item, script).length > 0;
}

function chooseQuestionType(item, occurrenceIndex, questionIndex, isNewItem, script) {
  if (isNewItem && occurrenceIndex === 0) return 'kana-audio-to-kana';

  const cycle = ['kana-to-romaji', 'romaji-to-kana', 'kana-audio-to-kana', 'kana-confusion'];
  const type = cycle[(occurrenceIndex + questionIndex + item.order) % cycle.length];
  if (type === 'kana-confusion' && !hasConfusionOptions(item, script)) return 'romaji-to-kana';
  return type;
}

function buildQuestion(type, item, context, questionIndex) {
  const isRomajiChoice = type === 'kana-to-romaji';
  const options = isRomajiChoice
    ? createRomajiOptions(item, context)
    : createKanaOptions(item, context, { preferConfusion: type === 'kana-confusion' });
  const correctAnswer = isRomajiChoice ? item.romaji : item.kana;
  const promptByType = {
    'kana-audio-to-kana': '听音，选择对应的假名',
    'kana-to-romaji': '这个假名怎么读？',
    'romaji-to-kana': `选择读作 ${item.romaji} 的假名`,
    'kana-confusion': `选出读作 ${item.romaji} 的假名`,
  };

  return {
    id: `${context.sessionId}-${questionIndex}-${item.kana}-${type}`,
    type,
    prompt: promptByType[type],
    targetKana: item.kana,
    audioKana: item.audioKana,
    displayKana: item.displayKana,
    romaji: item.romaji,
    sectionId: item.sectionId,
    sectionTitle: item.sectionTitle,
    correctAnswer,
    correctAnswerLabel: isRomajiChoice ? item.romaji : item.displayKana,
    optionMode: isRomajiChoice ? 'romaji' : 'kana',
    options,
    autoPlayAudio: type === 'kana-audio-to-kana',
  };
}

export function buildKanaQuestions(targetItems, context) {
  const occurrenceByKana = {};
  const newKanaSet = new Set(context.newItems?.map(item => item.kana) ?? []);

  return targetItems.map((item, index) => {
    const occurrenceIndex = occurrenceByKana[item.kana] ?? 0;
    occurrenceByKana[item.kana] = occurrenceIndex + 1;
    const type = chooseQuestionType(item, occurrenceIndex, index, newKanaSet.has(item.kana), context.script);
    return buildQuestion(type, item, { ...context, targetItems }, index);
  });
}

export function createKanaSessionId(script = 'hiragana') {
  return `kana-${normalizeKanaScript(script)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildKanaPracticeSession(script, progressState, options = {}) {
  const normalizedScript = normalizeKanaScript(script);
  const allItems = flattenGojuon(normalizedScript);
  const now = Number(options.now) || Date.now();
  const count = Math.round(clampNumber(options.count ?? KANA_SESSION_DEFAULT, KANA_SESSION_MIN, KANA_SESSION_MAX));
  const sessionId = createKanaSessionId(normalizedScript);

  const phaseItems = getUnlockedPhaseItems(allItems, progressState, normalizedScript);
  const introducedItems = phaseItems.filter((item) => {
    const progress = getProgressForKana(progressState, normalizedScript, item.kana);
    return progress.seenCount > 0;
  });
  const unseenItems = phaseItems.filter((item) => {
    const progress = getProgressForKana(progressState, normalizedScript, item.kana);
    return progress.seenCount === 0;
  });
  const newLimit = getNewItemLimit(introducedItems, progressState, normalizedScript);
  const newItems = unseenItems
    .sort((a, b) => a.order - b.order)
    .slice(0, newLimit);

  const targetItems = allocateTargetItems({
    allItems,
    phaseItems,
    introducedItems,
    newItems,
    count,
    progressState,
    script: normalizedScript,
    now,
  });
  const questions = buildKanaQuestions(targetItems, {
    allItems,
    progressState,
    script: normalizedScript,
    sessionId,
    newItems,
  });

  return {
    id: sessionId,
    script: normalizedScript,
    title: normalizedScript === 'katakana' ? '片假名学习' : '平假名学习',
    questions,
    targetKana: uniqueBy(targetItems, item => item.kana).map(item => item.kana),
    newKana: newItems.map(item => item.kana),
    startedAt: now,
  };
}

export function getSelectedKanaFromQuestion(question, selectedAnswer) {
  if (question?.optionMode !== 'kana') return null;
  const option = question.options?.find(item => item.value === selectedAnswer);
  return option?.kana ?? null;
}

export function computeKanaSessionResult(session, answers = []) {
  const answerByQuestionId = new Map(
    answers.map(answer => [answer.questionId, answer])
  );
  const perKana = {};
  let correctTotal = 0;

  (session?.questions ?? []).forEach((question) => {
    const answer = answerByQuestionId.get(question.id);
    const kana = question.targetKana;
    if (!kana) return;
    const isCorrect = Boolean(answer?.isCorrect);
    if (isCorrect) correctTotal += 1;

    const current = perKana[kana] ?? {
      seen: 0,
      correct: 0,
      wrong: 0,
      firstTryCorrect: 0,
      wrongOptions: {},
    };
    current.seen += 1;
    if (isCorrect) {
      current.correct += 1;
      current.firstTryCorrect += 1;
    } else {
      current.wrong += 1;
      if (answer?.selectedKana && answer.selectedKana !== kana) {
        current.wrongOptions[answer.selectedKana] = (current.wrongOptions[answer.selectedKana] ?? 0) + 1;
      }
    }
    perKana[kana] = current;
  });

  return {
    sessionId: session?.id ?? createKanaSessionId(session?.script),
    script: normalizeKanaScript(session?.script),
    startedAt: session?.startedAt ?? null,
    completedAt: Date.now(),
    questionsTotal: session?.questions?.length ?? 0,
    correctTotal,
    newKana: Array.isArray(session?.newKana) ? session.newKana : [],
    perKana,
  };
}

export function computeMasteryDelta(kanaResult, progressRecord) {
  const result = kanaResult ?? {};
  if ((Number(result.seen) || 0) <= 0) return 0;

  const item = normalizeKanaProgressRecord(progressRecord);
  const correct = Math.max(0, Number(result.correct) || 0);
  const wrong = Math.max(0, Number(result.wrong) || 0);
  const correctPoints = correct * 4;
  const wrongPenalty = wrong * 6;
  const streakBonus = wrong === 0 && correct >= 4 ? 2 : 0;
  const rawDelta = correctPoints + streakBonus - wrongPenalty;
  const positiveCap = item.masteryPct >= 80 ? 12 : MAX_GAIN_PER_KANA_SESSION;
  const negativeCap = item.masteryPct >= 90 ? -MAX_LOSS_PER_KANA_SESSION : -10;

  return Math.round(clampNumber(rawDelta, negativeCap, positiveCap));
}

export function getKanaDisplayProgressColor(progressPct) {
  const pct = clampNumber(progressPct, 0, 100);
  if (pct <= 0) return '#E8E8E8';
  if (pct < 40) return '#FBBF24';
  if (pct < 80) return '#60A5FA';
  if (pct < 100) return '#34D399';
  return '#22C55E';
}
