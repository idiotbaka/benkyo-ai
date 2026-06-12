<p align="center">
  <img src="src/assets/icons/benkyochan/logo.png" width="128" alt="日学 Benkyo AI Logo">
</p>

<h1 align="center">日学 (Benkyo AI)</h1>

日学是一款使用 AI 来生成专属定制课程的游戏化日语学习 App，数据完全存储在本地，交互体验参考 Duolingo。
它搭建了一套学习循环：生成课程，完成关卡，复习薄弱项，收集奖励，继续前进。

## 使用前配置

配置入口：应用内「我的 → 设置」。

| 配置 | 是否必需 | 用途 | 支持 |
| --- | --- | --- | --- |
| AI 模型 | 必需 | 课程生成、题目生成 | OpenAI、Anthropic、Google Gemini、DeepSeek<br>阿里云百炼 / Qwen、月之暗面 Kimi、智谱 GLM、MiniMax<br>火山引擎 / 豆包、百度千帆 / 文心、腾讯混元<br>自定义 OpenAI-compatible 端点 |
| TTS 语音模型 | 可选，推荐配置 | 日语句子、单词和语法例句朗读 | CosyVoice、Qwen-TTS<br>MiniMax（阿里云百炼 / 官方 API）<br>豆包语音（火山引擎） |

## 截图导览

<details>
<summary><strong>AI 生成与章节地图</strong></summary>

<br>

<table>
  <tr>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-09-03-616_com.benkyo.ai.jpg" width="220" alt="AI 课程偏好选择"><br>
      <strong>课程偏好选择</strong><br>
      <sub>选择学习风格、节奏、自定义提示词等。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-11-18-691_com.benkyo.ai.jpg" width="220" alt="AI 正在生成课程"><br>
      <strong>AI 生成进度</strong><br>
      <sub>由 AI 生成的课程和知识讲解。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-32-26-418_com.benkyo.ai.jpg" width="220" alt="章节地图"><br>
      <strong>章节地图</strong><br>
      <sub>类似 Duolingo 的章节列表，故事化课程。</sub>
    </td>
  </tr>
</table>

</details>

<details>
<summary><strong>课程学习与闯关</strong></summary>

<br>

<table>
  <tr>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-32-43-948_com.benkyo.ai.jpg" width="220" alt="语法教程"><br>
      <strong>语法教程</strong><br>
      <sub>AI 生成章节语法教程，包含例句、词汇等。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-32-57-097_com.benkyo.ai.jpg" width="220" alt="关卡详情"><br>
      <strong>关卡详情</strong><br>
      <sub>每个关卡配有单独知识讲解以及语法要点。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-33-56-177_com.benkyo.ai.jpg" width="220" alt="选词填空题"><br>
      <strong>选词填空</strong><br>
      <sub>根据中文提示补全日语句子，保留假名注音。</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-34-54-667_com.benkyo.ai.jpg" width="220" alt="单词配对题"><br>
      <strong>单词配对</strong><br>
      <sub>点击词卡完成配对，快速记忆词汇。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-36-13-317_com.benkyo.ai.jpg" width="220" alt="句子翻译题"><br>
      <strong>句子翻译</strong><br>
      <sub>使用词卡进行日译中、中译日。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-17-03-914_com.benkyo.ai.jpg" width="220" alt="关卡结算"><br>
      <strong>关卡结算</strong><br>
      <sub>闯关结算星级、XP、金币等资源道具。</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-20-12-635_com.benkyo.ai.jpg" width="220" alt="礼物盒奖励"><br>
      <strong>礼物盒奖励</strong><br>
      <sub>各种场景都可能掉落礼物盒，开出道具。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-38-51-120_com.benkyo.ai.jpg" width="220" alt="练习中心"><br>
      <strong>练习中心</strong><br>
      <sub>涵盖各种各样专项练习以及复习。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-39-00-352_com.benkyo.ai.jpg" width="220" alt="单词本"><br>
      <strong>单词本</strong><br>
      <sub>自动收录词汇，支持排序、五十音筛选和单词朗读。</sub>
    </td>
  </tr>
