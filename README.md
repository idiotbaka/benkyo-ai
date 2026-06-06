# 日学 (Benkyo AI)

日学是一款本地优先的日语学习 App，交互体验参考 Duolingo。应用支持 AI 生成个性化课程，并提供闯关练习、语法教程、练习中心、单词本、每日任务、徽章/御守收集和日语 TTS 朗读。

项目仍在开发中，功能和数据结构会持续调整。

## 功能概览

- AI 生成课程：根据学习水平、目标和节奏生成章节、语法与题目。
- 闯关练习：选词填空、句子翻译、单词配对，支持心心、金币、XP 和星级结算。
- 练习中心：听力练习、课程巩固、单词复习、错题重练。
- 学习资料：语法教程、假名注音、自动收录单词本。
- 成长系统：每日任务、签到、徽章、商店、御守扭蛋。
- AI 配置：支持多种 LLM provider 和自定义 OpenAI-compatible 端点。
- 日语 TTS：支持 CosyVoice、Qwen-TTS、MiniMax（阿里云百炼/官方 API）和豆包语音（火山引擎）。
- 多端支持：Web 开发预览、Tauri 桌面端、Android APK。

## 技术栈

React 19 / Vite 8 / Tailwind CSS v4 / GSAP / Zustand / React Router / Vercel AI SDK 6 / Tauri v2 / Rust

## 本地开发

```bash
npm install
npm run dev
```

Tauri 开发模式：

```bash
npm run tauri:dev
```

豆包语音（火山引擎）TTS 需要 Tauri Rust 代理，需在 `npm run tauri:dev` 或打包后的应用中测试。

## 构建

```bash
npm run lint
npm run build
npm run tauri:build
```

Android release APK：

```bash
npm run android:release -- -KeystorePath .\android-signing\benkyo-ai-release.jks -KeyAlias benkyo-ai
```

首次创建 keystore 时：

```bash
npm run android:release -- -CreateKeystore -KeystorePath .\android-signing\benkyo-ai-release.jks -KeyAlias benkyo-ai
```

Android 构建需要 Rust、Android SDK/NDK。Windows 构建前需开启开发者模式。更多说明见 [scripts/README-android.md](scripts/README-android.md)。

## 配置

应用内「我的 → 设置」配置 AI 与 TTS。API Key、模型、Base URL、音色等配置会本地持久化。

## 素材鸣谢

- [効果音ラボ](https://soundeffect-lab.info/)
- [Kenney](https://kenney.nl/)

## License

MIT
