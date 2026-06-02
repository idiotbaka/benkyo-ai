# 日学 (JP Learn) - AI 工程指南

日语学习 App，交互参考 Duolingo。使用 React Web 技术栈，通过 Tauri v2 打包桌面端和 Android。
支持 AI 生成个性化课程、闯关练习、语法教程、单词本、TTS 日语语音和 UI 音效。

本文件只保留 AI 快速理解代码所需的信息。实现细节应优先阅读对应源码，不要仅凭本文假设行为。

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

常用命令：

```bash
npm run dev
npm run build
npm run lint
npm run tauri:dev
npm run tauri:build
npx tauri android build --apk --split-per-abi
```

---

## 目录地图

```text
src/
├── pages/
│   ├── HomePage.jsx              首页
│   ├── LessonPage.jsx            闯关路由入口
│   ├── GrammarPage.jsx           语法教程
│   ├── ShopPage.jsx              商店
│   ├── VocabPage.jsx             单词本
│   ├── ProfilePage.jsx           我的
│   ├── ProfileSetupPage.jsx      首次设置
│   └── SettingsPage.jsx          AI + TTS 设置
├── components/
│   ├── Layout/                   MainLayout / BottomNav
│   ├── Map/                      地图、章节横幅、课程生成弹层
│   ├── Lesson/                   题型、反馈、结算、复活
│   ├── Profile/                  编辑资料、头像裁剪、背包
│   └── UI/                       通用组件、悬浮组件、音频按钮
├── store/
│   ├── userStore.js              用户、心心、金币、道具、XP 加速
│   ├── gameStore.js              答题状态和关卡进度
│   ├── courseStore.js            AI 生成课程
│   ├── aiStore.js                大模型配置
│   ├── ttsStore.js               TTS 配置
│   ├── vocabStore.js             单词本
│   ├── autoGenStore.js           后台补齐关卡运行态
│   └── nextChapterGenStore.js    下一章节生成运行态
├── lib/
│   ├── ai-providers.js           AI provider 与思考深度
│   ├── ai-debug.js               AI 原始输出调试日志
│   ├── course-wire.js            AI JSON 传输协议与兼容解码
│   ├── generate-chapter.js       课程生成流水线
│   ├── judge-answer.js           AI 误判申诉
│   ├── tts.js                    TTS 请求与 IndexedDB 缓存
│   ├── japanese-speech-player.js 日语语音播放控制
│   ├── sound-effects.js          UI 音效类型和播放
│   └── schemas/course.js         课程 Zod 结构参考
└── data/
    ├── courses.json              静态示例，仅参考
    └── shopItems.js              商店和背包共用道具
```

Android 自定义入口：`src-tauri/gen/android/app/src/main/java/com/jplearn/app/MainActivity.kt`。

不要扫描或编辑 `src-tauri/target/`、`src-tauri/gen/android/app/build/` 等构建产物。

---

## 路由

```text
/                              HomePage，MainLayout
/shop                          ShopPage，MainLayout
/vocab                         VocabPage，MainLayout
/profile                       ProfilePage，MainLayout
/setup                         ProfileSetupPage
/lesson/:chapterId/:levelId    LessonPage
/grammar/:chapterId            GrammarPage
/settings                      SettingsPage
```

- `App.jsx` 使用 `HashRouter`，不要改为 `BrowserRouter`。
- `RequireProfile` 在 profile 为空时强制跳转 `/setup`。
- `AppInit` 启动时同步连续签到、心心和 XP 加速状态。
- `XpBoostWidget`、`SoundEffectProvider` 在 `App.jsx` 全局渲染。

---

## Zustand Store

| Store | 持久化 key | 核心职责 |
|-------|------------|----------|
| `userStore` | `jplearn-user` | profile、连续天数、心心、金币、背包、签到、XP 加速、学习档案 |
| `gameStore` | `jplearn-progress` | 持久化 `levelProgress`、`totalXp`；临时保存当前 `lesson` |
| `courseStore` | `jplearn-courses` | AI 生成的 `chapters` |
| `aiStore` | `jplearn-ai-config` | provider、API Key、模型、Base URL、思考深度 |
| `ttsStore` | `jplearn-tts-config` | TTS provider、API Key、模型、音色 |
| `vocabStore` | `jplearn-vocab` | 单词本 |
| `autoGenStore` | 不持久化 | 后台批量生成进度与 AbortController |
| `nextChapterGenStore` | 不持久化 | 下一章节生成进度与 AbortController |

关键常量：`MAX_HEARTS = 3`、`REGEN_MS = 5 * 60 * 1000`、`XP_PER_LEVEL = 200`、`BASE_XP = 60`。

