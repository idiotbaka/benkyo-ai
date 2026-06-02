import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const TTS_PROVIDER_PRESETS = {
  'aliyun-cosyvoice': {
    label: 'CosyVoice（阿里云百炼）',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer',
  },
};

const useTtsStore = create(
  persist(
    (set, get) => ({
      provider: 'aliyun-cosyvoice',
      baseUrl: TTS_PROVIDER_PRESETS['aliyun-cosyvoice'].baseUrl,
      modelId: 'cosyvoice-v3.5-flash',
      apiKey: '',
      voice: 'loongriko_v3',

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
      name: 'jplearn-tts-config',
    }
  )
);

export default useTtsStore;
