import { generateObject, streamText, Output } from 'ai';
import { getModel, buildThinkingOptions } from './ai-providers.js';
import { getAiErrorContent, logAiGeneratedContent } from './ai-debug.js';
import {
  COMPACT_JSON_OUTPUT_RULE,
  GRAMMAR_OBJECT_JSON_FORMAT,
  QUESTIONS_WIRE_FORMAT,
  RECOMMENDATIONS_WIRE_FORMAT,
  SCAFFOLD_WIRE_FORMAT,
  decodeQuestionsWire,
  decodeRecommendationsWire,
  decodeScaffoldWire,
  decodeSectionsWire,
} from './course-wire.js';

// ─── Thinking depth helper ─────────────────────────────────────────────────────
/**
 * 将 AI 配置中的思考深度应用到 AI SDK 调用参数上
 * 处理：输出 token 缩减 / providerOptions 原生思考参数
 */
function applyThinkingOpts(aiConfig, callOptions) {
  const { maxTokensMultiplier = 1, providerOptions } =
    buildThinkingOptions(aiConfig, aiConfig.thinkingDepth);
  const result = {
    ...callOptions,
    maxOutputTokens: Math.round(
      (callOptions.maxOutputTokens ?? callOptions.maxTokens ?? 4000) * maxTokensMultiplier
    ),
  };
  delete result.maxTokens;
  if (providerOptions) result.providerOptions = providerOptions;
  return result;
}

// ─── Streamed JSON generation with estimated progress ─────────────────────────

const STREAM_PROGRESS_CAP = 0.92;
const VALIDATING_PROGRESS = 0.96;
const STREAM_PROGRESS_MULTIPLIER = 2;
const EXPECTED_JSON_CHARS = {
  scaffold:        900,
  grammar:         4000,
  questions:       4500,
  recommendations: 900,
};
const CHAPTER_PHASES = [
  { id: 'scaffold',  weight: 0.15 },
  { id: 'grammar',   weight: 0.35 },
  { id: 'questions', weight: 0.50 },
];

function buildProgressMessage(baseMessage, status, progress) {
  if (status === 'thinking') return `${baseMessage} · 模型正在思考…`;
  if (status === 'generating') return `${baseMessage} · 正在生成完整内容，约 ${Math.round(progress * 100)}%`;
  if (status === 'streaming') return `${baseMessage} · 正在接收内容，约 ${Math.round(progress * 100)}%`;
  if (status === 'validating') return `${baseMessage} · 正在校验并整理…`;
  if (status === 'fallback') return `${baseMessage} · 正在使用兼容模式生成…`;
  return `${baseMessage} · 已完成`;
}

function createProgressReporter({ phase, baseMessage, expectedChars, onProgress }) {
  let timer = null;
  let status = 'thinking';
  let stepProgress = 0;
  let receivedChars = 0;

  const emit = (nextStatus = status, nextProgress = stepProgress) => {
    status = nextStatus;
    stepProgress = Math.max(stepProgress, Math.min(1, nextProgress));
    onProgress?.({
      phase,
      status,
      stepProgress,
      receivedChars,
      message: buildProgressMessage(baseMessage, status, stepProgress),
    });
  };

  const start = () => {
    emit('thinking', 0);
    timer = setInterval(() => {
      const cap = status === 'thinking'
        ? 0.12
        : status === 'generating'
        ? 0.88
        : status === 'fallback'
        ? 0.88
        : status === 'streaming'
        ? 0.90
        : stepProgress;
      const increment = status === 'thinking' ? 0.008 : 0.004;
      if (stepProgress < cap) emit(status, Math.min(cap, stepProgress + increment));
    }, 800);
  };

  return {
    start,
    receive(delta) {
      receivedChars += delta.length;
      const estimated = Math.min(
        STREAM_PROGRESS_CAP,
        (0.08 + (receivedChars / expectedChars) * 0.84) * STREAM_PROGRESS_MULTIPLIER
      );
      emit('streaming', estimated);
    },
    generating() {
      emit('generating', stepProgress);
    },
    fallback() {
      emit('fallback', stepProgress);
    },
    validating() {
      emit('validating', VALIDATING_PROGRESS);
    },
    done() {
      emit('done', 1);
    },
    close() {
      if (timer) clearInterval(timer);
    },
  };
}

function isAbortError(error, signal) {
  return signal?.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError';
}

async function generateObjectWithDebugLog(aiConfig, callOptions, { phase, mode }) {
  try {
    const result = await generateObject(applyThinkingOpts(aiConfig, callOptions));
    logAiGeneratedContent({
      phase,
      mode,
      status: 'success',
      content: result.object,
    });
    return result;
  } catch (error) {
    logAiGeneratedContent({
      phase,
      mode,
      status: 'failure',
      content: getAiErrorContent(error),
      error,
    });
    throw error;
  }
}

/**
 * 使用 AI SDK 6 推荐的 streamText + Output.json() 接收 JSON。
 * 某些兼容接口不支持流式响应时，自动回退到原有 generateObject 调用。
 */
async function generateJsonWithProgress(aiConfig, callOptions, {
  phase,
  baseMessage,
  expectedChars,
  onProgress,
}) {
  const reporter = createProgressReporter({ phase, baseMessage, expectedChars, onProgress });
  reporter.start();

  try {
    let streamedText = '';
    try {
      const result = streamText(applyThinkingOpts(aiConfig, {
        ...callOptions,
        output: Output.json(),
      }));

      for await (const delta of result.textStream) {
        streamedText += delta;
        reporter.receive(delta);
      }

      reporter.validating();
      const raw = await result.output;
      logAiGeneratedContent({
        phase,
        mode: 'streamText',
        status: 'success',
        content: streamedText || raw,
      });
      reporter.done();
      return raw;
    } catch (error) {
      logAiGeneratedContent({
        phase,
        mode: 'streamText',
        status: 'failure',
        content: getAiErrorContent(error, streamedText),
        error,
      });
      if (isAbortError(error, callOptions.abortSignal)) throw error;

      console.warn(`[AI] ${phase} stream failed, falling back to generateObject:`, error);
      reporter.fallback();
      const { object } = await generateObjectWithDebugLog(aiConfig, {
        ...callOptions,
        output: 'no-schema',
      }, {
        phase,
        mode: 'generateObject-fallback',
      });
      reporter.validating();
      reporter.done();
      return object;
    }
  } finally {
    reporter.close();
  }
}

