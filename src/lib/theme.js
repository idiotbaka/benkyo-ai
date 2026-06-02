// ─── Theme palettes ──────────────────────────────────────────────────────────
export const THEMES = {
  male: {
    primary: '#5B4FE9',
    from:    '#7C6CF6',
    dark:    '#4338CA',
    deep:    '#3730A3',
    lite:    '#EDE9FE',
    border:  '#C4B5FD',
  },
  female: {
    primary: '#EC4899',
    from:    '#F472B6',
    dark:    '#DB2777',
    deep:    '#BE185D',
    lite:    '#FCE7F3',
    border:  '#F9A8D4',
  },
};

// ─── Apply theme by writing CSS custom properties to :root ───────────────────
export function applyTheme(gender) {
  const t = THEMES[gender] ?? THEMES.male;
  const root = document.documentElement;
  root.style.setProperty('--tp',      t.primary);
  root.style.setProperty('--tp-from', t.from);
  root.style.setProperty('--tp-dark', t.dark);
  root.style.setProperty('--tp-deep', t.deep);
  root.style.setProperty('--tp-lite', t.lite);
  root.style.setProperty('--tp-bdr',  t.border);
}

// ─── Get palette object (for dynamic JS usage) ───────────────────────────────
export function getTheme(gender) {
  return THEMES[gender] ?? THEMES.male;
}
