# Android release APK 构建与签名

脚本 `build-android.ps1` 会依次完成：

1. 调用 Tauri 编译 release APK。
2. 默认按 ABI 分包。
3. 使用 Android SDK Build Tools 中的 `zipalign` 对齐 APK。
4. 使用 `apksigner` 签名并校验每个 APK。
5. 将可安装的 APK 输出到项目根目录的 `android-release/`。

## 前置条件

- 已安装 Node.js、Rust、Android Studio、Android SDK API 36 和 NDK。
- 已设置 `ANDROID_HOME`，例如 `C:\Users\<用户名>\AppData\Local\Android\Sdk`。
- Windows 已开启开发者模式，避免 Android 构建创建符号链接失败。
- 已运行过 `npm install`。当前仓库已包含 Android 工程；只有重新初始化时才需要运行 `npx tauri android init`。

## 首次使用：生成签名文件并构建

在项目根目录运行：

```powershell
npm run android:release -- -CreateKeystore -KeystorePath .\android-signing\benkyo-ai-release.jks -KeyAlias benkyo-ai
```

脚本会提示输入 keystore 密码和 key 密码。key 密码直接按 Enter 时会复用 keystore 密码。

请妥善备份 `android-signing/benkyo-ai-release.jks`、alias 和密码。后续发布应用更新必须使用同一个签名文件。该目录和常见密钥文件扩展名已加入 `.gitignore`，不要将签名文件提交到 Git。

## 后续构建

```powershell
npm run android:release -- -KeystorePath .\android-signing\benkyo-ai-release.jks -KeyAlias benkyo-ai
```

不传密码时，脚本会安全地提示输入。CI 环境可以改用环境变量：

```powershell
$env:ANDROID_KEYSTORE_PATH = ".\android-signing\benkyo-ai-release.jks"
$env:ANDROID_KEY_ALIAS = "benkyo-ai"
$env:ANDROID_KEYSTORE_PASSWORD = "<keystore password>"
$env:ANDROID_KEY_PASSWORD = "<key password>"
npm run android:release
```

默认输出多个 ABI APK。需要生成单个通用 APK 时使用：

```powershell
npm run android:release -- -KeystorePath .\android-signing\benkyo-ai-release.jks -Universal
```

查看脚本帮助：

```powershell
npm run android:release -- -Help
```

已有未签名 release APK，仅需重新签名时使用：

```powershell
npm run android:release -- -SkipBuild -KeystorePath .\android-signing\benkyo-ai-release.jks -KeyAlias benkyo-ai
```