async function generateJsonObjectWithProgress(aiConfig, callOptions, {
  phase,
  baseMessage,
  expectedChars,
  onProgress,
  mode = 'generateObject',
}) {
  const reporter = createProgressReporter({ phase, baseMessage, expectedChars, onProgress });
  reporter.start();
  reporter.generating();

  try {
    const { object } = await generateObjectWithDebugLog(aiConfig, {
      ...callOptions,
      output: 'no-schema',
    }, {
      phase,
      mode,
    });
    reporter.validating();
    reporter.done();
    return object;
  } finally {
    reporter.close();
  }
}

function createChapterProgressHandler(onProgress, stepIndex) {
  const completedWeight = CHAPTER_PHASES
    .slice(0, stepIndex)
    .reduce((sum, phase) => sum + phase.weight, 0);
  const { weight } = CHAPTER_PHASES[stepIndex];

  return event => onProgress?.({
    ...event,
    stepIndex,
    stepTotal: CHAPTER_PHASES.length,
    overallProgress: completedWeight + event.stepProgress * weight,
  });
}

// ─── Human-readable label maps ─────────────────────────────────────────────────

const LEVEL_LABELS = {
  beginner:    '初学者（零基础，从未学过日语）',
  elementary:  '入门（认识假名，会简单词汇）',
  n5:          '初级（日语能力 N5 水平，掌握基础语法和常用词汇）',
  n4:          '初级（日语能力 N4 水平，能理解简单日常对话）',
};
const PACE_LABELS = {
  relaxed:    '轻松随意（每章 2 个新语法，4 节课反复巩固）',
  steady:     '稳步推进（每章 2 个新语法，5 节课循序渐进）',
  fast:       '快速入门（每章 3 个新语法，6 节课练习巩固）',
  intensive:  '密集冲刺（每章 4 个新语法，8 节课密集训练）',
};
const DEFAULT_PACE = 'steady';
const CURRICULUM_PACE_PLANS = {
  relaxed:   { label: '轻松随意', grammarPointCount: 2, levelCount: 4 },
  steady:    { label: '稳步推进', grammarPointCount: 2, levelCount: 5 },
  fast:      { label: '快速入门', grammarPointCount: 3, levelCount: 6 },
  intensive: { label: '密集冲刺', grammarPointCount: 4, levelCount: 8 },
};
const PURPOSE_LABELS = {
  hobby:    '兴趣爱好（喜欢日本文化、动漫）',
  travel:   '旅游出行（计划去日本旅行）',
  work:     '工作 / 学业（职场沟通或学术需要）',
  exam:     '考试备考（JLPT 等日语考试）',
};
const STYLE_LABELS = {
  fun:             '轻松有趣（游戏化，轻松愉快地学习）',
  systematic:      '系统专业（扎实语法，循序渐进）',
  conversational:  '情景对话（贴近实际使用场景）',
  balanced:        '综合均衡（全面覆盖，均衡发展）',
};

function buildUserContext(userAnswers) {
  return [
    `学习者水平：${LEVEL_LABELS[userAnswers.level] || userAnswers.level}`,
    `学习节奏：${PACE_LABELS[userAnswers.pace] || userAnswers.pace}`,
    `学习用途：${PURPOSE_LABELS[userAnswers.purpose] || userAnswers.purpose}`,
    `课程风格：${STYLE_LABELS[userAnswers.style] || userAnswers.style}`,
    userAnswers.extra?.trim() ? `补充需求：${userAnswers.extra.trim()}` : null,
  ].filter(Boolean).join('\n');
}

function getCurriculumPacePlan(pace) {
  return CURRICULUM_PACE_PLANS[pace] ?? CURRICULUM_PACE_PLANS[DEFAULT_PACE];
}

function buildCurriculumPaceRequirements(pace) {
  const plan = getCurriculumPacePlan(pace);
  return `【章节教学节奏：${plan.label}，必须严格遵守】
- 本章只引入恰好 ${plan.grammarPointCount} 个不同的新语法点，不多不少。先选定这 ${plan.grammarPointCount} 个语法点，再编排关卡。
- 生成恰好 ${plan.levelCount} 个关卡，不多不少。每关仍有 9 道题，因此同一语法必须跨关卡反复巩固。
- 每关 grammar 数组只能从本章选定的 ${plan.grammarPointCount} 个语法点中选择，不得在后续关卡临时加入新语法。
- 每个新语法至少出现在 2 个关卡中；前面的关卡用于引入和专项练习，后面的关卡用于复习、对比或情境综合。
- 最后一关必须是综合复习，grammar 数组必须包含本章全部 ${plan.grammarPointCount} 个语法点。
- 不要采用“每关新增一批语法”的编排。可以更换场景、词汇和题目难度，但要让学习者有足够练习时间。`;
}

// ─── Normalize helpers (handle field name variations across different AI models) ─

// 将标题中的中文章节数字统一转为阿拉伯数字（「第一章」→「第1章」）
const ZH_NUMS = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
function normalizeChapterNum(title) {
  return title.replace(/第([一二三四五六七八九十]+)章/, (_, n) => `第${ZH_NUMS[n] ?? n}章`);
}

function lightenHex(hex, amount = 30) {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (n >> 16) + amount);
    const g = Math.min(255, ((n >> 8) & 0xff) + amount);
    const b = Math.min(255, (n & 0xff) + amount);
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  } catch {
    return '#7C6CF6';
  }
}

