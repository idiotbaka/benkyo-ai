import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const COMPATIBLE_PROVIDER_PRESETS = {
  'deepseek':          { name: 'deepseek',          baseURL: 'https://api.deepseek.com' },
  'aliyun-bailian':    { name: 'aliyun-bailian',    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  'moonshot':          { name: 'moonshot',           baseURL: 'https://api.moonshot.cn/v1' },
  'zhipu':             { name: 'zhipu',              baseURL: 'https://open.bigmodel.cn/api/paas/v4' },
  'volcengine':        { name: 'volcengine',         baseURL: 'https://ark.cn-beijing.volces.com/api/v3' },
  'baidu-qianfan':     { name: 'baidu-qianfan',     baseURL: 'https://qianfan.baidubce.com/v2' },
  'tencent-hunyuan':   { name: 'tencent-hunyuan',   baseURL: 'https://api.hunyuan.cloud.tencent.com/v1' },
  'minimax':           { name: 'minimax',            baseURL: 'https://api.minimaxi.com/v1' },
};

/**
 * 根据配置创建 AI 提供商实例
 * @param {{ provider: string, apiKey: string, modelId: string, baseUrl?: string }} config
 */
export function createProvider(config) {
  switch (config.provider) {
    case 'openai':
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
      });

    case 'anthropic':
      return createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
      });

    case 'google':
      return createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
      });

    case 'deepseek':
    case 'aliyun-bailian':
    case 'moonshot':
    case 'zhipu':
    case 'volcengine':
    case 'baidu-qianfan':
    case 'tencent-hunyuan':
    case 'minimax': {
      const preset = COMPATIBLE_PROVIDER_PRESETS[config.provider];
      return createOpenAICompatible({
        name: preset.name,
        apiKey: config.apiKey,
        baseURL: config.baseUrl || preset.baseURL,
      });
    }

    case 'openai-compatible':
      return createOpenAICompatible({
        name: 'openai-compatible',
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });

    default:
      throw new Error(`不支持的提供商: ${config.provider}`);
  }
}

/**
 * 从配置直接获取可用的模型实例
 */
export function getModel(config) {
  const provider = createProvider(config);
  return provider(config.modelId);
}

// ─── Thinking depth options ────────────────────────────────────────────────────

// 各深度对应的思考 token 预算（仅对支持预算控制的模型生效）
const THINKING_BUDGETS = {
  deep:     { anthropic: 10000, google: 8192 },
  standard: { anthropic: 4000,  google: 3000 },
  // Anthropic extended thinking requires at least 1,024 tokens.
  fast:     { anthropic: 1024,  google: 512  },
};

// 各深度对应的最大 token 缩减系数（对所有模型生效，减少输出长度来提速）
const MAX_TOKENS_MULTIPLIERS = { deep: 1.0, standard: 0.9, fast: 0.7 };

const REASONING_EFFORTS = { deep: 'high', standard: 'medium', fast: 'low' };
const GOOGLE_THINKING_LEVELS = { deep: 'high', standard: 'medium', fast: 'low' };

function isOpenAIReasoningModel(modelId) {
  const id = (modelId || '').toLowerCase();
  return id.startsWith('o1') ||
    id.startsWith('o3') ||
    id.startsWith('o4-mini') ||
    (id.startsWith('gpt-5') && !id.startsWith('gpt-5-chat'));
}

function getAnthropicThinkingType(modelId) {
  const id = (modelId || '').toLowerCase();
  if (/claude-(?:sonnet|opus)-4-[6-9](?:-|$)/.test(id)) return 'adaptive';
  if (
    id.includes('claude-3-7') ||
    id.includes('claude-3.7') ||
    /claude-(?:sonnet|opus|haiku)-4(?:-|$)/.test(id)
  ) {
    return 'budget';
  }
  return null;
}

function getGoogleThinkingConfig(modelId, depth, budget) {
  const id = (modelId || '').toLowerCase();
  if (/^gemini-3(?:[.-]|$)/.test(id)) {
    // Gemini 3 Pro only supports low/high. Gemini 3.1 Pro and Flash models
    // support the medium level used by the standard preset.
    const standardLevel = /^gemini-3-pro(?:-|$)/.test(id) ? 'low' : GOOGLE_THINKING_LEVELS.standard;
    return {
      thinkingLevel: depth === 'standard' ? standardLevel : GOOGLE_THINKING_LEVELS[depth],
    };
  }
  if (id.includes('thinking') || id.includes('2.5') || id.includes('gemini-2-5')) {
    return { thinkingBudget: budget };
  }
  return null;
}

/**
 * 根据 AI 配置和思考深度，返回 generateObject 调用时的额外选项覆盖
 *
 * @param {{ provider: string, modelId: string }} aiConfig
 * @param {'deep'|'standard'|'fast'} thinkingDepth
 * @returns {{ maxTokensMultiplier: number, providerOptions?: object }}
 */
export function buildThinkingOptions(aiConfig, thinkingDepth = 'deep') {
  const { provider, modelId } = aiConfig;
  const depth = Object.hasOwn(MAX_TOKENS_MULTIPLIERS, thinkingDepth) ? thinkingDepth : 'deep';
  const multiplier = MAX_TOKENS_MULTIPLIERS[depth] ?? 1.0;
  const budget = THINKING_BUDGETS[depth] ?? THINKING_BUDGETS.deep;
  const effort = REASONING_EFFORTS[depth];

  if (provider === 'openai' && isOpenAIReasoningModel(modelId)) {
    return {
      maxTokensMultiplier: multiplier,
      providerOptions: {
        openai: { reasoningEffort: effort },
      },
    };
  }

  if (provider === 'anthropic') {
    const thinkingType = getAnthropicThinkingType(modelId);
    if (thinkingType === 'adaptive') {
      return {
        maxTokensMultiplier: multiplier,
        providerOptions: {
          anthropic: {
            thinking: { type: 'adaptive' },
            effort,
          },
        },
      };
    }
    if (thinkingType !== 'budget') return { maxTokensMultiplier: multiplier };
    return {
      maxTokensMultiplier: multiplier,
      providerOptions: {
        anthropic: { thinking: { type: 'enabled', budgetTokens: budget.anthropic } },
      },
    };
  }

  if (provider === 'google') {
    const thinkingConfig = getGoogleThinkingConfig(modelId, depth, budget.google);
    if (!thinkingConfig) return { maxTokensMultiplier: multiplier };
    return {
      maxTokensMultiplier: multiplier,
      providerOptions: {
        google: { thinkingConfig },
      },
    };
  }

  return { maxTokensMultiplier: multiplier };
}
