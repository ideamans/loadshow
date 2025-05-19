import Pino from 'pino'
import { Page, PuppeteerLaunchOptions } from 'puppeteer'
import { Page as CorePage, PuppeteerLaunchOptions as CorePuppeteerLaunchOptions } from 'puppeteer-core'

// Common types and interfaces

export type DualLaunchOptions = CorePuppeteerLaunchOptions | PuppeteerLaunchOptions
export type DualPage = Page | CorePage

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
  withPuppeteer(
    puppeteerOptions: DualLaunchOptions,
    cb: (page: DualPage) => Promise<void>,
    preferSystemChrome?: boolean,
  ): Promise<void>
  htmlToImage(html: string, outputFilePath: string, puppeteerArgs?: string[]): Promise<void>
  imageDimensions(imageFilePath: string): Promise<{ width: number; height: number }>
}

// To use workflow input makes deeply optional to merge into default values.
export type DeepPartial<T> = T extends object
  ? T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends Map<infer K, infer V>
      ? Map<K, DeepPartial<V>>
      : T extends Set<infer U>
        ? Set<DeepPartial<U>>
        : { [P in keyof T]?: DeepPartial<T[P]> }
  : T

export type FrameFormat = 'png' | 'jpeg'
