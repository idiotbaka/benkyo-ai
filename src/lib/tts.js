import { invoke } from '@tauri-apps/api/core';

const CACHE_DB_NAME = 'benkyo-ai-tts-cache';
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = 'speech-audio';
const CACHE_KEY_VERSION = 1;
const MAX_CACHE_ENTRIES = 300;
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Returns a stable cache key for one synthesized result.
 * Keep every field that can change the generated audio in this profile.
 */
export function getTtsCacheKey(text, config) {
  const normalizedText = normalizeSpeechText(text);
  const profile = normalizeConfig(config);

  return JSON.stringify({
    version: CACHE_KEY_VERSION,
    text: normalizedText,
    provider: profile.provider,
    baseUrl: profile.baseUrl,
    modelId: profile.modelId,
    voice: profile.voice,
    format: profile.format,
    sampleRate: profile.sampleRate,
    rate: profile.rate,
    bitRate: profile.bitRate,
  });
}

export function getTtsConfigError(config) {
  const profile = normalizeConfig(config);

  if (!profile.baseUrl) return '请先在设置中填写语音模型 Base URL';
  if (!profile.apiKey) return '请先在设置中填写语音模型 API 密钥';
  if (!profile.modelId) return '请先在设置中填写语音模型 ID';
  if (!profile.voice) return '请先在设置中填写语音模型音色';
  return '';
}

/**
 * Gets an audio blob from the local cache, or synthesizes and caches it.
 * IndexedDB is used because localStorage is not suitable for binary audio.
 */
export async function getJapaneseSpeechAudio(text, config, { signal } = {}) {
  const normalizedText = normalizeSpeechText(text);
  const cacheKey = getTtsCacheKey(normalizedText, config);
  const cachedAudio = await readCachedAudio(cacheKey);

  if (cachedAudio) return cachedAudio;

  const audioBlob = await requestTtsAudioBlob(normalizedText, config, { signal });
  await writeCachedAudio(cacheKey, audioBlob);
  return audioBlob;
}

/**
 * Calls the provider without touching the local cache.
 * Exported so the Settings page can test draft values before saving them.
 */
