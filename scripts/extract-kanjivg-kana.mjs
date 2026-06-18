#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const DEFAULT_SOURCE_DIR = 'kanji';
const DEFAULT_OUTPUT_DIR = 'src/assets/kana-trace';
const DATA_FILE_NAME = 'kana-trace-data.json';

const KANJIVG_SOURCE_URL = 'https://github.com/KanjiVG/kanjivg';
const KANJIVG_WEBSITE_URL = 'http://kanjivg.tagaini.net';
const KANJIVG_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/3.0/';

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source' || arg === '-s') {
      args.source = argv[i + 1];
      i += 1;
    } else if (arg === '--out' || arg === '-o') {
      args.out = argv[i + 1];
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  npm run kana:trace
  node scripts/extract-kanjivg-kana.mjs --source kanji --out src/assets/kana-trace

Options:
  --source, -s   KanjiVG SVG directory. Defaults to "${DEFAULT_SOURCE_DIR}".
  --out, -o      Generated asset directory. Defaults to "${DEFAULT_OUTPUT_DIR}".
`);
}

function assertSafeOutputDir(outputDir) {
  const relative = path.relative(repoRoot, outputDir);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Output directory must be inside the repository: ${outputDir}`);
  }
  if (relative === '.' || relative.split(path.sep).length < 2) {
    throw new Error(`Refusing to clear broad output directory: ${outputDir}`);
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function removeDirWithRetries(dir) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(error.code) || attempt === 5) {
        throw error;
      }
      await wait(100 * (attempt + 1));
    }
  }
}