`gameStore.lesson` 是临时答题状态，包含当前题目位置、心心、正确数、反馈、金币和最终结算信息。

---

## 课程数据

运行时课程完全读取 `courseStore`，不要改回读取 `courses.json`。

AI 请求使用精简的带 key JSON 传输协议，运行时仍保存下面的可读课程结构。传输协议集中定义在 `course-wire.js`；解码器保留旧 tuple 协议兼容，仅用于读取旧缓存或容错，不要再要求模型生成深层 tuple 数组。

```js
chapter = {
  id, title, subtitle, description, icon, color, gradient,
  levels: [{
    id, number, title, topic, grammar, icon,
    locked, questions
  }],
  grammar: { sections: [...] }
}
```

语法 sections 支持 `intro`、`grammar-rule`（含 `pattern`、`examples`）、`tip`、`vocabulary`（含 `words`）。

题型：

| type | 组件 | 关键字段 |
|------|------|----------|
| `word-fill` | `WordFillQuestion` | `parts`、`options`、`answers`、`ruby` |
| `sentence-translate` | `SentenceTranslateQuestion` | `sentence`、`options`、`answers`、`ruby` |
| `word-match` | `WordMatchQuestion` | `pairs[{ jp, cn, ruby }]` |

约定：

- `word-fill.parts` 用 `"___"` 表示空格。
- `sentence-translate.options` 和 `answers` 必须全部是中文词语。
- `sentence-translate` 通过 `answers.join('')` 比较答案。
- 题目 ID 在不同关卡间可能重复，例如每关都有 `q1`。
- `LessonScreen` 必须使用 `${currentIndex}-${q.id}` 作为题目组件 key，避免巩固题复用旧本地状态。
- `grammar` 与 `levels` 同级；章节标题格式为 `第N章：副标题`。

---

## 闯关规则

- 每关普通题通常为 9 道：4 `word-fill` + 3 `sentence-translate` + 2 `word-match`。
- 开始关卡时普通题会随机洗牌。
- 非第一章节会从前序章节随机追加 1 道非 `word-match` 巩固题，标记 `_isReview: true`。
- 巩固题答错不扣心、不计 `correctCount`、不影响星级；答对仍可获得金币。
- 普通题答错扣 1 心；每 5 分钟恢复 1 心。
- 蛋糕恢复 3 心，可临时超过上限，最多显示到 5 心。
- `word-match` 错配直接由 `deductHeart()` 扣心，不经过 `FeedbackPanel`。
- `sentence-translate` 答错且已配置 AI 时，可在 `FeedbackPanel` 点击误判申诉。

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

商店道具：

```text
xp2x_15  120 金币，15 分钟 2x XP
xp3x_15  160 金币，15 分钟 3x XP
cake      80 金币，恢复 3 心
```

---

## AI 生成

AI 配置在 `aiStore.js`。支持原生 OpenAI、Anthropic、Google，以及多个 OpenAI-compatible 提供商。
完整 provider 列表以 `PROVIDER_PRESETS` 和 `ai-providers.js` 为准。

`generate-chapter.js` 导出：

```js
generateFirstChapter(aiConfig, userAnswers, { onProgress, signal })
generateLevelQuestions(aiConfig, chapter, levelIdx, { onProgress, signal, userAnswers })
generateChapterRecommendations(aiConfig, context)
generateNextChapter(aiConfig, context, { onProgress, signal })
```

章节生成是三步流水线：`scaffold` 章节骨架（4~8 关，由学习节奏决定）→ `grammar` 语法教程 → `questions` 第一关题目。

### 教学节奏

首次生成章节时，用户选择的 pace 会同时限制全章新语法数量和关卡数量：

| pace | UI 文案 | 新语法数量 | 关卡数量 |
|------|---------|------------|----------|
| `relaxed` | 轻松随意 | 2 | 4 |
| `steady` | 稳步推进 | 2 | 5 |
| `fast` | 快速入门 | 3 | 6 |
| `intensive` | 密集冲刺 | 4 | 8 |

`scaffold` 提示词与运行时语义校验会共同约束：

- 全章必须恰好包含 pace 指定数量的不同新语法点和关卡。
- 每关 `grammar` 只能引用本章选定语法，不要每关引入一批全新语法。
- 每个语法点至少在 2 个关卡出现；最后一关必须覆盖全章语法，作为综合复习。
- scaffold 语义校验失败时，自动使用更低 temperature 重试。

### JSON 传输协议

