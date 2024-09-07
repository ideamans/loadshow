import Pino from 'pino'
import { LaunchOptions, Page } from 'puppeteer-core'

// Common types and interfaces

export interface CommandOutput {
  exitCode: number
  stdout: string
  stderr: string
}

export interface DependencyInterface {
  logger?: Pino.Logger
  withSubLogger(ns: string): DependencyInterface
  ffmpeg(args: string[]): Promise<CommandOutput>
  readStringFile(filePath: string): Promise<string>
  writeStringFile(filePath: string, content: string): Promise<void>
  writeFile(filePath: string, buffer: Buffer): Promise<void>
  mkdirp(dirPath: string, recreate?: boolean): Promise<void>
  withPuppeteer(puppeteerOptions: LaunchOptions, cb: (page: Page) => Promise<void>): Promise<void>
  htmlToImage(html: string, outputFilePath: string): Promise<void>
  imageDimensions(imageFilePath: string): Promise<{ width: number; height: number }>
}

// To use workflow input makes deeply optional to merge into default values.
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends Record<string, unknown> | undefined
    ? DeepPartial<T[P]>
    : T[P]
}

export type FrameFormat = 'png' | 'jpeg'
