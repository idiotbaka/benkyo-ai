# 日学 (Benkyo AI) - AI 工程指南

日语学习 App，交互参考 Duolingo。使用 React Web 技术栈，通过 Tauri v2 打包桌面端和 Android。
支持 AI 生成个性化课程、闯关练习、练习中心、语法教程、单词本、TTS 日语语音和 UI 音效。

本文件只保留 AI 快速理解代码所需的信息。实现细节以源码为准，修改前先读目标组件、store 和相邻工具函数，不要只凭本文假设行为。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| UI | React 19 函数组件 + Hooks |
| 构建 | Vite 8，`base: './'` 适配 Tauri |
| 样式 | TailwindCSS v4，通过 `@tailwindcss/vite` 集成 |
| 动画 | GSAP 3 + `@gsap/react` |
| 状态 | Zustand 5 + persist |
| 路由 | React Router DOM 7，必须使用 `HashRouter` |
| AI | Vercel AI SDK 6，多 provider |
| Schema | Zod 4，主要作为结构参考 |
| 客户端 | Tauri v2，桌面端 + Android |

常用命令：`npm run dev`、`npm run lint`、`npm run build`、`npm run tauri:dev`、`npm run tauri:build`、`npx tauri android build --apk --split-per-abi`。

不要扫描或编辑 `src-tauri/target/`、`src-tauri/gen/android/app/build/` 等构建产物。

---

## 目录地图

```text
src/
├── pages/
│   ├── HomePage.jsx                    首页章节地图
│   ├── LessonPage.jsx                  章节闯关路由入口
│   ├── VocabPage.jsx                   练习中心
│   ├── VocabBookPage.jsx               单词本详情
│   ├── ListeningPracticePage.jsx       听力练习
│   ├── CourseReviewPracticePage.jsx    课程巩固
│   ├── WordReviewPracticePage.jsx      单词复习
│   ├── WrongReviewPracticePage.jsx     错题重练
│   ├── GrammarPage.jsx                 语法教程
│   ├── ShopPage.jsx                    商店
│   ├── ProfilePage.jsx                 我的
│   ├── ProfileSetupPage.jsx            首次设置
│   └── SettingsPage.jsx                AI + TTS 设置
├── components/
│   ├── Layout/                         MainLayout / BottomNav
│   ├── Map/                            地图、章节横幅、课程生成弹层
│   ├── Lesson/                         通用闯关题型、反馈、结算、复活
│   ├── Practice/                       练习中心特殊玩法组件
│   ├── Profile/                        编辑资料、头像裁剪、背包
│   └── UI/                             通用组件、悬浮组件、音频按钮
├── store/
│   ├── userStore.js                    用户、心心、金币、道具、XP 加速
│   ├── gameStore.js                    章节/通用练习闯关状态
│   ├── courseStore.js                  AI 生成课程
│   ├── aiStore.js                      大模型配置
│   ├── ttsStore.js                     TTS 配置
│   ├── vocabStore.js                   单词本
│   ├── wrongQuestionStore.js           错题库
│   ├── listeningPracticeStore.js       听力练习状态
│   ├── wordReviewPracticeStore.js      单词复习状态
│   ├── autoGenStore.js                 后台补齐关卡运行态
│   └── nextChapterGenStore.js          下一章节生成运行态
├── lib/
│   ├── generate-chapter.js             课程生成流水线
│   ├── course-wire.js                  AI JSON 传输协议与兼容解码
│   ├── *-practice.js                   练习中心抽题/构题工具
│   ├── judge-answer.js                 AI 误判申诉
│   ├── tts.js                          TTS 请求与 IndexedDB 缓存
│   ├── japanese-speech-player.js       日语语音播放控制
│   ├── sound-effects.js                UI 音效类型和播放
│   └── schemas/course.js               课程 Zod 结构参考
└── data/                               静态示例与商店道具数据
```

Android 自定义入口：`src-tauri/gen/android/app/src/main/java/com/benkyo/ai/MainActivity.kt`。

---

## 路由

```text
/                                  HomePage，MainLayout
/shop                              ShopPage，MainLayout
/vocab                             VocabPage，MainLayout，底部导航显示“练习”
/vocab/book                        VocabBookPage，MainLayout
/profile                           ProfilePage，MainLayout
/setup                             ProfileSetupPage
/lesson/:chapterId/:levelId        LessonPage
/practice/listening                ListeningPracticePage
/practice/course-review            CourseReviewPracticePage
/practice/word-review              WordReviewPracticePage
/practice/wrong-review             WrongReviewPracticePage
/grammar/:chapterId                GrammarPage
/settings                          SettingsPage
```