export async function requestTtsAudioBlob(text, config, { signal } = {}) {
  const normalizedText = normalizeSpeechText(text);
  const profile = normalizeConfig(config);
  const configError = getTtsConfigError(profile);

  if (!normalizedText) throw new Error('播放文本不能为空');
  if (configError) throw new Error(configError);
  if (!isSupportedTtsProvider(profile.provider)) {
    throw new Error(`暂不支持语音提供商：${profile.provider}`);
  }

  const requestSignal = createTimeoutSignal(signal);

  try {
    if (profile.provider === 'volcengine-doubao-tts') {
      const audioBlob = await requestVolcengineTtsBlob(profile, normalizedText, requestSignal.signal);
      if (!audioBlob) throw new Error('未解析到可播放的音频数据');
      return audioBlob;
    }

    const res = await fetch(profile.baseUrl, {
      method: 'POST',
      headers: createTtsRequestHeaders(profile),
      body: JSON.stringify(createTtsRequestBody(profile, normalizedText)),
      signal: requestSignal.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      const providerError = getTtsResponseErrorMessage(parseJson(errText));
      throw new Error(providerError || `HTTP ${res.status}: ${errText.slice(0, 120)}`);
    }

    const audioBlob = await extractTtsAudioBlob(res, requestSignal.signal);
    if (!audioBlob) throw new Error('未解析到可播放的音频数据');
    return audioBlob;
  } finally {
    requestSignal.cleanup();
  }
}

async function requestVolcengineTtsBlob(profile, text, signal) {
  if (signal.aborted) throw createAbortError();
  if (!globalThis.__TAURI_INTERNALS__) {
    throw new Error('豆包语音需要在 Tauri 客户端中使用，请通过 npm run tauri:dev 测试');
  }

  const responseText = await invoke('proxy_volcengine_tts', {
    endpoint: profile.baseUrl,
    apiKey: profile.apiKey,
    resourceId: profile.modelId,
    body: createTtsRequestBody(profile, text),
  });

  if (signal.aborted) throw createAbortError();

  const data = parseTtsJsonPayload(responseText);
  if (!data) throw new Error('火山语音响应不是有效 JSON');
  return extractTtsAudioBlobFromData(data);
}

function isSupportedTtsProvider(provider) {
  return (
    provider === 'aliyun-cosyvoice' ||
    provider === 'aliyun-qwen-tts' ||
    provider === 'aliyun-minimax-tts' ||
    provider === 'minimax-official-tts' ||
    provider === 'volcengine-doubao-tts' ||
    provider === 'openai-tts'
  );
}

function createTtsRequestHeaders(profile) {
  if (profile.provider === 'volcengine-doubao-tts') {
    return {
      'Content-Type': 'application/json',
      'X-Api-Key': normalizeBearerToken(profile.apiKey),
      'X-Api-Resource-Id': profile.modelId,
    };
  }

  return {
    Authorization: `Bearer ${normalizeBearerToken(profile.apiKey)}`,
    'Content-Type': 'application/json',
  };
}

function createTtsRequestBody(profile, text) {
  if (profile.provider === 'openai-tts') {
    return {
      model: profile.modelId,
      input: text,
      voice: profile.voice,
      response_format: profile.format,
      instructions: 'Speak in clear, natural Japanese with friendly lesson pacing.',
    };
  }

  if (profile.provider === 'aliyun-qwen-tts') {
    return {
      model: profile.modelId,
      input: {
        text,
        voice: profile.voice,
        language_type: 'Japanese',
      },
    };
  }

  if (profile.provider === 'aliyun-minimax-tts') {
    return {
      model: profile.modelId,
      input: {
        text,
        voice_setting: {
          voice_id: profile.voice,
          language_boost: 'Japanese',
        },
        audio_setting: {
          format: 'mp3',
        },
      },
    };
  }

  if (profile.provider === 'minimax-official-tts') {
    return {
      model: profile.modelId,
      text,
      stream: false,
      voice_setting: {
        voice_id: profile.voice,
        language_boost: 'Japanese',
      },
      audio_setting: {
        format: 'mp3',
      },
    };
  }

  if (profile.provider === 'volcengine-doubao-tts') {
    return {
      req_params: {
        text,
        speaker: profile.voice,
        audio_params: {
          format: 'mp3',
          sample_rate: profile.sampleRate,
          bit_rate: normalizeBitRateBps(profile.bitRate),
        },
        additions: JSON.stringify({
          explicit_language: 'ja',
        }),
      },
    };
  }

  return {
    model: profile.modelId,
    input: {
      text,
      voice: profile.voice,
      format: profile.format,
      sample_rate: profile.sampleRate,
      rate: profile.rate,
      bit_rate: profile.bitRate,
    },
  };
}

function normalizeText(text) {
  return typeof text === 'string' ? text.trim() : '';
}

function normalizeBearerToken(apiKey) {
  return normalizeText(apiKey).replace(/^bearer\s+/i, '');
}

function normalizeBitRateBps(bitRate) {
  const numericBitRate = Number(bitRate);
  if (!Number.isFinite(numericBitRate) || numericBitRate <= 0) return 64000;
  return numericBitRate < 1000 ? numericBitRate * 1000 : numericBitRate;
}

function normalizeSpeechText(text) {
  const normalized = normalizeText(text);
  if (!normalized || hasSentenceEndingPunctuation(normalized)) return normalized;
  return `${normalized}。`;
}

function hasSentenceEndingPunctuation(text) {
  const textWithoutClosingMarks = text.replace(/[）)】\]」』》〉〕〗〙〛｝}"'”’]+$/u, '');
  return /[。.!！?？…]+$/u.test(textWithoutClosingMarks);
}

function normalizeConfig(config = {}) {
  return {
    provider: config.provider?.trim() || '',
    baseUrl: config.baseUrl?.trim() || '',
    modelId: config.modelId?.trim() || '',
    apiKey: config.apiKey?.trim() || '',
    voice: config.voice?.trim() || '',
    format: config.format || 'mp3',
    sampleRate: config.sampleRate ?? 24000,
    rate: config.rate ?? 1.0,
    bitRate: config.bitRate ?? 64,
  };
}

function createTimeoutSignal(signal, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('TTS 请求超时')), timeoutMs);
  const handleAbort = () => controller.abort(signal.reason);

  if (signal) {
    if (signal.aborted) {
      handleAbort();
    } else {
      signal.addEventListener('abort', handleAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', handleAbort);
    },
  };
}

