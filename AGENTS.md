# 日学 (Benkyo AI) - AI 工程指南

日语学习 App，交互参考 Duolingo。使用 React Web 技术栈，通过 Tauri v2 打包桌面端和 Android。
支持 AI 生成个性化课程、闯关练习、练习中心、语法教程、单词本、每日任务、徽章/御守/道具收集、TTS 日语语音和 UI 音效。

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

常用命令：`npm run dev`、`npm run lint`、`npm run build`、`npm run tauri:dev`、`npm run tauri:build`、`npx tauri android build --apk --split-per-abi`、`npm run android:release -- -KeystorePath .\android-signing\benkyo-ai-release.jks -KeyAlias benkyo-ai`。

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
│   ├── Shop/                           御守扭蛋与商店特殊组件
│   ├── Profile/                        编辑资料、头像裁剪、背包、徽章
│   └── UI/                             通用组件、悬浮组件、音频按钮
├── store/
│   ├── userStore.js                    用户、心心、金币、道具、XP/金币加成、御守收藏
│   ├── gameStore.js                    章节/通用练习闯关状态
│   ├── courseStore.js                  AI 生成课程
│   ├── badgeStore.js                   徽章解锁与累计进度
│   ├── dailyTaskStore.js               每日任务状态
│   ├── aiStore.js                      大模型配置
│   ├── ttsStore.js                     TTS 配置
│   ├── vocabStore.js                   单词本
│   ├── wrongQuestionStore.js           错题库
│   ├── appearanceStore.js              图标皮肤
│   ├── listeningPracticeStore.js       听力练习状态
│   ├── wordReviewPracticeStore.js      单词复习状态
│   ├── autoGenStore.js                 后台补齐关卡运行态
│   └── nextChapterGenStore.js          下一章节生成运行态
├── lib/
│   ├── generate-chapter.js             课程生成流水线
│   ├── course-wire.js                  AI JSON 传输协议与兼容解码
│   ├── badge-progress.js               徽章实时进度计算
│   ├── equipment-effects.js            护身符/装备实际特效入口
│   ├── *-practice.js                   练习中心抽题/构题工具
│   ├── giftbox-rewards.js              礼物盒掉落与开启奖励
│   ├── judge-answer.js                 AI 误判申诉
│   ├── tts.js                          TTS 请求与 IndexedDB 缓存
│   ├── japanese-speech-player.js       日语语音播放控制
│   ├── sound-effects.js                UI 音效类型和播放
│   └── schemas/course.js               课程 Zod 结构参考
└── data/                               静态示例、商店与御守数据
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
- `AppInit` 启动时同步连续签到、心心、XP 加速和每日任务。
- `XpBoostWidget`、`SoundEffectProvider`、`DailyTaskToast` 在 `App.jsx` 全局渲染。
- 练习中心入口在 `VocabPage.jsx`；单词本内容已拆到 `VocabBookPage.jsx`。

---

## Zustand Store

| Store | 持久化 key | 核心职责 |
|-------|------------|----------|
| `userStore` | `benkyo-ai-user` | profile、连续天数、心心、金币、背包、装备状态、签到、XP/金币加成、学习档案、御守收藏 |
| `gameStore` | `benkyo-ai-progress` | 持久化 `levelProgress`、`totalXp`；临时保存章节闯关和通用练习 `lesson` |
| `courseStore` | `benkyo-ai-courses` | AI 生成的 `chapters` |
| `dailyTaskStore` | `benkyo-ai-daily-tasks` | 每日任务、完成 toast 队列、宝箱领取状态 |
| `badgeStore` | `benkyo-ai-badges` | 徽章解锁状态和累计计数 |
| `aiStore` | `benkyo-ai-ai-config` | provider、API Key、模型、Base URL、思考深度 |
| `ttsStore` | `benkyo-ai-tts-config` | TTS provider、API Key、模型、音色 |
| `vocabStore` | `benkyo-ai-vocab` | 单词本 |
| `wrongQuestionStore` | `benkyo-ai-wrong-questions` | 错题库，按章节+关卡+题目稳定去重 |
| `appearanceStore` | `benkyo-ai-appearance` | 当前图标皮肤，默认 `benkyochan` |
| `listeningPracticeStore` | 不持久化 | 听力练习特殊玩法状态、心心、失败/复活、结算 |
| `wordReviewPracticeStore` | 不持久化 | 单词复习特殊玩法状态、心心、失败/复活、结算 |
| `autoGenStore` | 不持久化 | 后台批量生成进度与 AbortController |
| `nextChapterGenStore` | 不持久化 | 下一章节生成进度与 AbortController |

