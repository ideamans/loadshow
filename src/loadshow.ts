import Path from 'path'

import { BannerOutput, BannerSpec, ContextVars, createBanner, defaultBannerSpec, mergeBannerSpec } from './banner.js'
import {
  compositeFrames,
  CompositionInput,
  CompositionOutput,
  CompositionSpec,
  defaultCompositionSpec,
  mergeCompositionSpec,
} from './composition.js'
import { computeLayout, defaultLayoutSpec, LayoutInput, LayoutOutput, LayoutSpec, mergeLayoutSpec } from './layout.js'
import {
  defaultRecordingSpec,
  mergeRecordingSpec,
  RecordingOutput,
  RecordingSpec,
  recordPageLoading,
  ResourcesLoading,
  Timing,
} from './recording.js'
import {
  defaultRenderingSpec,
  mergeRenderingSpec,
  RenderingInput,
  RenderingOutput,
  RenderingSpec,
  renderVideo,
} from './rendering.js'
import { DeepPartial, DependencyInterface, FrameFormat } from './types.js'

export interface LoadshowSpec {
  frameFormat: FrameFormat
  frameQuality: number
  hasBanner: boolean
  hasProgressBar: boolean
  layout: LayoutSpec
  recording: RecordingSpec
  banner: BannerSpec
  composition: CompositionSpec
  rendering: RenderingSpec
}

export function defaultLoadshowSpec(): LoadshowSpec {
  return {
    frameFormat: 'png',
    frameQuality: 85,
    hasBanner: true,
    hasProgressBar: true,
    layout: defaultLayoutSpec(),
    recording: defaultRecordingSpec(),
    banner: defaultBannerSpec(),
    composition: defaultCompositionSpec(),
    rendering: defaultRenderingSpec(),
  }
}

export interface LoadshowInput extends LoadshowSpec {
  url: string
  videoFilePath: string
  artifactsDirPath: string
  progressListener?: {
    afterCalculateLayout?: (input: LayoutInput, output: LayoutOutput) => void
    afterRecordPageLoading?: (input: RecordingSpec, output: RecordingOutput) => void
    afterCreateBanner?: (input: BannerSpec, output: BannerOutput) => void
    afterComposeFrames?: (input: CompositionInput, output: CompositionOutput) => void
    afterRenderVideo?: (input: RenderingInput, output: RenderingOutput) => void
  }
}

export function mergeLoadshowSpec(base: LoadshowSpec, optional?: DeepPartial<LoadshowSpec>): LoadshowSpec {
  return {
    ...base,
    ...(optional ?? {}),
    layout: mergeLayoutSpec(base.layout, optional?.layout),
    recording: mergeRecordingSpec(base.recording, optional?.recording),
    banner: mergeBannerSpec(base.banner, optional?.banner),
    composition: mergeCompositionSpec(base.composition, optional?.composition),
    rendering: mergeRenderingSpec(base.rendering, optional?.rendering),
  }
}

export interface LoadshowOutput {
  url: string
  videoFilePath: string
  title?: string
  timing: Timing
  resources: ResourcesLoading
}