function normalizeScaffold(raw) {
  const levels = (raw.levels ?? []).map((lv, idx) => {
    const level = {
      id:     lv.id     ?? `ch1-lv${idx + 1}`,
      number: lv.number ?? idx + 1,
      title:  lv.title  ?? lv.level_title  ?? `第${idx + 1}关`,
      topic:  lv.topic  ?? lv.description  ?? lv.level_topic ?? '',
      grammar: Array.isArray(lv.grammar)        ? lv.grammar
             : Array.isArray(lv.grammar_points) ? lv.grammar_points
             : [],
      icon: lv.icon ?? lv.emoji ?? '📖',
    };
    if (idx > 0) level.locked = true;
    return level;
  });

  const color = raw.color ?? raw.theme_color ?? raw.primary_color ?? raw.main_color ?? '#5B4FE9';
  const gradient = Array.isArray(raw.gradient) && raw.gradient.length === 2
    ? raw.gradient
    : [lightenHex(color, 30), color];

  return {
    id:          raw.id          ?? raw.chapter_id          ?? 'ch1',
    title:       normalizeChapterNum(raw.title ?? raw.chapter_title ?? '第一章'),
    subtitle:    raw.subtitle    ?? raw.chapter_subtitle     ?? raw.sub_title ?? raw.chapter_title ?? '日语学习',
    description: raw.description ?? raw.chapter_description ?? raw.overview  ?? raw.intro         ?? '',
    icon:        raw.icon        ?? raw.chapter_icon         ?? raw.emoji     ?? '📖',
    color,
    gradient,
    levels,
  };
}

function normalizeGrammarPoint(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim() : '';
}

function listUniqueGrammarPoints(levels) {
  const grammarPoints = new Map();
  levels.forEach(level => {
    (level.grammar ?? []).forEach(grammarPoint => {
      const normalized = normalizeGrammarPoint(grammarPoint);
      if (normalized && !grammarPoints.has(normalized)) {
        grammarPoints.set(normalized, grammarPoint.trim());
      }
    });
  });
  return [...grammarPoints.values()];
}

function validateScaffoldPace(scaffold, pacePlan) {
  if (scaffold.levels.length !== pacePlan.levelCount) {
    throw new Error(
      `Scaffold pace mismatch: expected ${pacePlan.levelCount} levels, received ${scaffold.levels.length}`
    );
  }

  scaffold.levels.forEach((level, levelIdx) => {
    if (
      !Array.isArray(level.grammar) ||
      level.grammar.length === 0 ||
      level.grammar.some(grammarPoint => !normalizeGrammarPoint(grammarPoint))
    ) {
      throw new Error(`Scaffold level ${levelIdx + 1} must contain valid grammar points`);
    }
  });

  const grammarPoints = listUniqueGrammarPoints(scaffold.levels);
  if (grammarPoints.length !== pacePlan.grammarPointCount) {
    throw new Error(
      `Scaffold pace mismatch: expected ${pacePlan.grammarPointCount} unique grammar points, received ${grammarPoints.length}`
    );
  }

  const finalGrammar = new Set(scaffold.levels.at(-1).grammar.map(normalizeGrammarPoint));
  const missingFromReview = grammarPoints.filter(
    grammarPoint => !finalGrammar.has(normalizeGrammarPoint(grammarPoint))
  );
  if (missingFromReview.length > 0) {
    throw new Error(`Scaffold final review is missing grammar: ${missingFromReview.join('、')}`);
  }

  const underPracticed = grammarPoints.filter(grammarPoint => {
    const normalized = normalizeGrammarPoint(grammarPoint);
    return scaffold.levels.filter(level =>
      level.grammar.some(item => normalizeGrammarPoint(item) === normalized)
    ).length < 2;
  });
  if (underPracticed.length > 0) {
    throw new Error(`Scaffold grammar needs spaced practice: ${underPracticed.join('、')}`);
  }

  return scaffold;
}

function parseScaffold(raw, pacePlan, decodeOptions) {
  return validateScaffoldPace(
    normalizeScaffold(decodeScaffoldWire(raw, decodeOptions)),
    pacePlan
  );
}

async function generateValidatedScaffold(
  aiConfig,
  callOptions,
  progressOptions,
  pacePlan,
  decodeOptions
) {
  const raw = await generateJsonWithProgress(aiConfig, callOptions, progressOptions);

  try {
    return parseScaffold(raw, pacePlan, decodeOptions);
  } catch (error) {
    if (isAbortError(error, callOptions.abortSignal)) throw error;
    console.warn('[AI] scaffold failed semantic validation, retrying:', error);
  }

  const retryRaw = await generateJsonWithProgress(aiConfig, {
    ...callOptions,
    prompt: `${callOptions.prompt}

【重新生成】上一份课程骨架违反了教学节奏约束。请重新检查关卡数量、不同新语法总数、跨关卡复习次数和终关综合复习后，输出完整的新 JSON。`,
    temperature: 0.1,
  }, {
    ...progressOptions,
    baseMessage: `${progressOptions.baseMessage}（校正教学节奏）`,
  });

  return parseScaffold(retryRaw, pacePlan, decodeOptions);
}