关键常量：`MAX_HEARTS = 3`、`REGEN_MS = 5 * 60 * 1000`、`XP_PER_LEVEL = 200`、`BASE_XP = 60`。

`userStore` 同时管理背包道具、`xpBoost`、`coinBoost`、咖啡每日使用日期和奖励发放。`addBoostedCoins()` 会应用金币加成；XP 加成卡与金币加成卡互斥；`syncXpBoost()` 会清理过期加成。背包只展示已拥有道具，空背包显示居中提示。

`gameStore.lesson` 是临时答题状态，包含当前题目位置、心心、正确数、反馈、金币和最终结算信息。`startPracticeLesson()` 用于课程巩固和错题重练这类复用章节闯关 UI 的练习，`lesson.isPractice` 会阻止写入章节进度。听力练习和单词复习使用独立 store，但心心扣除、失败页、复活页与通用闯关保持同一套体验。

---

## 我的、每日任务与徽章

`ProfilePage.jsx` 包含个人信息、统计卡、背包入口、徽章入口、每日签到、每日特别任务和课程进度。

- `dailyTaskStore.ensureToday()` 每天生成小/中/大三个任务。
- 进度由各玩法调用 `recordEvent()` 推进；任务首次完成会加入 `toastQueue`，由全局 `DailyTaskToast` 顶部弹出。
- 在“我的”页点击已完成任务宝箱会 `claimTask()`，随后 `userStore.grantReward()` 发放金币或道具，并弹出 `RewardModal`。
- 每日签到成功后可能额外获得金币加成卡；签到奖励、任务奖励、礼物盒开启和扭蛋额外掉落统一通过 `RewardModal` 展示。
- 徽章静态定义在 `data/badges.js`，进度统一由 `lib/badge-progress.js` 计算，解锁和累计计数在 `badgeStore`。
- 用户进入“我的”页时 `ProfilePage.queueBadgeUnlocks()` 统一检查并弹出 `BadgeUnlockModal`；签到/每日任务奖励/吃蛋糕后会额外触发检查。
- 徽章进度来源包括背包道具、单词数、角色等级、全 3 星章节、章节数；累计计数包括每日任务、总金币、吃蛋糕、误判申诉。

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
- AI 误判申诉成功会记录徽章累计计数 `appealSuccess +1`。

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

装备 `绘马(equip_ema)` 时，正常完成结算的星级最低为 2 星，`1 星` 会提升为 `2 星`，XP、关卡进度、礼物盒掉落和完成页均使用提升后的最终星级。失败页不触发绘马保底。

金币题目奖励通过 `userStore.addBoostedCoins()` 发放，会受金币加成卡影响；3 星额外金币不受金币加成影响。结算和练习完成页可能额外掉落礼物盒，掉落/开启逻辑集中在 `giftbox-rewards.js`。

道具定义集中在 `data/shopItems.js` 的 `ITEM_DEFINITIONS`；`SHOP_ITEMS` 只过滤可购买道具，背包使用完整定义。当前道具包括 XP 加成卡、金币加成卡、礼物盒、蛋糕、罐装咖啡和日式点心套装。