所有课程生成提示词都使用带 key 的对象协议。模型可以输出正常 JSON 空格和换行；不要强制单行压缩，也不要改回难以稳定生成的深层 tuple 数组。

- `scaffold`：`{"chapter": {...}, "levels": [...]}`。
- `grammar`：`{"intro": "...", "rules": [{...}], "tips": [{...}], "vocabulary": {...}}`。
- `questions`：`{"wf": [...], "st": [...], "wm": [...]}`。
- `recommendations`：`{"recommendations": [...]}`。

协议定义和兼容解码统一放在 `course-wire.js`。旧 tuple 格式仍可被 decoder 读取，但只作为历史缓存兼容层，不是模型输出格式。

### 生成策略

- `scaffold` 和 `questions` 使用 `streamText({ output: Output.json() })` 流式接收 JSON；流式失败会回退 `generateObject({ output: 'no-schema' })`。
- `grammar` 内容较长且嵌套更深，固定使用非流式 `generateObject({ output: 'no-schema' })` 生成带 key 对象。校验失败时会使用更严格提示词、较低 temperature 和更高 token 上限重试。
- `grammar` 必须逐一讲解 scaffold 中的全部语法点：每个语法点恰好对应 1 条 rule，不得遗漏，也不得把多个语法合并成一条。
- `grammar` 的规则、pattern、examples、tips 和 vocabulary 都有语义校验；其中每条规则至少 2 个例句，tips 为 1~2 条，词汇至少 8 个。
- `recommendations` 使用非流式 `generateObject` 和带 key 对象协议。
- `courseStore` 在 hydration 和章节写入路径中会尝试修复旧缓存里可恢复的异常 grammar sections，并在运行时使用规范化结构。
- AI 生成成功或失败都会通过 `ai-debug.js` 输出 `[AI DEBUG] phase=... mode=... status=...`，失败时尽量打印 provider 返回的原始文本，便于定位模型漂移。

重要约束：

- AI SDK 6 使用 `maxOutputTokens`，不要新增旧参数 `maxTokens`。
- AI 输出最终仍交给 `normalize*` 容错，不要直接相信 provider 字段名。
- 半成品 JSON 仅用于预计进度，不可写入 store。
- Zod schema 主要作结构参考，不要轻易改成严格运行时校验。
- 进度是“预计进度”，包含字符估算、阶段权重、上限和校验阶段。
- 后台生成由 `autoGenStore` 依次补齐空关卡，支持中断。
- AI 误判裁定使用 `judge-answer.js`；解析需容忍 reason 中的非转义引号。

---

## TTS 与音效

TTS 当前仅支持阿里云百炼 CosyVoice，配置入口位于 `SettingsPage`。

关键文件：`ttsStore.js` 配置、`tts.js` 请求和缓存、`japanese-speech-player.js` 播放控制、`JapaneseSpeechButton.jsx` 播放按钮。

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

音效：

- 类型统一定义在 `sound-effects.js`。
- 全局按钮点击由 `SoundEffectProvider` 代理：容器加 `data-ui-click-sfx`。
- 单个按钮可用 `data-sfx="none"` 关闭，或 `data-sfx="<type>"` 覆盖。
- 已有 UI 点击、选词、取消选词、答对、答错、过关音效。

---

## UI 与样式约束

- TailwindCSS v4 没有 `tailwind.config.js`，主题 token 写在 `src/index.css` 的 `@theme`。
- 全局 `body { overflow: hidden }`。脱离 `MainLayout` 的全屏页面需自行管理滚动。
- `GrammarPage`、`SettingsPage` 使用 `height: 100vh; overflowY: auto`。
- 常规按钮优先复用 `.btn-press`。
- 假名注音统一复用 `RubyText`。
- 品牌 Logo 使用 `src/assets/icons/logo_32.png` 或 `logo.png`。
- GSAP 使用 `useGSAP`，并在文件顶层 `gsap.registerPlugin(useGSAP)`。
- 为避免 FOUC，先 `gsap.set()` 再播放入场动画。
- Sheet 关闭时先播放退场动画，完成后再卸载。

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
3. 涉及 AI 时确认使用 `maxOutputTokens`；`scaffold` 和 `questions` 保留流式回退，`grammar` 保留非流式带 key 生成与严格重试。
4. 涉及题目切换时考虑跨关卡重复 `q.id` 和组件本地状态。
5. 涉及音频时区分 TTS 语音与 UI 音效。
6. 涉及全屏布局时检查 Android 原生 safe area 与 `body overflow:hidden`。
7. 修改后至少运行目标文件定向 lint 与 `npm run build`。