- `App.jsx` 使用 `HashRouter`，不要改为 `BrowserRouter`。
- `RequireProfile` 在 profile 为空时强制跳转 `/setup`。
- `AppInit` 启动时同步连续签到、心心和 XP 加速状态。
- `XpBoostWidget`、`SoundEffectProvider` 在 `App.jsx` 全局渲染。
- 练习中心入口在 `VocabPage.jsx`；单词本内容已拆到 `VocabBookPage.jsx`。

---

## Zustand Store

| Store | 持久化 key | 核心职责 |
|-------|------------|----------|
| `userStore` | `benkyo-ai-user` | profile、连续天数、心心、金币、背包、签到、XP 加速、学习档案 |
| `gameStore` | `benkyo-ai-progress` | 持久化 `levelProgress`、`totalXp`；临时保存章节闯关和通用练习 `lesson` |
| `courseStore` | `benkyo-ai-courses` | AI 生成的 `chapters` |
| `aiStore` | `benkyo-ai-ai-config` | provider、API Key、模型、Base URL、思考深度 |
| `ttsStore` | `benkyo-ai-tts-config` | TTS provider、API Key、模型、音色 |
| `vocabStore` | `benkyo-ai-vocab` | 单词本 |
| `wrongQuestionStore` | `benkyo-ai-wrong-questions` | 错题库，按章节+关卡+题目稳定去重 |
| `listeningPracticeStore` | 不持久化 | 听力练习特殊玩法状态 |
| `wordReviewPracticeStore` | 不持久化 | 单词复习特殊玩法状态 |
| `autoGenStore` | 不持久化 | 后台批量生成进度与 AbortController |
| `nextChapterGenStore` | 不持久化 | 下一章节生成进度与 AbortController |

关键常量：`MAX_HEARTS = 3`、`REGEN_MS = 5 * 60 * 1000`、`XP_PER_LEVEL = 200`、`BASE_XP = 60`。

`gameStore.lesson` 是临时答题状态，包含当前题目位置、心心、正确数、反馈、金币和最终结算信息。`startPracticeLesson()` 用于课程巩固和错题重练这类复用章节闯关 UI 的练习，`lesson.isPractice` 会阻止写入章节进度。

---

## 课程数据与题型

运行时课程完全读取 `courseStore`，不要改回读取 `courses.json`。

AI 请求使用精简的带 key JSON 传输协议，运行时仍保存可读课程结构。传输协议集中定义在 `course-wire.js`；旧 tuple 协议只作为历史缓存兼容层。

```js
chapter = {
  id, title, subtitle, description, icon, color, gradient,
  levels: [{ id, number, title, topic, grammar, icon, locked, questions }],
  grammar: { sections: [...] }
}
```

语法 sections 支持 `intro`、`grammar-rule`（含 `pattern`、`examples`）、`tip`、`vocabulary`（含 `words`）。

| type | 组件 | 关键字段 |
|------|------|----------|
| `word-fill` | `WordFillQuestion` | `parts`、`options`、`answers`、`ruby` |
| `sentence-translate` | `SentenceTranslateQuestion` | `sentence`、`translation`、`options`、`answers`、`ruby` |
| `word-match` | `WordMatchQuestion` | `pairs[{ jp, cn, ruby }]` |

约定：`word-fill.parts` 用 `"___"` 表示空格；`sentence-translate.options` 和 `answers` 必须全部是中文词语，通过 `answers.join('')` 比较；题目 ID 在不同关卡间可能重复，`LessonScreen` 必须使用 `${currentIndex}-${q.id}` 作为题目组件 key；`grammar` 与 `levels` 同级，章节标题格式为 `第N章：副标题`。

---

## 章节闯关规则

- 每关普通题通常为 9 道：4 `word-fill` + 3 `sentence-translate` + 2 `word-match`。
- 开始关卡时普通题随机洗牌。
- 非第一章节会从前序章节随机追加 1 道非 `word-match` 巩固题，标记 `_isReview: true`。
- 巩固题答错不扣心、不计 `correctCount`、不影响星级；答对仍可获得金币。
- 普通题答错扣 1 心；每 5 分钟恢复 1 心。
- 蛋糕恢复 3 心，可临时超过上限，最多显示到 5 心。
- `word-match` 错配直接由 `deductHeart()` 扣心，不经过 `FeedbackPanel`。
- `sentence-translate` 答错且已配置 AI 时，可在 `FeedbackPanel` 点击误判申诉。
- 只有章节闯关答错会写入错题库；练习中心内的答错不写入。
- AI 误判申诉成功会从错题库撤销对应题目。

