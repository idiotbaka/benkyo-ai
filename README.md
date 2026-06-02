# 日学 (JP Learn)

> ⚠️ **项目仍在开发中**

一款日语学习 App，支持 AI 生成个性化课程内容，通过 Tauri 打包为桌面/移动端应用。

---

## 目前已实现

- **AI 生成课程** — 根据学习偏好（水平 / 节奏 / 目标）自动生成章节、关卡与题目。支持 OpenAI、Claude、Gemini、DeepSeek、Qwen 等十余种主流 AI 提供商
- **本地化** — 用户数据完全本地存储，前端直接调用 AI API
- **多种题型** — 选词填空、点词造句、单词配对
- **关卡地图** — 章节 + 关卡树形地图，由 AI 驱动无限生成章节题目
- **语法教程** — 每章配套语法教程长页面，含句型卡、词汇表、例句注音
- **单词本** — 配对题完成后自动收录词汇
- **道具商店** — 金币购买双倍/三倍经验卡、蛋糕（回心、复活道具）
- **心心系统** — 答错扣心，5 分钟自动恢复，蛋糕可快速补满
- **XP 与等级** — 完关获得 XP，升级时触发庆祝动画

---

## 技术栈

| 层级 | 技术 |
|------|------|
| UI 框架 | React 19 |
| 构建工具 | Vite 8 |
| 动画 | GSAP 3 + @gsap/react |
| 状态管理 | Zustand 5 (+ persist) |
| 路由 | React Router DOM 7 (HashRouter) |
| 样式 | TailwindCSS v4 (Vite 插件集成) |
| AI SDK | Vercel AI SDK (`ai` ^6) |
| Schema | Zod 4 |
| 桌面/移动打包 | Tauri v2 |

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动 Web 开发服务器（http://localhost:5173）
npm run dev
```

---

## 构建

### Web 静态产物

```bash
npm run build
# 产物输出到 dist/
```

### 桌面应用（需安装 Rust）

```bash
# 开发模式
npm run tauri:dev

# 打包安装包
npm run tauri:build
```

### Android APK（需配置 Android SDK + NDK）

```bash
# 初始化 Android 项目（仅首次）
npx tauri android init

# 构建（按架构分包）
npx tauri android build --apk --split-per-abi
```

> Android 构建前置条件：Rust + Android Studio (SDK API 36 + NDK 30)，Windows 需开启开发者模式。

---

## AI 配置

应用内「我的 → 设置」中配置 AI 提供商（LLM 和 TTS），支持：

OpenAI · Anthropic · Google Gemini · DeepSeek · 阿里云百炼(Qwen) · 月之暗面(Kimi) · 智谱 GLM · 火山引擎(豆包) · 百度千帆 · 腾讯混元 · MiniMax · 自定义 OpenAI 兼容端点

---

## 音频素材

应用中使用的部分音效素材来自以下网站：

- [効果音ラボ](https://soundeffect-lab.info/) (`soundeffect-lab.info`)
- [Kenney](https://kenney.nl/) (`kenney.nl`)

---

## License

MIT
