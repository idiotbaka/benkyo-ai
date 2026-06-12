[CmdletBinding()]
param(
    [switch]$Help,
    [string]$KeystorePath = $env:ANDROID_KEYSTORE_PATH,
    [string]$KeyAlias = $env:ANDROID_KEY_ALIAS,
    [string]$KeystorePassword = $env:ANDROID_KEYSTORE_PASSWORD,
    [string]$KeyPassword = $env:ANDROID_KEY_PASSWORD,
    [switch]$CreateKeystore,
    [string]$DistinguishedName = "CN=Benkyo AI, OU=Development, O=Benkyo AI, L=Unknown, S=Unknown, C=CN",
    [int]$ValidityDays = 10000,
    [string]$OutputDir,
    [switch]$SkipBuild,
    [switch]$Universal
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Show-Usage {
    @"
Build and sign release APKs for Benkyo AI.

Usage:
  npm run android:release -- -KeystorePath <path> [-KeyAlias <alias>]
  npm run android:release -- -CreateKeystore -KeystorePath <path> [-KeyAlias <alias>]

Options:
  -CreateKeystore       Create a release keystore before building. Use only once.
  -KeystorePath         Keystore path. Defaults to ANDROID_KEYSTORE_PATH.
  -KeyAlias             Key alias. Defaults to ANDROID_KEY_ALIAS or "benkyo-ai".
  -OutputDir            Signed APK output directory. Defaults to .\android-release.
  -SkipBuild            Sign existing Gradle release APKs without rebuilding.
  -Universal            Build one universal APK instead of one APK per ABI.
  -Help                 Show this help.

Passwords default to ANDROID_KEYSTORE_PASSWORD and ANDROID_KEY_PASSWORD.
When they are not set, the script prompts for them without echoing input.
"@
}

function Get-FullPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$BasePath
    )

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $BasePath $Path))
}

function Read-PlainTextSecret {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Prompt
    )

    $secureValue = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Get-RequiredCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required command '$Name' was not found in PATH."
    }

    return $command.Source
}

function Invoke-External {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    Write-Host "==> $Description"
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

function Get-AndroidSdkPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot
    )

    $candidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT)
    $localPropertiesPath = Join-Path $RepoRoot "src-tauri\gen\android\local.properties"

    if (Test-Path -LiteralPath $localPropertiesPath) {
        $sdkLine = Get-Content -LiteralPath $localPropertiesPath |
            Where-Object { $_ -match "^\s*sdk\.dir\s*=" } |
            Select-Object -First 1

        if ($sdkLine) {
            $sdkPath = $sdkLine -replace "^\s*sdk\.dir\s*=\s*", ""
            $sdkPath = $sdkPath -replace "\\:", ":" -replace "\\\\", "\"
            $candidates += $sdkPath
        }
    }

    if ($env:LOCALAPPDATA) {
        $candidates += (Join-Path $env:LOCALAPPDATA "Android\Sdk")
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Container)) {
            return [System.IO.Path]::GetFullPath($candidate)
        }
    }

    throw "Android SDK was not found. Set ANDROID_HOME to your Android SDK directory."
}

function Get-BuildToolsVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $parts = @([regex]::Matches($Name, "\d+") | ForEach-Object { [int]$_.Value })
    while ($parts.Count -lt 4) {
        $parts += 0
    }

    return [version]::new($parts[0], $parts[1], $parts[2], $parts[3])
}

function Get-AndroidSigningTools {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SdkPath
    )

    $buildToolsRoot = Join-Path $SdkPath "build-tools"
    if (-not (Test-Path -LiteralPath $buildToolsRoot -PathType Container)) {
        throw "Android SDK Build Tools were not found under '$buildToolsRoot'."
    }

    $toolDirectories = Get-ChildItem -LiteralPath $buildToolsRoot -Directory |
        Sort-Object -Property @{ Expression = { Get-BuildToolsVersion $_.Name } } -Descending

    foreach ($directory in $toolDirectories) {
        $zipalign = @("zipalign.exe", "zipalign") |
            ForEach-Object { Join-Path $directory.FullName $_ } |
            Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
            Select-Object -First 1
        $apksigner = @("apksigner.bat", "apksigner") |
            ForEach-Object { Join-Path $directory.FullName $_ } |
            Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
            Select-Object -First 1

        if ($zipalign -and $apksigner) {
            return @{
                Zipalign = $zipalign
                Apksigner = $apksigner
                Version = $directory.Name
            }
        }
    }

    throw "zipalign and apksigner were not found under '$buildToolsRoot'."
}

