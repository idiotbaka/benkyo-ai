import { useState, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import useCourseStore from '../../store/courseStore';
import useAiStore from '../../store/aiStore';
import useUserStore from '../../store/userStore';
import { generateFirstChapter } from '../../lib/generate-chapter';
import { acquireKeepScreenAwake, releaseKeepScreenAwake } from '../../lib/keep-screen-awake';
import { useIcon } from '../../lib/icons';
import EstimatedProgressBar from '../UI/EstimatedProgressBar';

gsap.registerPlugin(useGSAP);

// ─── Question definitions ──────────────────────────────────────────────────────

const TOPIC_OPTIONS = {
  beginner: [
    { value: '日常问候用语', label: '日常问候', desc: 'こんにちは、ありがとう…' },
    { value: '数字与颜色', label: '数字与颜色', desc: '1・2・3 和颜色词汇' },
    { value: '自我介绍基础', label: '自我介绍', desc: '我叫…，来自…' },
    { value: '家族称谓', label: '家族称谓', desc: '家庭成员的日语叫法' },
    { value: '食物与饮食词汇', label: '食物词汇', desc: '寿司、拉面等常见食物' },
    { value: '日常物品名称', label: '日常物品', desc: '身边常见事物的说法' },
    { value: '时间与日期表达', label: '时间日期', desc: '几点了？今天几号？' },
    { value: '身体部位词汇', label: '身体部位', desc: '头、手、脚等身体词汇' },
    { value: '动物名称词汇', label: '动物词汇', desc: '猫、狗、熊猫等动物' },
    { value: '天气与气候表达', label: '天气表达', desc: '晴れ、雨、雪等天气词' },
    { value: '国家与地名', label: '国家地名', desc: '日本各地与世界国家' },
    { value: '购物基础用语', label: '购物基础', desc: '这个多少钱？我要买…' },
    { value: '交通工具词汇', label: '交通工具', desc: '电车、公交、出租车' },
    { value: '情绪与感受表达', label: '情绪词汇', desc: '高兴、难过、累了等' },
    { value: '地点与方向', label: '地点与方向', desc: '指路和方位表达' },
    { value: '兴趣爱好表达', label: '兴趣爱好', desc: '好きなこと・趣味' },
  ],
  elementary: [
    { value: '自我介绍', label: '自我介绍', desc: '用日语说「我是…」' },
    { value: '日常问候与礼貌用语', label: '礼貌用语', desc: '各种场合的寒暄' },
    { value: '数字与时间', label: '数字与时间', desc: '说出时间和日期' },
    { value: '地点与方向', label: '地点与方向', desc: '指路和方位表达' },
    { value: '购物与讨价还价', label: '购物对话', desc: '在商店买东西的表达' },
    { value: '餐厅点餐用语', label: '餐厅点餐', desc: '菜单、点菜、结账' },
    { value: '交通出行表达', label: '交通出行', desc: '乘车、问路、换乘' },
    { value: '家庭与亲属关系', label: '家庭关系', desc: '家人和亲戚的称呼' },
    { value: '职业与工作场景', label: '职业词汇', desc: '常见职业和工作用语' },
    { value: '天气与四季变化', label: '天气季节', desc: '描述天气和季节' },
    { value: '兴趣爱好表达', label: '兴趣爱好', desc: '好きなこと・趣味' },
    { value: '身体与健康表达', label: '健康用语', desc: '身体不舒服时怎么说' },
    { value: '颜色与形状描述', label: '颜色形状', desc: '用日语描述外观' },
    { value: '日常活动动词', label: '日常活动', desc: '吃饭、睡觉、工作等' },
    { value: '电话与通讯用语', label: '电话用语', desc: '打电话、发消息' },
    { value: '邀约与约定表达', label: '邀约表达', desc: '一起去…好吗？' },
  ],
  n5: [
    { value: '名词句与判断助动词', label: '名词句', desc: '〜は〜です 句型' },
    { value: '动词基础变形', label: '动词变形', desc: 'ます形和て形基础' },
    { value: '形容词与描述', label: '形容词', desc: 'い形容词和な形容词' },
    { value: '助词综合用法', label: '助词用法', desc: 'は・が・を・に 等' },
    { value: '存在动词あります与います', label: '存在表达', desc: '物と人的存在句型' },
    { value: '数量与计数助词', label: '计数助词', desc: '一つ・二本・三枚 等' },
    { value: '地点与移动表达', label: '地点移动', desc: '去哪里？在哪里？' },
    { value: '时间词汇与表达', label: '时间词汇', desc: '昨日・今日・明日等' },
    { value: '购物与金钱表达', label: '购物金钱', desc: '价格、买卖相关词汇' },
    { value: '食物与饮食相关', label: '饮食词汇', desc: '餐厅、食物、口味' },
    { value: '趣味与爱好描述', label: '趣味爱好', desc: 'Nが好きです 句型' },
    { value: '日常活动常用动词', label: '常用动词', desc: '食べる・飲む・見る 等' },
    { value: 'ない形否定用法', label: '否定用法', desc: '动词否定句的构成' },
    { value: 'て形与请求表达', label: 'て形基础', desc: '〜てください 句型' },
    { value: '形容词变化与用法', label: '形容词变形', desc: '形容词的过去否定形' },
    { value: '自然与环境词汇', label: '自然词汇', desc: '山・川・海・空 等' },
  ],
  n4: [
    { value: 'て形与复合句', label: 'て形复合句', desc: '连接多个动作或状态' },
    { value: '敬语与礼貌表达', label: '敬语表达', desc: '职场和正式场合用语' },
    { value: '条件句与假设', label: '条件句型', desc: 'たら・ば・と 的用法' },
    { value: '授受动词与状态变化', label: '授受动词', desc: 'あげる・もらう・くれる' },
    { value: 'た形与过去时态', label: '过去时态', desc: '过去式和过去完成' },
    { value: '可能形与能力表达', label: '可能形', desc: '〜ことができる 句型' },
    { value: '意志形与意图表达', label: '意志形', desc: '〜つもり・〜と思う' },
    { value: '被动形与自他动词', label: '被动句型', desc: '被动句的结构与用法' },
    { value: '使役形与指示表达', label: '使役句型', desc: '让某人做…的表达' },
    { value: '复合助词与连接', label: '复合助词', desc: 'について・によって 等' },
    { value: '敬语体系深化', label: '敬语深化', desc: '尊敬语与谦让语' },
    { value: '接续词与文章逻辑', label: '接续词', desc: 'しかし・だから・また 等' },
    { value: '形式名词こと与もの', label: '形式名词', desc: '〜ことがある 等用法' },
    { value: '引用与传闻表达', label: '引用表达', desc: '〜そうだ・〜らしい' },
    { value: '时间顺序与先后表达', label: '时间顺序', desc: '〜前に・〜後で 等' },
    { value: '比较与对比句型', label: '比较句型', desc: 'AよりB・AほどB 等' },
  ],
  n3: [
    { value: '条件表达的细微差别', label: '条件表达', desc: 'たら・ば・なら・と 的辨析' },
    { value: '推测与可能性表达', label: '推测表达', desc: '〜ようだ・〜みたいだ・〜らしい' },
    { value: '意志计划与决定', label: '意志计划', desc: '〜ことにする・〜ことになる' },
    { value: '原因理由与转折', label: '原因转折', desc: '〜ために・〜のに・〜おかげで' },
    { value: '动作状态与变化', label: '状态变化', desc: '〜ていく・〜てくる・〜ようになる' },
    { value: '日常会话中的省略表达', label: '会话省略', desc: '更自然地理解和回应对话' },
    { value: '旅行突发状况沟通', label: '旅行应对', desc: '问询、说明和解决问题' },
    { value: '短文阅读与信息提取', label: '短文阅读', desc: '通知、邮件和生活文章' },
  ],
  n2: [
    { value: '复合助词与书面表达', label: '复合助词', desc: '〜に対して・〜に関して 等' },
    { value: '高级条件与假设表达', label: '高级条件', desc: '〜限り・〜以上・〜ものなら' },
    { value: '因果关系与逻辑连接', label: '逻辑连接', desc: '梳理较复杂文章的论证关系' },
    { value: '正式场合的敬语运用', label: '正式敬语', desc: '商务和公共场合的得体表达' },
    { value: '新闻报道常用表达', label: '新闻表达', desc: '理解报道中的书面句式' },
    { value: '职场邮件与联络', label: '职场邮件', desc: '确认、请求、汇报与致歉' },
    { value: '抽象话题意见表达', label: '意见表达', desc: '阐述立场并回应不同看法' },
    { value: '长句结构分析', label: '长句分析', desc: '拆解修饰关系和句子主干' },
  ],
  n1: [
    { value: '高级语法辨析与语感', label: '高级语法', desc: '掌握相近句型的使用边界' },
    { value: '社论与评论文章阅读', label: '评论阅读', desc: '理解抽象论述和隐含立场' },
    { value: '正式演讲与观点陈述', label: '正式演讲', desc: '清晰组织复杂观点' },
    { value: '惯用表达与四字熟语', label: '惯用表达', desc: '提升书面和口头表达密度' },
    { value: '商务谈判与提案', label: '商务提案', desc: '说明方案、权衡与推进决策' },
    { value: '文学作品中的表达', label: '文学阅读', desc: '感受语气、修辞和叙事风格' },
    { value: '社会议题深入讨论', label: '社会议题', desc: '表达分析、反驳和总结' },
    { value: '高阶听力与即时概括', label: '高阶听力', desc: '抓住访谈和讲座的重点' },
  ],
  advanced: [
    { value: '自然口语与语气调整', label: '自然口语', desc: '根据关系和场合切换说法' },
    { value: '日语写作润色与改写', label: '写作润色', desc: '让表达更准确、流畅和自然' },
    { value: '复杂话题即兴讨论', label: '即兴讨论', desc: '快速组织并展开完整观点' },
    { value: '跨文化沟通中的语用', label: '跨文化沟通', desc: '理解言外之意和沟通习惯' },
    { value: '影视作品与流行表达', label: '影视表达', desc: '辨析真实口语、俚语和语气' },
    { value: '专业文章精读', label: '专业精读', desc: '处理高密度信息与复杂结构' },
    { value: '发音节奏与表达感染力', label: '发音节奏', desc: '改善停顿、重音和连贯表达' },
    { value: '日语思维与语感训练', label: '语感训练', desc: '减少逐句翻译，提升自然度' },
  ],
};

const QUESTIONS = [
  {
    id: 'level',
    title: '你的日语水平？',
    emoji: '🎓',
    options: [
      { value: 'beginner',    label: '初学者', desc: '只能够认识假名' },
      { value: 'elementary',  label: '入门',   desc: '会一些简单的词汇' },
      { value: 'n5',          label: '初级 N5', desc: '掌握基础语法和常用词汇' },
      { value: 'n4',          label: '初级 N4', desc: '能理解简单日常对话' },
      { value: 'n3',          label: '中级 N3', desc: '能理解日常话题和短篇文章' },
      { value: 'n2',          label: '中高级 N2', desc: '能处理较复杂的文章和对话' },
      { value: 'n1',          label: '高级 N1', desc: '能理解广泛场景中的日语' },
      { value: 'advanced',    label: '高阶强化', desc: '通过能力考试后继续提升语感' },
    ],
  },
  {
    id: 'pace',
    title: '希望的学习节奏？',
    emoji: '⏱️',
    options: [
      { value: 'relaxed',    label: '轻松随意', desc: '每章 1 个语法 · 5 节课' },
      { value: 'steady',     label: '稳步推进', desc: '每章 2 个语法 · 6 节课' },
      { value: 'fast',       label: '快速入门', desc: '每章 3 个语法 · 7 节课' },
      { value: 'intensive',  label: '密集冲刺', desc: '每章 4 个语法 · 8 节课' },
    ],
  },
  {
    id: 'purpose',
    title: '学习日语的用途？',
    emoji: '🎯',
    options: [
      { value: 'hobby',   label: '兴趣爱好', desc: '喜欢日本文化、动漫' },
      { value: 'travel',  label: '旅游出行', desc: '计划去日本旅行' },
      { value: 'work',    label: '工作 / 学业', desc: '职场沟通或学术需要' },
      { value: 'exam',    label: '考试备考', desc: 'JLPT 等日语考试' },
    ],
  },
  {
    id: 'style',
    title: '偏好的课程风格？',
    emoji: '✨',
    options: [
      { value: 'fun',            label: '轻松有趣', desc: '游戏化，轻松愉快地学' },
      { value: 'systematic',     label: '系统专业', desc: '扎实语法，循序渐进' },
      { value: 'conversational', label: '情景对话', desc: '贴近实际使用场景' },
      { value: 'balanced',       label: '综合均衡', desc: '全面覆盖，均衡发展' },
    ],
  },
  {
    id: 'topic',
    title: '第一课想学什么？',
    emoji: '📖',
    isDynamic: true, // options depend on answers.level
  },
  {
    id: 'extra',
    type: 'textarea',
    title: '还有什么想补充的？',
    emoji: '💬',
    placeholder: '例如：想多练习会话、有特定想学的词汇、对某个语法有疑问…（可跳过）',
  },
];

const TOTAL_STEPS = QUESTIONS.length;
const LEVEL_PAGE_SIZE = 4;
const TOPIC_PAGE_SIZE = 4;

// ─── Progress steps for generation phase ──────────────────────────────────────

const GEN_STEPS = [
  { icon: '🏗️', label: '规划课程结构' },
  { icon: '📚', label: '生成语法讲解' },
  { icon: '📝', label: '生成第一关题目' },
];

// ─── Main component ────────────────────────────────────────────────────────────

export default function CreateCourseSheet({ onClose, onDone }) {
  const [phase, setPhase] = useState('wizard'); // 'wizard' | 'generating' | 'error'
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [levelPage, setLevelPage] = useState(0);
  const [topicPage, setTopicPage] = useState(0);
  const [genStep, setGenStep] = useState(0);
  const [genMsg, setGenMsg] = useState(GEN_STEPS[0].label);
  const [genProgress, setGenProgress] = useState(0);
  const [error, setError] = useState('');

  const overlayRef = useRef(null);
  const sheetRef = useRef(null);
  const contentRef = useRef(null);
  const abortRef = useRef(null);
  const generationCheckpointRef = useRef(null);

  const setChapters = useCourseStore(s => s.setChapters);
  const setLearningProfile = useUserStore(s => s.setLearningProfile);

  // ── Entry animation ─────────────────────────────────────────────────────────
  useGSAP(() => {
    gsap.set([overlayRef.current, sheetRef.current], { opacity: 0 });
    gsap.set(sheetRef.current, { y: '100%' });
  });

  useGSAP(() => {
    gsap.to(overlayRef.current, { opacity: 1, duration: 0.15 });
    gsap.to(sheetRef.current, { opacity: 1, y: '0%', duration: 0.2, ease: 'power3.out' });
  }, []);

  // ── Content fade on step change ─────────────────────────────────────────────
  useGSAP(() => {
    if (!contentRef.current) return;
    gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' }
    );
  }, [step, phase]);

  // ── Close handler (with exit animation) ────────────────────────────────────
  const doClose = useCallback(() => {
    abortRef.current?.abort();
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2 });
    gsap.to(sheetRef.current, { y: '100%', duration: 0.28, ease: 'power3.in', onComplete: onClose });
  }, [onClose]);

  const doDone = useCallback(() => {
    abortRef.current?.abort();
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2 });
    gsap.to(sheetRef.current, { y: '100%', duration: 0.28, ease: 'power3.in', onComplete: onDone });
  }, [onDone]);

  // ── Wizard navigation ───────────────────────────────────────────────────────
  const currentQ = QUESTIONS[step];
  const currentAnswer = answers[currentQ?.id] ?? '';

  const canNext = currentQ?.type === 'textarea'
    ? true                   // textarea is always skippable
    : Boolean(currentAnswer); // option questions require selection

  const handleSelect = (value) => {
    setAnswers(prev => {
      const next = { ...prev, [currentQ.id]: value };
      // Reset topic selection when level changes
      if (currentQ.id === 'level') {
        delete next.topic;
        setTopicPage(0);
      }
      return next;
    });
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(s => s + 1);
    } else {
      handleGenerate();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
    else doClose();
  };

  const handleSkip = () => {
    // Only for textarea question
    setAnswers(prev => ({ ...prev, [currentQ.id]: '' }));
    handleGenerate();
  };

  // ── Generation ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const finalAnswers = { ...answers };    // Read config at call time to avoid reactive selector infinite loop
    const aiConfig = useAiStore.getState().getConfig();
    // Persist learning profile (Q1–Q4)
    setLearningProfile({
      level:   finalAnswers.level,
      pace:    finalAnswers.pace,
      purpose: finalAnswers.purpose,
      style:   finalAnswers.style,
    });

    setPhase('generating');
    const savedCheckpoint = generationCheckpointRef.current;
    const resumeStep = savedCheckpoint?.grammarSections ? 2 : savedCheckpoint?.scaffold ? 1 : 0;
    setGenStep(resumeStep);
    setGenMsg(GEN_STEPS[resumeStep]?.label || GEN_STEPS[0].label);
    setGenProgress(savedCheckpoint?.grammarSections ? 2 / 3 : savedCheckpoint?.scaffold ? 1 / 3 : 0);

    const controller = new AbortController();
    abortRef.current = controller;
    const keepAwakeToken = acquireKeepScreenAwake('first-chapter-generation');

    try {
      const chapter = await generateFirstChapter(
        aiConfig,
        finalAnswers,
        {
          onProgress: ({ stepIndex, overallProgress, message }) => {
            setGenStep(stepIndex);
            setGenProgress(overallProgress);
            setGenMsg(message || GEN_STEPS[stepIndex]?.label || '');
          },
          resumeState: savedCheckpoint,
          onCheckpoint: checkpoint => {
            generationCheckpointRef.current = {
              ...(generationCheckpointRef.current ?? {}),
              ...checkpoint,
            };
          },
          signal: controller.signal,
        }
      );

      generationCheckpointRef.current = null;
      setChapters([chapter]);
      doDone();
    } catch (err) {
      if (err?.name === 'AbortError') return; // user cancelled
      console.error('[CreateCourseSheet] generation error:', err);
      setError(err?.message || '课程生成失败，请检查 AI 配置后重试。');
      setPhase('error');
    } finally {
      releaseKeepScreenAwake(keepAwakeToken);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  };

  const handleRetry = () => {
    setError('');
    void handleGenerate();
  };

  // ── Topic options (dynamic based on level answer, paginated) ───────────────
  const allLevelOptions = QUESTIONS[0].options;
  const levelPageCount = Math.ceil(allLevelOptions.length / LEVEL_PAGE_SIZE);
  const levelOptions = allLevelOptions.slice(levelPage * LEVEL_PAGE_SIZE, (levelPage + 1) * LEVEL_PAGE_SIZE);
  const allTopicOptions = TOPIC_OPTIONS[answers.level] ?? TOPIC_OPTIONS.beginner;
  const topicPageCount = Math.ceil(allTopicOptions.length / TOPIC_PAGE_SIZE);
  const topicOptions = allTopicOptions.slice(topicPage * TOPIC_PAGE_SIZE, (topicPage + 1) * TOPIC_PAGE_SIZE);

  const handleLevelPageChange = (direction) => {
    setLevelPage(page => page + direction);
    setTopicPage(0);
    setAnswers(prev => {
      const next = { ...prev };
      delete next.level;
      delete next.topic;
      return next;
    });
  };

  const handleTopicPageChange = () => {
    const nextPage = (topicPage + 1) % topicPageCount;
    setTopicPage(nextPage);
    // Clear topic selection since options have changed
    setAnswers(prev => {
      const next = { ...prev };
      delete next.topic;
      return next;
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.55)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) doClose(); }}
    >
      <div
        ref={sheetRef}
        style={{
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#1a1a2e' }}>
              ✨ 创建第一课
            </span>
            <button
              onClick={doClose}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#f0f0f5', border: 'none', cursor: 'pointer',
                fontSize: 16, color: '#666',
              }}
            >
              ✕
            </button>
          </div>

          {/* Progress dots (wizard phase only) */}
          {phase === 'wizard' && (
            <div style={{ display: 'flex', gap: 6, marginTop: 16, justifyContent: 'center' }}>
              {QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === step ? 20 : 8, height: 8,
                    borderRadius: 4,
                    background: i < step ? 'var(--tp)' : i === step ? 'var(--tp)' : '#e0e0ef',
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Scrollable content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 32px' }}>
          <div ref={contentRef}>
            {phase === 'wizard' && (
              <WizardContent
                question={currentQ}
                answer={currentAnswer}
                levelOptions={levelOptions}
                levelPage={levelPage}
                levelPageCount={levelPageCount}
                onLevelPageChange={handleLevelPageChange}
                topicOptions={topicOptions}
                topicPage={topicPage}
                topicPageCount={topicPageCount}
                onTopicPageChange={handleTopicPageChange}
                onSelect={handleSelect}
                onBack={handleBack}
                onNext={handleNext}
                onSkip={handleSkip}
                isFirst={step === 0}
                isLast={step === TOTAL_STEPS - 1}
                canNext={canNext}
              />
            )}

            {phase === 'generating' && (
              <GeneratingContent
                genStep={genStep}
                genMsg={genMsg}
                genProgress={genProgress}
              />
            )}

            {phase === 'error' && (
              <ErrorContent
                error={error}
                onRetry={handleRetry}
                onClose={doClose}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Wizard content ────────────────────────────────────────────────────────────

function WizardContent({ question, answer, levelOptions, levelPage, levelPageCount, onLevelPageChange, topicOptions, topicPage, topicPageCount, onTopicPageChange, onSelect, onBack, onNext, onSkip, isFirst, isLast, canNext }) {
  const options = question.isDynamic
    ? topicOptions
    : question.id === 'level'
      ? levelOptions
      : question.options;

  return (
    <div>
      {/* Question title */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>{question.emoji}</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
          {question.title}
        </h2>
      </div>

      {/* Options or textarea */}
      {question.type === 'textarea' ? (
        <TextareaField
          placeholder={question.placeholder}
          value={answer}
          onChange={(v) => onSelect(v)}
        />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {options.map(opt => (
              <OptionCard
                key={opt.value}
                label={opt.label}
                desc={opt.desc}
                selected={answer === opt.value}
                onSelect={() => onSelect(opt.value)}
              />
            ))}
          </div>
          {question.isDynamic && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <button
                onClick={onTopicPageChange}
                className="btn-press"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 18px', borderRadius: 20,
                  background: '#f0eeff', border: '1.5px solid #c5bef8',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--tp)',
                }}
              >
                换一批
                <span style={{ fontSize: 11, color: '#9d95d8', fontWeight: 400 }}>
                  {topicPage + 1}/{topicPageCount}
                </span>
              </button>
            </div>
          )}
          {question.id === 'level' && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => onLevelPageChange(-1)}
                disabled={levelPage === 0}
                className="btn-press"
                style={{
                  padding: '8px 14px', borderRadius: 20,
                  background: levelPage === 0 ? '#f5f5f7' : '#f0eeff',
                  border: levelPage === 0 ? '1.5px solid #e5e5ea' : '1.5px solid #c5bef8',
                  cursor: levelPage === 0 ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600,
                  color: levelPage === 0 ? '#c4c4cc' : 'var(--tp)',
                }}
              >
                ← 上一页
              </button>
              <span style={{ minWidth: 28, textAlign: 'center', fontSize: 12, color: '#9d95d8', fontWeight: 600 }}>
                {levelPage + 1}/{levelPageCount}
              </span>
              <button
                type="button"
                onClick={() => onLevelPageChange(1)}
                disabled={levelPage === levelPageCount - 1}
                className="btn-press"
                style={{
                  padding: '8px 14px', borderRadius: 20,
                  background: levelPage === levelPageCount - 1 ? '#f5f5f7' : '#f0eeff',
                  border: levelPage === levelPageCount - 1 ? '1.5px solid #e5e5ea' : '1.5px solid #c5bef8',
                  cursor: levelPage === levelPageCount - 1 ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600,
                  color: levelPage === levelPageCount - 1 ? '#c4c4cc' : 'var(--tp)',
                }}
              >
                下一页 →
              </button>
            </div>
          )}
        </>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
        <button
          onClick={onBack}
          className="btn-press"
          style={{
            flex: 1, padding: '14px 0', borderRadius: 14,
            background: '#f0f0f5', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 15, color: '#555',
          }}
        >
          {isFirst ? '取消' : '← 上一步'}
        </button>

        {question.type === 'textarea' ? (
          <>
            <button
              onClick={onSkip}
              className="btn-press"
              style={{
                flex: 1, padding: '14px 0', borderRadius: 14,
                background: '#f0f0f5', border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 15, color: '#555',
              }}
            >
              跳过
            </button>
            <button
              onClick={onNext}
              disabled={!answer?.trim()}
              className="btn-press"
              style={{
                flex: 1, padding: '14px 0', borderRadius: 14,
                background: answer?.trim() ? 'var(--tp)' : '#d0d0e8',
                border: 'none', cursor: answer?.trim() ? 'pointer' : 'not-allowed',
                fontWeight: 700, fontSize: 15, color: '#fff',
              }}
            >
              开始生成 🚀
            </button>
          </>
        ) : (
          <button
            onClick={onNext}
            disabled={!canNext}
            className="btn-press"
            style={{
              flex: 2, padding: '14px 0', borderRadius: 14,
              background: canNext ? 'var(--tp)' : '#d0d0e8',
              border: 'none', cursor: canNext ? 'pointer' : 'not-allowed',
              fontWeight: 700, fontSize: 15, color: '#fff',
            }}
          >
            {isLast ? '开始生成 🚀' : '下一步 →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Option card ───────────────────────────────────────────────────────────────

function OptionCard({ label, desc, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="btn-press"
      style={{
        padding: '14px 12px', borderRadius: 14, cursor: 'pointer',
        border: selected ? '2px solid var(--tp)' : '2px solid #e8e8f0',
        background: selected ? '#f0eeff' : '#fff',
        textAlign: 'left', transition: 'all 0.15s ease',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, color: selected ? 'var(--tp)' : '#1a1a2e', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4 }}>{desc}</div>
    </button>
  );
}

// ─── Textarea field ────────────────────────────────────────────────────────────

function TextareaField({ placeholder, value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      style={{
        width: '100%', padding: '14px', borderRadius: 14,
        border: '2px solid #e8e8f0', outline: 'none',
        fontSize: 14, color: '#1a1a2e', resize: 'none',
        fontFamily: 'inherit', lineHeight: 1.6,
        boxSizing: 'border-box',
        transition: 'border-color 0.15s ease',
      }}
      onFocus={(e) => { e.target.style.borderColor = 'var(--tp)'; }}
      onBlur={(e) => { e.target.style.borderColor = '#e8e8f0'; }}
    />
  );
}

// ─── Generating content ────────────────────────────────────────────────────────

function GeneratingContent({ genStep, genMsg, genProgress }) {
  const sdGenerateImg = useIcon('sd/sd_generate.png');

  return (
    <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
      {/* Pulsing mascot */}
      <div style={{ marginBottom: 24, animation: 'pulse 1.5s ease-in-out infinite' }}>
        <img src={sdGenerateImg} alt="AI 正在生成课程" width={148} height={148} style={{ objectFit: 'contain', margin: '0 auto' }} />
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>
        正在生成课程…
      </h2>
      <p style={{ fontSize: 14, color: '#888', margin: '0 0 32px' }}>
        AI 正在为你量身定制专属日语课程，请稍候
      </p>

      {/* Step indicator */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {GEN_STEPS.map((s, i) => {
          const isDone = i < genStep;
          const isActive = i === genStep;
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 12,
                background: isDone ? '#f0fdf4' : isActive ? '#f0eeff' : '#f8f8fc',
                border: isActive ? '1.5px solid var(--tp)' : '1.5px solid transparent',
                transition: 'all 0.3s ease',
              }}
            >
              <span style={{ fontSize: 20, minWidth: 28 }}>
                {isDone ? '✅' : isActive ? (
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                ) : s.icon}
              </span>
              <span style={{
                fontSize: 14, fontWeight: isActive ? 600 : 400,
                color: isDone ? '#16a34a' : isActive ? 'var(--tp)' : '#aaa',
              }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <EstimatedProgressBar progress={genProgress} label={genMsg} />

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Error content ─────────────────────────────────────────────────────────────

function ErrorContent({ error, onRetry, onClose }) {
  const sdErrorImg = useIcon('sd/sd2_error.png');

  return (
    <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
      <img src={sdErrorImg} alt="课程生成失败" width={132} height={132} style={{ display: 'block', objectFit: 'contain', margin: '0 auto 16px' }} />
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '0 0 12px' }}>
        课程生成失败
      </h2>
      <p style={{
        fontSize: 13, color: '#e74c3c', margin: '0 0 24px',
        background: '#fef2f2', borderRadius: 10, padding: '12px 16px',
        lineHeight: 1.6, textAlign: 'left',
      }}>
        {error}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onClose}
          className="btn-press"
          style={{
            flex: 1, padding: '14px 0', borderRadius: 14,
            background: '#f0f0f5', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 15, color: '#555',
          }}
        >
          稍后再试
        </button>
        <button
          onClick={onRetry}
          className="btn-press"
          style={{
            flex: 2, padding: '14px 0', borderRadius: 14,
            background: 'var(--tp)', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 15, color: '#fff',
          }}
        >
          重试一次 →
        </button>
      </div>
    </div>
  );
}
