import { z } from 'zod';

// ─── Question Types ────────────────────────────────────────────────────────────

export const WordFillQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('word-fill'),
  prompt: z.string().describe('题目说明，如"选出正确的词语，完成句子"'),
  parts: z.array(z.string()).describe('句子片段，用 "___" 标记空格，如 ["私", "___", "田中です。"]'),
  options: z.array(z.string()).describe('选项列表，共 4 个'),
  answers: z.array(z.string()).describe('正确答案，通常 1 个'),
  translation: z.string().describe('整句中文翻译'),
  hint: z.string().describe('语法提示说明'),
  ruby: z.record(z.string()).describe('汉字→假名映射，如 {"私":"わたし"}；不需要注音时传空对象 {}'),
});

export const SentenceTranslateQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('sentence-translate'),
  prompt: z.string().describe('题目说明，如"将句子翻译成中文"'),
  sentence: z.string().describe('需要翻译的日语句子'),
  options: z.array(z.string()).describe('可选词语列表（含干扰项），5~6 个中文词'),
  answers: z.array(z.string()).describe('按顺序排列的正确答案词语'),
  translation: z.string().describe('正确的中文翻译'),
  hint: z.string().describe('语法或词汇提示'),
  ruby: z.record(z.string()).describe('汉字→假名映射，不需要注音时传 {}'),
});

export const WordMatchQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('word-match'),
  prompt: z.string().describe('题目说明，如"点击配对，消消看！"'),
  pairs: z.array(z.object({
    jp: z.string().describe('日语词语'),
    cn: z.string().describe('中文释义'),
    ruby: z.record(z.string()).describe('该词条汉字→假名映射，如 {"先生":"せんせい"}'),
  })).min(4).max(4).describe('配对数据，固定 4 对'),
});

export const QuestionSchema = z.discriminatedUnion('type', [
  WordFillQuestionSchema,
  SentenceTranslateQuestionSchema,
  WordMatchQuestionSchema,
]);

// ─── Grammar Section Types ────────────────────────────────────────────────────

const PatternItemSchema = z.object({
  label: z.string().optional().describe('成分标签，如"话题"、"谓语"；与 color 配合使用'),
  color: z.string().optional().describe('标签背景色 hex，有 label 时必填'),
  text: z.string().optional().describe('语法词原文，如"は"、"です"；纯文本时只填此字段'),
}).describe('句型图示元素：成分标签用 {label,color}，语法词用 {text}');

const ExampleSchema = z.object({
  parts: z.array(z.object({
    t: z.string().describe('词语文字'),
    k: z.string().optional().describe('假名注音，有汉字时必填'),
  })).describe('例句按词拆分的数组'),
  cn: z.string().describe('例句中文翻译'),
  note: z.string().optional().describe('备注，如"口语形式"'),
});

const IntroSectionSchema = z.object({
  type: z.literal('intro'),
  content: z.string().describe('章节学习目标和内容概述，2~3 句话'),
});

const GrammarRuleSectionSchema = z.object({
  type: z.literal('grammar-rule'),
  badge: z.string().describe('句型标签，如"肯定句"、"否定句"'),
  badgeColor: z.string().describe('标签颜色 hex，如 "#5B4FE9"'),
  title: z.string().describe('句型名称，如"〜は〜です"'),
  reading: z.string().describe('罗马字读法，如"〜 wa 〜 desu"'),
  description: z.string().describe('句型用法说明，2~4 句'),
  pattern: z.array(PatternItemSchema).describe('句型结构图示元素数组，3~5 个元素'),
  casual: z.string().optional().describe('口语简化形式，有则填，如"口语简化：〜じゃありません"'),
  examples: z.array(ExampleSchema).min(2).max(3).describe('例句列表，2~3 个'),
});

const TipSectionSchema = z.object({
  type: z.literal('tip'),
  icon: z.string().describe('emoji 图标，如"💡"、"⚠️"'),
  title: z.string().describe('贴士标题'),
  content: z.string().describe('贴士正文，1~3 句话'),
});

const VocabularySectionSchema = z.object({
  type: z.literal('vocabulary'),
  title: z.string().describe('词汇表标题，如"本章核心单词"'),
  words: z.array(z.object({
    jp: z.string().describe('日语词形（汉字或假名）'),
    kana: z.string().describe('假名读法'),
    cn: z.string().describe('中文释义'),
    pos: z.string().describe('词性，如"名词"、"代词"、"动词"'),
  })).min(8).describe('核心词汇，8 个以上'),
});

export const GrammarSectionSchema = z.discriminatedUnion('type', [
  IntroSectionSchema,
  GrammarRuleSectionSchema,
  TipSectionSchema,
  VocabularySectionSchema,
]);

// ─── Chapter Scaffold (structure only, no questions) ──────────────────────────

export const ChapterScaffoldSchema = z.object({
  id: z.string().describe('章节 id，固定为 "ch1"'),
  title: z.string().describe('章节标题，如"第一章"'),
  subtitle: z.string().describe('章节副标题，概括主题，如"基础自我介绍"'),
  description: z.string().describe('章节学习目标简介，1~2 句话'),
  icon: z.string().describe('代表性 emoji'),
  color: z.string().describe('主题色 hex，选择鲜明但不刺眼的颜色'),
  gradient: z.tuple([z.string(), z.string()]).describe('渐变色数组 [浅色 hex, 深色 hex]'),
  levels: z.array(z.object({
    id: z.string().describe('关卡 id，格式 "ch1-lv1" 至 "ch1-lv8"'),
    number: z.number().int().describe('关卡序号，从 1 开始'),
    title: z.string().describe('关卡标题，如"第一关"'),
    topic: z.string().describe('本关语法或词汇主题，简短描述'),
    grammar: z.array(z.string()).describe('本关涉及的句型或语法点列表'),
    icon: z.string().describe('emoji 图标'),
    locked: z.boolean().optional().describe('第一关不填此字段；其余关卡填 true'),
  })).min(4).max(8).describe('关卡列表，按学习节奏生成 4~8 个，难度循序渐进'),
});

// ─── Wrapped result schemas for generateObject ────────────────────────────────

export const GrammarResultSchema = z.object({
  sections: z.array(GrammarSectionSchema).describe(
    'section 顺序：intro(1个) → grammar-rule(每个语法点1个) → tip(穿插1~2个) → vocabulary(末尾1个)'
  ),
});

export const QuestionsResultSchema = z.object({
  questions: z.array(QuestionSchema).min(8).max(10).describe(
    '题目列表，8~10 道，类型混合：word-fill 约4道、sentence-translate 约3道、word-match 约2道'
  ),
});