async function cleanupStaleSvgFiles(svgDir, expectedFileNames) {
  let entries = [];
  try {
    entries = await fs.readdir(svgDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  const expected = new Set(expectedFileNames);
  const staleFiles = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.svg') && !expected.has(entry.name))
    .map(entry => path.join(svgDir, entry.name));

  for (const file of staleFiles) {
    try {
      await removeDirWithRetries(file);
    } catch (error) {
      console.warn(`Warning: could not remove stale file ${file}: ${error.message}`);
    }
  }
}

function codePointFileName(char) {
  const codePoint = char.codePointAt(0);
  if (!Number.isFinite(codePoint)) {
    throw new Error(`Invalid kana character: ${char}`);
  }
  return `${codePoint.toString(16).padStart(5, '0')}.svg`;
}

function codePointLabel(char) {
  return `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
}

function getAttr(tag, name) {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 's');
  const match = tag.match(pattern);
  return match?.[2] ?? match?.[3] ?? '';
}

function parseViewBox(svgContent) {
  const svgTag = svgContent.match(/<svg\b[^>]*>/is)?.[0] ?? '';
  const viewBox = getAttr(svgTag, 'viewBox');
  if (viewBox) {
    const values = viewBox.trim().split(/[\s,]+/).map(Number);
    if (values.length === 4 && values.every(Number.isFinite)) return values;
  }

  const width = Number(getAttr(svgTag, 'width'));
  const height = Number(getAttr(svgTag, 'height'));
  if (Number.isFinite(width) && Number.isFinite(height)) return [0, 0, width, height];

  return [0, 0, 109, 109];
}

function extractStrokePaths(svgContent, fileName) {
  const strokeStart = svgContent.indexOf('id="kvg:StrokePaths_');
  const searchStart = strokeStart >= 0 ? strokeStart : 0;
  const strokeNumberStart = svgContent.indexOf('id="kvg:StrokeNumbers_', searchStart);
  const block = strokeNumberStart > searchStart
    ? svgContent.slice(searchStart, strokeNumberStart)
    : svgContent.slice(searchStart);

  const paths = [];
  for (const match of block.matchAll(/<path\b[^>]*>/gis)) {
    const tag = match[0];
    const d = getAttr(tag, 'd').trim();
    if (!d) continue;

    paths.push({
      id: getAttr(tag, 'id') || `${path.basename(fileName, '.svg')}-s${paths.length + 1}`,
      d,
    });
  }

  if (paths.length === 0) {
    throw new Error(`No stroke paths found in ${fileName}`);
  }

  return paths;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildSimplifiedSvg(characterData) {
  const viewBox = characterData.viewBox.join(' ');
  const paths = characterData.strokes
    .map(stroke => `  <path id="${escapeXml(stroke.id)}" d="${escapeXml(stroke.d)}"/>`)
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">`,
    '<g fill="none" stroke="#000000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">',
    paths,
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}

function collectCourseKanaEntries(sections, toKatakanaText) {
  const entries = {
    hiragana: [],
    katakana: [],
  };

  const seen = {
    hiragana: new Set(),
    katakana: new Set(),
  };

  for (const section of sections) {
    for (const row of section.rows ?? []) {
      for (const item of row) {
        if (!item?.kana) continue;

        const base = {
          romaji: item.romaji,
          sectionId: section.id,
          sectionTitle: section.title,
        };

        if (!seen.hiragana.has(item.kana)) {
          seen.hiragana.add(item.kana);
          entries.hiragana.push({
            kana: item.kana,
            ...base,
            components: [...item.kana],
          });
        }

        const katakana = toKatakanaText(item.kana);
        if (!seen.katakana.has(katakana)) {
          seen.katakana.add(katakana);
          entries.katakana.push({
            kana: katakana,
            ...base,
            components: [...katakana],
          });
        }
      }
    }
  }

  return entries;
}

function getTargetCharacters(entries) {
  const chars = new Set();
  for (const script of Object.keys(entries)) {
    for (const entry of entries[script]) {
      for (const component of entry.components) chars.add(component);
    }
  }
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
}

async function readSourceSvg(sourceDir, char) {
  const fileName = codePointFileName(char);
  const filePath = path.join(sourceDir, fileName);
  const content = await fs.readFile(filePath, 'utf8');
  return { fileName, content };
}

function buildNotice({ characterCount, entryCount }) {
  return `KanjiVG Kana Trace Assets
===========================

Generated by: scripts/extract-kanjivg-kana.mjs

This directory contains a subset of kana stroke data derived from KanjiVG.
It is limited to the hiragana and katakana characters required by the app's
current kana learning data, including dakuten, handakuten, and yoon component
kana.

Source:
- KanjiVG repository: ${KANJIVG_SOURCE_URL}
- KanjiVG website: ${KANJIVG_WEBSITE_URL}

License:
- Creative Commons Attribution-Share Alike 3.0
- ${KANJIVG_LICENSE_URL}

Attribution:
- KanjiVG copyright (C) 2009/2010/2011 Ulrich Apel.
- KanjiVG data is used and transformed here as compact kana tracing assets.

Generated contents:
- ${DATA_FILE_NAME}: normalized stroke path data for runtime tracing.
- svg/: simplified per-character SVG files for inspection and fallback use.

Generated counts:
- Characters: ${characterCount}
- Kana entries: ${entryCount}

Keep this NOTICE with the generated data and include KanjiVG attribution in
user-facing app/license documentation when these assets are shipped.
`;
}

function buildReadme() {
  return `# Kana Trace Assets

This directory is generated from the local KanjiVG SVG source folder.

\`\`\`bash
npm run kana:trace
\`\`\`

The generated JSON follows the app's current \`GOJUON_SECTIONS\` data and
stores compound yoon entries as components, for example \`きゃ -> ["き", "ゃ"]\`.

Do not edit generated files by hand. Update \`src/data/gojuonKana.js\` or the
extract script, then regenerate this directory.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const sourceDir = path.resolve(repoRoot, args.source ?? DEFAULT_SOURCE_DIR);
  const outputDir = path.resolve(repoRoot, args.out ?? DEFAULT_OUTPUT_DIR);
  const svgOutputDir = path.join(outputDir, 'svg');
  assertSafeOutputDir(outputDir);

  const gojuonPath = pathToFileURL(path.join(repoRoot, 'src/data/gojuonKana.js')).href;
  const { GOJUON_SECTIONS, toKatakanaText } = await import(gojuonPath);
  const entries = collectCourseKanaEntries(GOJUON_SECTIONS, toKatakanaText);
  const targetChars = getTargetCharacters(entries);

  await fs.access(sourceDir);
  await fs.mkdir(svgOutputDir, { recursive: true });

  const characters = {};
  const missing = [];
  const expectedSvgFileNames = targetChars.map(codePointFileName);
  let strokeCount = 0;

  for (const char of targetChars) {
    try {
      const { fileName, content } = await readSourceSvg(sourceDir, char);
      const data = {
        char,
        codePoint: codePointLabel(char),
        fileName,
        svgPath: `svg/${fileName}`,
        viewBox: parseViewBox(content),
        strokes: extractStrokePaths(content, fileName),
      };
      characters[char] = data;
      strokeCount += data.strokes.length;
      await fs.writeFile(path.join(svgOutputDir, fileName), buildSimplifiedSvg(data), 'utf8');
    } catch (error) {
      missing.push({ char, codePoint: codePointLabel(char), fileName: codePointFileName(char), error: error.message });
    }
  }

  await cleanupStaleSvgFiles(svgOutputDir, expectedSvgFileNames);

  if (missing.length > 0) {
    const lines = missing.map(item => `- ${item.char} (${item.codePoint}, ${item.fileName}): ${item.error}`);
    throw new Error(`Missing or invalid KanjiVG SVG files:\n${lines.join('\n')}`);
  }

  const entryCount = entries.hiragana.length + entries.katakana.length;
  const data = {
    schemaVersion: 1,
    source: {
      name: 'KanjiVG',
      repository: KANJIVG_SOURCE_URL,
      website: KANJIVG_WEBSITE_URL,
      license: 'CC BY-SA 3.0',
      licenseUrl: KANJIVG_LICENSE_URL,
    },
    counts: {
      scripts: Object.fromEntries(Object.entries(entries).map(([script, items]) => [script, items.length])),
      kanaEntries: entryCount,
      characters: targetChars.length,
      strokes: strokeCount,
    },
    entries,
    characters,
  };

  await fs.writeFile(path.join(outputDir, DATA_FILE_NAME), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(outputDir, 'NOTICE.txt'), buildNotice({
    characterCount: targetChars.length,
    entryCount,
  }), 'utf8');
  await fs.writeFile(path.join(outputDir, 'README.md'), buildReadme(), 'utf8');

  console.log(`Generated ${targetChars.length} kana character assets and ${entryCount} kana entries.`);
  console.log(`Output: ${path.relative(repoRoot, outputDir)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