道具规则：`xp2x_15` / `xp3x_15` 商店可买，15 分钟 XP 加成；`coin2x_15` / `coin3x_15` 不能购买，可由签到等奖励获得，15 分钟金币加成；金币加成与 XP 加成互斥。`cake` 恢复 3 心；`coffee` 每日可用 1 次，延长当前 XP 或金币加成 10 分钟；`sweets_set` 直接恢复到 5 心。`giftbox1`、`giftbox2`、`giftbox3` 不可购买，可从闯关、练习或扭蛋额外掉落，打开后随机发放金币或道具。装备类护身符的实际效果集中在 `lib/equipment-effects.js`，使用 `userStore.equippedItems` 判断是否生效。

---

## 商店与御守扭蛋

`ShopPage.jsx` 底部固定切换“道具商店 / 御守・護身符”。道具商店仍使用 `data/shopItems.js`；御守扭蛋入口渲染 `components/Shop/OmamoriGacha.jsx`。

御守数据集中在 `data/omamoriGacha.js`：`OMAMORI_GACHA_COST = 200`；概率为 `N 62%`、`R 25%`、`SR 10%`、`SSR 3%`；`OMAMORI_ITEMS` 定义 27 种御守、稀有度、名称和 `sd/*.png` 图标路径；`OMAMORI_LORE` / `getOmamoriLore()` 定义详情页文化小知识；`OMAMORI_EFFECTS` / `getOmamoriEffect()` 定义御守特效说明；`drawOmamori()` 只负责按概率抽取，不写 store。`连勝守`、`勉強ちゃんの絆` 是 App 定制御守。

御守与装备持久化在 `userStore`：`spendCoins(amount)` 扣金币；`recordOmamoriDraw(itemId)` 累加 `omamoriCollection[itemId]`；`markOmamoriDetailViewed()` 写入 `omamoriViewedDetails[itemId]`；`equippedItems[itemId]` 记录装备是否启用。Console 调试方法在 `App.jsx` 暴露：`benkyoDebugAddCoins(amount = 1000)`。

`OmamoriGacha.jsx` 负责所有御守 UI：舞台背景、抽奖结果横向滚动、收藏图鉴和详情遮罩。收藏区只允许点击已获得御守；未获得置灰且不可打开详情。已获得但未查看详情的御守在“累计X枚”前显示主题色 `New`，打开详情后消失。首次抽到新御守时，结果弹窗顶部固定占位显示 `New!!`，避免弹窗高度跳动。

御守与商店存在解锁关系：持有 `爆睡祈願(N)` 后可购买 `罐装咖啡`；持有 `健康祈願(N)` 后可购买 `日式点心套装`；持有指定御守后可购买对应装备护身符。商店购买条件使用 item 的 `purchaseRequirement` 声明，`ShopPage` 统一判断并展示。装备类护身符可在商店和背包切换“装备/卸下”，购买后默认装备（除非 item 显式关闭 `autoEquipOnPurchase`）。

已实现装备特效：`团扇(equip_round_fan)` 装备时，御守抽取实际费用从 `OMAMORI_GACHA_COST = 200` 降为 160，Gacha 主按钮、主卡片右上角、抽取弹窗 tag、再抽一次按钮都显示 160，其中按钮价格会显示 200 删除线和 160 现价；实际扣费使用 160。`绘马(equip_ema)` 装备时，首页章节关卡和练习中心正常完成结算星级最低为 2 星。

御守详情页会显示简洁的特效说明。抽到 SR/SSR 御守会额外获得 1 个豪华礼物盒。

样式主要在 `index.css` 的 `Shop: Omamori gacha` 区块。御守图片不要再套卡片边框：收藏图统一 4 列，`100px × 204px` 容器底部对齐；结果滚动图使用 `125px × 255px` 容器底部对齐。SR/SSR 收藏图保留扫光；结果页 SR/SSR 扫光使用图片 mask，只扫御守不透明区域，不扫外部空白。

---

## 练习中心

`VocabPage.jsx` 是“练习中心”，上方四张卡片为 `听力练习`、`课程巩固`、`单词复习`、`错题重练`，下方“我的笔记”进入 `/vocab/book` 单词本。卡片显示当前可用题库数量 tag；错题重练显示错题数量 tag。

练习构题工具集中在 `src/lib/*-practice.js`：

