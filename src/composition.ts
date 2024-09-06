import Path from 'path'

import Sharp from 'sharp'
import TextToSVG from 'text-to-svg'
const textToSVG = TextToSVG.loadSync()

import { BannerOutput } from './banner.js'
import { LayoutOutput, LayoutSpec } from './layout.js'
import { ResourcesLoading, ScreenFrame } from './recording.js'
import { DeepPartial, DependencyInterface, FrameFormat } from './types.js'

export interface CompositionSpec {
  colorTheme: {
    background: string
    border: string
    progressBackground: string
    progressForeground: string
    progressText: string
    progressTimeText: string
  }
}

export function defaultCompositionSpec(): CompositionSpec {
  return {
    colorTheme: {
      background: '#eee',
      border: '#ccc',
      progressBackground: '#fff',
      progressForeground: '#0a0',
      progressText: '#fff',
      progressTimeText: '#333',
    },
  }
}

export function mergeCompositionSpec(base: CompositionSpec, optional?: DeepPartial<CompositionSpec>): CompositionSpec {
  return {
    ...base,
    ...(optional ?? {}),
    colorTheme: { ...base.colorTheme, ...(optional?.colorTheme ?? {}) },
  }
}

export interface CompositionInput extends CompositionSpec {
  frameFormat: FrameFormat
  frameQuality: number
  screenFrames: ScreenFrame[]
  resourcesLoading: ResourcesLoading
  outputDirPath: string
  layoutInput: LayoutSpec
  layoutOutput: LayoutOutput
  bannerOutput?: BannerOutput
  hasProgressBar: boolean
}

export interface FrameFile {
  path: string
  time: number
}

export interface CompositionOutput {
  dirPath: string
  frameFiles: FrameFile[]
}

export async function compositeFrames(
  input: CompositionInput,
  dependency: Pick<DependencyInterface, 'logger' | 'writeFile'>
): Promise<CompositionOutput> {
  {
    const loggingInput = { ...input }
    delete loggingInput.screenFrames // screenFrames is too large
    dependency.logger?.trace({ input: loggingInput }, `compositeFrames received input`)
  }

  // Frame size
  const frameWidth = input.layoutInput.canvasWidth

  // Progress height
  const progressHeight = input.layoutInput.progressHeight

  // Banner height
  const bannerHeight = input.bannerOutput ? input.bannerOutput.height : 0

  // mp4 needs even height so we round up to the nearest even number
  const rawFrameHeight = bannerHeight + progressHeight + input.layoutInput.canvasHeight
  const frameHeight = Math.ceil(rawFrameHeight / 2) * 2

  // Banner data
  dependency.logger?.debug({}, 'Reading information banner image')
  const bannerBuffer = input.bannerOutput ? await Sharp(input.bannerOutput.outputFilePath).toBuffer() : undefined

  // Build frames in parallel
  async function buildFrame(frame: ScreenFrame): Promise<FrameFile> {
    dependency.logger?.debug({}, `Compositing frame #${frame.time}`)

    // Canvas sharp object
    const base = Sharp({
      create: {
        width: frameWidth,
        height: frameHeight,
        channels: 4,
        background: input.colorTheme.background,
      },
    })

    const overlays: Sharp.OverlayOptions[] = []

    // Place banner
    if (bannerHeight > 0 && bannerBuffer) {
      overlays.push({
        input: bannerBuffer,
        left: 0,
        top: 0,
      })
    }

    // Place progress bar
    if (input.hasProgressBar && progressHeight > 0 && input.resourcesLoading.all > 0) {
      dependency.logger?.debug({}, `Compositing progress bar on frame #${frame.time}`)

      const percentage = frame.resourcesLoading.all / input.resourcesLoading.all
      const width = Math.floor(input.layoutInput.canvasWidth * percentage)

      // Background
      overlays.push({
        input: {
          create: {
            width: input.layoutInput.canvasWidth,
            height: progressHeight,
            channels: 4,
            background: input.colorTheme.progressBackground,
          },
        },
        left: 0,
        top: bannerHeight,
      })

      // Text size
      const fontSize = progressHeight * 0.8
      const textMargin = Math.floor(progressHeight / 2)

      // Time text
      const timeString = `${(frame.time / 1000).toFixed(2)} sec.`
      const timeText = textToSVG.getSVG(timeString, {
        x: 0,
        y: 0,
        fontSize,
        anchor: 'top',
        attributes: { fill: input.colorTheme.progressTimeText },
      })

      overlays.push({
        input: Buffer.from(timeText),
        left: input.layoutInput.canvasWidth - textMargin - Math.floor((timeString.length * fontSize) / 2),
        top: Math.floor(bannerHeight + progressHeight * 0.1),
      })

      // Foreground
      if (width > 0) {
        overlays.push({
          input: {
            create: {
              width,
              height: progressHeight,
              channels: 4,
              background: input.colorTheme.progressForeground,
            },
          },
          left: 0,
          top: bannerHeight,
        })
      }

      // Text
      const text = textToSVG.getSVG(`${Math.round(percentage * 100)} % Loaded`, {
        x: 0,
        y: 0,
        fontSize,
        anchor: 'top',
        attributes: { fill: input.colorTheme.progressText },
      })

      overlays.push({
        input: Buffer.from(text),
        left: textMargin,
        top: Math.floor(bannerHeight + progressHeight * 0.1),
      })
    }

    const canvasOffset = bannerHeight + progressHeight

    // Put borders as rectangles
    if (input.layoutInput.borderWidth > 0) {
      dependency.logger?.debug({}, `Compositing border rectangles on frame #${frame.time}`)
      for (const column of input.layoutOutput.columns) {
        overlays.push({
          input: {
            create: {
              width: column.width,
              height: column.height,
              channels: 4,
              background: input.colorTheme.border,
            },
          },
          left: column.x,
          top: column.y + canvasOffset,
        })
      }
    }

    // Put screen windows inside border rectangles
    dependency.logger?.debug({}, `Compositing screen windows on frame #${frame.time}`)
    const screen = Sharp(
      await Sharp(Buffer.from(frame.base64Data, 'base64')).resize(input.layoutOutput.scroll.width).toBuffer()
    )
    const screenDimensions = await screen.metadata()

    for (const window of input.layoutOutput.windows) {
      const height = Math.min(window.height, screenDimensions.height - window.scrollTop)
      const width = Math.min(window.width, screenDimensions.width)
      if (width <= 0 || height <= 0) break

      // Sharp object seems to be mutable so we need to clone it
      const windowed = screen.clone().extract({ left: 0, top: window.scrollTop, width, height })
      overlays.push({
        input: await windowed.toBuffer(),
        left: window.x,
        top: canvasOffset + window.y,
      })
      if (height < window.height) break
    }

    // Write frame to image file
    const pad = String(frame.time).padStart(10, '0')
    const ext = input.frameFormat === 'png' ? 'png' : 'jpg'
    const path = Path.join(input.outputDirPath, `frame-${pad}.${ext}`)
    const buffer = await base
      .composite(overlays)
      .toFormat(input.frameFormat, { quality: input.frameQuality })
      .toBuffer()
    await dependency.writeFile(path, buffer)

    // Record frame file path and time
    return { path, time: frame.time }
  }

  const frameFiles: FrameFile[] = await Promise.all(input.screenFrames.map(buildFrame))

  return { dirPath: input.outputDirPath, frameFiles }
}
