import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useTtsStore from '../../store/ttsStore';
import { getTtsConfigError } from '../../lib/tts';
import { playJapaneseSpeech } from '../../lib/japanese-speech-player';

export default function JapaneseSpeechButton({ text, label = `播放「${text}」`, autoPlay = false }) {
  const provider = useTtsStore(s => s.provider);
  const baseUrl = useTtsStore(s => s.baseUrl);
  const modelId = useTtsStore(s => s.modelId);
  const apiKey = useTtsStore(s => s.apiKey);
  const voice = useTtsStore(s => s.voice);
  const format = useTtsStore(s => s.format);
  const sampleRate = useTtsStore(s => s.sampleRate);
  const rate = useTtsStore(s => s.rate);
  const bitRate = useTtsStore(s => s.bitRate);

  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const playbackRef = useRef(null);
  const abortRef = useRef(null);
  const hasAutoPlayedRef = useRef(false);

  const config = useMemo(
    () => ({ provider, baseUrl, modelId, apiKey, voice, format, sampleRate, rate, bitRate }),
    [provider, baseUrl, modelId, apiKey, voice, format, sampleRate, rate, bitRate]
  );
  const configError = getTtsConfigError(config);

  const cleanupPlayback = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    playbackRef.current?.stop();
    playbackRef.current = null;
  }, []);

  useEffect(() => cleanupPlayback, [cleanupPlayback]);

  const handlePlay = useCallback(async () => {
    if (status === 'loading' || status === 'playing') {
      cleanupPlayback();
      setStatus('idle');
      return;
    }

    setError('');
    setStatus('loading');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const playback = await playJapaneseSpeech(text, config, { signal: controller.signal });
      if (controller.signal.aborted) return;
      playbackRef.current = playback;
      setStatus('playing');
      playback.finished.then(reason => {
        if (playbackRef.current !== playback) return;
        playbackRef.current = null;
        setStatus(reason === 'error' ? 'error' : 'idle');
        if (reason === 'error') setError('音频播放失败');
      });
    } catch (err) {
      if (controller.signal.aborted || err?.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      cleanupPlayback();
      setError(formatPlaybackError(err));
      setStatus('error');
    }
  }, [cleanupPlayback, config, status, text]);

  useEffect(() => {
    if (!autoPlay || configError || hasAutoPlayedRef.current) return;
    const timer = setTimeout(() => {
      hasAutoPlayedRef.current = true;
      void handlePlay();
    }, 0);
    return () => clearTimeout(timer);
  }, [autoPlay, configError, handlePlay]);

  const title = configError || error || label;

  return (
    <button
      type="button"
      className="btn-press"
      onClick={handlePlay}
      disabled={Boolean(configError)}
      aria-label={title}
      title={title}
      style={{
        width: 30,
        height: 30,
        marginTop: 5,
        borderRadius: '50%',
        border: `1.5px solid ${status === 'error' ? '#FCA5A5' : '#DDD9FF'}`,
        background: status === 'playing' ? 'var(--tp)' : '#F8F7FF',
        color: status === 'playing' ? 'white' : 'var(--tp)',
        cursor: configError ? 'not-allowed' : 'pointer',
        opacity: configError ? 0.42 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        padding: 0,
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      {status === 'loading' ? '...' : status === 'playing' ? '■' : <SpeakerIcon />}
    </button>
  );
}

function SpeakerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9.5v5h4l5 4v-13l-5 4H4Z" fill="currentColor" />
      <path d="M16 9a4.2 4.2 0 0 1 0 6M18.5 6.5a7.6 7.6 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function formatPlaybackError(err) {
  const message = err?.message || String(err);
  if (message.includes('401') || message.toLowerCase().includes('unauthorized')) {
    return '语音模型 API 密钥无效';
  }
  if (message.includes('超时') || message.toLowerCase().includes('timeout')) {
    return '语音请求超时，请稍后重试';
  }
  return `播放失败：${message.slice(0, 60)}`;
}
