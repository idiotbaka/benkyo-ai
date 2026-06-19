export const SYSTEM_SPEECH_PROVIDER = 'system-speech';
export const SYSTEM_SPEECH_AUTO_VOICE = 'auto';

const DEFAULT_VOICE_LOAD_TIMEOUT_MS = 1200;
const JAPANESE_LANG_RE = /^ja(?:[-_]|$)/i;

export function isSystemSpeechSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

export function isJapaneseSystemVoice(voice) {
  return JAPANESE_LANG_RE.test(voice?.lang || '');
}

export function getSystemSpeechVoiceId(voice) {
  if (!voice) return '';
  return voice.voiceURI || `${voice.name}|${voice.lang}`;
}

export function getSystemSpeechVoiceLabel(voice) {
  if (!voice) return '';
  const lang = voice.lang ? ` (${voice.lang})` : '';
  const defaultLabel = voice.default ? '・默认' : '';
  return `${voice.name}${lang}${defaultLabel}`;
}

export function sortSystemSpeechVoices(voices) {
  return [...voices].sort((a, b) => {
    const aJapanese = isJapaneseSystemVoice(a) ? 0 : 1;
    const bJapanese = isJapaneseSystemVoice(b) ? 0 : 1;
    if (aJapanese !== bJapanese) return aJapanese - bJapanese;

    const aDefault = a.default ? 0 : 1;
    const bDefault = b.default ? 0 : 1;
    if (aDefault !== bDefault) return aDefault - bDefault;

    return getSystemSpeechVoiceLabel(a).localeCompare(getSystemSpeechVoiceLabel(b), 'ja');
  });
}

export function hasJapaneseSystemVoice(voices) {
  return voices.some(isJapaneseSystemVoice);
}

export async function loadSystemSpeechVoices(timeoutMs = DEFAULT_VOICE_LOAD_TIMEOUT_MS) {
  if (!isSystemSpeechSupported()) return [];

  const synth = window.speechSynthesis;
  const currentVoices = sortSystemSpeechVoices(synth.getVoices());
  if (currentVoices.length > 0) return currentVoices;

  return new Promise(resolve => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener?.('voiceschanged', handleVoicesChanged);
      resolve(sortSystemSpeechVoices(synth.getVoices()));
    };

    const handleVoicesChanged = () => finish();
    synth.addEventListener?.('voiceschanged', handleVoicesChanged, { once: true });
    window.setTimeout(finish, timeoutMs);
  });
}

export function resolveSystemSpeechVoice(voiceId, voices) {
  const sortedVoices = sortSystemSpeechVoices(voices || []);
  const normalizedVoiceId = typeof voiceId === 'string' ? voiceId.trim() : '';

  if (normalizedVoiceId && normalizedVoiceId !== SYSTEM_SPEECH_AUTO_VOICE) {
    const selectedVoice = sortedVoices.find(voice => getSystemSpeechVoiceId(voice) === normalizedVoiceId);
    if (selectedVoice) return selectedVoice;
  }

  return (
    sortedVoices.find(isJapaneseSystemVoice) ||
    sortedVoices.find(voice => voice.default) ||
    sortedVoices[0] ||
    null
  );
}