| 功能 | 数据来源 | 进入条件 | 状态/页面 | 奖励 |
|------|----------|----------|-----------|------|
| 听力练习 | 全部 `sentence-translate`，取 `sentence` + `translation` | TTS 已配置、可用题 >= 6 且有心心 | `listeningPracticeStore` + `ListeningPracticePage` | 答对 +5 金币，XP = 星数 × 30，可能掉落礼物盒 |
| 课程巩固 | 全部关卡 `questions` 随机抽 9 题 | 可用题 >= 9 且有心心 | `gameStore.startPracticeLesson` + `CourseReviewPracticePage` | 同章节闯关 |
| 单词复习 | `word-match.pairs` 去重后构 10 题 | 可用词条 >= 10 且有心心 | `wordReviewPracticeStore` + `WordReviewPracticePage` | 答对 +2 金币，XP = 星数 × 10，可能掉落礼物盒 |
| 错题重练 | `wrongQuestionStore.questions` 随机抽 9 题 | 错题 >= 9 且有心心 | `gameStore.startPracticeLesson({ practiceType: 'wrong-review' })` + `WrongReviewPracticePage` | 同章节闯关 |

练习中心四个入口都会先 `syncHearts()`，没有心心时弹出生命值耗尽提示并阻止进入。听力练习和单词复习虽使用独立 store，也会从 `userStore.hearts` 初始化本局心心；答错会调用 `userStore.deductHeart()` 扣全局心心；心心归零后进入失败/复活流程。`LessonFailedContent` 和 `ReviveSheet` 支持传入独立 practice session，听力/单词复习复用同一套失败页和蛋糕复活页。失败页只发放按答对比例折算的部分 XP，不套 XP 加成，不触发绘马星级保底；正常完成才按星级结算并受绘马保底影响。

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

TTS 配置入口位于 `SettingsPage`，provider 预设集中在 `ttsStore.js`，请求、缓存和响应解析集中在 `tts.js`。

当前 TTS provider：

- `aliyun-cosyvoice`：CosyVoice（阿里云百炼）。
- `aliyun-qwen-tts`：Qwen-TTS（阿里云百炼），使用 DashScope multimodal endpoint，`input.language_type` 固定为 `Japanese`。
- `aliyun-minimax-tts`：MiniMax（阿里云百炼），使用 DashScope multimodal endpoint，传 `input.voice_setting.voice_id`、`input.voice_setting.language_boost = "Japanese"`、`audio_setting.format = "mp3"`；响应音频在 `output.data.audio`，为 hex 编码。
- `minimax-official-tts`：MiniMax（官方 API），使用 `https://api.minimaxi.com/v1/t2a_v2`，传顶层 `text`、`voice_setting.voice_id`、`voice_setting.language_boost = "Japanese"`、`audio_setting.format = "mp3"`；响应音频在 `data.audio`，为 hex 编码。
- `volcengine-doubao-tts`：豆包语音（火山引擎），使用 `https://openspeech.bytedance.com/api/v3/tts/unidirectional`，鉴权 Header 为 `X-Api-Key` 和 `X-Api-Resource-Id`。浏览器端会被 CORS 拦截，必须通过 Tauri Rust command `proxy_volcengine_tts` 代理请求；纯 `npm run dev` 不能完整测试该 provider，需使用 `npm run tauri:dev`。

关键文件：`ttsStore.js`、`tts.js`、`japanese-speech-player.js`、`JapaneseSpeechButton.jsx`、`src-tauri/src/lib.rs`。

TTS 请求与解析：

- 日语文本合成前会先 trim；若末尾没有句末标点，会补 `。`，避免 TTS 模型继续扩写单词或短句。cache key 使用补标点后的文本。
- API Key 会统一去掉用户可能手填的 `Bearer ` 前缀，再按 provider 组装鉴权 Header。
- 火山引擎 `req_params.additions` 必须是 JSON 字符串，不是对象；明确语种使用 `{"explicit_language":"ja"}`。
- 火山引擎 HTTP Chunked 可能连续返回多个 JSON：`code: 0` 携带 base64 `data` 音频分片，`code: 20000000` 是结束标记。Rust 代理会合并为 `data_chunks`，前端再按顺序解码为音频 Blob。
- 响应解析支持 Blob、音频 URL、base64、hex 和 `data_chunks`；MiniMax 错误消息优先读取 `base_resp.status_msg`。

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

