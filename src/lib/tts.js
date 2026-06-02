const CACHE_DB_NAME = 'jplearn-tts-cache';
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
  const normalizedText = normalizeText(text);
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
  const normalizedText = normalizeText(text);
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
  const normalizedText = normalizeText(text);
  const profile = normalizeConfig(config);
  const configError = getTtsConfigError(profile);

  if (!normalizedText) throw new Error('播放文本不能为空');
  if (configError) throw new Error(configError);
  if (profile.provider !== 'aliyun-cosyvoice') {
    throw new Error(`暂不支持语音提供商：${profile.provider}`);
  }

  const requestSignal = createTimeoutSignal(signal);

  try {
    const res = await fetch(profile.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${profile.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: profile.modelId,
        input: {
          text: normalizedText,
          voice: profile.voice,
          format: profile.format,
          sample_rate: profile.sampleRate,
          rate: profile.rate,
          bit_rate: profile.bitRate,
        },
      }),
      signal: requestSignal.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 120)}`);
    }

    const audioBlob = await extractTtsAudioBlob(res, requestSignal.signal);
    if (!audioBlob) throw new Error('未解析到可播放的音频数据');
    return audioBlob;
  } finally {
    requestSignal.cleanup();
  }
}

function normalizeText(text) {
  return typeof text === 'string' ? text.trim() : '';
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

  const base64Audio =
    outputAudio?.data ||
    (typeof outputAudio === 'string' ? outputAudio : '') ||
    data?.audio ||
    data?.data?.audio;

  if (typeof base64Audio === 'string' && base64Audio.length > 0) {
    return base64ToBlob(base64Audio, 'audio/mpeg');
  }

  return null;
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
