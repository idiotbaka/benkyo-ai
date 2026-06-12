import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { generateText } from 'ai';
import tauriConfig from '../../src-tauri/tauri.conf.json';
import useAiStore, { PROVIDER_PRESETS } from '../store/aiStore';
import useTtsStore, { TTS_PROVIDER_PRESETS } from '../store/ttsStore';
import useAppearanceStore, { DEFAULT_ICON_SKIN, DEFAULT_WORD_CHIP_MOTION, ICON_SKINS, WORD_CHIP_MOTION_OPTIONS, isIconSkin, isWordChipMotion } from '../store/appearanceStore';
import { getModel } from '../lib/ai-providers';
import { getAiErrorContent, logAiGeneratedContent } from '../lib/ai-debug';
import { requestTtsAudioBlob } from '../lib/tts';
import { useIcon } from '../lib/icons';

gsap.registerPlugin(useGSAP);

const PROVIDER_OPTIONS = Object.entries(PROVIDER_PRESETS).map(([id, info]) => ({
  id,
  label: info.label,
  defaultBaseUrl: info.baseUrl,
  requiresBaseUrl: info.requiresBaseUrl,
}));

const THINKING_DEPTH_OPTIONS = [
  {
    id: 'deep',
    icon: '🧠',
    label: '深度思考',
    desc: '最高质量，AI 充分推理后生成，等待时间最长',
  },
  {
    id: 'standard',
    icon: '⚖️',
    label: '标准',
    desc: '质量与速度均衡，适合日常使用',
  },
  {
    id: 'fast',
    icon: '⚡',
    label: '快速',
    desc: '最短等待，思考步骤精简，速度优先',
  },
];

const REQUEST_MODE_OPTIONS = [
  { id: 'stream', label: '流式传输（默认）' },
  { id: 'object', label: '非流式传输' },
];

const TTS_PROVIDER_OPTIONS = Object.entries(TTS_PROVIDER_PRESETS).map(([id, info]) => ({
  id,
  label: info.label,
  defaultBaseUrl: info.baseUrl,
}));

const SETTINGS_PANEL_IDS = new Set(['appearance', 'ai', 'tts', 'thinking']);

const APP_INFO = {
  name: tauriConfig.productName || '日学',
  version: tauriConfig.version || '0.2.3',
  githubLabel: 'idiotbaka/benkyo-ai',
  githubUrl: 'https://github.com/idiotbaka/benkyo-ai',
};

const SOUND_CREDITS = [
  { label: '効果音ラボ', url: 'https://soundeffect-lab.info/' },
  { label: 'Kenney', url: 'https://kenney.nl/' },
];

const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: '#6B7280',
  display: 'block',
  marginBottom: 8,
};

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  background: '#F9FAFB',
  border: '1.5px solid #E5E7EB',
  borderRadius: 12,
  outline: 'none',
  fontSize: 13,
  color: '#1E1B4B',
  boxSizing: 'border-box',
};

const selectShellStyle = {
  position: 'relative',
  background: '#F9FAFB',
  borderRadius: 12,
  border: '1.5px solid #E5E7EB',
};

const selectStyle = {
  width: '100%',
  padding: '11px 14px',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: 14,
  fontWeight: 600,
  color: '#1E1B4B',
  cursor: 'pointer',
  appearance: 'none',
};