function normalizeSections(raw) {
  const sections = raw?.sections ?? (Array.isArray(raw) ? raw : []);
  return sections.map(s => {
    if (s.type === 'intro') {
      return { type: 'intro', content: s.content ?? '' };
    }
    if (s.type === 'grammar-rule') {
      return {
        type: 'grammar-rule',
        badge:       s.badge      ?? s.label         ?? '句型',
        badgeColor:  s.badgeColor ?? s.badge_color   ?? s.color ?? '#5B4FE9',
        title:       s.title      ?? s.grammar_name  ?? '',
        reading:     s.reading    ?? s.romanization  ?? '',
        description: s.description ?? s.explanation  ?? '',
        pattern: (s.pattern ?? []).map(p => ({
          label: p.label,
          color: p.color,
          text:  p.text,
        })),
        casual: s.casual,
        examples: (s.examples ?? []).map(ex => ({
          parts: (ex.parts ?? []).map(p => ({
            t: p.t ?? p.text ?? '',
            k: p.k ?? p.kana ?? undefined,
          })),
          cn:   ex.cn   ?? ex.chinese ?? ex.translation ?? '',
          note: ex.note ?? undefined,
        })),
      };
    }
    if (s.type === 'tip') {
      return {
        type:    'tip',
        icon:    s.icon    ?? s.emoji  ?? '💡',
        title:   s.title   ?? '',
        content: s.content ?? '',
      };
    }
    if (s.type === 'vocabulary') {
      return {
        type:  'vocabulary',
        title: s.title ?? '本章核心单词',
        words: (s.words ?? s.vocabulary ?? s.word_list ?? []).map(w => ({
          jp:   w.jp   ?? w.japanese ?? w.word     ?? '',
          kana: w.kana ?? w.reading  ?? w.furigana ?? '',
          cn:   w.cn   ?? w.chinese  ?? w.meaning  ?? '',
          pos:  w.pos  ?? w.part_of_speech ?? w.type ?? '词汇',
        })),
      };
    }
    return s;
  }).filter(s => s.type);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeGrammarMatchText(value) {
  return normalizeGrammarPoint(value).replace(/[\s「」『』【】()[\]（）]/g, '');
}

function matchGrammarRulesToPoints(rules, expectedGrammarPoints) {
  const unmatchedRules = new Set(rules.map((_, idx) => idx));

  return expectedGrammarPoints.filter(grammarPoint => {
    const expected = normalizeGrammarMatchText(grammarPoint);
    const exactMatch = [...unmatchedRules].find(
      idx => normalizeGrammarMatchText(rules[idx].title) === expected
    );
    const match = exactMatch ?? [...unmatchedRules].find(idx => {
      const title = normalizeGrammarMatchText(rules[idx].title);
      return title.includes(expected) || expected.includes(title);
    });

    if (match === undefined) return true;
    unmatchedRules.delete(match);
    return false;
  });
}

function validateGrammarSections(sections, expectedGrammarPoints = []) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('Grammar tutorial has no sections');
  }

  let introCount = 0;
  let ruleCount = 0;
  let tipCount = 0;
  let vocabularyCount = 0;

  sections.forEach((section, sectionIdx) => {
    if (section.type === 'intro') {
      introCount += 1;
      if (!isNonEmptyString(section.content)) {
        throw new Error(`Grammar intro ${sectionIdx} content must be a string`);
      }
      return;
    }

    if (section.type === 'grammar-rule') {
      ruleCount += 1;
      if (!isNonEmptyString(section.title) || !isNonEmptyString(section.description)) {
        throw new Error(`Grammar rule ${sectionIdx} is missing its title or description`);
      }
      if (!Array.isArray(section.pattern) || section.pattern.length === 0) {
        throw new Error(`Grammar rule ${sectionIdx} has no pattern`);
      }
      if (
        section.pattern.some(item =>
          !isNonEmptyString(item.label) && !isNonEmptyString(item.text)
        )
      ) {
        throw new Error(`Grammar rule ${sectionIdx} contains an invalid pattern item`);
      }
      if (!Array.isArray(section.examples) || section.examples.length < 2) {
        throw new Error(`Grammar rule ${sectionIdx} needs at least two examples`);
      }
      if (
        section.examples.some(example =>
          !isNonEmptyString(example.cn) ||
          !Array.isArray(example.parts) ||
          example.parts.length === 0 ||
          example.parts.some(part => !isNonEmptyString(part.t))
        )
      ) {
        throw new Error(`Grammar rule ${sectionIdx} contains an invalid example`);
      }
      return;
    }

    if (section.type === 'tip') {
      tipCount += 1;
      if (
        !isNonEmptyString(section.icon) ||
        !isNonEmptyString(section.title) ||
        !isNonEmptyString(section.content)
      ) {
        throw new Error(`Grammar tip ${sectionIdx} is incomplete`);
      }
      return;
    }

    if (section.type === 'vocabulary') {
      vocabularyCount += 1;
      if (!Array.isArray(section.words) || section.words.length < 8) {
        throw new Error('Grammar vocabulary needs at least eight words');
      }
      if (
        section.words.some(word =>
          !isNonEmptyString(word.jp) ||
          !isNonEmptyString(word.kana) ||
          !isNonEmptyString(word.cn) ||
          !isNonEmptyString(word.pos)
        )
      ) {
        throw new Error('Grammar vocabulary contains an incomplete word');
      }
      return;
    }

    throw new Error(`Unsupported grammar section type: ${JSON.stringify(section.type)}`);
  });

  if (introCount !== 1) throw new Error('Grammar tutorial must have exactly one intro');
  if (expectedGrammarPoints.length > 0 && ruleCount !== expectedGrammarPoints.length) {
    throw new Error(
      `Grammar tutorial must explain exactly ${expectedGrammarPoints.length} scaffold grammar points, received ${ruleCount}`
    );
  }
  if (ruleCount === 0) throw new Error('Grammar tutorial must have at least one rule');
  if (tipCount < 1 || tipCount > 2) throw new Error('Grammar tutorial must have one or two tips');
  if (vocabularyCount !== 1) throw new Error('Grammar tutorial must have exactly one vocabulary');

  const missingGrammar = matchGrammarRulesToPoints(
    sections.filter(section => section.type === 'grammar-rule'),
    expectedGrammarPoints
  );
  if (missingGrammar.length > 0) {
    throw new Error(`Grammar tutorial is missing scaffold grammar: ${missingGrammar.join('、')}`);
  }

  return sections;
}

function parseGrammarSections(raw, expectedGrammarPoints) {
  return validateGrammarSections(normalizeSections(decodeSectionsWire(raw)), expectedGrammarPoints);
}

