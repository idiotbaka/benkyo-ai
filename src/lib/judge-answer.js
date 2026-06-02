import { generateText } from 'ai';
import { getModel } from './ai-providers';
import { getAiErrorContent, logAiGeneratedContent } from './ai-debug.js';

/**
 * 让 AI 裁定 sentence-translate 题目中用户的回答是否也是正确的翻译。
 *
 * @param {{ provider: string, apiKey: string, modelId: string, baseUrl?: string }} aiConfig
 * @param {{ sentence: string, answers: string[], translation: string }} question
 * @param {string[]} userAnswer - 用户选择的词语数组
 * @returns {Promise<{ correct: boolean, reason: string }>}
 */
export async function judgeAnswer(aiConfig, question, userAnswer) {
  const model = getModel(aiConfig);
  const expected = question.answers.join('');
  const userStr = Array.isArray(userAnswer) ? userAnswer.join('') : String(userAnswer);

  const prompt = `你是一位专业的日语教学评分专家。请判断以下翻译题中，学生的回答是否也是正确的翻译。

日语原句：${question.sentence}
参考标准答案：${expected}
学生的回答：${userStr}

判断标准：
- 允许合理的语序调整（中文语序灵活）
- 允许同义词或近义词替换（前提是含义准确）
- 如果学生回答语义正确但表达有细微差异，也应判定为正确

注意：reason 字段中如需引用词语，请使用「」书名号，不要使用英文双引号，以免 JSON 格式错误。

请仅输出 JSON，格式如下（不要输出任何其他文字）：
{"correct": true, "reason": ""}
或
{"correct": false, "reason": "错误原因，50字以内"}`;

  let text = '';
  try {
    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 150,
    });
    text = result.text;
    logAiGeneratedContent({
      phase: 'judge-answer',
      mode: 'generateText',
      status: 'success',
      content: text,
    });
  } catch (error) {
    logAiGeneratedContent({
      phase: 'judge-answer',
      mode: 'generateText',
      status: 'failure',
      content: getAiErrorContent(error, text),
      error,
    });
    throw error;
  }

  const parsed = robustParseJudgeResult(text);
  if (!parsed) throw new Error('AI 返回格式异常，无法解析结果');

  return {
    correct: Boolean(parsed.correct),
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
  };
}

/**
 * 尝试从 AI 返回文本中解析 { correct, reason }。
 * 先用标准 JSON.parse，失败时手动提取字段（容忍 reason 中的未转义引号）。
 */
function robustParseJudgeResult(text) {
  // Greedy match: grab the outermost { ... } block
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const raw = match[0];

  // 1. Try standard parse first
  try {
    return JSON.parse(raw);
  } catch {
    // fall through to manual extraction
  }

  // 2. Extract `correct` field
  const correctMatch = raw.match(/"correct"\s*:\s*(true|false)/);
  if (!correctMatch) return null;
  const correct = correctMatch[1] === 'true';

  // 3. Extract `reason` field — take everything between the opening quote after
  //    `"reason":` and the LAST `"` in the substring (= closing quote of the value).
  let reason = '';
  const reasonIdx = raw.indexOf('"reason"');
  if (reasonIdx !== -1) {
    const afterKey   = raw.slice(reasonIdx);
    const colonIdx   = afterKey.indexOf(':');
    const openQuote  = afterKey.indexOf('"', colonIdx + 1);
    if (openQuote !== -1) {
      const content    = afterKey.slice(openQuote + 1);
      const closeQuote = content.lastIndexOf('"');
      reason = closeQuote !== -1 ? content.slice(0, closeQuote) : content;
    }
  }

  return { correct, reason };
}

