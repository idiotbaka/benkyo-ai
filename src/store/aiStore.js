import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const THINKING_DEPTHS = new Set(['deep', 'standard', 'fast']);
const REQUEST_MODES = new Set(['stream', 'object']);

// Default base URLs for providers that have built-in presets
export const PROVIDER_PRESETS = {
  openai:            { label: 'OpenAI',          baseUrl: 'https://api.openai.com/v1',                                   requiresBaseUrl: false },
  anthropic:         { label: 'Anthropic',        baseUrl: 'https://api.anthropic.com',                                   requiresBaseUrl: false },
  google:            { label: 'Google Gemini',    baseUrl: '',                                                             requiresBaseUrl: false },
  deepseek:          { label: 'DeepSeek',         baseUrl: 'https://api.deepseek.com',                                    requiresBaseUrl: false },
  'aliyun-bailian':  { label: '阿里云百炼 / Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',          requiresBaseUrl: false },
  moonshot:          { label: '月之暗面 Kimi',     baseUrl: 'https://api.moonshot.cn/v1',                                  requiresBaseUrl: false },
  zhipu:             { label: '智谱 GLM',          baseUrl: 'https://open.bigmodel.cn/api/paas/v4',                       requiresBaseUrl: false },
  volcengine:        { label: '火山引擎 / 豆包',   baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',                   requiresBaseUrl: false },
  'baidu-qianfan':   { label: '百度千帆 / 文心',   baseUrl: 'https://qianfan.baidubce.com/v2',                            requiresBaseUrl: false },
  'tencent-hunyuan': { label: '腾讯混元',          baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',                   requiresBaseUrl: false },
  minimax:           { label: 'MiniMax',           baseUrl: 'https://api.minimaxi.com/v1',                                requiresBaseUrl: false },
  'openai-compatible': { label: '自定义兼容端点',  baseUrl: '',                                                            requiresBaseUrl: true  },
};

const useAiStore = create(
  persist(
    (set, get) => ({
      provider: 'openai',
      apiKey: '',
      modelId: '',
      baseUrl: '',
      thinkingDepth: 'deep',
      requestMode: 'stream',

      setConfig({ provider, apiKey, modelId, baseUrl, requestMode }) {
        set({
          provider,
          apiKey,
          modelId,
          baseUrl,
          ...(REQUEST_MODES.has(requestMode) ? { requestMode } : {}),
        });
      },

      setThinkingDepth(depth) {
        if (THINKING_DEPTHS.has(depth)) {
          set({ thinkingDepth: depth });
        }
      },

      setRequestMode(mode) {
        if (REQUEST_MODES.has(mode)) {
          set({ requestMode: mode });
        }
      },

      getConfig() {
        const { provider, apiKey, modelId, baseUrl, thinkingDepth, requestMode } = get();
        return {
          provider,
          apiKey,
          modelId,
          baseUrl,
          thinkingDepth,
          requestMode: REQUEST_MODES.has(requestMode) ? requestMode : 'stream',
        };
      },
    }),
    {
      name: 'benkyo-ai-ai-config',
    }
  )
);

export default useAiStore;