function normalizeQuestions(raw) {
  const questions = raw?.questions ?? (Array.isArray(raw) ? raw : []);
  return questions.map((q, idx) => {
    const id = q.id ?? q.question_id ?? `q${idx + 1}`;
    if (q.type === 'word-fill') {
      return {
        id, type: 'word-fill',
        prompt:      q.prompt      ?? q.question     ?? q.instruction ?? '选出正确的词语，完成句子',
        parts:       q.parts       ?? q.sentence_parts ?? [],
        options:     q.options     ?? q.choices        ?? [],
        answers:     Array.isArray(q.answers) ? q.answers : [q.answer ?? q.correct_answer].filter(Boolean),
        translation: q.translation ?? q.chinese ?? q.cn  ?? '',
        hint:        q.hint        ?? q.tip             ?? '',
        ruby:        q.ruby        ?? q.kana_map        ?? {},
      };
    }
    if (q.type === 'sentence-translate') {
      return {
        id, type: 'sentence-translate',
        prompt:      q.prompt      ?? q.question      ?? q.instruction ?? '将句子翻译成中文',
        sentence:    q.sentence    ?? q.japanese       ?? q.jp_sentence  ?? '',
        options:     q.options     ?? q.choices        ?? q.word_choices ?? [],
        answers:     Array.isArray(q.answers) ? q.answers : [q.answer].filter(Boolean),
        translation: q.translation ?? q.chinese ?? q.cn ?? '',
        hint:        q.hint        ?? q.tip            ?? '',
        ruby:        q.ruby        ?? q.kana_map       ?? {},
      };
    }
    if (q.type === 'word-match') {
      return {
        id, type: 'word-match',
        prompt: q.prompt ?? q.question ?? q.instruction ?? '点击配对，消消看！',
        pairs: (q.pairs ?? q.matching ?? q.word_pairs ?? []).map(p => ({
          jp:   p.jp   ?? p.japanese ?? p.word    ?? '',
          cn:   p.cn   ?? p.chinese  ?? p.meaning ?? '',
          ruby: p.ruby ?? p.kana_map ?? {},
        })),
      };
    }
    return { id, ...q };
  });
}

// ─── Step 1: Generate chapter scaffold ────────────────────────────────────────

async function generateScaffold(aiConfig, userAnswers, signal, onProgress) {
  const model = getModel(aiConfig);
  const userContext = buildUserContext(userAnswers);
  const pacePlan = getCurriculumPacePlan(userAnswers.pace);
  const paceRequirements = buildCurriculumPaceRequirements(userAnswers.pace);

  return generateValidatedScaffold(aiConfig, {
    model,
    system: `你是专业的日语互动课程设计师。根据学习者信息，设计第一章节的课程骨架。
学习者信息：
${userContext}`,
    prompt: `请为主题「${userAnswers.topic}」设计第一章节课程骨架。
要求：难度循序渐进，第一关紧扣主题，后续围绕同一批新语法进行巩固和自然延伸。
【重要】关卡的标题（title）和主题（topic）必须与学习者的风格偏好高度一致。若学习者的补充需求中有特定风格要求（如 GALGAME 风格、旅行场景等），每个关卡标题和主题都应鲜明体现该风格，使整章课程具有沉浸感和一致性。

${paceRequirements}

${SCAFFOLD_WIRE_FORMAT}

现在请为主题「${userAnswers.topic}」生成真实内容。${COMPACT_JSON_OUTPUT_RULE}`,
    temperature: 0.3,
    maxOutputTokens: 2000,
    abortSignal: signal,
    maxRetries: 1,
  }, {
    phase: 'scaffold',
    baseMessage: '🏗️ 规划课程结构',
    expectedChars: EXPECTED_JSON_CHARS.scaffold,
    onProgress,
  }, pacePlan);
}

// ─── Step 2: Generate grammar sections ────────────────────────────────────────

async function generateGrammarSections(aiConfig, scaffold, userAnswers, signal, onProgress) {
  const model = getModel(aiConfig);
  const allGrammarPoints = listUniqueGrammarPoints(scaffold.levels);
  const userContext = buildUserContext(userAnswers);
  const levelOverview = scaffold.levels
    .map((lv, i) => `第${i + 1}关「${lv.title}」主题：${lv.topic}，语法：${lv.grammar.join('、')}`)
    .join('\n');

  const grammarPrompt = `章节「${scaffold.title}·${scaffold.subtitle}」
章节描述：${scaffold.description}
全章必须逐一讲解的语法清单（共 ${allGrammarPoints.length} 个，每一个同等重要）：${allGrammarPoints.join('、')}

【关卡主题一览（供例句场景参考）】
${levelOverview}

生成完整语法讲解：
- intro：1 段简短导语，2~3 句话
- rules：恰好 ${allGrammarPoints.length} 项，逐一覆盖上方全部语法点；每项 title 清晰写出对应语法点
- 每条 rule：简洁 description、2~5 个 pattern 元素、恰好 2 个 examples
- tips：1~2 项
- vocabulary.words：8~12 项
- 不要只讲第一关，不要遗漏后续关卡语法，不要把多个语法点合并成一条规则
- examples 的场景、人名、词汇尽量与章节风格及关卡主题一致，但正文保持简洁

${GRAMMAR_OBJECT_JSON_FORMAT}

现在请为「${scaffold.subtitle}」生成真实内容。
输出要求：只输出一个合法 JSON 对象；不要 Markdown 或代码块；允许正常 JSON 排版空格和换行。`;

  try {
    const raw = await generateJsonObjectWithProgress(aiConfig, {
      model,
      system: `你是专业的日语语法教材编写者。优先保证 JSON 格式稳定、字段完整、内容简洁。
学习者信息：
${userContext}`,
      prompt: grammarPrompt,
      temperature: 0.1,
      maxOutputTokens: 7000,
      abortSignal: signal,
      maxRetries: 1,
    }, {
      phase: 'grammar',
      baseMessage: '📚 生成语法讲解',
      expectedChars: EXPECTED_JSON_CHARS.grammar,
      onProgress,
      mode: 'generateObject-keyed',
    });

    return parseGrammarSections(raw, allGrammarPoints);
  } catch (error) {
    if (isAbortError(error, signal)) throw error;
    console.warn('[AI] grammar generation failed, retrying with stricter instructions:', error);
  }

  const retryRaw = await generateJsonObjectWithProgress(aiConfig, {
    model,
    system: `你是专业的日语语法教材编写者。上一份回答无法解析。只输出简单、完整、可解析的 JSON 对象。`,
    prompt: `${grammarPrompt}

【重新生成】上一份回答存在 JSON 语法错误或字段遗漏。请从头生成完整 JSON：
- 严格使用带字段名的对象，不要使用位置数组、数字 key 或伪 JSON
- 每条规则只保留恰好 2 个简短例句
- 输出前检查所有大括号、中括号、双引号和逗号是否闭合`,
    temperature: 0,
    maxOutputTokens: 8000,
    abortSignal: signal,
    maxRetries: 1,
  }, {
    phase: 'grammar',
    baseMessage: '📚 重新生成语法讲解',
    expectedChars: EXPECTED_JSON_CHARS.grammar,
    onProgress,
    mode: 'generateObject-keyed-retry',
  });

  return parseGrammarSections(retryRaw, allGrammarPoints);
}