function VisibilityIcon({ visible }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.6 10.7A2 2 0 0 0 13.3 13.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9.4 4.2C10.2 4.1 11.1 4 12 4C16.6 4 20.1 7 22 12C21.5 13.3 20.9 14.4 20.1 15.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.2 5.5C4.3 6.8 2.9 9 2 12C3.9 17 7.4 20 12 20C13.8 20 15.4 19.5 16.8 18.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12C3.9 7 7.4 4 12 4C16.6 4 20.1 7 22 12C20.1 17 16.6 20 12 20C7.4 20 3.9 17 2 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function SelectChevron() {
  return (
    <span
      style={{
        position: 'absolute',
        right: 14,
        top: '50%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        fontSize: 12,
        color: '#9CA3AF',
      }}
    >
      ▼
    </span>
  );
}

function normalizeSettingsPanel(panel) {
  return SETTINGS_PANEL_IDS.has(panel) ? panel : null;
}

function getSettingsPanelFromLocation(location) {
  const params = new URLSearchParams(location.search);
  return normalizeSettingsPanel(
    params.get('panel') ||
    params.get('section') ||
    location.state?.panel ||
    location.state?.section,
  );
}

function SettingsPanel({ panelRef, title, summary, tone = 'var(--tp)', open, onToggle, children }) {
  return (
    <section
      ref={panelRef}
      style={{
        background: 'white',
        borderRadius: 18,
        border: `1.5px solid ${open ? tone : '#EDE9FE'}`,
        boxShadow: open ? '0 8px 28px rgba(91,79,233,0.14)' : '0 4px 18px rgba(91,79,233,0.08)',
        overflow: 'hidden',
        marginBottom: 12,
        transition: 'border-color 0.18s, box-shadow 0.18s',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: '15px 16px',
          cursor: 'pointer',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 12,
          alignItems: 'center',
          textAlign: 'left',
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 22,
                borderRadius: 99,
                background: tone,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 16, fontWeight: 900, color: '#1E1B4B' }}>{title}</span>
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: '#6B7280',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              paddingLeft: 16,
            }}
          >
            {summary}
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: open ? '#F0EEFF' : '#F8FAFC',
            color: open ? 'var(--tp)' : '#6B7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.18s, color 0.18s',
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRight: `2.5px solid ${open ? 'var(--tp)' : '#64748B'}`,
              borderBottom: `2.5px solid ${open ? 'var(--tp)' : '#64748B'}`,
              borderRadius: 2,
              transform: open ? 'translateY(2px) rotate(225deg)' : 'translateY(-2px) rotate(45deg)',
              transition: 'transform 0.18s, border-color 0.18s',
            }}
          />
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 18px', borderTop: '1px solid #F1F5F9' }}>
          <div style={{ paddingTop: 16 }}>{children}</div>
        </div>
      )}
    </section>
  );
}

function AboutInfoRow({ label, children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '76px 1fr',
      gap: 10,
      alignItems: 'start',
      padding: '10px 0',
      borderTop: '1px solid #F1F5F9',
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8' }}>{label}</span>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E1B4B', lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}

function ExternalInfoLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        color: 'var(--tp)',
        fontWeight: 800,
        textDecoration: 'none',
      }}
    >
      {children}
    </a>
  );
}