</table>

</details>

<details>
<summary><strong>个人成长与娱乐系统</strong></summary>

<br>

<table>
  <tr>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-37-18-693_com.benkyo.ai.jpg" width="220" alt="道具商店"><br>
      <strong>道具商店</strong><br>
      <sub>购买各种道具，随着推进进度解锁。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-40-31-562_com.benkyo.ai.jpg" width="220" alt="御守 Gacha"><br>
      <strong>御守 Gacha</strong><br>
      <sub>消耗金币抽卡，并解锁各种加成效果。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-37-36-597_com.benkyo.ai.jpg" width="220" alt="御守抽取结果"><br>
      <strong>御守抽取</strong><br>
      <sub>类似游戏的滚动抽卡效果。</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-38-45-216_com.benkyo.ai.jpg" width="220" alt="御守详情"><br>
      <strong>御守详情</strong><br>
      <sub>查看御守能力和文化小知识。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-38-23-968_com.benkyo.ai.jpg" width="220" alt="护身符装备"><br>
      <strong>护身符装备</strong><br>
      <sub>解锁并装备护身符，获得各种各样的实际效果。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-40-03-373_com.benkyo.ai.jpg" width="220" alt="个人主页"><br>
      <strong>个人主页</strong><br>
      <sub>展示各种资源、每日任务和章节进度。</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-22-43-09-200_com.benkyo.ai.jpg" width="220" alt="背包"><br>
      <strong>背包</strong><br>
      <sub>管理各种各样的道具。</sub>
    </td>
    <td align="center" width="33%">
      <img src="images/Screenshot_2026-06-11-23-50-39-401_com.benkyo.ai.jpg" width="220" alt="徽章"><br>
      <strong>徽章</strong><br>
      <sub>达成成就解锁徽章。</sub>
    </td>
    <td align="center" width="33%"></td>
  </tr>
</table>

</details>

## 技术栈

| 层级 | 技术 |
| --- | --- |
| UI | React 19、React Router DOM 7、HashRouter |
| 构建 | Vite 8、Tailwind CSS v4、GSAP 3 |
| 状态 | Zustand 5、persist、本地优先存储 |
| AI | Vercel AI SDK 6、OpenAI、Anthropic、Google、OpenAI-compatible provider |
| TTS | CosyVoice、Qwen-TTS、MiniMax、豆包语音，IndexedDB 音频缓存 |
| 客户端 | Tauri v2、Rust、桌面端、Android |

## 项目结构

```text
src/
├── pages/          # 首页、闯关、练习中心、商店、我的、设置等页面
├── components/     # 章节地图、题型、练习、商店、资料页和通用 UI
├── store/          # Zustand stores：用户、课程、关卡、徽章、任务、TTS、AI 等
├── lib/            # AI 生成、题目构造、TTS、音效、奖励、装备效果等逻辑
└── data/           # 商店、徽章、御守等静态配置

src-tauri/          # Tauri v2 桌面端与 Android 壳层
images/             # README 截图资源
scripts/            # Android release 打包脚本
```

## 本地开发

```bash
npm install
npm run dev
```

Tauri 开发模式：

```bash
npm run tauri:dev
```

应用内「我的 → 设置」配置 AI 与 TTS。API Key、模型、Base URL、音色等配置会保存在本地。

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

豆包语音（火山引擎）TTS 以及听力练习的分词系统需要 Tauri Rust 代理，需在 `npm run tauri:dev` 或打包后的应用中测试。

## 鸣谢

### 开源项目

- [daac-tools/vibrato](https://github.com/daac-tools/vibrato)：用于日语文本分词 / 形态素分析。Vibrato 基于 Viterbi 算法实现，采用 MIT License / Apache License 2.0 双许可证。

### 素材与音效

- [効果音ラボ](https://soundeffect-lab.info/)
- [Kenney](https://kenney.nl/)

## License

[MIT](LICENSE) © [idiotbaka](https://github.com/idiotbaka)
