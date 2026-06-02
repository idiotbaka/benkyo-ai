import useTtsStore from '../store/ttsStore';
import { getJapaneseSpeechAudio, getTtsConfigError } from './tts';

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
    const audioBlob = await getJapaneseSpeechAudio(text, config, { signal: controller.signal });
    if (controller.signal.aborted || requestId !== latestRequestId) throw createAbortError();

    const playback = createPlayback(audioBlob);
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

function createPlayback(audioBlob) {
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
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

function createAbortError() {
  return new DOMException('语音播放已取消', 'AbortError');
}
