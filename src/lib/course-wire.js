export const WIRE_VERSION = 1;

export const COMPACT_JSON_OUTPUT_RULE =
  '输出要求：只输出一个合法 JSON 对象；不要 Markdown 或代码块；允许正常 JSON 排版空格和换行。';

export const SENTENCE_TRANSLATE_OPTIONS_RULE =
  'sentence-translate 的 answers 必须按自然中文译文的阅读顺序排列，例如「昨日、映画を見た。」为 ["昨天","看了","电影"]。options 必须按词卡数量完整包含 answers：answers 中同一个中文词语每出现一次，options 中也必须至少出现一次。重复词语不得去重。例如 answers 为 ["我","让","妹妹","叫醒了","我"] 时，options 中必须提供两个 "我" 词卡。';

export const SCAFFOLD_WIRE_FORMAT = `使用带 key 的 JSON 传输格式：
{"chapter":{"title":"...","subtitle":"...","description":"...","icon":"...","color":"#5B4FE9"},"levels":[{"title":"...","topic":"...","grammar":["..."],"icon":"..."}]}
levels 数量必须严格服从上文的教学节奏要求。id、章节序号、关卡序号、locked、gradient 由程序补全，不要输出。
grammar 数组中的每一项必须是一个可单独讲解的语法点，不要把多个语法点合并成一个字符串。新语法数量和复习组合方式必须服从上文的教学节奏要求。
chapter.title 是中文章节故事标题，不要包含语法点或知识点；chapter.subtitle 是一句中文课程知识介绍；chapter.description 是中文章节故事简介。
示例仅展示格式，真实输出的 levels 数量必须服从上文要求。
单行示例：{"chapter":{"title":"便利店初遇","subtitle":"学习基础判断句和自我介绍表达","description":"你在便利店遇到一位超可爱的店员，从打招呼开始认识彼此。","icon":"👋","color":"#5B4FE9"},"levels":[{"title":"遇见店员","topic":"初次见面时介绍自己","grammar":["〜は〜です","〜は〜ではありません"],"icon":"📖"},{"title":"交换名字","topic":"确认姓名和身份","grammar":["〜は〜です"],"icon":"🔢"}]}`;

export const QUESTIONS_WIRE_FORMAT = `使用带 key 的 JSON 传输格式：
{"wf":[{"parts":["...","___","..."],"options":["..."],"answers":["..."],"translation":"...","hint":"...","ruby":{"汉字":"假名"}}],"st":[{"sentence":"...","options":["中文词语"],"answers":["中文词语"],"translation":"...","hint":"...","ruby":{"汉字":"假名"}}],"wm":[{"pairs":[{"jp":"...","cn":"...","ruby":{"汉字":"假名"}}]}]}
wf=word-fill；st=sentence-translate；wm=word-match。id、type、prompt 由程序补全，不要输出。ruby 是汉字到假名的对象，没有注音时填 {}。
${SENTENCE_TRANSLATE_OPTIONS_RULE}
示例仅展示格式，真实输出必须包含 4 个 wf、3 个 st、2 个 wm；每个 wm 的 pairs 固定 4 对。
单行示例：{"wf":[{"parts":["私","___","田中です。"],"options":["は","が","を","に"],"answers":["は"],"translation":"我是田中。","hint":"「は」是话题助词","ruby":{"私":"わたし","田中":"たなか"}}],"st":[{"sentence":"田中さんは学生です。","options":["田中","是","学生","老师","我"],"answers":["田中","是","学生"],"translation":"田中是学生。","hint":"「です」相当于中文的「是」","ruby":{"田中":"たなか","学生":"がくせい"}}],"wm":[{"pairs":[{"jp":"私","cn":"我","ruby":{"私":"わたし"}},{"jp":"先生","cn":"老师","ruby":{"先生":"せんせい"}},{"jp":"学生","cn":"学生","ruby":{"学生":"がくせい"}},{"jp":"日本","cn":"日本","ruby":{"日本":"にほん"}}]}]}`;