// ─── Step 3: Generate level 1 questions ───────────────────────────────────────

async function generateLevel1Questions(aiConfig, scaffold, grammarSections, userAnswers, signal, onProgress) {
  const model = getModel(aiConfig);
  const level1 = scaffold.levels[0];
  const userContext = buildUserContext(userAnswers);

  // Extract vocab and grammar rules from grammar sections for richer question context
  const vocabSection = grammarSections.find(s => s.type === 'vocabulary');
  const vocabText = (vocabSection?.words ?? []).slice(0, 20)
    .map(w => `${w.jp}（${w.kana}）＝${w.cn}`)
    .join('、') || '（无）';
  const grammarRuleText = grammarSections
    .filter(s => s.type === 'grammar-rule')
    .map(s => `・${s.title}（${s.reading}）：${s.description}`)
    .join('\n') || '（无）';

  const raw = await generateJsonWithProgress(aiConfig, {
    model,
    system: `你是专业的外语互动课程设计师，擅长设计趣味性强、难度递进的语言练习题。
学习者信息：
${userContext}`,
    prompt: `【章节背景】
章节：${scaffold.title}「${scaffold.subtitle}」
描述：${scaffold.description}
本章已教授的语法规则：
${grammarRuleText}
本章核心词汇：${vocabText}

【关卡信息】
关卡标题：${level1.title}
关卡主题：${level1.topic}
语法要点：${level1.grammar.join('、')}

生成 9 道题（4 道 word-fill + 3 道 sentence-translate + 2 道 word-match）。

题目要求：
- 【极其重要】所有题目的场景、人名、词汇必须与关卡标题「${level1.title}」（${level1.topic}）的主题高度契合，营造沉浸感
- word-fill：4 个选项，答案唯一正确，干扰项有迷惑性，parts 中用 "___" 标记空格
- sentence-translate：给出一句日语，让学习者点击【中文词语】拼出中文翻译。sentence 字段填日语原句，options 和 answers 字段必须全部是【中文词语】（不得出现日语），options 为中文词（含干扰词），answers 为正确中文词按序排列
- word-match：每道固定 4 对，pairs 中每对含 jp/cn/ruby 三个字段
- ruby 字段为汉字→假名的映射对象，如 {"私":"わたし"}

${QUESTIONS_WIRE_FORMAT}

现在请为关卡「${level1.title}」（${level1.topic}）生成全部 9 道真实题目（4 word-fill + 3 sentence-translate + 2 word-match）。${COMPACT_JSON_OUTPUT_RULE}`,
    temperature: 0.3,
    maxOutputTokens: 5000,
    abortSignal: signal,
    maxRetries: 1,
  }, {
    phase: 'questions',
    baseMessage: '📝 生成第一关题目',
    expectedChars: EXPECTED_JSON_CHARS.questions,
    onProgress,
  });

  return normalizeQuestions(decodeQuestionsWire(raw));
}

// ─── Export: generate questions for any level ────────────────────────────────

async function generateLevelNQuestions(aiConfig, chapter, level, levelIdx, userAnswers, signal, onProgress) {
  const model = getModel(aiConfig);

  // Extract vocab from grammar sections (up to 24 words for context)
  const vocabSection = chapter.grammar?.sections?.find(s => s.type === 'vocabulary');
  const vocabText = (vocabSection?.words ?? []).slice(0, 24)
    .map(w => `${w.jp}（${w.kana}）＝${w.cn}`)
    .join('、') || '（无）';

  // Extract grammar rules already taught in this chapter
  const grammarRuleText = (chapter.grammar?.sections ?? [])
    .filter(s => s.type === 'grammar-rule')
    .map(s => `・${s.title}（${s.reading}）：${s.description}`)
    .join('\n') || '（无）';

  // Previous levels summary for continuity
  const prevSummary = levelIdx > 0
    ? chapter.levels.slice(0, levelIdx)
        .map((lv, i) => `第${i + 1}关「${lv.topic}」：${lv.grammar.join('、')}`)
        .join('\n')
    : '（本关为章节第一关）';

  const raw = await generateJsonWithProgress(aiConfig, {
    model,
    system: `你是专业的外语互动课程设计师，擅长设计趣味性强、难度递进的语言练习题。${userAnswers ? `\n学习者信息：\n${buildUserContext(userAnswers)}` : ''}`,
    prompt: `【章节背景】
章节：${chapter.title}「${chapter.subtitle}」
描述：${chapter.description || '（无）'}
本章已教授的语法规则：
${grammarRuleText}
本章核心词汇：${vocabText}

【关卡定位】
前序关卡已覆盖：
${prevSummary}
当前关卡：第 ${levelIdx + 1} 关「${level.title}」——「${level.topic}」
当前关卡语法要点：${level.grammar.join('、')}

生成 9 道题（4 道 word-fill + 3 道 sentence-translate + 2 道 word-match）。

题目要求：
- 【极其重要】所有题目的场景、人名、词汇必须与当前关卡标题「${level.title}」（${level.topic}）的主题高度契合，营造沉浸感
- 难度递进：比前序关卡有所提升，聚焦当前关卡语法要点，可有机复用前序已学词汇
- word-fill：4 个选项，答案唯一正确，干扰项有迷惑性，parts 中用 "___" 标记空格
- sentence-translate：给出一句日语，让学习者点击【中文词语】拼出中文翻译。sentence 字段填日语原句，options 和 answers 字段必须全部是【中文词语】（不得出现日语），options 含干扰词
- word-match：每道固定 4 对，pairs 中每对含 jp/cn/ruby 三个字段
- ruby 字段为汉字→假名的映射对象，如 {"私":"わたし"}

${QUESTIONS_WIRE_FORMAT}

现在请为关卡「${level.title}」（${level.topic}）生成全部 9 道真实题目（4 word-fill + 3 sentence-translate + 2 word-match）。${COMPACT_JSON_OUTPUT_RULE}`,
    temperature: 0.3,
    maxOutputTokens: 5000,
    abortSignal: signal,
    maxRetries: 1,
  }, {
    phase: 'questions',
    baseMessage: `📝 生成「${level.topic}」题目`,
    expectedChars: EXPECTED_JSON_CHARS.questions,
    onProgress,
  });

  return normalizeQuestions(decodeQuestionsWire(raw));
}