## 图标与资源

- 图标统一通过 `useIcon()` / `useIconResolver()` 读取，路径写相对皮肤根目录，如 `ui/bag.png`、`sd/sd_badge_course.png`。
- 道具图标位于当前皮肤 `item/` 目录；商店和背包都从 `ITEM_DEFINITIONS.iconPath` 解析，不要手写 public URL。
- 当前支持 `benkyochan` 默认皮肤，缺失资源会回退默认皮肤，未来会增加新皮肤。
- 徽章图为圆形成品图，不要额外绘制边框；未解锁灰度，已解锁和解锁弹窗使用扫光效果。
- 御守图标位于当前皮肤 `sd/` 目录，文件名含日文/中文字符；通过 `useIconResolver()` 解析，不要手写 public URL。
- 品牌 Logo 使用当前皮肤下的 `logo_32.png` 或 `logo.png`。

---

## UI 与样式约束

- TailwindCSS v4 没有 `tailwind.config.js`，主题 token 写在 `src/index.css` 的 `@theme`。
- 全局 `body { overflow: hidden }`。脱离 `MainLayout` 的全屏页面需自行管理滚动。
- 常规按钮优先复用 `.btn-press`；题型选项按钮优先复用既有题型样式。
- `GrammarPage`、`SettingsPage` 使用 `height: 100vh; overflowY: auto`。
- `VocabPage`、`VocabBookPage` 使用与首页/我的一致的 `scroll-y` 滚动条样式。
- 假名注音统一复用 `RubyText`。
- GSAP 使用 `useGSAP`，并在文件顶层 `gsap.registerPlugin(useGSAP)`。
- 为避免 FOUC，先 `gsap.set()` 再播放入场动画。
- Sheet 关闭时先播放退场动画，完成后再卸载。
- 练习中心卡片右侧 SD 图允许溢出显示；调整卡片时检查移动端文本和图片不要互相遮挡。
- 复活页 `ReviveSheet` 中蛋糕库存数量使用背包风格胶囊标签，不要退回普通右对齐文字。

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
- 豆包语音（火山引擎）通过 Tauri Rust `proxy_volcengine_tts` 代理请求，并依赖 Rust `reqwest`；Android release 构建会一并交叉编译这些 Rust 依赖，首次构建可能需要下载 crates 且耗时更长，但现有签名打包命令不需要调整。

---

## 修改前快速检查

1. 先读目标组件和对应 store，不要根据旧说明猜测。
2. 不要扫描 `src-tauri/target` 或 Android `build` 目录。
3. 涉及 AI 时确认使用 `maxOutputTokens`；保留当前流式/非流式策略。
4. 涉及题目切换时考虑跨关卡重复 `q.id` 和组件本地状态。
5. 涉及练习中心时确认使用对应 `*-practice.js` 里的构题和计数口径，并确认四个入口都有心心检查。
6. 涉及错题库时确认只记录章节闯关错误，练习中心错误不入库。
7. 涉及徽章时区分实时进度和累计计数，解锁只在“我的”页统一检查。
8. 涉及商店/御守/道具/装备时确认金币扣除、购买条件、背包库存、装备状态、实际特效、收藏计数、已读 New 状态和图标皮肤回退。
9. 涉及音频时区分 TTS 语音与 UI 音效。
10. 涉及全屏布局时检查 Android 原生 safe area 与 `body overflow:hidden`。
11. 涉及护身符特效时优先复用 `lib/equipment-effects.js`，避免 UI 展示和实际扣费/结算逻辑分叉。
12. 修改后至少运行 `npm run lint`；重要功能或路由变更只需运行 `npm run build` 确认即可，不要启动 Vite 开发服务器或内置浏览器。
