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

![apple.com.mp4](https://github.com/ideamans/loadshow/raw/main/readme/apple.com.webp)

### 動画の比較

`juxtapose`サブコマンドで、複数の動画を左右に並べた比較動画を作成できます。

```bash
loadshow juxtapose -o compare.mp4 apple.com.mp4 microsoft.com.mp4
```

上記のコマンドは、`apple.com.mp4`と`microsoft.com.mp4`を左右に配置し、`-o`オプションに指定した`compare.mp4`として出力します。

![compare.mp4](https://github.com/ideamans/loadshow/raw/main/readme/compare.webp)

## TIPS

### 環境変数

次の項目を環境変数で指定できます。

- `LOG_LEVEL` ログレベル (`fatal` | `warn` | `error` | `info` | `debug` | `fatal`) デフォルト値 `info`
- `CHROME_PATH` Chromeのパス (例 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`)
- `FFMPEG_PATH` ffmpegのパス (例 `/opt/homebrew/bin/ffmpeg`) デフォルト値 `ffmpeg` (Windowsの場合 `ffmpeg.exe`)
- `LC_ALL` or `LC_MESSAGES` or `LANG` 情報バナーのロケール (例 `ja-JP`)
- `TZ` 情報バナーのタイムゾーン (例 `Asia/Tokyo`)

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
    preferSystemChrome: false # Puppeteerバンドルのブラウザではなくインストール済みChromeを優先
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

### 使用するブラウザ

`puppeteer`にバンドルされているChromeを利用します。

仕様オプションの`recording.preferSystemChrome`を`true`にすると、システムにChromeがインストールされている場合、それを優先して利用します。

環境変数`CHROME_PATH`の指定がある場合、最優先で適用します。以下はOSごとのシステムChromeの代表的なパスです。

- MacOS `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Windows `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Linux `/usr/bin/google-chrome`

### 情報バナーのカスタマイズ - 表示内容

動画の上部に表示される情報バナーは、HTMLテンプレート([handlebars](https://handlebarsjs.com/))の変数を書き換えることによりカスタマイズできます。

変数自体がテンプレートとして振る舞うので、`{{ }}`などの記号を記述することで他の変数を参照できます。

```yaml
# システムから渡される変数
width: 動画の幅
url: 記録しているURL
htmlTitle: HTMLタイトル
timestampMs: 記録を行った日時のタイムスタンプ(単位 ms)
resourceSizeBytes: リソースサイズ
onLoadTimeMs: 読み込み時間(OnLoad 単位 ms)

# 組み込みヘルパー
datetime: ロケールに合わせた日時タイムスタンプの整形
mb: リソースサイズをMB単位に整形
msToSec: msを秒に整形
i18n: 一部の用語を翻訳
```

仕様オプション`banner.vars`以下の値を変更することでカスタマイズできます。

```yaml
banner:
  vars:
    mainTitle: "{{htmlTitle}}"
    subTitle: "{{url}}"
    credit: "loadshow"
    createdAt: "{{datetime timestampMs}}"
    resourceSizeLabel: "Resource Size"
    resourceSizeValue: "{{mb resourceSizeBytes}}"
    onLoadTimeLabel: "OnLoad Time"
    onLoadTimeValue: "{{msToSec onLoadTimeMs}}"
```

例えば`loadshow`というクレジット表記を変更するには、次のようにコマンドを実行します。

```bash
loadshow record -u "banner.vars.credit=My Loadshow!" https://apple.com/ ./loadshow.mp4
```

### 情報バナーのカスタマイズ - テンプレートの変更

仕様オプション`banner.templateFilePath`にHTMLテンプレートのパスを指定することで、テンプレート自体を変更できます。

あるいは`banner.htmlTemplate`にHTMLテンプレートを直接指定することもできます。この利用方法はYAMLファイルによる仕様の指定を想定しています。

詳しくは`src/banner.ts`を参照してください。

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

### 残課題

- `puppeteer`と同時にインストールされる`Google Chrome for Testing`をGoogle Chromeとして利用する。
  - その方がセットアップが楽。
  - しかし現時点では`Google Chrome for Testing`では縦長のような柔軟なビューポートを制御できない問題がある。そのため事前にインストールされた通常のChromeを必要としている。
