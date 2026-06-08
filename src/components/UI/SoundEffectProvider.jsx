import { useEffect } from 'react';
import { playSoundEffect, primeSoundEffects, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';

/**
 * Central UI sound router.
 *
 * Add data-ui-click-sfx to a container to give its enabled buttons the default
 * click sound. A button can opt out with data-sfx="none", or override the sound
 * with data-sfx="<type>" as more interaction sounds are introduced.
 */
export default function SoundEffectProvider() {
  useEffect(() => {
    const handleFirstInteraction = () => {
      primeSoundEffects();
    };

    const handleClick = event => {
      if (!(event.target instanceof Element)) return;

      const control = event.target.closest('button, [role="button"]');
      if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;

      const explicitType = control.dataset.sfx;
      if (explicitType === 'none') return;

      if (explicitType) {
        playSoundEffect(explicitType);
      } else if (control.closest('[data-ui-click-sfx]')) {
        playSoundEffect(SOUND_EFFECT_TYPES.UI_CLICK);
      }
    };

    document.addEventListener('pointerdown', handleFirstInteraction, { capture: true, once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { capture: true, once: true, passive: true });
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('pointerdown', handleFirstInteraction, true);
      document.removeEventListener('touchstart', handleFirstInteraction, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  return null;
}