if ($Help) {
    Show-Usage
    exit 0
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if (-not $KeyAlias) {
    $KeyAlias = "benkyo-ai"
}
if (-not $OutputDir) {
    $OutputDir = Join-Path $repoRoot "android-release"
}
$OutputDir = Get-FullPath -Path $OutputDir -BasePath $repoRoot

if (-not $KeystorePath) {
    throw "Keystore path is required. Pass -KeystorePath or set ANDROID_KEYSTORE_PATH."
}
$KeystorePath = Get-FullPath -Path $KeystorePath -BasePath $repoRoot

if (-not $KeystorePassword) {
    $KeystorePassword = Read-PlainTextSecret "Keystore password"
}
if (-not $KeyPassword) {
    $KeyPassword = Read-PlainTextSecret "Key password (press Enter to reuse the keystore password)"
    if (-not $KeyPassword) {
        $KeyPassword = $KeystorePassword
    }
}

$node = Get-RequiredCommand "node"
$npx = Get-RequiredCommand "npx"
$keytool = Get-RequiredCommand "keytool"
$sdkPath = Get-AndroidSdkPath -RepoRoot $repoRoot
$signingTools = Get-AndroidSigningTools -SdkPath $sdkPath

Write-Host "==> Android SDK: $sdkPath"
Write-Host "==> Android Build Tools: $($signingTools.Version)"

if ($CreateKeystore) {
    if (Test-Path -LiteralPath $KeystorePath) {
        throw "Keystore already exists at '$KeystorePath'. Remove -CreateKeystore to use it."
    }

    $keystoreDirectory = Split-Path -Parent $KeystorePath
    New-Item -ItemType Directory -Path $keystoreDirectory -Force | Out-Null
    Invoke-External -FilePath $keytool -Description "Creating release keystore" -Arguments @(
        "-genkeypair",
        "-v",
        "-keystore", $KeystorePath,
        "-storepass", $KeystorePassword,
        "-keypass", $KeyPassword,
        "-alias", $KeyAlias,
        "-storetype", "JKS",
        "-keyalg", "RSA",
        "-keysize", "2048",
        "-validity", "$ValidityDays",
        "-dname", $DistinguishedName
    )
}
elseif (-not (Test-Path -LiteralPath $KeystorePath -PathType Leaf)) {
    throw "Keystore was not found at '$KeystorePath'. Use -CreateKeystore for the first build."
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$buildArguments = @("tauri", "android", "build", "--apk")
if (-not $Universal) {
    $buildArguments += "--split-per-abi"
}

if (-not $SkipBuild) {
    Push-Location $repoRoot
    try {
        Invoke-External -FilePath $node -Arguments @("scripts/sync-android-app-name.mjs") -Description "Syncing Android app name"
        Invoke-External -FilePath $npx -Arguments $buildArguments -Description "Building release APKs with Tauri"
    }
    finally {
        Pop-Location
    }
}

$apkOutputRoot = Join-Path $repoRoot "src-tauri\gen\android\app\build\outputs\apk"
if (-not (Test-Path -LiteralPath $apkOutputRoot -PathType Container)) {
    throw "Gradle APK output directory was not found at '$apkOutputRoot'."
}

$unsignedApks = Get-ChildItem -LiteralPath $apkOutputRoot -Recurse -File -Filter "*.apk" |
    Where-Object {
        $_.FullName -match "[\\/]release[\\/]" -and
        $_.BaseName -notmatch "-(signed|aligned)$" -and
        (($Universal -and $_.FullName -match "[\\/]universal[\\/]") -or
            (-not $Universal -and $_.FullName -notmatch "[\\/]universal[\\/]"))
    }

if (-not $unsignedApks) {
    throw "No release APKs were found under '$apkOutputRoot'."
}

$signedApks = @()
foreach ($apk in $unsignedApks) {
    $artifactName = $apk.BaseName -replace "-unsigned$", ""
    $alignedApk = Join-Path $OutputDir "$artifactName-aligned.apk"
    $signedApk = Join-Path $OutputDir "$artifactName-signed.apk"

    Remove-Item -LiteralPath $alignedApk, $signedApk -Force -ErrorAction SilentlyContinue

    Invoke-External -FilePath $signingTools.Zipalign -Description "Aligning $($apk.Name)" -Arguments @(
        "-p",
        "-f",
        "4",
        $apk.FullName,
        $alignedApk
    )
    Invoke-External -FilePath $signingTools.Apksigner -Description "Signing $($apk.Name)" -Arguments @(
        "sign",
        "--ks", $KeystorePath,
        "--ks-key-alias", $KeyAlias,
        "--ks-pass", "pass:$KeystorePassword",
        "--key-pass", "pass:$KeyPassword",
        "--out", $signedApk,
        $alignedApk
    )
    Invoke-External -FilePath $signingTools.Apksigner -Description "Verifying $(Split-Path -Leaf $signedApk)" -Arguments @(
        "verify",
        "--verbose",
        "--print-certs",
        $signedApk
    )

    Remove-Item -LiteralPath $alignedApk -Force
    $signedApks += $signedApk
}

Write-Host ""
Write-Host "Signed APKs:"
$signedApks | ForEach-Object { Write-Host "  $_" }