export const RECOMMENDATIONS_WIRE_FORMAT = `使用带 key 的 JSON 传输格式：
{"recommendations":[{"title":"第N章：...","topic":"...","description":"..."}]}
recommendations 必须包含 4 个推荐方向。title 必须使用上文指定的下一章节编号，严格采用「第N章：中文故事标题」格式，不要在 title 中写语法点或知识点。
description 必须简洁，每条控制在 50 个字以内。
单行示例：{"recommendations":[{"title":"第2章：和妹妹上学的路上","topic":"延续家人日常场景，补充并列和递进关系的接续词","description":"承接上一章的午后对话，在上学路上自然扩展表达"},{"title":"第2章：放学后的便利店","topic":"延续日常剧情，补充因果和转折关系的相关表达","description":"维持人物和故事连续性，在新场景中巩固同类语法"},{"title":"第2章：雨天共撑一把伞","topic":"延续同行场景，根据已学进度补充尚未覆盖的接续表达","description":"在连续剧情中增加更自然的句子衔接"},{"title":"第2章：周末的新约定","topic":"若接续词已足够掌握，则自然过渡到计划和邀请表达","description":"避免重复堆叠同类语法，并保持剧情连贯"}]}`;

export const GRAMMAR_OBJECT_JSON_FORMAT = `Use this keyed JSON grammar format:
{"intro":"...","rules":[{"badge":"...","badgeColor":"#5B4FE9","title":"...","reading":"...","description":"...","pattern":[{"text":"..."},{"label":"...","color":"#5B4FE9"}],"examples":[{"parts":[{"text":"...","kana":"..."}],"translation":"...","note":"..."}],"casual":"..."}],"tips":[{"icon":"...","title":"...","content":"..."}],"vocabulary":{"title":"...","words":[{"jp":"...","kana":"...","cn":"...","pos":"..."}]}}
Required: intro is one string; rules is an array of objects; tips contains 1 or 2 objects; vocabulary.words contains at least 8 objects.
Each grammar point must have exactly one rule object and at least 2 examples. Keep intro, descriptions, and notes concise.
All text values must be JSON strings. Never use positional tuples, numeric keys, or nested sections. Omit optional casual and note fields when empty.`;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function usesWireFormat(raw, keys) {
  return isObject(raw) && (
    Number(raw.v) === WIRE_VERSION ||
    keys.some(key => Object.hasOwn(raw, key))
  );
}

function expectArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`AI 返回的紧凑 JSON 格式异常：${label} 必须是数组`);
  }
  return value;
}

function expectTuple(value, label) {
  return expectArray(value, label);
}

function optional(value) {
  return value === '' || value === null ? undefined : value;
}

