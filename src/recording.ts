import { Page } from 'puppeteer-core'

import {
  DeepPartial,
  defaultCorePuppeteerLaunchOptions,
  defaultPuppeteerLaunchOptions,
  DependencyInterface,
  DualLaunchOptions,
  FrameFormat,
} from './types.js'

export interface RecordingSpec {
  network: {
    latencyMs: number
    downloadThroughputMbps: number
    uploadThroughputMbps: number
  }
  cpuThrottling: number
  headers: { [key: string]: string }
  viewportWidth: number
  timeoutMs: number
  preferSystemChrome: boolean
  puppeteer: DualLaunchOptions
}

export function defaultRecordingSpec(): RecordingSpec {
  const puppeteer = process.env.USE_PUPPETEER ? defaultPuppeteerLaunchOptions : defaultCorePuppeteerLaunchOptions

  return {
    network: {
      // Network conditions
      latencyMs: 20, // Latency in milliseconds
      downloadThroughputMbps: 10, // Download throughput in Mbps
      uploadThroughputMbps: 10, // Upload throughput in Mbps
    },
    cpuThrottling: 4, // CPU throttling rate
    headers: {
      // HTTP request headers
      // 'User-Agent':
      //   'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1',
      // 'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    viewportWidth: 375, // Viewport width in pixels
    timeoutMs: 30 * 1000, // Navigation timeout in milliseconds
    preferSystemChrome: false, // Use system Chrome if available
    puppeteer,
  }
}

export function mergeRecordingSpec(base: RecordingSpec, optional?: DeepPartial<RecordingSpec>): RecordingSpec {
  // Merge headers with case-insensitive keys
  const lowerCasedBaseHeaders = Object.keys(base.headers).reduce<{ [key: string]: string }>((acc, key) => {
    acc[key.toLowerCase()] = base.headers[key]
    return acc
  }, {})

  const lowerCasedOptionalHeaders = Object.keys(optional?.headers || {}).reduce<{ [key: string]: string }>(
    (acc, key) => {
      if (optional?.headers[key] !== undefined) {
        acc[key.toLowerCase()] = optional?.headers[key]
      }
      return acc
    },
    {}
  )

  const puppeteer = {
    ...base.puppeteer,
    ...(optional?.puppeteer ?? {}),
    args: [...(base.puppeteer?.args || []), ...(optional?.puppeteer?.args || [])],
  } as DualLaunchOptions

  return {
    ...base,
    ...optional,
    network: { ...base.network, ...(optional?.network ?? {}) },
    headers: { ...lowerCasedBaseHeaders, ...lowerCasedOptionalHeaders },
    puppeteer,
  }
}

export interface RecordingInput extends RecordingSpec {
  frameFormat: FrameFormat
  frameQuality: number
  screen: { width: number; height: number }
  url: string
}

export interface ResourcesLoading {
  all: number
  images: number
}

export interface ResourcesLoadingHistory extends ResourcesLoading {
  timestampMs: number
}

export interface ScreenFrame {
  time: number
  resourcesLoading: ResourcesLoading
  base64Data: string
}

export interface Timing {
  ttfrUrl?: string
  ttfrMs?: number // Time To First Response (almost TTFB)
  onDCLMs?: number
  onLoadMs?: number
  screenFixMs?: number
}

export interface RecordingOutput {
  screenFrames: ScreenFrame[]
  title?: string
  timing: Timing
  totalResourcesLoading: ResourcesLoading
}

export async function recordPageLoading(
  input: RecordingInput,
  dependency: Pick<DependencyInterface, 'logger' | 'withPuppeteer'>
): Promise<RecordingOutput> {
  dependency.logger?.trace({ input }, `recordPageLoading received input`)

  const output: RecordingOutput = { screenFrames: [], totalResourcesLoading: { all: 0, images: 0 }, timing: {} }
  const resourcesLoadingHistories: ResourcesLoadingHistory[] = [{ images: 0, all: 0, timestampMs: 0 }]

  let startedAt: number

  dependency.logger?.debug({}, `Launching puppeteer`)
  await dependency.withPuppeteer(
    input.puppeteer,
    async (page: Page) => {
      dependency.logger?.debug({}, `Setting up viewport and headers`)
      const deviceScaleFactor = input.screen.width / input.viewportWidth
      const viewport = {
        width: input.viewportWidth,
        height: Math.ceil(input.screen.height / deviceScaleFactor),
      }

      await page.setViewport({ ...viewport, deviceScaleFactor })
      await page.setExtraHTTPHeaders(input.headers)

      dependency.logger?.debug({}, `Creating CDP session in puppeteer`)
      const cdp = await page.createCDPSession()

      // It seems to be good to set window bounds after viewport setting
      const { windowId } = await cdp.send('Browser.getWindowForTarget')
      await cdp.send('Browser.setWindowBounds', { windowId, bounds: viewport })

      // Network settings
      dependency.logger?.debug({}, `Setting up network conditions via CDP`)
      await cdp.send('Network.enable')
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: input.network.latencyMs,
        downloadThroughput: Math.floor((input.network.downloadThroughputMbps * 1024 * 1024) / 8),
        uploadThroughput: Math.floor((input.network.uploadThroughputMbps * 1024 * 1024) / 8),
      })

      // CPU throttling
      dependency.logger?.debug({}, `Setting up CPU throttling via CDP`)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: input.cpuThrottling })

      // Event listeners
      dependency.logger?.debug({}, `Setting event listeners`)

      // Disable dialogs
      page.on('dialog', async (dialog) => {
        dependency.logger?.debug({ message: dialog.message() }, `Dialog event received`)
        await dialog.dismiss()
      })

      // On response
      page.on('response', (response) => {
        const url = response.url()

        // Mark time to first response
        if (output.timing.ttfrMs === undefined) {
          output.timing.ttfrMs = Date.now() - startedAt
          output.timing.ttfrUrl = url
        }

        const status = response.status() || 0
        const headers = response.headers()
        const mime = headers['content-type'] || ''

        // Ignore non-2xx responses
        if (status < 200 || status >= 300) return

        response
          .buffer()
          .then((buffer) => {
            // Count up resource size
            output.totalResourcesLoading.all += buffer.length
            if (mime && mime.startsWith('image/')) {
              output.totalResourcesLoading.images += buffer.length
            }

            // Record resource receiving history to show progress bar
            resourcesLoadingHistories.push({ timestampMs: Date.now() - startedAt, ...output.totalResourcesLoading })
          })
          .catch((err) => {
            // Ignore buffer error
            dependency.logger?.debug({ url, message: err.message }, `Failed to buffer response ${url}`)
          })
      })

      // DCL event
      page.on('domcontentloaded', () => {
        dependency.logger?.debug({}, `Received DCL event`)

        // Get HTML title
        page
          .$eval('title', (el) => el.textContent)
          .then((title) => {
            output.title = title || ''
          })
          .catch((err) => {
            dependency.logger?.warn({ err }, `Failed to get title on DCL`)
          })

        output.timing.onDCLMs = Date.now() - startedAt
      })

      // Onload event
      page.on('load', () => {
        dependency.logger?.debug({}, `Received load event`)
        output.timing.onLoadMs = Date.now() - startedAt
      })

      // Screencast frame event
      cdp.on('Page.screencastFrame', async (f) => {
        dependency.logger?.trace({}, `Received screencast frame at ${f.metadata.timestamp}`)

        // Update onScreenFix time and push the frame
        const time = Math.floor(f.metadata.timestamp * 1000) - startedAt
        output.screenFrames.push({
          time,
          // Resources loading as placeholder
          // The actual resources loading will be calculated later
          // Because the timing of this event seems bo be delayed by about 50ms due to encoding
          resourcesLoading: { images: 0, all: 0 },
          base64Data: f.data,
        })
        await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId })

        // screenFix is the time last frame received
        output.timing.screenFixMs = time
      })

      // Start screencast
      dependency.logger?.debug({}, `Starting screencast`)
      await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: input.frameQuality,
        everyNthFrame: 1,
      })

      startedAt = Date.now()

      try {
        // Start navigation to the url
        dependency.logger?.debug({}, `Starting page navigation`)
        await page.goto(input.url, {
          waitUntil: 'load',
          timeout: input.timeoutMs,
        })

        dependency.logger?.debug({}, `Stopping screencast and waiting to finish`)
        await cdp.send('Page.stopScreencast')
        // Wait for a while maybe the last frame is not captured
        await new Promise((ok) => setTimeout(ok, 500))
      } catch (err) {
        dependency.logger?.error({ err }, `Failed to navigate to ${input.url}`)
      } finally {
        dependency.logger?.debug({}, `Detaching CDP session`)
        await cdp.detach()
      }
    },
    input.preferSystemChrome
  )

  dependency.logger?.debug({}, `Calculating frames metadata`)

  // Match nearest resources loading timing to screencast frames
  for (let i = 0; i < output.screenFrames.length; i++) {
    const frame = output.screenFrames[i]
    const resourcesLoading = resourcesLoadingHistories.filter((h) => h.timestampMs <= frame.time).pop()
    frame.resourcesLoading = { ...resourcesLoading }
  }

  // Force to set the last frame resources loading to the total
  const lastFrame = output.screenFrames[output.screenFrames.length - 1]
  lastFrame.resourcesLoading = { ...output.totalResourcesLoading }

  return output
}
