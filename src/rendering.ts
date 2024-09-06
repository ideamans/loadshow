import Path from 'path'

import { FrameFile } from './composition.js'
import { CommandOutput, DeepPartial, DependencyInterface } from './types.js'

export interface RenderingSpec {
  // blank
  outroMs: number
  ffmpegArgs: string[]
}

export function defaultRenderingSpec(): RenderingSpec {
  return {
    outroMs: 1000,
    ffmpegArgs: [],
  }
}

export function mergeRenderingSpec(base: RenderingSpec, optional?: DeepPartial<RenderingSpec>): RenderingSpec {
  return {
    ...base,
    ...(optional ?? {}),
    ffmpegArgs: [...base.ffmpegArgs, ...(optional?.ffmpegArgs ?? [])],
  }
}

export interface RenderingInput extends RenderingSpec {
  frameFiles: FrameFile[]
  timelineFilePath: string
  ffmpegArgsPath: string
  videoFilePath: string
}

export interface RenderingOutput {
  ffmpegCommandOutput: CommandOutput
}

export async function renderVideo(
  input: RenderingInput,
  dependency: Pick<DependencyInterface, 'logger' | 'writeStringFile' | 'ffmpeg'>
): Promise<RenderingOutput> {
  dependency.logger?.trace({ input }, `renderVideo received input`)

  const frameFiles = [...input.frameFiles]
  const timelineDirPath = Path.dirname(input.timelineFilePath)

  // Create a timeline file to make a video
  // file 'frame1.png'
  // duration 1.0
  // ...
  dependency.logger?.debug({}, `Creating timeline file ${input.timelineFilePath}`)
  let currentMs = 0
  const timeline: string[] = []
  for (const frameFile of frameFiles) {
    const durationMs = frameFile.time - currentMs
    const relPath = Path.relative(timelineDirPath, frameFile.path)
    timeline.push(`file '${relPath}'`)
    timeline.push(`duration ${durationMs / 1000}`)
    currentMs = frameFile.time
  }

  // Add outro: stop at the last frame for a while
  const lastFrame = frameFiles[frameFiles.length - 1]
  const relPath = Path.relative(timelineDirPath, lastFrame.path)
  if (input.outroMs > 0) {
    const lastDurationSec = input.outroMs / 1000
    timeline.push(`file '${relPath}'`)
    timeline.push(`duration ${lastDurationSec}`)
  }

  // The last frame is necessary to prevent looping
  timeline.push(`file '${relPath}'`)

  // Make the video with the timeline file
  await dependency.writeStringFile(input.timelineFilePath, timeline.join('\n'))

  dependency.logger?.debug({}, `Rendering video ${input.videoFilePath} with ffmpeg`)
  const ffmpegArgs = [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    input.timelineFilePath,
    '-vsync',
    'vfr',
    // '-pix_fmt',
    // 'yuv420p',
    ...input.ffmpegArgs,
    input.videoFilePath,
  ]
  await dependency.writeStringFile(
    input.ffmpegArgsPath,
    ffmpegArgs
      .map((arg) => {
        return arg.includes(' ') ? `'${arg}'` : arg
      })
      .join(' ')
  )
  const ffmpegCommandOutput = await dependency.ffmpeg(ffmpegArgs)
  if (ffmpegCommandOutput.exitCode !== 0) {
    dependency.logger?.error(
      ffmpegCommandOutput,
      `Failed to execute ffmpeg with exit code ${ffmpegCommandOutput.exitCode}`
    )
    throw new Error(`Failed to render video: ${ffmpegCommandOutput.stderr}`)
  }

  return {
    ffmpegCommandOutput,
  }
}