结算：

```text
普通题 0 错 -> 3 星
普通题 1 错 -> 2 星
普通题 >=2 错 -> 1 星
XP = BASE_XP * 星数 * XP 加速倍率
普通/巩固非配对题答对 +5 金币
word-match 每配对成功一组 +1 金币
3 星额外 +10 金币
```

商店道具：`xp2x_15` 120 金币，15 分钟 2x XP；`xp3x_15` 160 金币，15 分钟 3x XP；`cake` 80 金币，恢复 3 心。

---

## 练习中心

`VocabPage.jsx` 是“练习中心”，上方四张卡片为 `听力练习`、`课程巩固`、`单词复习`、`错题重练`，下方“我的笔记”进入 `/vocab/book` 单词本。卡片显示当前可用题库数量 tag；错题重练显示错题数量 tag。

练习构题工具集中在 `src/lib/*-practice.js`：

| 功能 | 数据来源 | 进入条件 | 状态/页面 | 奖励 |
|------|----------|----------|-----------|------|
| 听力练习 | 全部 `sentence-translate`，取 `sentence` + `translation` | TTS 已配置且可用题 >= 6 | `listeningPracticeStore` + `ListeningPracticePage` | 答对 +5 金币，XP = 星数 × 30 |
| 课程巩固 | 全部关卡 `questions` 随机抽 9 题 | 可用题 >= 9 且有心心 | `gameStore.startPracticeLesson` + `CourseReviewPracticePage` | 同章节闯关 |
| 单词复习 | `word-match.pairs` 去重后构 10 题 | 可用词条 >= 10 | `wordReviewPracticeStore` + `WordReviewPracticePage` | 答对 +2 金币，XP = 星数 × 10 |
| 错题重练 | `wrongQuestionStore.questions` 随机抽 9 题 | 错题 >= 9 且有心心 | `gameStore.startPracticeLesson({ practiceType: 'wrong-review' })` + `WrongReviewPracticePage` | 同章节闯关 |

听力练习：未配置 TTS 时弹出配置引导；句子先删除标点，再优先使用 `Intl.Segmenter('ja-JP', { granularity: 'word' })` 分词，旧运行时回退逐字符；反馈卡片展示中文翻译。

单词复习：10 题中“中文选日文”和“日文选中文”各 5 题；四个选项为 1 个正确答案 + 3 个随机错误答案；日文展示需保留 ruby；点选时播放正确答案日文。

错题重练：错题库按 `chapterId + levelId + question.id` 去重，无 `question.id` 时用题目内容指纹；重复答错只更新 `wrongCount` 和时间；在错题重练中答对会移出错题库，普通章节里再次答对不会自动清除旧错题。

---

## AI 生成

AI 配置在 `aiStore.js`。支持原生 OpenAI、Anthropic、Google，以及多个 OpenAI-compatible 提供商。完整 provider 列表以 `PROVIDER_PRESETS` 和 `ai-providers.js` 为准。

`generate-chapter.js` 导出：

```js
generateFirstChapter(aiConfig, userAnswers, { onProgress, signal })
generateLevelQuestions(aiConfig, chapter, levelIdx, { onProgress, signal, userAnswers })
generateChapterRecommendations(aiConfig, context)
generateNextChapter(aiConfig, context, { onProgress, signal })
```

章节生成流水线：`scaffold` 章节骨架（4~8 关，由 pace 决定）→ `grammar` 语法教程 → `questions` 第一关题目。

| pace | UI 文案 | 新语法数量 | 关卡数量 |
|------|---------|------------|----------|
| `relaxed` | 轻松随意 | 2 | 4 |
| `steady` | 稳步推进 | 2 | 5 |
| `fast` | 快速入门 | 3 | 6 |
| `intensive` | 密集冲刺 | 4 | 8 |

JSON 协议：`scaffold` 为 `{"chapter": {...}, "levels": [...]}`；`grammar` 为 `{"intro": "...", "rules": [{...}], "tips": [{...}], "vocabulary": {...}}`；`questions` 为 `{"wf": [...], "st": [...], "wm": [...]}`；`recommendations` 为 `{"recommendations": [...]}`。

