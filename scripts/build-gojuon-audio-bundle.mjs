import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const ffmpeg = require('@ffmpeg-installer/ffmpeg')

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const sourceRoot = resolve(projectRoot, 'src/assets/audio/gojuon')
const sourceManifestPath = join(sourceRoot, 'manifest.json')
const bundleFileName = 'gojuon-audio.bin'
const indexFileName = 'gojuon-audio-index.json'
const bundlePath = join(sourceRoot, bundleFileName)
const indexPath = join(sourceRoot, indexFileName)

const categoryLabelsByFolder = new Map([
  ['01_五十音', ['gojuon', '五十音']],
  ['02_浊音和半浊音', ['dakuten_handakuten', '浊音和半浊音']],
  ['03_拗音', ['yoon', '拗音']],
  ['04_特殊拗音', ['special_yoon', '特殊拗音']],
])

function toPosixPath(path) {
  return path.split(sep).join('/')
}

async function pathExists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function loadSourceManifest() {
  if (!(await pathExists(sourceManifestPath))) {
    return null
  }

  const manifest = JSON.parse(await readFile(sourceManifestPath, 'utf8'))
  return Array.isArray(manifest.files) ? manifest : null
}

async function collectWavFiles(dir) {
  const items = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const item of items) {
    const fullPath = join(dir, item.name)
    if (item.isDirectory()) {
      files.push(...await collectWavFiles(fullPath))
      continue
    }

    if (item.isFile() && extname(item.name).toLowerCase() === '.wav') {
      files.push(fullPath)
    }
  }

  return files.sort((a, b) => a.localeCompare(b, 'ja'))
}

function createFallbackRecord(filePath) {
  const source = toPosixPath(relative(sourceRoot, filePath))
  const folder = source.split('/')[0]
  const [category, categoryLabel] = categoryLabelsByFolder.get(folder) ?? ['uncategorized', '未分类']

  return {
    source: basename(filePath),
    output: source,
    category,
    category_label: categoryLabel,
    row_group: null,
    alias_of: null,
    source_frames: null,
    output_frames: null,
    sample_rate: null,
    channels: null,
    sample_width: null,
  }
}

async function collectSourceRecords(sourceManifest) {
  if (sourceManifest?.files?.length) {
    return sourceManifest.files.map((record) => ({
      ...record,
      output: toPosixPath(record.output),
    }))
  }

  const wavFiles = await collectWavFiles(sourceRoot)
  return wavFiles.map(createFallbackRecord)
}

function encodeMp3(wavPath, record) {
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    wavPath,
    '-vn',
    '-map_metadata',
    '-1',
    '-id3v2_version',
    '0',
    '-write_xing',
    '0',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '320k',
  ]

  if (record.sample_rate) {
    args.push('-ar', String(record.sample_rate))
  }

  if (record.channels) {
    args.push('-ac', String(record.channels))
  }

  args.push('-f', 'mp3', 'pipe:1')

  return new Promise((resolvePromise, reject) => {
    const child = spawn(ffmpeg.path, args, { windowsHide: true })
    const stdout = []
    const stderr = []

    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed for ${wavPath}: ${Buffer.concat(stderr).toString('utf8')}`))
        return
      }

      const mp3 = Buffer.concat(stdout)
      if (!isMp3Buffer(mp3)) {
        reject(new Error(`ffmpeg output for ${wavPath} does not look like mp3 data`))
        return
      }

      resolvePromise(mp3)
    })
  })
}

function isMp3Buffer(buffer) {
  if (buffer.length < 3) {
    return false
  }

  const hasId3Header = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33
  const hasFrameSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0
  return hasId3Header || hasFrameSync
}

function getDurationMs(record) {
  if (!record.output_frames || !record.sample_rate) {
    return null
  }

  return Math.round((record.output_frames / record.sample_rate) * 1000)
}

async function main() {
  await mkdir(sourceRoot, { recursive: true })

  const sourceManifest = await loadSourceManifest()
  const sourceRecords = await collectSourceRecords(sourceManifest)
  if (!sourceRecords.length) {
    throw new Error(`No wav source records found in ${sourceRoot}`)
  }

  const entries = {}
  const groups = {}
  const order = []
  const buffers = []
  let offset = 0

  for (const record of sourceRecords) {
    const wavPath = join(sourceRoot, record.output)
    if (!(await pathExists(wavPath))) {
      throw new Error(`Missing source wav: ${wavPath}`)
    }

    const kana = basename(record.output, extname(record.output))
    if (entries[kana]) {
      throw new Error(`Duplicate kana key in gojuon audio records: ${kana}`)
    }

    const mp3 = await encodeMp3(wavPath, record)
    const length = mp3.length
    const category = record.category ?? 'uncategorized'

    entries[kana] = {
      kana,
      offset,
      length,
      category,
      categoryLabel: record.category_label ?? null,
      source: record.output,
      mimeType: 'audio/mpeg',
      durationMs: getDurationMs(record),
      sampleRate: record.sample_rate ?? null,
      channels: record.channels ?? null,
      sampleWidth: record.sample_width ?? null,
      sourceFrames: record.source_frames ?? null,
      outputFrames: record.output_frames ?? null,
      rowGroup: record.row_group ?? null,
      aliasOf: record.alias_of ?? null,
    }

    groups[category] ??= []
    groups[category].push(kana)
    order.push(kana)
    buffers.push(mp3)
    offset += length
  }

  const bundle = Buffer.concat(buffers, offset)
  const index = {
    version: 1,
    description: 'Bundled gojuon kana audio. Slice gojuon-audio.bin by entry offset and length, then play the slice as audio/mpeg.',
    bundle: {
      file: bundleFileName,
      format: 'mp3',
      mimeType: 'audio/mpeg',
      codec: 'libmp3lame',
      bitrate: '320k',
      totalBytes: bundle.length,
      entryCount: order.length,
    },
    encoder: {
      name: 'ffmpeg',
      args: ['-codec:a', 'libmp3lame', '-b:a', '320k', '-id3v2_version', '0', '-write_xing', '0'],
    },
    categories: sourceManifest?.categories ?? Object.fromEntries(
      [...categoryLabelsByFolder.values()].map(([key, label]) => [key, label]),
    ),
    groups,
    order,
    entries,
  }

  await writeFile(bundlePath, bundle)
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8')

  console.log(`Bundled ${order.length} gojuon clips`)
  console.log(`${toPosixPath(relative(projectRoot, bundlePath))}: ${bundle.length} bytes`)
  console.log(`${toPosixPath(relative(projectRoot, indexPath))}: ${order.length} indexed entries`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