function AboutAppSection() {
  return (
    <section
      style={{
        background: 'white',
        borderRadius: 18,
        border: '1.5px solid #EDE9FE',
        boxShadow: '0 4px 18px rgba(91,79,233,0.08)',
        padding: '16px',
        marginTop: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', margin: '0 0 4px' }}>关于 APP</p>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B', margin: 0 }}>{APP_INFO.name}</h2>
        </div>
        <span style={{
          padding: '6px 10px',
          borderRadius: 999,
          background: '#F0EEFF',
          color: 'var(--tp)',
          fontSize: 12,
          fontWeight: 900,
          whiteSpace: 'nowrap',
        }}>
          v{APP_INFO.version}
        </span>
      </div>

      <AboutInfoRow label="仓库">
        <ExternalInfoLink href={APP_INFO.githubUrl}>{APP_INFO.githubLabel}</ExternalInfoLink>
      </AboutInfoRow>

      <AboutInfoRow label="音效鸣谢">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
          {SOUND_CREDITS.map(item => (
            <ExternalInfoLink key={item.url} href={item.url}>{item.label}</ExternalInfoLink>
          ))}
        </div>
      </AboutInfoRow>
    </section>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const targetPanel = getSettingsPanelFromLocation(location);
  const savedConfig = useAiStore(s => s.getConfig)();
  const setConfig = useAiStore(s => s.setConfig);
  const thinkingDepth = useAiStore(s => s.thinkingDepth);
  const setThinkingDepthStore = useAiStore(s => s.setThinkingDepth);
  const savedTtsConfig = useTtsStore(s => s.getConfig)();
  const setTtsConfigStore = useTtsStore(s => s.setConfig);
  const iconSkin = useAppearanceStore(s => s.iconSkin);
  const setIconSkin = useAppearanceStore(s => s.setIconSkin);
  const wordChipMotion = useAppearanceStore(s => s.wordChipMotion);
  const setWordChipMotion = useAppearanceStore(s => s.setWordChipMotion);
  const settingImg = useIcon('ui/setting.png');
  const activeIconSkin = isIconSkin(iconSkin) ? iconSkin : DEFAULT_ICON_SKIN;
  const activeWordChipMotion = isWordChipMotion(wordChipMotion) ? wordChipMotion : DEFAULT_WORD_CHIP_MOTION;
  const savedTtsProvider = TTS_PROVIDER_PRESETS[savedTtsConfig.provider]
    ? savedTtsConfig.provider
    : 'aliyun-cosyvoice';
  const savedTtsPreset = TTS_PROVIDER_PRESETS[savedTtsProvider];

  const [provider, setProvider] = useState(savedConfig.provider || 'openai');
  const [apiKey, setApiKey] = useState(savedConfig.apiKey || '');
  const [modelId, setModelId] = useState(savedConfig.modelId || '');
  const [baseUrl, setBaseUrl] = useState(savedConfig.baseUrl || '');
  const [requestMode, setRequestMode] = useState(savedConfig.requestMode || 'stream');
  const [showKey, setShowKey] = useState(false);
  const [ttsProvider, setTtsProvider] = useState(savedTtsProvider);
  const [ttsBaseUrl, setTtsBaseUrl] = useState(savedTtsConfig.baseUrl || savedTtsPreset.baseUrl);
  const [ttsModelId, setTtsModelId] = useState(savedTtsConfig.modelId || savedTtsPreset.modelId);
  const [ttsApiKey, setTtsApiKey] = useState(savedTtsConfig.apiKey || '');
  const [ttsVoice, setTtsVoice] = useState(savedTtsConfig.voice || savedTtsPreset.voice);
  const [showTtsKey, setShowTtsKey] = useState(false);
  const [openPanels, setOpenPanels] = useState(() => new Set(targetPanel ? [targetPanel] : []));

  const [testStatus, setTestStatus] = useState(null); // null | 'loading' | 'ok' | 'error'
  const [testMessage, setTestMessage] = useState('');
  const [ttsTestStatus, setTtsTestStatus] = useState(null); // null | 'loading' | 'ok' | 'error'
  const [ttsTestMessage, setTtsTestMessage] = useState('');

  const pageRef = useRef(null);
  const backBtnRef = useRef(null);
  const panelRefs = useRef({});
  const ttsAudioRef = useRef(null);
  const ttsAudioUrlRef = useRef(null);

  useGSAP(() => {
    gsap.set(pageRef.current, { opacity: 0, y: 16 });
  });
  useGSAP(() => {
    gsap.to(pageRef.current, { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.7)' });
  }, []);

  const currentPreset = PROVIDER_PRESETS[provider];
  const currentTtsPreset = TTS_PROVIDER_PRESETS[ttsProvider];
  const providerLabel = currentPreset?.label || provider || '未选择';
  const ttsProviderLabel = currentTtsPreset?.label || ttsProvider || '未选择';
  const activeIconSkinLabel = ICON_SKINS.find(opt => opt.id === activeIconSkin)?.label || activeIconSkin;
  const activeWordChipMotionLabel = WORD_CHIP_MOTION_OPTIONS.find(opt => opt.id === activeWordChipMotion)?.label || activeWordChipMotion;
  const activeThinkingDepthLabel = THINKING_DEPTH_OPTIONS.find(opt => opt.id === thinkingDepth)?.label || '深度思考';
  const isAiConfigured = Boolean(
    provider &&
    apiKey.trim() &&
    modelId.trim() &&
    (provider !== 'openai-compatible' || baseUrl.trim()),
  );
  const isTtsConfigured = Boolean(
    ttsProvider &&
    ttsBaseUrl.trim() &&
    ttsModelId.trim() &&
    ttsApiKey.trim() &&
    ttsVoice.trim(),
  );

  function isPanelOpen(panelId) {
    return openPanels.has(panelId);
  }

  function togglePanel(panelId) {
    setOpenPanels(prev => {
      const next = new Set(prev);
      if (next.has(panelId)) {
        next.delete(panelId);
      } else {
        next.add(panelId);
      }
      return next;
    });
  }

  function setPanelRef(panelId, node) {
    if (node) {
      panelRefs.current[panelId] = node;
    }
  }

  useEffect(() => {
    if (!targetPanel) return undefined;

    let scrollTimer;
    const openTimer = window.setTimeout(() => {
      setOpenPanels(prev => {
        if (prev.has(targetPanel)) return prev;
        const next = new Set(prev);
        next.add(targetPanel);
        return next;
      });

      scrollTimer = window.setTimeout(() => {
        panelRefs.current[targetPanel]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }, 0);

    return () => {
      window.clearTimeout(openTimer);
      if (scrollTimer) window.clearTimeout(scrollTimer);
    };
  }, [targetPanel]);

  useEffect(() => {
    setConfig({
      provider,
      apiKey: apiKey.trim(),
      modelId: modelId.trim(),
      baseUrl: baseUrl.trim(),
      requestMode,
    });
  }, [provider, apiKey, modelId, baseUrl, requestMode, setConfig]);

  useEffect(() => {
    setTtsConfigStore({
      provider: ttsProvider,
      baseUrl: ttsBaseUrl.trim(),
      modelId: ttsModelId.trim(),
      apiKey: ttsApiKey.trim(),
      voice: ttsVoice.trim(),
    });
  }, [ttsProvider, ttsBaseUrl, ttsModelId, ttsApiKey, ttsVoice, setTtsConfigStore]);

  function handleTtsProviderChange(newProvider) {
    setTtsProvider(newProvider);
    const preset = TTS_PROVIDER_PRESETS[newProvider];
    if (preset?.baseUrl) setTtsBaseUrl(preset.baseUrl);
    if (preset?.modelId) setTtsModelId(preset.modelId);
    if (preset?.voice) setTtsVoice(preset.voice);
    setTtsTestStatus(null);
    setTtsTestMessage('');
  }

  // When provider changes, auto-fill baseUrl with the preset default (if not already custom-set)
  function handleProviderChange(newProvider) {
    setProvider(newProvider);
    const preset = PROVIDER_PRESETS[newProvider];
    // Only auto-fill if user hasn't typed a custom value
    setBaseUrl(preset.baseUrl);
    setTestStatus(null);
    setTestMessage('');
  }

  async function handleTest() {
    setTestStatus('loading');
    setTestMessage('');
    try {
      const effectiveBaseUrl = baseUrl.trim() || currentPreset?.baseUrl || '';
      if (provider === 'openai-compatible' && !effectiveBaseUrl) {
        setTestStatus('error');
        setTestMessage('自定义兼容端点必须填写 Base URL');
        return;
      }
      if (!apiKey.trim()) {
        setTestStatus('error');
        setTestMessage('请先填写 API 密钥');
        return;
      }
      if (!modelId.trim()) {
        setTestStatus('error');
        setTestMessage('请先填写模型 ID');
        return;
      }

      const model = getModel({
        provider,
        apiKey: apiKey.trim(),
        modelId: modelId.trim(),
        baseUrl: effectiveBaseUrl || undefined,
      });

      let text = '';
      try {
        const result = await generateText({
          model,
          prompt: '请回复"OK"，不要说任何其他内容。',
          temperature: 0,
          abortSignal: AbortSignal.timeout(20_000),
          maxRetries: 0,
        });
        text = result.text;
        logAiGeneratedContent({
          phase: 'settings-test',
          mode: 'generateText',
          status: 'success',
          content: text,
        });
      } catch (error) {
        logAiGeneratedContent({
          phase: 'settings-test',
          mode: 'generateText',
          status: 'failure',
          content: getAiErrorContent(error, text),
          error,
        });
        throw error;
      }

      if (text && text.trim().length > 0) {
        setTestStatus('ok');
        setTestMessage(`模型已生效，返回内容：${text.trim().slice(0, 60)}`);
      } else {
        setTestStatus('error');
        setTestMessage('模型返回内容为空，请检查配置');
      }
    } catch (err) {
      setTestStatus('error');
      const msg = err?.message || String(err);
      if (msg.includes('API key') || msg.includes('api_key') || msg.includes('Unauthorized') || msg.includes('401')) {
        setTestMessage('API 密钥无效，请检查后重试');
      } else if (msg.includes('timeout') || err?.name === 'TimeoutError') {
        setTestMessage('请求超时，请检查网络或 Base URL');
      } else if (msg.includes('model') || msg.includes('404')) {
        setTestMessage('模型 ID 不存在，请确认模型名称');
      } else {
        setTestMessage(`连接失败：${msg.slice(0, 80)}`);
      }
    }
  }

  async function handleTtsTest() {
    setTtsTestStatus('loading');
    setTtsTestMessage('');

    const endpoint = ttsBaseUrl.trim();
    const apiKeyTrimmed = ttsApiKey.trim();
    const modelIdTrimmed = ttsModelId.trim();
    const voiceTrimmed = ttsVoice.trim();

    if (!endpoint) {
      setTtsTestStatus('error');
      setTtsTestMessage('请先填写 Base URL');
      return;
    }
    if (!apiKeyTrimmed) {
      setTtsTestStatus('error');
      setTtsTestMessage('请先填写 TTS API 密钥');
      return;
    }
    if (!modelIdTrimmed) {
      setTtsTestStatus('error');
      setTtsTestMessage('请先填写 TTS 模型 ID');
      return;
    }
    if (!voiceTrimmed) {
      setTtsTestStatus('error');
      setTtsTestMessage('请先填写音色 Voice');
      return;
    }

    try {
      const audioBlob = await requestTtsAudioBlob('こんにちは！', {
        provider: ttsProvider,
        baseUrl: endpoint,
        modelId: modelIdTrimmed,
        apiKey: apiKeyTrimmed,
        voice: voiceTrimmed,
        format: 'mp3',
        sampleRate: 24000,
        rate: 1.0,
        bitRate: 64,
      });

      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      if (ttsAudioUrlRef.current) {
        URL.revokeObjectURL(ttsAudioUrlRef.current);
        ttsAudioUrlRef.current = null;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      ttsAudioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      ttsAudioRef.current = audio;
      await audio.play();

      setTtsTestStatus('ok');
      setTtsTestMessage('试音成功，已播放「こんにちは！」');
    } catch (err) {
      setTtsTestStatus('error');
      const msg = err?.message || String(err);
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        setTtsTestMessage('TTS API 密钥无效，请检查后重试');
      } else if (msg.includes('timeout')) {
        setTtsTestMessage('TTS 请求超时，请检查网络或 Base URL');
      } else {
        setTtsTestMessage(`试音失败：${msg.slice(0, 160)}`);
      }
    }
  }

  const showRequiredHint = provider === 'openai-compatible';
  const appearanceSummary = `${activeIconSkinLabel} · ${activeWordChipMotionLabel}`;
  const aiSummary = isAiConfigured ? `${providerLabel} · ${modelId.trim()}` : '尚未配置模型或密钥';
  const ttsSummary = isTtsConfigured ? `${ttsProviderLabel} · ${ttsVoice.trim()}` : '尚未配置音频模型';
  const thinkingSummary = `当前：${activeThinkingDepthLabel}`;

  return (
    <div className="scroll-y" style={{ height: '100vh', overflowY: 'auto', background: 'linear-gradient(180deg, #F5F3FF 0%, #EEF2FF 100%)' }}>
      <div style={{
        background: 'linear-gradient(155deg, var(--tp) 0%, var(--tp-from) 100%)',
        padding: '14px 16px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'grid',
        gridTemplateColumns: '80px 1fr 80px',
        alignItems: 'center',
        columnGap: 8,
      }}>
        <button
          ref={backBtnRef}
          type="button"
          onClick={() => {
            gsap.timeline()
              .to(backBtnRef.current, { scale: 0.88, duration: 0.08, ease: 'power2.in' })
              .to(backBtnRef.current, { scale: 1, duration: 0.18, ease: 'back.out(2.5)' })
              .call(() => navigate(-1));
          }}
          style={{
            background: 'rgba(255,255,255,0.18)',
            borderRadius: 12, padding: '6px 14px',
            color: 'white', fontSize: 13, fontWeight: 700,
            backdropFilter: 'blur(4px)',
            border: 'none', cursor: 'pointer',
            justifySelf: 'start',
          }}
        >
          ← 返回
        </button>
        <h1 style={{ color: 'white', fontSize: 20, fontWeight: 800, textAlign: 'center', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <img src={settingImg} alt="设置" width={22} height={22} style={{ objectFit: 'contain' }} /> 设置
        </h1>
        <div aria-hidden="true" />
      </div>

      <div ref={pageRef} style={{ padding: '18px 16px 40px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{
          background: 'rgba(255,255,255,0.76)',
          border: '1.5px solid rgba(237,233,254,0.95)',
          borderRadius: 16,
          padding: '12px 14px',
          marginBottom: 14,
          boxShadow: '0 4px 16px rgba(91,79,233,0.07)',
        }}>
          <p style={{ fontSize: 12, color: '#5B21B6', fontWeight: 800, margin: '0 0 4px' }}>本地配置</p>
          <p style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.6, margin: 0 }}>
            API 密钥仅保存在本地设备，不会上传至任何服务器。
          </p>
        </div>

        <SettingsPanel
          panelRef={node => setPanelRef('appearance', node)}
          title="界面设置"
          summary={appearanceSummary}
          tone="#8B5CF6"
          open={isPanelOpen('appearance')}
          onToggle={() => togglePanel('appearance')}
        >
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>图标组</label>
            <div style={selectShellStyle}>
              <select
                value={activeIconSkin}
                onChange={e => setIconSkin(e.target.value)}
                style={selectStyle}
              >
                {ICON_SKINS.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}{opt.isDefault ? '（默认）' : ''}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>

          <div>
            <label style={labelStyle}>选词交互类型</label>
            <div style={selectShellStyle}>
              <select
                value={activeWordChipMotion}
                onChange={e => setWordChipMotion(e.target.value)}
                style={selectStyle}
              >
                {WORD_CHIP_MOTION_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}{opt.isDefault ? '（默认）' : ''}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>
        </SettingsPanel>

        <SettingsPanel
          panelRef={node => setPanelRef('ai', node)}
          title="LLM 模型配置"
          summary={aiSummary}
          tone="#6366F1"
          open={isPanelOpen('ai')}
          onToggle={() => togglePanel('ai')}
        >
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>模型提供商</label>
            <div style={selectShellStyle}>
              <select
                value={provider}
                onChange={e => handleProviderChange(e.target.value)}
                style={selectStyle}
              >
                {PROVIDER_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>
              Base URL
              {showRequiredHint && <span style={{ color: '#EF4444', marginLeft: 4 }}>*必填</span>}
              {!showRequiredHint && <span style={{ color: '#9CA3AF', marginLeft: 4, fontWeight: 500 }}>（可覆盖默认地址）</span>}
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder={currentPreset?.baseUrl || '例如 https://api.openai.com/v1'}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>模型 ID</label>
            <input
              type="text"
              value={modelId}
              onChange={e => setModelId(e.target.value)}
              placeholder={getModelIdPlaceholder(provider)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>API 密钥</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                style={{ ...inputStyle, padding: '11px 44px 11px 14px' }}
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                aria-label={showKey ? '隐藏 API 密钥' : '显示 API 密钥'}
                title={showKey ? '隐藏 API 密钥' : '显示 API 密钥'}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9CA3AF', padding: 2,
                }}
              >
                <VisibilityIcon visible={showKey} />
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>API 请求类型</label>
            <div style={selectShellStyle}>
              <select
                value={requestMode}
                onChange={e => setRequestMode(e.target.value)}
                style={selectStyle}
              >
                {REQUEST_MODE_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>

          <button
            type="button"
            onClick={handleTest}
            disabled={testStatus === 'loading'}
            className="btn-press"
            style={{
              width: '100%', padding: '12px 0', marginBottom: 10,
              borderRadius: 14, border: 'none',
              background: testStatus === 'loading' ? '#E5E7EB' : 'linear-gradient(135deg, var(--tp-from), var(--tp))',
              color: testStatus === 'loading' ? '#9CA3AF' : 'white',
              fontSize: 14, fontWeight: 800,
              cursor: testStatus === 'loading' ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {testStatus === 'loading' ? '⏳ 测试中...' : '🔌 测试模型是否生效'}
          </button>

          {testStatus && testStatus !== 'loading' && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: testStatus === 'ok' ? '#F0FDF4' : '#FEF2F2',
              border: `1.5px solid ${testStatus === 'ok' ? '#BBF7D0' : '#FECACA'}`,
              marginBottom: 14,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: testStatus === 'ok' ? '#15803D' : '#DC2626' }}>
                {testStatus === 'ok' ? '✅ ' : '❌ '}{testMessage}
              </span>
            </div>
          )}
        </SettingsPanel>

        <SettingsPanel
          panelRef={node => setPanelRef('tts', node)}
          title="TTS 模型配置"
          summary={ttsSummary}
          tone="#0EA5E9"
          open={isPanelOpen('tts')}
          onToggle={() => togglePanel('tts')}
        >
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>音频提供商</label>
            <div style={selectShellStyle}>
              <select
                value={ttsProvider}
                onChange={e => handleTtsProviderChange(e.target.value)}
                style={selectStyle}
              >
                {TTS_PROVIDER_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Base URL</label>
            <input
              type="text"
              value={ttsBaseUrl}
              onChange={e => setTtsBaseUrl(e.target.value)}
              placeholder={currentTtsPreset?.baseUrl || ''}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>模型 ID</label>
            <input
              type="text"
              value={ttsModelId}
              onChange={e => setTtsModelId(e.target.value)}
              placeholder={currentTtsPreset?.modelId || '模型 ID'}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>TTS API 密钥</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showTtsKey ? 'text' : 'password'}
                value={ttsApiKey}
                onChange={e => setTtsApiKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                style={{ ...inputStyle, padding: '11px 44px 11px 14px' }}
              />
              <button
                type="button"
                onClick={() => setShowTtsKey(v => !v)}
                aria-label={showTtsKey ? '隐藏 TTS API 密钥' : '显示 TTS API 密钥'}
                title={showTtsKey ? '隐藏 TTS API 密钥' : '显示 TTS API 密钥'}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9CA3AF', padding: 2,
                }}
              >
                <VisibilityIcon visible={showTtsKey} />
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>音色 Voice</label>
            <input
              type="text"
              value={ttsVoice}
              onChange={e => setTtsVoice(e.target.value)}
              placeholder={currentTtsPreset?.voice || '音色 Voice'}
              style={inputStyle}
            />
          </div>

          <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 14px 0', lineHeight: 1.55 }}>
            {getTtsProviderHint(ttsProvider)}
          </p>

          <button
            type="button"
            onClick={handleTtsTest}
            disabled={ttsTestStatus === 'loading'}
            className="btn-press"
            style={{
              width: '100%', padding: '12px 0', marginBottom: 10,
              borderRadius: 14, border: 'none',
              background: ttsTestStatus === 'loading' ? '#E5E7EB' : 'linear-gradient(135deg, var(--tp-from), var(--tp))',
              color: ttsTestStatus === 'loading' ? '#9CA3AF' : 'white',
              fontSize: 14, fontWeight: 800,
              cursor: ttsTestStatus === 'loading' ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {ttsTestStatus === 'loading' ? '⏳ 试音中...' : '🔊 测试音色（こんにちは！）'}
          </button>

          {ttsTestStatus && ttsTestStatus !== 'loading' && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: ttsTestStatus === 'ok' ? '#F0FDF4' : '#FEF2F2',
              border: `1.5px solid ${ttsTestStatus === 'ok' ? '#BBF7D0' : '#FECACA'}`,
              marginBottom: 14,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: ttsTestStatus === 'ok' ? '#15803D' : '#DC2626' }}>
                {ttsTestStatus === 'ok' ? '✅ ' : '❌ '}{ttsTestMessage}
              </span>
            </div>
          )}
        </SettingsPanel>

        <SettingsPanel
          panelRef={node => setPanelRef('thinking', node)}
          title="思考深度"
          summary={thinkingSummary}
          tone="#F59E0B"
          open={isPanelOpen('thinking')}
          onToggle={() => togglePanel('thinking')}
        >
          {THINKING_DEPTH_OPTIONS.map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              className="btn-press"
              onClick={() => setThinkingDepthStore(opt.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 12px',
                marginBottom: i < THINKING_DEPTH_OPTIONS.length - 1 ? 6 : 0,
                borderRadius: 12,
                border: `2px solid ${thinkingDepth === opt.id ? 'var(--tp)' : '#E5E7EB'}`,
                background: thinkingDepth === opt.id ? '#F0EEFF' : '#F9FAFB',
                cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{opt.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: thinkingDepth === opt.id ? 'var(--tp)' : '#1E1B4B' }}>
                    {opt.label}
                  </span>
                  {opt.id === 'deep' && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--tp-lite)', color: 'var(--tp)', padding: '1px 7px', borderRadius: 20 }}>
                      默认
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>{opt.desc}</p>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                border: `2.5px solid ${thinkingDepth === opt.id ? 'var(--tp)' : '#D1D5DB'}`,
                background: thinkingDepth === opt.id ? 'var(--tp)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {thinkingDepth === opt.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
              </div>
            </button>
          ))}

          {thinkingDepth === 'deep' && (
            <div style={{ background: '#FEF3C7', border: '1.5px solid #FCD34D', borderRadius: 10, padding: '10px 12px', marginTop: 10 }}>
              <p style={{ fontSize: 12, color: '#92400E', margin: 0, lineHeight: 1.6 }}>
                ⏳ 深度思考模式下，AI 推理过程较长，生成章节可能需要 1~3 分钟，取决于模型的首字延迟和TPS。若希望加快生成，可切换为「标准」或「快速」模式。
              </p>
            </div>
          )}

          <div style={{ background: '#F8FAFC', border: '1.5px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', marginTop: 10 }}>
            <p style={{ fontSize: 12, color: '#4B5563', margin: 0, lineHeight: 1.6 }}>
              使用 OpenAI、Google、Anthropic 以外的模型可能不支持 reasoning_effort 推理深度设置。当模型不支持时，会尝试添加 thinking_budget 参数来限制推理预算。如果调用 AI 生成时出错，请切换为深度思考模式。深度思考模式下将不再限制推理预算。
            </p>
          </div>
        </SettingsPanel>

        <AboutAppSection />
      </div>
    </div>
  );
}

function getModelIdPlaceholder(provider) {
  const map = {
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    google: 'gemini-2.0-flash',
    deepseek: 'deepseek-chat',
    'aliyun-bailian': 'qwen-plus',
    moonshot: 'moonshot-v1-8k',
    zhipu: 'glm-4-flash',
    volcengine: 'doubao-pro-4k',
    'baidu-qianfan': 'ernie-4.0-8k',
    'tencent-hunyuan': 'hunyuan-turbos-latest',
    minimax: 'minimax-text-01',
    'openai-compatible': 'your-model-id',
  };
  return map[provider] || '模型 ID';
}

function getTtsProviderHint(provider) {

  if (provider === 'aliyun-cosyvoice') {
    return '访问 https://bailian.console.aliyun.com/ 进行开通';
  }

  if (provider === 'aliyun-qwen-tts') {
    return '访问 https://bailian.console.aliyun.com/ 进行开通';
  }

  if (provider === 'aliyun-minimax-tts') {
    return '访问 https://bailian.console.aliyun.com/ 进行开通';
  }

  if (provider === 'minimax-official-tts') {
    return '访问 https://platform.minimaxi.com/console/personal-info 进行开通';
  }

  if (provider === 'volcengine-doubao-tts') {
    return '访问 https://www.volcengine.com/product/tts 进行开通';
  }

  return '未配置 TTS 时，APP 基础功能不受影响，但语音输出相关功能无法使用。';
}