- AI SDK 6 使用 `maxOutputTokens`，不要新增旧参数 `maxTokens`。
- `scaffold` 和 `questions` 使用 `streamText({ output: Output.json() })`，失败回退 `generateObject({ output: 'no-schema' })`。
- `grammar` 固定使用非流式 `generateObject({ output: 'no-schema' })`，并保留严格重试和语义校验。
- AI 输出最终仍交给 `normalize*` 容错，不要直接相信 provider 字段名。
- 半成品 JSON 仅用于预计进度，不可写入 store。
- Zod schema 主要作结构参考，不要轻易改成严格运行时校验。
- AI 误判裁定使用 `judge-answer.js`；解析需容忍 reason 中的非转义引号。

---

## TTS 与音效

TTS 当前仅支持阿里云百炼 CosyVoice，配置入口位于 `SettingsPage`。

关键文件：`ttsStore.js`、`tts.js`、`japanese-speech-player.js`、`JapaneseSpeechButton.jsx`。

TTS 缓存：

- 使用 IndexedDB，最多 300 条。
- cache key 必须包含文本、provider、Base URL、模型、音色、格式、采样率、语速、码率。
- 切换模型或音色后不能误播旧缓存。
- 新播放会停止旧请求和旧音频，避免快速点击叠音。
- 未配置 TTS 时，播放按钮置灰；自动播放静默跳过。

已接入位置：

- 单词本单词。
- 语法教程例句与 vocabulary。
- `sentence-translate` 句子按钮与自动播放。
- 闯关中带假名单词点击播放。
- `word-fill` 底部日语单词卡片。
- `word-match` 左侧日语卡片。
- 听力练习自动播放/重播。
- 单词复习日语答案播放。

音效：

- 类型统一定义在 `sound-effects.js`。
- 全局按钮点击由 `SoundEffectProvider` 代理：容器加 `data-ui-click-sfx`。
- 单个按钮可用 `data-sfx="none"` 关闭，或 `data-sfx="<type>"` 覆盖。
- 已有 UI 点击、选词、取消选词、答对、答错、过关音效。

---

## UI 与样式约束

- TailwindCSS v4 没有 `tailwind.config.js`，主题 token 写在 `src/index.css` 的 `@theme`。
- 全局 `body { overflow: hidden }`。脱离 `MainLayout` 的全屏页面需自行管理滚动。
- 常规按钮优先复用 `.btn-press`；题型选项按钮优先复用既有题型样式。
- `GrammarPage`、`SettingsPage` 使用 `height: 100vh; overflowY: auto`。
- `VocabPage`、`VocabBookPage` 使用与首页/我的一致的 `scroll-y` 滚动条样式。
- 假名注音统一复用 `RubyText`。
- 品牌 Logo 使用 `src/assets/icons/logo_32.png` 或 `logo.png`。
- GSAP 使用 `useGSAP`，并在文件顶层 `gsap.registerPlugin(useGSAP)`。
- 为避免 FOUC，先 `gsap.set()` 再播放入场动画。
- Sheet 关闭时先播放退场动画，完成后再卸载。
- 练习中心卡片右侧 SD 图允许溢出显示；调整卡片时检查移动端文本和图片不要互相遮挡。

---

## Android 注意事项

- `targetSdk = 36`，Android 15+ 为 edge-to-edge。
- `MainActivity.kt` 保留 `enableEdgeToEdge()`。
- WebView 安全区由原生层读取 `systemBars + displayCutout` 后应用 padding。
- 原生层会向 WebView 下传清零后的 inset，避免新版 WebView 与 CSS 双重留白。
- `index.html` 保留 `viewport-fit=cover`；`index.css` 保留 `env(safe-area-inset-*)` 作为 Web/iOS 兼容。
- Windows 构建 Android 前需开启开发者模式，否则符号链接创建失败。
- Kotlin 首次编译可能出现跨盘符增量缓存报错：`.cargo` 在 C 盘、项目在 D 盘。Gradle 通常会自动回退为非增量编译。
- release APK 默认 unsigned，安装前需签名。

---

## 修改前快速检查

1. 先读目标组件和对应 store，不要根据旧说明猜测。
2. 不要扫描 `src-tauri/target` 或 Android `build` 目录。
3. 涉及 AI 时确认使用 `maxOutputTokens`；保留当前流式/非流式策略。
4. 涉及题目切换时考虑跨关卡重复 `q.id` 和组件本地状态。
5. 涉及练习中心时确认使用对应 `*-practice.js` 里的构题和计数口径。
6. 涉及错题库时确认只记录章节闯关错误，练习中心错误不入库。
7. 涉及音频时区分 TTS 语音与 UI 音效。
8. 涉及全屏布局时检查 Android 原生 safe area 与 `body overflow:hidden`。
9. 修改后至少运行 `npm run lint`；重要功能或路由变更同时运行 `npm run build`。
