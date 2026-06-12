import gsap from 'gsap';

const CHIP_SELECTOR = '[data-word-chip-id]';

export function captureWordChipRects(container) {
  if (!container) return null;

  const rects = new Map();
  container.querySelectorAll(CHIP_SELECTOR).forEach((chip) => {
    rects.set(chip.dataset.wordChipId, chip.getBoundingClientRect());
  });
  return rects;
}

export function animateWordChipLayout(container, previousRects) {
  if (!container || !previousRects) return;

  container.querySelectorAll(CHIP_SELECTOR).forEach((chip) => {
    const previousRect = previousRects.get(chip.dataset.wordChipId);
    if (!previousRect) return;

    const nextRect = chip.getBoundingClientRect();
    const x = previousRect.left - nextRect.left;
    const y = previousRect.top - nextRect.top;
    if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) return;

    gsap.killTweensOf(chip);
    gsap.fromTo(
      chip,
      { x, y, zIndex: 20 },
      { x: 0, y: 0, zIndex: 1, duration: 0.28, ease: 'power3.out', clearProps: 'transform,zIndex' }
    );
  });
}