async function extractTtsAudioBlob(res, signal) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('audio/')) return await res.blob();

  const data = await res.json();
  const inlineAudioBlob = extractTtsAudioBlobFromData(data);
  if (inlineAudioBlob) return inlineAudioBlob;

  const outputAudio = data?.output?.audio;
  const audioUrl =
    outputAudio?.url ||
    data?.output?.audio_url ||
    data?.audio_url ||
    data?.data?.audio_url ||
    data?.output?.url ||
    (typeof outputAudio === 'string' && /^https?:\/\//.test(outputAudio) ? outputAudio : '');

  if (audioUrl) {
    const secureAudioUrl = audioUrl.replace(/^http:\/\//, 'https://');
    const audioRes = await fetch(secureAudioUrl, { signal });
    if (!audioRes.ok) throw new Error(`音频下载失败：HTTP ${audioRes.status}`);
    return await audioRes.blob();
  }

  return null;
}

function extractTtsAudioBlobFromData(data) {
  const providerError = getTtsResponseErrorMessage(data);
  if (providerError) throw new Error(providerError);

  const outputAudio = data?.output?.audio;
  const hexAudio = data?.output?.data?.audio || data?.data?.audio;
  if (isHexString(hexAudio)) {
    return hexToBlob(hexAudio, 'audio/mpeg');
  }

  const base64Audio =
    outputAudio?.data ||
    (typeof outputAudio === 'string' ? outputAudio : '') ||
    data?.audio ||
    data?.data?.audio ||
    (typeof data?.data === 'string' ? data.data : '');

  if (Array.isArray(data?.data_chunks) && data.data_chunks.length > 0) {
    return base64ChunksToBlob(data.data_chunks, 'audio/mpeg');
  }

  if (typeof base64Audio === 'string' && base64Audio.length > 0) {
    return base64ToBlob(base64Audio, 'audio/mpeg');
  }

  return null;
}

function createAbortError() {
  return new DOMException('TTS 请求已取消', 'AbortError');
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseTtsJsonPayload(payload) {
  if (payload && typeof payload === 'object') return payload;

  let parsed = payload;
  for (let i = 0; i < 2 && typeof parsed === 'string'; i += 1) {
    parsed = parseJson(parsed);
  }

  return parsed && typeof parsed === 'object' ? parsed : null;
}

function getTtsResponseErrorMessage(data) {
  if (data?.code !== undefined) {
    const numericCode = Number(data.code);
    if (numericCode === 0) return '';

    const message = normalizeText(data.message);
    if (message) return `TTS 服务错误 ${data.code}: ${message}`;
    return `TTS 服务错误 ${data.code}`;
  }

  const baseResp = data?.base_resp || data?.output?.base_resp;
  const statusCode = baseResp?.status_code;
  const statusMsg = normalizeText(baseResp?.status_msg);

  if (statusCode === undefined && !statusMsg) return '';

  const numericStatus = Number(statusCode);
  const isSuccess = !Number.isNaN(numericStatus) && numericStatus === 0;
  if (isSuccess) return '';

  if (statusMsg && statusCode !== undefined) return `TTS 服务错误 ${statusCode}: ${statusMsg}`;
  return statusMsg || `TTS 服务错误 ${statusCode}`;
}

function isHexString(value) {
  return typeof value === 'string' && value.length > 0 && value.length % 2 === 0 && /^[\da-f]+$/i.test(value);
}

function hexToBlob(hex, mimeType) {
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return new Blob([bytes], { type: mimeType });
}

function base64ToBlob(base64, mimeType) {
  const normalized = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

function base64ChunksToBlob(chunks, mimeType) {
  const byteArrays = chunks
    .filter(chunk => typeof chunk === 'string' && chunk.length > 0)
    .map(chunk => base64ToBytes(chunk));

  return new Blob(byteArrays, { type: mimeType });
}

function base64ToBytes(base64) {
  const normalized = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

let cacheDbPromise = null;

function getCacheDb() {
  if (!('indexedDB' in globalThis)) return Promise.resolve(null);
  if (cacheDbPromise) return cacheDbPromise;

  cacheDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        const store = db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'cacheKey' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(() => null);

  return cacheDbPromise;
}

async function readCachedAudio(cacheKey) {
  const db = await getCacheDb();
  if (!db) return null;

  try {
    const record = await runRequest(db.transaction(CACHE_STORE_NAME).objectStore(CACHE_STORE_NAME).get(cacheKey));
    return record?.audioBlob instanceof Blob ? record.audioBlob : null;
  } catch {
    return null;
  }
}

async function writeCachedAudio(cacheKey, audioBlob) {
  const db = await getCacheDb();
  if (!db) return;

  try {
    const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
    tx.objectStore(CACHE_STORE_NAME).put({
      cacheKey,
      audioBlob,
      createdAt: Date.now(),
    });
    await waitForTransaction(tx);
    await trimCache(db);
  } catch {
    // Playback should still work when private browsing or storage quota blocks caching.
  }
}

async function trimCache(db) {
  const count = await runRequest(db.transaction(CACHE_STORE_NAME).objectStore(CACHE_STORE_NAME).count());
  const removeCount = count - MAX_CACHE_ENTRIES;
  if (removeCount <= 0) return;

  const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
  const index = tx.objectStore(CACHE_STORE_NAME).index('createdAt');
  let removed = 0;

  index.openCursor().onsuccess = event => {
    const cursor = event.target.result;
    if (!cursor || removed >= removeCount) return;
    cursor.delete();
    removed += 1;
    cursor.continue();
  };

  await waitForTransaction(tx);
}

function runRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
