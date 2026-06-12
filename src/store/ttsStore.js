import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const TTS_PROVIDER_PRESETS = {
  'openai-tts': {
    label: 'OpenAI TTS',
    baseUrl: 'https://api.openai.com/v1/audio/speech',
    modelId: 'gpt-4o-mini-tts',
    voice: 'marin',
  },
  'aliyun-cosyvoice': {
    label: 'CosyVoice（阿里云百炼）',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer',
    modelId: 'cosyvoice-v3-flash',
    voice: 'loongriko_v3',
  },
  'aliyun-qwen-tts': {
    label: 'Qwen-TTS（阿里云百炼）',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    modelId: 'qwen3-tts-flash',
    voice: 'Cherry',
  },
  'aliyun-minimax-tts': {
    label: 'MiniMax（阿里云百炼）',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    modelId: 'MiniMax/speech-2.8-hd',
    voice: 'Korean_ShyGirl',
  },
  'minimax-official-tts': {
    label: 'MiniMax（官方API）',
    baseUrl: 'https://api.minimaxi.com/v1/t2a_v2',
    modelId: 'speech-2.8-hd',
    voice: 'Korean_ShyGirl',
  },
  'volcengine-doubao-tts': {
    label: '豆包语音（火山引擎）',
    baseUrl: 'https://openspeech.bytedance.com/api/v3/tts/unidirectional',
    modelId: 'seed-tts-1.0',
    voice: 'multi_female_maomao_conversation_wvae_bigtts',
  },
};

const useTtsStore = create(
  persist(
    (set, get) => ({
      provider: 'aliyun-cosyvoice',
      baseUrl: TTS_PROVIDER_PRESETS['aliyun-cosyvoice'].baseUrl,
      modelId: TTS_PROVIDER_PRESETS['aliyun-cosyvoice'].modelId,
      apiKey: '',
      voice: TTS_PROVIDER_PRESETS['aliyun-cosyvoice'].voice,

      // Runtime defaults tuned for compatibility and latency:
      // mp3: most device-compatible codec, 24kHz for clear speech at low payload.
      format: 'mp3',
      sampleRate: 24000,
      rate: 1.0,
      bitRate: 64,

      setConfig({ provider, baseUrl, modelId, apiKey, voice }) {
        set({ provider, baseUrl, modelId, apiKey, voice });
      },

      getConfig() {
        const {
          provider,
          baseUrl,
          modelId,
          apiKey,
          voice,
          format,
          sampleRate,
          rate,
          bitRate,
        } = get();

        return {
          provider,
          baseUrl,
          modelId,
          apiKey,
          voice,
          format,
          sampleRate,
          rate,
          bitRate,
        };
      },
    }),
    {
      name: 'benkyo-ai-tts-config',
    }
  )
);

export default useTtsStore;
