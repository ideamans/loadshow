# Deterministic Rendering Playbook

この文書は、`page-regression-tester` がブラウザ描画を決定論的にするために採っている全テクニックと、その実装方法を他プロジェクトへ転用する際の手順をまとめたものです。すべて Playwright を前提にしていますが、仕組み自体はどのオートメーションフレームワークでも再現できます。

## 1. アニメーションとモーションの完全停止
- **意図:** トランジションや点滅による 1px 差分を抑止。
- **実装:** `src/capture/deterministic.ts` の `DISABLE_ANIMATIONS_CSS` をそのまま注入。CSS は全要素の animation/transition を `none`+`0s` にし、 caret を透明化、`scroll-behavior` を `auto` に固定しています。

```ts
// src/capture/deterministic.ts
export const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation: none !important;
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition: none !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  html {
    scroll-behavior: auto !important;
  }
  @media (prefers-reduced-motion: no-preference) {
    :root { --force-no-motion: 1; }
  }
`

const context = await browser.newContext({ reducedMotion: 'reduce' })
const page = await context.newPage()
await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS })
```

## 2. 時刻・乱数・高精度タイマの固定
- **意図:** 時刻や乱数を使う UI を常に同じ状態にする。
- **実装:** `generateMockTimeScript` が `Date` を拡張し、引数なしコンストラクタと `Date.now()` を固定値にリダイレクト。`Math.random()` は線形合同法 (LCG) でシード付きに置き換え、`performance.now()` も 0 から進まない値にしています。`getAllDeterministicScripts` で他のスクリプトとまとめて注入します。

```ts
const deterministic = getAllDeterministicScripts('2025-01-01T00:00:00Z', 42)
await page.addInitScript(deterministic)
```

抜粋:

```ts
// src/capture/deterministic.ts
const fixedTimestamp = new Date('${fixedTime}').valueOf()
window.Date = class extends OriginalDate {
  constructor(...args) { super(args.length ? args : fixedTimestamp) }
  static now() { return fixedTimestamp }
}
let seed = ${seed}
Math.random = function() {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
```

## 3. メディア自動再生とタイマーの抑止
- **意図:** 動画・音声・カルーセルの自動進行を無効化。
- **実装:** `DISABLE_AUTOPLAY_SCRIPT` が `HTMLMediaElement.prototype.play/load` をモンキーパッチし、常に `pause()` と `currentTime = 0` を適用。`autoplay`/`loop` アクセサも `false` で固定します。さらに `setInterval/setTimeout` と `clear*` をラップして ID を記録し、ファーストビュー描画後にすべての interval を `clearInterval`。これにより内部タイマーで駆動するスライダーも停止します。

```ts
const intervals = new Set<number>()
const timeouts = new Set<number>()
const originalSetInterval = window.setInterval
const originalSetTimeout = window.setTimeout
const originalClearInterval = window.clearInterval
const originalClearTimeout = window.clearTimeout

window.setInterval = function(...args) {
  const id = originalSetInterval.apply(this, args)
  intervals.add(id)
  return id
}
window.setTimeout = function(...args) {
  const id = originalSetTimeout.apply(this, args)
  timeouts.add(id)
  return id
}
window.clearInterval = function(id) {
  intervals.delete(id)
  return originalClearInterval(id)
}
window.clearTimeout = function(id) {
  timeouts.delete(id)
  return originalClearTimeout(id)
}

window.addEventListener('load', () => {
  setTimeout(() => {
    intervals.forEach(id => originalClearInterval(id))
    intervals.clear()
    document.querySelectorAll('video, audio').forEach(media => {
      media.pause()
      media.currentTime = 0
    })
  }, 100)
})
```

## 4. Lazy Load を強制的に完了させる
- **意図:** Intersection Observer を利用する要素を即座に「表示済み」にする。
- **実装:** `FIX_INTERSECTION_OBSERVER_SCRIPT` が独自クラスを注入。`observe()` されると `setTimeout(0)` で `isIntersecting: true` のエントリを渡し、`intersectionRatio` も `1.0` に固定します。これにより遅延画像や無限スクロールが初回ロードで読み込まれます。

```ts
window.IntersectionObserver = class {
  constructor(callback) { this.callback = callback }
  observe(element) {
    setTimeout(() => {
      this.callback([{
        target: element,
        isIntersecting: true,
        intersectionRatio: 1.0,
        boundingClientRect: element.getBoundingClientRect(),
        intersectionRect: element.getBoundingClientRect(),
        rootBounds: null,
        time: Date.now()
      }], this)
    }, 0)
  }
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}
```

## 5. スクロール関連の副作用を禁止
- **意図:** 自動フォーカスやライブラリがビューポートを動かすのを防ぐ。
- **実装:** `DISABLE_SCROLL_SCRIPT` が `window.scrollTo/scroll`, `Element.prototype.scroll/scrollTo/scrollIntoView` を no-op に置き換え、テスト中はユーザー操作以外のスクロールが発生しません。

```ts
const noop = () => {}
window.scrollTo = noop
window.scroll = noop
Element.prototype.scrollIntoView = function() {}
Element.prototype.scrollTo = function() {}
Element.prototype.scroll = function() {}
```

## 6. Web Animations API の停止
- **意図:** `Element.animate()` を使った JS 駆動アニメーションも止める。
- **実装:** `DISABLE_WEB_ANIMATIONS_SCRIPT` で `Element.prototype.animate` を、常に `playState: 'finished'` を返すダミーオブジェクトに差し替え、`document.getAnimations` なども空配列に固定します。

```ts
Element.prototype.animate = function() {
  return {
    cancel() {}, finish() {}, pause() {}, play() {}, reverse() {},
    playbackRate: 0, playState: 'finished'
  }
}
document.getAnimations = () => []
Element.prototype.getAnimations = () => []
```

## 7. ネットワーク／外部リソースの固定
- **意図:** ブレやすい外部サービスからの差分を遮断／モック。
- **実装:** `executeCapture` のコンテキスト作成直後に `context.route('**/*', handler)` を登録し、CLI の `--block-urls` をワイルドカードから RegExp へ変換して `route.abort()`。Playwright の `route.fulfill()` を追加すれば API フィクスチャも差し込めます。

```ts
await context.route('**/*', route => {
  const url = route.request().url()
  const shouldBlock = options.blockUrls!.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return regex.test(url)
  })
  return shouldBlock ? route.abort() : route.continue()
})
```

## 8. フォントと画像のロード待ち
- **意図:** FOUT/FOIT や遅延画像によるレンダリング差をなくす。
- **実装:** `executeCapture` はナビゲーション後にフォント→画像の順で待機します。`document.fonts` が存在し、`status !== 'loaded'` の場合は `document.fonts.ready` を await。画像は `document.images` を走査し、`img.complete` で未ロードのものだけ `onload/onerror` を Promise 化して待ちます。

```ts
await page.evaluate(async () => {
  if (document.fonts && document.fonts.status !== 'loaded') {
    await document.fonts.ready
  }
})
await page.evaluate(async () => {
  const images = Array.from(document.images)
  await Promise.all(
    images
      .filter(img => !img.complete)
      .map(img => new Promise<void>(resolve => {
        img.onload = img.onerror = () => resolve()
      }))
  )
})
```

## 9. 待機条件の多層化
- **意図:** SPA で特定の UI が揃うまで確実に待つ。
- **実装:** `page.goto(url, { waitUntil: options.waitUntil || 'networkidle' })` でネットワーク安定を待った後、`options.waitSelector` の配列を回りながら `page.waitForSelector(selector, { state: 'visible', timeout })` を実行。セレクタごとのログも出力し、失敗したものは警告します。

```ts
for (const selector of options.waitSelector) {
  await page.waitForSelector(selector, { state: 'visible', timeout })
}
```

## 10. ビューポートとメディア設定の固定
- **意図:** レイアウトを Viewport/DPR 差から守る。
- **実装:** ブラウザコンテキスト生成時に `viewport`, `deviceScaleFactor`, `userAgent`, `reducedMotion` を指定。CLI の `--viewport` / `--dpr` / `--user-agent` オプションで上書きできます。

```ts
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  userAgent: options.userAgent,
  reducedMotion: 'reduce',
})
```

## 11. ダイナミック領域のマスク
- **意図:** どうしても止められない要素を差分対象から外す。
- **実装:** `--mask` で渡したセレクタ群を `page.evaluate` に渡し、各要素へ `style.visibility = 'hidden'` を適用。Playwright の `mask` オプションとは異なり DOM を直接隠す方式のため、同じ領域を再利用できます。

```ts
await page.evaluate((selectors: string[]) => {
  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (el instanceof HTMLElement) el.style.visibility = 'hidden'
    })
  })
}, options.mask)
```

## 12. 構造スナップショットとメタデータ
- **意図:** DOM/スタイル状態を JSON で保存して回帰比較に活用。
- **実装:** `createStructureSnapshot` が `page.evaluate` 内で `extractAllVisibleElements` を実行。`64x64px` 以上かつ表示中の要素を列挙し、`xpath`, `best selector`, `role`, `data-testid`, `text`, `DOMRect`, `computed styles` を収集します。`saveStructureSnapshot` が PNG と同名の `*.snapshot.json` に書き込みます。

```ts
if (options.saveSnapshot) {
  const snapshot = await createStructureSnapshot(page, options.url, viewport, options.snapshotSelectors)
  const snapshotPath = outputPath.replace(/\.(png|jpg|jpeg)$/i, '.snapshot.json')
  await saveStructureSnapshot(snapshot, snapshotPath)
}
```

サンプル出力:

```json
{
  "url": "https://example.com",
  "viewport": { "width": 1440, "height": 900, "dpr": 2 },
  "timestamp": "2024-02-01T12:00:00.000Z",
  "elements": [
    {
      "xpath": "/html/body/header/nav/div[1]",
      "selector": "[data-testid=\"hero\"]",
      "text": "Hero headline",
      "rect": { "x": 0, "y": 64, "width": 1440, "height": 320 },
      "styles": {
        "display": "flex",
        "position": "relative",
        "fontSize": "48px",
        "lineHeight": "56px",
        "color": "rgb(34, 34, 34)",
        "margin": "0px 0px 32px 0px",
        "padding": "64px 0px 64px 0px"
      }
    }
  ]
}
```

## 13. 適用手順（Playwright テンプレート）
1. **コンテキスト作成:** 固定ビューポート・DPR・`reducedMotion: 'reduce'` を設定。
2. **初期化スクリプト:** `getAllDeterministicScripts(mockTime, seed)` を `page.addInitScript` で注入。必要な場合は `DISABLE_ANIMATIONS_CSS` も `addStyleTag` する。
3. **ネットワーク制御:** `context.route` で URL ブロックや `route.fulfill` によるモックを設定。
4. **ナビゲーション & 待機:** `page.goto(..., waitUntil: 'networkidle')` → フォント/画像/任意セレクタ待ち → `page.waitForTimeout(100)` で最終整形。
5. **マスク & キャプチャ:** 動的領域をマスクし、`page.screenshot` でファーストビューを保存。必要なら構造スナップショットも併せて出力する。

これらのステップを組み合わせれば、他プロジェクトでも時間や再読み込みに左右されないピクセルレンダリングを実現できます。
