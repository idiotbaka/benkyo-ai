# Kana Trace Assets

This directory is generated from the local KanjiVG SVG source folder.

```bash
npm run kana:trace
```

The generated JSON follows the app's current `GOJUON_SECTIONS` data and
stores compound yoon entries as components, for example `きゃ -> ["き", "ゃ"]`.

Do not edit generated files by hand. Update `src/data/gojuonKana.js` or the
extract script, then regenerate this directory.
