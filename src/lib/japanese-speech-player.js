import useTtsStore from '../store/ttsStore';
import { getJapaneseSpeechAudio, getTtsConfigError } from './tts';
import {
  SYSTEM_SPEECH_PROVIDER,
  isSystemSpeechSupported,
  loadSystemSpeechVoices,
  resolveSystemSpeechVoice,
} from './system-speech';

let activeRequestController = null;
let activePlayback = null;
let latestRequestId = 0;

/**
 * Plays Japanese text with the saved TTS settings.
 * Event-driven lesson interactions use this helper so missing config stays silent.
 */
export function playSavedJapaneseSpeech(text, options) {
  const config = useTtsStore.getState().getConfig();
  if (getTtsConfigError(config)) return Promise.resolve(null);
  return playJapaneseSpeech(text, config, options);
}

/**
 * Plays one cached or newly synthesized clip. Starting a new clip stops the
 * previous request and audio instance so rapid card taps never overlap.
 */
export async function playJapaneseSpeech(text, config, { signal } = {}) {
  stopJapaneseSpeech();

  const requestId = ++latestRequestId;
  const controller = new AbortController();
  const handleAbort = () => controller.abort(signal?.reason);
  activeRequestController = controller;

  if (signal) {
    if (signal.aborted) {
      handleAbort();
    } else {
      signal.addEventListener('abort', handleAbort, { once: true });
    }
  }

  try {
    let playback;

    if (config?.provider === SYSTEM_SPEECH_PROVIDER) {
      playback = await createSystemSpeechPlayback(text, config, controller.signal);
    } else {
      const audioBlob = await getJapaneseSpeechAudio(text, config, { signal: controller.signal });
      playback = createAudioBlobPlayback(audioBlob);
    }

    if (controller.signal.aborted || requestId !== latestRequestId) throw createAbortError();
    activePlayback = playback;
    await playback.play();
    return playback;
  } finally {
    signal?.removeEventListener('abort', handleAbort);
    if (activeRequestController === controller) activeRequestController = null;
  }
}

export function stopJapaneseSpeech() {
  latestRequestId += 1;
  activeRequestController?.abort();
  activeRequestController = null;
  activePlayback?.stop();
  activePlayback = null;
}

function createAudioBlobPlayback(audioBlob) {
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  let settled = false;
  let resolveFinished;

  const finished = new Promise(resolve => {
    resolveFinished = resolve;
  });

  const playback = {
    async play() {
      try {
        await audio.play();
      } catch (err) {
        cleanup('error');
        throw err;
      }
    },
    stop() {
      cleanup('stopped');
    },
    finished,
  };

  function cleanup(reason) {
    if (settled) return;
    settled = true;
    audio.removeEventListener('ended', handleEnded);
    audio.removeEventListener('error', handleError);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(audioUrl);
    if (activePlayback === playback) activePlayback = null;
    resolveFinished(reason);
  }

  function handleEnded() {
    cleanup('ended');
  }

  function handleError() {
    cleanup('error');
  }

  audio.addEventListener('ended', handleEnded, { once: true });
  audio.addEventListener('error', handleError, { once: true });
  return playback;
}

async function createSystemSpeechPlayback(text, config, signal) {
  if (!isSystemSpeechSupported()) {
    throw new Error('当前 WebView 不支持系统内置语音');
  }

  const normalizedText = normalizeSpeechText(text);
  if (!normalizedText) throw new Error('播放文本不能为空');

  const voices = await loadSystemSpeechVoices();
  if (signal.aborted) throw createAbortError();

  const voice = resolveSystemSpeechVoice(config?.voice, voices);
  const utterance = new SpeechSynthesisUtterance(normalizedText);
  utterance.lang = voice?.lang || 'ja-JP';
  utterance.rate = normalizeSpeechRate(config?.rate);
  utterance.pitch = 1;
  utterance.volume = 1;
  if (voice) utterance.voice = voice;

  let settled = false;
  let stopRequested = false;
  let resolveFinished;

  const finished = new Promise(resolve => {
    resolveFinished = resolve;
  });

  const playback = {
    async play() {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        cleanup('error');
        throw err;
      }
    },
    stop() {
      stopRequested = true;
      window.speechSynthesis.cancel();
      cleanup('stopped');
    },
    finished,
  };

  function cleanup(reason) {
    if (settled) return;
    settled = true;
    utterance.onend = null;
    utterance.onerror = null;
    if (activePlayback === playback) activePlayback = null;
    resolveFinished(reason);
  }

  utterance.onend = () => cleanup('ended');
  utterance.onerror = () => cleanup(stopRequested ? 'stopped' : 'error');

  return playback;
}

function normalizeText(text) {
  return typeof text === 'string' ? text.trim() : '';
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

function normalizeSpeechRate(rate) {
  const numericRate = Number(rate);
  if (!Number.isFinite(numericRate)) return 1;
  return Math.min(2, Math.max(0.5, numericRate));
}

function createAbortError() {
  return new DOMException('语音播放已取消', 'AbortError');
}
