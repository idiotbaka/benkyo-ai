import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_ICON_SKIN = 'benkyochan';
export const DEFAULT_WORD_CHIP_MOTION = 'animated';

export const ICON_SKINS = [
  { id: 'benkyochan', label: 'benkyochan', isDefault: true },
  /* { id: 'hiyohiyo', label: 'hiyohiyo' }, */
];

export const WORD_CHIP_MOTION_OPTIONS = [
  { id: 'animated', label: '有动画', isDefault: true },
  { id: 'none', label: '无动画' },
];

const ICON_SKIN_IDS = new Set(ICON_SKINS.map(skin => skin.id));
const WORD_CHIP_MOTION_IDS = new Set(WORD_CHIP_MOTION_OPTIONS.map(option => option.id));

export function isIconSkin(value) {
  return ICON_SKIN_IDS.has(value);
}

export function isWordChipMotion(value) {
  return WORD_CHIP_MOTION_IDS.has(value);
}

const useAppearanceStore = create(
  persist(
    (set) => ({
      iconSkin: DEFAULT_ICON_SKIN,
      wordChipMotion: DEFAULT_WORD_CHIP_MOTION,

      setIconSkin(iconSkin) {
        set({
          iconSkin: isIconSkin(iconSkin) ? iconSkin : DEFAULT_ICON_SKIN,
        });
      },

      setWordChipMotion(wordChipMotion) {
        set({
          wordChipMotion: isWordChipMotion(wordChipMotion) ? wordChipMotion : DEFAULT_WORD_CHIP_MOTION,
        });
      },
    }),
    {
      name: 'benkyo-ai-appearance',
      partialize: (s) => ({
        iconSkin: isIconSkin(s.iconSkin) ? s.iconSkin : DEFAULT_ICON_SKIN,
        wordChipMotion: isWordChipMotion(s.wordChipMotion) ? s.wordChipMotion : DEFAULT_WORD_CHIP_MOTION,
      }),
    }
  )
);

export default useAppearanceStore;