/**
 * 为章节中的任意关卡生成题目
 *
 * @param {object} aiConfig  - { provider, apiKey, modelId, baseUrl }
 * @param {object} chapter   - 完整章节对象（须含 chapter.grammar.sections）
 * @param {number} levelIdx  - 关卡在 chapter.levels 中的索引（0-based）
 * @param {object} [options]
 * @param {function} [options.onProgress] - (message: string) => void
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Array>} 题目数组
 */
export async function generateLevelQuestions(aiConfig, chapter, levelIdx, { onProgress, signal, userAnswers } = {}) {
  const sig = signal ?? AbortSignal.timeout(300_000);
  const level = chapter.levels[levelIdx];
  if (!level) throw new Error(`关卡索引 ${levelIdx} 不存在`);
  const handleProgress = event => onProgress?.({
    ...event,
    stepIndex: 0,
    stepTotal: 1,
    overallProgress: event.stepProgress,
  });
  return generateLevelNQuestions(aiConfig, chapter, level, levelIdx, userAnswers, sig, handleProgress);
}

// ─── Main export: generate first chapter ──────────────────────────────────────

// ─── Step 1-next: Generate scaffold for subsequent chapters ──────────────────

async function generateNextScaffold(aiConfig, context, chapterId, signal, onProgress) {
  const model = getModel(aiConfig);
  const { recentChapters, lastChapter, selectedTopic, userAnswers, extraNote } = context;

  // 最近学习的章节摘要（最多 10 个）
  const recentList = (recentChapters ?? []).slice(-10);
  const chaptersContext = recentList.map((ch, i) =>
    `${i + 1}. 「${ch.title}·${ch.subtitle}」：${(ch.levels ?? []).map(lv => lv.topic).join('、')}`
  ).join('\n');

  // 上一章节语法摘要
  const lastGrammar = (lastChapter?.grammar?.sections ?? [])
    .filter(s => s.type === 'grammar-rule')
    .map(s => `${s.title}（${s.reading}）`)
    .join('、') || '（无）';

  const userCtx = userAnswers ? buildUserContext(userAnswers) : '';
  const chapterNum = parseInt(chapterId.replace('ch', ''), 10);
  const pacePlan = getCurriculumPacePlan(userAnswers?.pace);
  const paceRequirements = buildCurriculumPaceRequirements(userAnswers?.pace);

  const scaffold = await generateValidatedScaffold(aiConfig, {
    model,
    system: `你是专业的日语互动课程设计师。根据学习者的学习进度，设计新章节的课程骨架。${userCtx ? `\n学习者信息：\n${userCtx}` : ''}`,
    prompt: `学习者已完成以下章节（由早到晚）：
${chaptersContext}

上一章节语法要点：${lastGrammar}

【本次要生成的新章节】
章节名称：${selectedTopic.title}
学习内容：${selectedTopic.topic || selectedTopic.title}
说明：${selectedTopic.description || '（无）'}${extraNote ? `\n学习者补充需求：${extraNote}` : ''}

请设计「${selectedTopic.title}」新章节的课程骨架，要求：
- 难度循序渐进，围绕本章选定的新语法进行专项练习、复习和综合运用
- 不重复已学内容，自然衔接上一章节难度
- 关卡标题和主题紧密契合本章节内容
【重要】若学习者的补充需求中有特定风格要求（如 GALGAME 风格、旅行场景等），每个关卡标题和主题都应鲜明体现该风格。

${paceRequirements}

${SCAFFOLD_WIRE_FORMAT}

现在请为章节「${selectedTopic.title}」生成真实内容。${COMPACT_JSON_OUTPUT_RULE}`,
    temperature: 0.3,
    maxOutputTokens: 2000,
    abortSignal: signal,
    maxRetries: 1,
  }, {
    phase: 'scaffold',
    baseMessage: '🏗️ 规划课程结构',
    expectedChars: EXPECTED_JSON_CHARS.scaffold,
    onProgress,
  }, pacePlan, { chapterId, chapterNum });
  // 强制校正 ID 和标题格式
  scaffold.id = chapterId;
  scaffold.title = `第${chapterNum}章：${scaffold.subtitle}`;
  scaffold.levels = scaffold.levels.map((lv, idx) => ({
    ...lv,
    id: `${chapterId}-lv${idx + 1}`,
  }));
  return scaffold;
}

// ─── Export: generate chapter recommendations ────────────────────────────────

/**
 * 根据已学习的章节，让 AI 推荐 4 个下一章节课程方向
 *
 * @param {object} aiConfig  - { provider, apiKey, modelId, baseUrl }
 * @param {object} context
 * @param {Array}  context.recentChapters  - 最近学习的章节列表（最多取后 10 个）
 * @param {object} context.lastChapter     - 最近完成的章节（用于提取语法摘要）
 * @param {object} [context.userAnswers]   - 学习者偏好（来自 learningProfile）
 * @param {AbortSignal} [context.signal]
 * @returns {Promise<Array<{title,topic,description}>>} 4 条推荐
 */
