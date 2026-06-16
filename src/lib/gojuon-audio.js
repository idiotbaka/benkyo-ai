import gojuonAudioBinUrl from '../assets/audio/gojuon/gojuon-audio.bin?url'
import gojuonAudioIndex from '../assets/audio/gojuon/gojuon-audio-index.json'

let gojuonAudioBufferPromise = null

function getGojuonAudioBuffer() {
  gojuonAudioBufferPromise ??= fetch(gojuonAudioBinUrl).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load gojuon audio bundle: ${response.status}`)
    }

    return response.arrayBuffer()
  })

  return gojuonAudioBufferPromise
}

export function getGojuonAudioIndex() {
  return gojuonAudioIndex
}

export function getGojuonAudioEntry(kana) {
  return gojuonAudioIndex.entries[kana] ?? null
}

export async function loadGojuonAudioBlob(kana) {
  const entry = getGojuonAudioEntry(kana)
  if (!entry) {
    throw new Error(`Unknown gojuon audio key: ${kana}`)
  }

  const bundle = await getGojuonAudioBuffer()
  const bytes = bundle.slice(entry.offset, entry.offset + entry.length)
  return new Blob([bytes], { type: entry.mimeType ?? gojuonAudioIndex.bundle.mimeType })
}

export async function createGojuonAudioUrl(kana) {
  const blob = await loadGojuonAudioBlob(kana)
  return URL.createObjectURL(blob)
}

export async function playGojuonAudio(kana, audio = new Audio()) {
  const url = await createGojuonAudioUrl(kana)
  audio.src = url

  const revokeUrl = () => URL.revokeObjectURL(url)
  audio.addEventListener('ended', revokeUrl, { once: true })
  audio.addEventListener('error', revokeUrl, { once: true })

  try {
    await audio.play()
  } catch (error) {
    revokeUrl()
    throw error
  }

  return audio
}