export async function runLoadshow(input: LoadshowInput, dependency: DependencyInterface): Promise<LoadshowOutput> {
  const timestampMs = Date.now()

  dependency.logger?.info({}, `Starting loadshow ${input.url}`)
  dependency.logger?.trace({ input }, `loadshow received input`)

  // Compute layout
  dependency.logger?.info({}, `Calculating layout`)
  const layoutSpec = mergeLayoutSpec(defaultLayoutSpec(), input.layout)
  const layoutInput = { ...layoutSpec }
  const layoutOutput = computeLayout({ ...layoutSpec }, dependency.withSubLogger('layout'))
  dependency.logger?.trace({ layoutOutput }, `computeLayout returned layoutOutput`)
  input.progressListener?.afterCalculateLayout?.(layoutInput, layoutOutput)

  // Web page screen recording
  dependency.logger?.info({}, `Recording web page loading`)
  const recordingSpec = mergeRecordingSpec(defaultRecordingSpec(), input.recording)
  const recordingInput = {
    ...recordingSpec,
    frameFormat: input.frameFormat,
    frameQuality: input.frameQuality,
    url: input.url,
    screen: { ...layoutOutput.scroll },
    timingFilePath: Path.join(input.artifactsDirPath, 'timing.json'),
  }
  const recordingOutput = await recordPageLoading(recordingInput, dependency.withSubLogger('recording'))
  {
    const loggingOutput = { ...recordingOutput }
    delete loggingOutput.screenFrames // screenFrames is too large
    dependency.logger?.trace({ recordingOutput: loggingOutput }, `recordPageLoading returned recordingOutput`)
  }
  input.progressListener?.afterRecordPageLoading?.(recordingInput, recordingOutput)

  // Generate banner
  let bannerOutput: BannerOutput | undefined
  if (input.hasBanner) {
    dependency.logger?.info({}, `Creating information banner`)
    const contextVars: ContextVars = {
      timestampMs,
      width: layoutInput.canvasWidth,
      resourceSizeBytes: recordingOutput.totalResourcesLoading.all,
      onLoadTimeMs: recordingOutput.timing.onLoadMs,
      url: input.url,
      htmlTitle: recordingOutput.title || input.url,
    }
    const bannerSpec = mergeBannerSpec(defaultBannerSpec(), input.banner)
    const bannerInput = {
      ...bannerSpec,
      outputFilePath: Path.join(input.artifactsDirPath, 'banner.png'),
      htmlFilePath: Path.join(input.artifactsDirPath, 'banner.html'),
      varsFilePath: Path.join(input.artifactsDirPath, 'banner.vars.json'),
      contextVars: contextVars,
    }
    bannerOutput = await createBanner(bannerInput, dependency.withSubLogger('banner'))
    dependency.logger?.trace({ bannerOutput }, `createBanner returned bannerOutput`)
    input.progressListener?.afterCreateBanner?.(bannerInput, bannerOutput)
  }

  // Compose screens and banner to frames
  dependency.logger?.info({}, `Composing frames`)
  const framesDirPath = Path.join(input.artifactsDirPath, 'frames')
  await dependency.mkdirp(framesDirPath)
  const compositionSpec = mergeCompositionSpec(defaultCompositionSpec(), input.composition)
  const compositionInput = {
    ...compositionSpec,
    frameFormat: input.frameFormat,
    frameQuality: input.frameQuality,
    screenFrames: recordingOutput.screenFrames,
    resourcesLoading: recordingOutput.totalResourcesLoading,
    outputDirPath: framesDirPath,
    hasProgressBar: input.hasProgressBar,
    bannerOutput,
    layoutInput,
    layoutOutput,
  }
  const compositionOutput = await compositeFrames(compositionInput, dependency.withSubLogger('composition'))
  dependency.logger?.trace({ compositionOutput }, `composeFrames returned compositionOutput`)
  input.progressListener?.afterComposeFrames?.(compositionInput, compositionOutput)

  // Render frames to video
  dependency.logger?.info({}, `Rendering video file`)
  const timelineFilePath = Path.join(input.artifactsDirPath, 'timeline.txt')
  const renderingSpec = mergeRenderingSpec(defaultRenderingSpec(), input.rendering)
  const renderingInput = {
    ...renderingSpec,
    frameFiles: compositionOutput.frameFiles,
    timelineFilePath,
    ffmpegArgsPath: Path.join(input.artifactsDirPath, 'ffmpeg.args.txt'),
    videoFilePath: input.videoFilePath,
  }
  const renderingOutput = await renderVideo(renderingInput, dependency.withSubLogger('rendering'))
  dependency.logger?.trace({ renderingOutput }, `renderVideo returned renderingOutput`)
  input.progressListener?.afterRenderVideo?.(renderingInput, renderingOutput)

  dependency.logger?.info(
    {
      url: input.url,
      title: recordingOutput.title,
      videoFilePath: renderingInput.videoFilePath,
      resources: recordingOutput.totalResourcesLoading,
      timing: recordingOutput.timing,
    },
    'Finished loadshow'
  )

  return {
    url: input.url,
    videoFilePath: renderingInput.videoFilePath,
    title: recordingOutput.title,
    timing: recordingOutput.timing,
    resources: recordingOutput.totalResourcesLoading,
  }
}
