# loadshow

`loadshow`は、Webページの読み込みプロセスを動画に記録するオープンソースのCLIツールです。

- Webページの読み込みスピードの比較は感覚と記憶に頼りがち
- PageSpeed Insightsなどの数値による評価は専門家以外にわかりにくい

このような問題意識から、Webページの読み込みスピードをわかりやすく表現し、直感的に比較する方法として開発しました。

読み込みスピードの改善結果の前後や、競合サイトとの比較などに活用ください。

## はじめよう

### 必要なソフトウェア

- Node.js >= 20
- ffmpeg

### インストール

```bash
npm i -g loadshow
```

### 動画の記録

`record`サブコマンドでWebページの読み込み過程を動画に記録します。URLと成果物を格納するディレクトリを指定します。

```bash
loadshow record https://apple.com/ ./loadshow.mp4
```

上記のコマンドは、`https://apple.com/`の読み込み過程を記録した`./loadshow.mp4`を作成します。

<video src="https://github.com/ideamans/loadshow/raw/master/readme/apple.com.mp4" muted autoplay playsinline></video>

### 動画の比較

`juxtapose`サブコマンドで、複数の動画を左右に並べた比較動画を作成できます。

```bash
loadshow juxtapose -o compare.mp4 apple.com.mp4 microsoft.com.mp4
```

上記のコマンドは、`apple.com.mp4`と`microsoft.com.mp4`を左右に配置し、`-o`オプションに指定した`compare.mp4`として出力します。

<video src="https://github.com/ideamans/loadshow/raw/master/readme/compare.mp4" muted autoplay playsinline></video>

## TIPS

### 環境変数

次の項目を環境変数で指定できます。

- `LOG_LEVEL` ログレベル (`fatal` | `warn` | `error` | `info` | `debug` | `fatal`) デフォルト値 `info`
- `FFMPEG_PATH` ffmpegのパス (例 `/opt/homebrew/bin/ffmpeg`) デフォルト値 `ffmpeg`
- `CHROME_PATH` Chromeのパス (例 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`)
- `LC_ALL` or `LC_MESSAGES` or `LANG` 情報バナーのロケール (例 `ja-JP`)
- `TZ` 情報バナーのタイムゾーン (例 `Asia/Tokyo`)

`CHROME_PATH`は指定しなければ`puppeteer`のデフォルトブラウザを使用します。Chromeを用いる場合は以下の値を参考にしてください。

- MacOS `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Windows `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Linux `/usr/bin/google-chrome`

### 動画の仕様とカスタマイズ

動画の仕様は次のように構造化されたオブジェクトで規定されています。それぞれのデフォルト値とともに示します。

```yaml
frameFormat: 'png' # 中間画像フォーマット (pngまたはjpeg。jpegの方がやや軽量)
frameQuality: 85 # 中間画像フォーマットがjpegの場合の品質値
hasBanner: true # 情報バナーの表示
hasProgressBar: true # プログレスバーの表示
layout:
  canvasWidth: 512 # 動画エリアの幅
  canvasHeight: 640 # 動画エリアの高さ
  columns: 3 # カラム数
  gap: 20 # カラム間の幅
  padding: 20 # 動画エリアの余白
  borderWidth: 1 # 罫線の幅
  indent: 20 # 第二カラム移行の頭下げ
  outdent: 20 # 第一カラムの下方の余白
  progressHeight: 16 # プログレスバーの幅
recording:
    network: # ネットワーク設定
      latencyMs: 20 # レイテンシー (単位 ms)
      downloadThroughputMbps: 10 # ダウンロードスループット (単位 Mbps)
      uploadThroughputMbps: 10 # アップロードスループット (単位 Mbps)
    },
    cpuThrottling: 4 # CPUスロットリング (スマホ相当にするため4 = 性能1/4)
    headers: # HTTPリクエストヘッダ
    viewportWidth: 375 # ビューポート幅
    timeoutMs: 30000 # タイムアウト (単位 ms)
    puppeteer: # puppeteerの設定 `PuppeteerLaunchOptions`
      headless: 'new',
      args: # 文字列
        - '--incognito'
        - '--hide-scrollbars'
banner: # 情報バナー
  templateFilePath: "" # HTMLテンプレート (ファイル指定)
  htmlTemplate: "" # HTMLテンプレート (テキスト指定)
  vars: # HTMLテンプレートに渡す変数 (オブジェクト)
    # var1: "値1"
composition:
  colorTheme:
    background: '#eee' # 動画エリアの背景
    border: '#ccc' # 罫線
    progressBackground: '#fff' # プログレスバーの背景
    progressForeground: '#0a0' # プログレスバー
    progressText: '#fff' # プログレスバーの文字
    progressTimeText: '#333' # 経過時間の文字
rendering:
  outroMs: 1000 # 読み込み完了後の静止時間 (単位 ms)
  ffmpegArgs: # ffmpegへの追加オプション (文字列配列)
    # - "..."
```

これらの値を必要に応じて一部上書きして、作成される動画をカスタマイズできます。値を上書きする方法はふたつあります。

```bash
# -u オプションによる上書き (複数可)
loadshow record -u "layout.canvasWidth=500" -u "frameFormat: jpeg" https://apple.com/ ./loadshow.mp4

# YAMLファイルでまとめて変更する場合
loadshow record -s spec.yml https://apple.com/ ./loadshow.mp4
```

`spec.yml`には、以下の例のように上書きしたい属性のみ記述します。

```yaml
frameFormat: jpeg
layout:
  canvasWidth: 500
```

### API

プログラムの一部として呼び出すには以下のように記述します。

```js
import Fs from 'fs'
import { Dependency, runLoadshow, defaultLoadshowSpec, mergeLoadshowSpec } from 'loadshow'

async function main() {
  // 外部依存
  const dependency = new Dependency()
  // Pino loggerをカスタマイズ / 削除可能
  // dependency.logger = ... / delete dependency.logger

  // 動画の仕様カスタマイズ
  const spec = mergeLoadshowSpec(defaultLoadshowSpec(), {
    layout: {
      canvasWidth: 500,
    },
    frameFormat: 'jpeg'
  })

  // 仕様・URL・動画パス・成果物ディレクトリを入力とする
  Fs.mkdirSync('./loadshow', { recursive: true })
  const input = {
    ...spec,
    url: 'https://github.com/',
    videoFilePath: './loadshow.mp4'
    artifactsDirPath: './loadshow',
  }

  // loadshowの実行
  const output = runLoadshow(spec, dependency)

  // 結果の参照
  console.log(output)
}

main()
```

## ライセンス

Apache License 2.0 の下で公開します。

技術サポートを希望の方は問い合わせください。

- 窓口 <contact@ideamans.com>

## 開発

### セットアップ

```bash
git clone <url>
cd <dir>
yarn
```

MacOS Arm64の場合、モジュール`sharp`の関係で次のコマンドが必要な模様。

```bash
yarn --ignore-engines
```

### テスト

```bash
yarn test
```

テストカバレッジは進捗予定。

### 簡易デバッグ

`src/adhoc.ts`を改変して以下のプログラムを実行。

```bash
yarn adhoc
```