export async function generateChapterRecommendations(aiConfig, { recentChapters, lastChapter, userAnswers, signal } = {}) {
  const sig = signal ?? AbortSignal.timeout(120_000);
  const model = getModel(aiConfig);

  // 最近学习的章节摘要（最多 10 个）
  const recentList = (recentChapters ?? []).slice(-10);
  const chaptersContext = recentList.map((ch, i) =>
    `${i + 1}. 「${ch.title}·${ch.subtitle}」\n   描述：${ch.description || '（无）'}\n   关卡主题：${(ch.levels ?? []).map(lv => lv.topic).join('、')}`
  ).join('\n\n');

  // 上一章节的语法要点摘要
  const lastGrammar = lastChapter
    ? (lastChapter.grammar?.sections ?? [])
        .filter(s => s.type === 'grammar-rule')
        .map(s => `${s.title}（${s.reading}）`)
        .join('、') || '（无）'
    : '（无）';

  const userCtx = userAnswers ? buildUserContext(userAnswers) : '';
  const extraHint = userAnswers?.extra?.trim() ? `\n学习者个性化需求：${userAnswers.extra.trim()}` : '';

  const { object: raw } = await generateObjectWithDebugLog(aiConfig, {
    model,
    output: 'no-schema',
    system: `你是专业的日语互动课程顾问。根据学习者的已学内容和水平，推荐 4 个适合下一步学习的章节课程方向。${userCtx ? `\n学习者信息：\n${userCtx}` : ''}`,
    prompt: `学习者已完成以下章节（最近学习的在后）：

${chaptersContext}

最近完成的章节「${lastChapter?.subtitle || ''}」已学语法要点：${lastGrammar}${extraHint}

请推荐 4 个适合学习者下一步学习的章节方向，要求：
1. 每个方向侧重点不同（如：新语法点、会话实践、词汇拓展、特定场景等）
2. 难度自然衔接已学内容，循序渐进
3. 不重复已学习的主题
4. 若学习者有个性化需求，优先考虑其偏好

${RECOMMENDATIONS_WIRE_FORMAT}

${COMPACT_JSON_OUTPUT_RULE}`,
    temperature: 0.6,
    maxOutputTokens: 1500,
    abortSignal: sig,
    maxRetries: 1,
  }, {
    phase: 'recommendations',
    mode: 'generateObject',
  });

  const decoded = decodeRecommendationsWire(raw);
  const recs = decoded?.recommendations ?? (Array.isArray(decoded) ? decoded : []);
  return recs.slice(0, 4).map(r => ({
    title: r.title ?? r.name ?? r.chapter_name ?? '章节推荐',
    topic: r.topic ?? r.content ?? r.subject ?? '',
    description: r.description ?? r.reason ?? r.desc ?? '',
  }));
}

// ─── Main export: generate first chapter ──────────────────────────────────────

/**
 * 生成第一章节课程
 *
 * @param {object} aiConfig - { provider, apiKey, modelId, baseUrl }
 * @param {object} userAnswers - { level, pace, purpose, style, topic, extra }
 * @param {object} options
 * @param {function} options.onProgress - ({ stepIndex, stepTotal, overallProgress, message }) => void
 * @param {AbortSignal} [options.signal] - 取消信号
 * @returns {Promise<object>} 完整章节对象（符合 courses.json 结构）
 */
export async function generateFirstChapter(aiConfig, userAnswers, { onProgress, signal } = {}) {
  const sig = signal ?? AbortSignal.timeout(300_000);

  const scaffold = await generateScaffold(
    aiConfig,
    userAnswers,
    sig,
    createChapterProgressHandler(onProgress, 0)
  );
  // 统一格式：若 title 仅为「第N章」（无主题名），追加 subtitle
  if (!/[：:]/.test(scaffold.title)) {
    scaffold.title = `${scaffold.title}：${scaffold.subtitle}`;
  }

  const grammarSections = await generateGrammarSections(
    aiConfig,
    scaffold,
    userAnswers,
    sig,
    createChapterProgressHandler(onProgress, 1)
  );

  const level1Questions = await generateLevel1Questions(
    aiConfig,
    scaffold,
    grammarSections,
    userAnswers,
    sig,
    createChapterProgressHandler(onProgress, 2)
  );

  const chapter = {
    ...scaffold,
    levels: scaffold.levels.map((level, idx) => ({
      ...level,
      questions: idx === 0 ? level1Questions : [],
      locked: idx === 0 ? undefined : true,
    })),
    grammar: { sections: grammarSections },
  };

  return chapter;
}

// ─── Export: generate next (subsequent) chapter ──────────────────────────────

/**
 * 为已有课程生成下一章节（三步流水线）。
 * @param {object} aiConfig  来自 aiStore.getConfig()
 * @param {object} context   { recentChapters, lastChapter, selectedTopic, extraNote, userAnswers }
 *   selectedTopic: { title, topic, description }（来自 AI 推荐或用户自填）
 *   userAnswers:   learningProfile（{ level, pace, purpose, style, extra }）
 * @param {{ onProgress?, signal? }} options
 */
export async function generateNextChapter(aiConfig, context, { onProgress, signal } = {}) {
  const sig = signal ?? AbortSignal.timeout(300_000);
  const { recentChapters, extraNote, userAnswers } = context;

  // 新章节 ID
  const chapterId = `ch${(recentChapters?.length ?? 0) + 1}`;

  // 将已学章节上下文和用户补充需求合并进 extra 字段，传给语法 / 题目生成步骤
  const recentList = (recentChapters ?? []).slice(-10);
  const chaptersCtxStr = recentList.map(ch =>
    `「${ch.subtitle}」关卡：${(ch.levels ?? []).map(lv => lv.topic).join('、')}`
  ).join('\n');
  const enrichedExtra = [
    `已学章节参考（请勿重复这些内容）：\n${chaptersCtxStr}`,
    extraNote?.trim() ? `学习者补充需求：${extraNote.trim()}` : null,
  ].filter(Boolean).join('\n\n');

  const enrichedUserAnswers = { ...(userAnswers ?? {}), extra: enrichedExtra };

  const scaffold = await generateNextScaffold(
    aiConfig,
    context,
    chapterId,
    sig,
    createChapterProgressHandler(onProgress, 0)
  );

  const grammarSections = await generateGrammarSections(
    aiConfig,
    scaffold,
    enrichedUserAnswers,
    sig,
    createChapterProgressHandler(onProgress, 1)
  );

  const level1Questions = await generateLevel1Questions(
    aiConfig,
    scaffold,
    grammarSections,
    enrichedUserAnswers,
    sig,
    createChapterProgressHandler(onProgress, 2)
  );

  const chapter = {
    ...scaffold,
    levels: scaffold.levels.map((level, idx) => ({
      ...level,
      questions: idx === 0 ? level1Questions : [],
      locked: idx === 0 ? undefined : true,
    })),
    grammar: { sections: grammarSections },
  };

  return chapter;
}
