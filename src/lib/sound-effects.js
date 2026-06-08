import uiClickSrc from '../assets/audio/kenney_ui_click.ogg';
import wordSelectedSrc from '../assets/audio/kenney_word_selected.ogg';
import wordUnselectedSrc from '../assets/audio/kenney_word_unselected.ogg';
import answerCorrectSrc from '../assets/audio/soundeffect_lab_correct.mp3';
import answerWrongSrc from '../assets/audio/soundeffect_lab_wrong.mp3';
import levelCompleteSrc from '../assets/audio/soundeffect_lab_level_complete.mp3';

export const SOUND_EFFECT_TYPES = {
  UI_CLICK: 'ui-click',
  WORD_SELECTED: 'word-selected',
  WORD_UNSELECTED: 'word-unselected',
  ANSWER_CORRECT: 'answer-correct',
  ANSWER_WRONG: 'answer-wrong',
  LEVEL_COMPLETE: 'level-complete',
};

const SOUND_EFFECTS = {
  [SOUND_EFFECT_TYPES.UI_CLICK]: { src: uiClickSrc, volume: 0.72 },
  [SOUND_EFFECT_TYPES.WORD_SELECTED]: { src: wordSelectedSrc, volume: 0.8 },
  [SOUND_EFFECT_TYPES.WORD_UNSELECTED]: { src: wordUnselectedSrc, volume: 0.8 },
  [SOUND_EFFECT_TYPES.ANSWER_CORRECT]: { src: answerCorrectSrc, volume: 0.85 },
  [SOUND_EFFECT_TYPES.ANSWER_WRONG]: { src: answerWrongSrc, volume: 0.85 },
  [SOUND_EFFECT_TYPES.LEVEL_COMPLETE]: { src: levelCompleteSrc, volume: 0.9 },
};

const POOL_SIZE = 4;
const audioPools = new Map();
let didPrimeAudio = false;

export function primeSoundEffects() {
  if (didPrimeAudio) return;
  didPrimeAudio = true;
  Object.entries(SOUND_EFFECTS).forEach(([type, effect]) => {
    getAudioPool(type, effect).players.forEach(audio => {
      try {
        audio.load();
      } catch {
        // Android WebView can throw while the page is backgrounded; playback will retry later.
      }
    });
  });
}

export function playSoundEffect(type) {
  const effect = SOUND_EFFECTS[type];
  if (!effect) return;

  const pool = getAudioPool(type, effect);
  const index = pool.cursor;
  pool.cursor = (pool.cursor + 1) % pool.players.length;

  let audio = pool.players[index];
  if (!audio || audio.error || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
    audio = createAudio(effect);
    pool.players[index] = audio;
  }

  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    audio = createAudio(effect);
    pool.players[index] = audio;
  }
  audio.volume = effect.volume;
  void audio.play().catch(() => {
    pool.players[index] = createAudio(effect);
  });
}

function getAudioPool(type, effect) {
  if (!audioPools.has(type)) {
    audioPools.set(type, {
      cursor: 0,
      players: Array.from({ length: POOL_SIZE }, () => createAudio(effect)),
    });
  }

  return audioPools.get(type);
}

function createAudio(effect) {
  const audio = new Audio(effect.src);
  audio.preload = 'auto';
  audio.volume = effect.volume;
  audio.setAttribute('playsinline', '');
  return audio;
}
