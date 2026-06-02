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

const audioTemplates = new Map();

export function playSoundEffect(type) {
  const effect = SOUND_EFFECTS[type];
  if (!effect) return;

  const audio = getAudioTemplate(type, effect).cloneNode();
  audio.volume = effect.volume;
  void audio.play().catch(() => {});
}

function getAudioTemplate(type, effect) {
  if (!audioTemplates.has(type)) {
    const audio = new Audio(effect.src);
    audio.preload = 'auto';
    audioTemplates.set(type, audio);
  }

  return audioTemplates.get(type);
}