function normalizeWireTag(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function getSectionType(value) {
  const tag = normalizeWireTag(value);
  if (['i', 'intro', 'introduction', '介绍', '导语'].includes(tag)) return 'intro';
  if (['g', 'grammar', 'grammar-rule', 'grammar_rule', 'rule', '语法', '语法规则'].includes(tag)) {
    return 'grammar-rule';
  }
  if (['p', 't', 'tip', 'tips', 'note', '提示', '贴士'].includes(tag)) return 'tip';
  if (['v', 'vocab', 'vocabulary', 'words', 'word-list', '词汇', '词汇表'].includes(tag)) {
    return 'vocabulary';
  }
  return null;
}

function inferSectionType(values) {
  if (values.length === 1) return 'intro';
  if (values.length >= 7 && Array.isArray(values[5]) && Array.isArray(values[6])) {
    return 'grammar-rule';
  }
  if (values.length >= 2 && Array.isArray(values[1])) return 'vocabulary';
  if (values.length >= 3) return 'tip';
  return null;
}

/**
 * Decode the compact AI wire format while preserving support for old full JSON.
 */
export function decodeScaffoldWire(raw, { chapterId = 'ch1', chapterNum = 1 } = {}) {
  if (isObject(raw?.chapter) && Array.isArray(raw.levels)) {
    return {
      id: chapterId,
      title: `第${chapterNum}章`,
      ...raw.chapter,
      levels: raw.levels.map((level, idx) => ({
        ...level,
        id: level.id ?? `${chapterId}-lv${idx + 1}`,
        number: level.number ?? idx + 1,
      })),
    };
  }
  if (!usesWireFormat(raw, ['c', 'ls'])) return raw;

  const [subtitle, description, icon, color] = expectTuple(raw.c, 'c');
  const levels = expectArray(raw.ls, 'ls').map((entry, idx) => {
    if (isObject(entry)) return entry;
    const [title, topic, grammar, levelIcon] = expectTuple(entry, `ls[${idx}]`);
    return {
      id: `${chapterId}-lv${idx + 1}`,
      number: idx + 1,
      title,
      topic,
      grammar: expectArray(grammar, `ls[${idx}][2]`),
      icon: levelIcon,
    };
  });

  return {
    id: chapterId,
    title: `第${chapterNum}章`,
    subtitle,
    description,
    icon,
    color,
    levels,
  };
}

function decodePatternItem(entry, label) {
  if (typeof entry === 'string') return { text: entry };
  if (isObject(entry)) return entry;
  const [type, value, color] = expectTuple(entry, label);
  const tag = normalizeWireTag(type);
  if (tag === 'l' || tag === 'label') return { label: value, color };
  // "t" is supported for compatibility with the initial v1 prompt.
  if (tag === 'x' || tag === 't' || tag === 'text') return { text: value };
  if (entry.length >= 3) return { label: value, color };
  if (entry.length >= 2) return { text: value };
  throw new Error(`AI 返回的紧凑 JSON 格式异常：${label} 类型 ${JSON.stringify(type)} 不支持`);
}

function decodeExamplePart(entry, label) {
  if (typeof entry === 'string') return { t: entry };
  if (isObject(entry)) return entry;
  const [text, kana] = expectTuple(entry, label);
  return { t: text, ...(optional(kana) !== undefined ? { k: optional(kana) } : {}) };
}

function decodeExample(entry, label) {
  if (isObject(entry)) return entry;
  const [parts, cn, note] = expectTuple(entry, label);
  return {
    parts: expectArray(parts, `${label}[0]`).map((part, idx) =>
      decodeExamplePart(part, `${label}[0][${idx}]`)
    ),
    cn,
    ...(optional(note) !== undefined ? { note: optional(note) } : {}),
  };
}

function isSectionTuple(value) {
  return Array.isArray(value) && getSectionType(value[0]) !== null;
}

function expandMisnestedSections(entry) {
  if (Array.isArray(entry) && entry.length > 0 && entry.every(isSectionTuple)) {
    return entry.flatMap(expandMisnestedSections);
  }

  const type = isObject(entry) ? getSectionType(entry.type) : getSectionType(entry?.[0]);
  const content = isObject(entry) ? entry.content : entry?.[1];
  if (
    type === 'intro' &&
    Array.isArray(content) &&
    content.length > 0 &&
    content.every(isSectionTuple)
  ) {
    return content.flatMap(expandMisnestedSections);
  }

  return [entry];
}

function decodeSection(entry, idx) {
  if (isObject(entry)) {
    const type = getSectionType(entry.type);
    return type ? { ...entry, type } : entry;
  }
  const [type, ...values] = expectTuple(entry, `s[${idx}]`);
  const sectionType = getSectionType(type) ?? inferSectionType(values);
  if (sectionType === 'intro') {
    return { type: 'intro', content: values[0] };
  }
  if (sectionType === 'grammar-rule') {
    const [badge, badgeColor, title, reading, description, pattern, examples, casual] = values;
    return {
      type: 'grammar-rule',
      badge,
      badgeColor,
      title,
      reading,
      description,
      pattern: expectArray(pattern, `s[${idx}][6]`).map((item, itemIdx) =>
        decodePatternItem(item, `s[${idx}][6][${itemIdx}]`)
      ),
      examples: expectArray(examples, `s[${idx}][7]`).map((example, exampleIdx) =>
        decodeExample(example, `s[${idx}][7][${exampleIdx}]`)
      ),
      ...(optional(casual) !== undefined ? { casual: optional(casual) } : {}),
    };
  }
  // "t" is supported for compatibility with the initial v1 prompt.
  if (sectionType === 'tip') {
    return { type: 'tip', icon: values[0], title: values[1], content: values[2] };
  }
  if (sectionType === 'vocabulary') {
    return {
      type: 'vocabulary',
      title: values[0],
      words: expectArray(values[1], `s[${idx}][2]`).map((word, wordIdx) => {
        if (isObject(word)) return word;
        const [jp, kana, cn, pos] = expectTuple(word, `s[${idx}][2][${wordIdx}]`);
        return { jp, kana, cn, pos };
      }),
    };
  }
  throw new Error(`AI 返回的紧凑 JSON 格式异常：s[${idx}] 类型 ${JSON.stringify(type)} 不支持`);
}

function decodeSectionEntries(entries, label = 's') {
  return expectArray(entries, label)
    .flatMap(expandMisnestedSections)
    .map(decodeSection);
}

function decodeGrammarEnvelope(raw) {
  const rules = expectArray(raw.rules, 'rules').map(rule => ['g', ...expectTuple(rule, 'rules[]')]);
  const tips = expectArray(raw.tips, 'tips').map(tip => ['p', ...expectTuple(tip, 'tips[]')]);
  const vocab = expectTuple(raw.vocab, 'vocab');
  return {
    sections: decodeSectionEntries([
      ['i', raw.intro],
      ...rules,
      ...tips,
      ['v', ...vocab],
    ]),
  };
}

function decodeGrammarObjectEnvelope(raw) {
  return {
    sections: [
      { type: 'intro', content: raw.intro },
      ...expectArray(raw.rules, 'rules').map(rule => ({
        ...rule,
        type: 'grammar-rule',
      })),
      ...expectArray(raw.tips, 'tips').map(tip => ({
        ...tip,
        type: 'tip',
      })),
      {
        ...raw.vocabulary,
        type: 'vocabulary',
      },
    ],
  };
}

export function decodeSectionsWire(raw) {
  if (isObject(raw) && Object.hasOwn(raw, 'vocabulary')) {
    return decodeGrammarObjectEnvelope(raw);
  }
  if (
    isObject(raw) &&
    ['intro', 'rules', 'tips', 'vocab'].some(key => Object.hasOwn(raw, key))
  ) {
    return decodeGrammarEnvelope(raw);
  }
  if (isObject(raw) && Array.isArray(raw.sections)) {
    return {
      ...raw,
      sections: decodeSectionEntries(raw.sections, 'sections'),
    };
  }
  if (isObject(raw) && Object.hasOwn(raw, 's')) {
    return {
      sections: decodeSectionEntries(raw.s),
    };
  }
  if (Array.isArray(raw)) return decodeSectionEntries(raw, 'sections');
  return raw;
}

export function repairGrammarSections(sections) {
  return decodeSectionEntries(sections, 'sections');
}

export function repairSentenceTranslateOptions(question) {
  if (question?.type !== 'sentence-translate') return question;

  const options = Array.isArray(question.options) ? question.options : [];
  const answers = Array.isArray(question.answers) ? question.answers : [];
  const availableCounts = new Map();

  options.forEach(option => {
    availableCounts.set(option, (availableCounts.get(option) ?? 0) + 1);
  });

  const missingOptions = [];
  answers.forEach(answer => {
    if (typeof answer !== 'string' || answer.length === 0) return;
    const availableCount = availableCounts.get(answer) ?? 0;
    if (availableCount > 0) {
      availableCounts.set(answer, availableCount - 1);
    } else {
      missingOptions.push(answer);
    }
  });

  return missingOptions.length > 0
    ? { ...question, options: [...options, ...missingOptions] }
    : question;
}

export function repairQuestions(questions) {
  return Array.isArray(questions)
    ? questions.map(repairSentenceTranslateOptions)
    : questions;
}

function decodeWordFill(entry, idx) {
  if (isObject(entry)) return { ...entry, type: 'word-fill' };
  const [parts, options, answers, translation, hint, ruby = {}] =
    expectTuple(entry, `wf[${idx}]`);
  return { type: 'word-fill', parts, options, answers, translation, hint, ruby };
}

function decodeSentenceTranslate(entry, idx) {
  if (isObject(entry)) return { ...entry, type: 'sentence-translate' };
  const [sentence, options, answers, translation, hint, ruby = {}] =
    expectTuple(entry, `st[${idx}]`);
  return { type: 'sentence-translate', sentence, options, answers, translation, hint, ruby };
}

function decodeWordMatch(entry, idx) {
  if (isObject(entry)) {
    return {
      ...entry,
      type: 'word-match',
      pairs: expectArray(entry.pairs, `wm[${idx}].pairs`),
    };
  }
  return {
    type: 'word-match',
    pairs: expectArray(entry, `wm[${idx}]`).map((pair, pairIdx) => {
      if (isObject(pair)) return pair;
      const [jp, cn, ruby = {}] = expectTuple(pair, `wm[${idx}][${pairIdx}]`);
      return { jp, cn, ruby };
    }),
  };
}

export function decodeQuestionsWire(raw) {
  if (!usesWireFormat(raw, ['wf', 'st', 'wm'])) return raw;
  return {
    questions: [
      ...expectArray(raw.wf ?? [], 'wf').map(decodeWordFill),
      ...expectArray(raw.st ?? [], 'st').map(decodeSentenceTranslate),
      ...expectArray(raw.wm ?? [], 'wm').map(decodeWordMatch),
    ],
  };
}

export function decodeRecommendationsWire(raw) {
  if (isObject(raw) && Array.isArray(raw.recommendations)) return raw;
  if (!usesWireFormat(raw, ['r'])) return raw;
  return {
    recommendations: expectArray(raw.r, 'r').map((entry, idx) => {
      if (isObject(entry)) return entry;
      const [title, topic, description] = expectTuple(entry, `r[${idx}]`);
      return { title, topic, description };
    }),
  };
}
