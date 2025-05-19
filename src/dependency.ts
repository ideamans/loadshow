import Fsp from 'node:fs/promises'

import { Browser, ChromeReleaseChannel, computeSystemExecutablePath } from '@puppeteer/browsers'
import { execa } from 'execa'
import ImageSize from 'image-size'
import NodeHtmlToImage from 'node-html-to-image'
import Pino from 'pino'
import Puppeteer, { PuppeteerLaunchOptions } from 'puppeteer'
import PuppeteerCore, { PuppeteerLaunchOptions as CorePuppeteerLaunchOptions } from 'puppeteer-core'

import { CommandOutput, DependencyInterface, DualLaunchOptions, DualPage } from './types.js'

interface ChromeExecutable {
  type: 'env' | 'system' | 'bundled'
  path?: string
}

export class Dependency implements DependencyInterface {
  logger!: Pino.Logger

  constructor(logNamespace?: string) {
    this.logger = Pino({
      level: process.env.LOG_LEVEL || 'info',
      msgPrefix: logNamespace,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          hideObject: !['', '0', 'false', 'no'].includes(process.env.LOG_OBJECTS?.toLowerCase() ?? ''),
        },
      },
    })
  }

  withSubLogger(ns: string) {
    const dependency = new Dependency(`${ns}: `)
    return dependency
  }

  async readStringFile(filePath: string): Promise<string> {
    return Fsp.readFile(filePath, 'utf8')
  }

  async writeStringFile(filePath: string, content: string): Promise<void> {
    await Fsp.writeFile(filePath, content)
  }

  async writeFile(filePath: string, buffer: Buffer): Promise<void> {
    await Fsp.writeFile(filePath, buffer)
  }

  async mkdirp(dirPath: string, recreate?: boolean): Promise<void> {
    if (recreate) {
      try {
        await Fsp.rm(dirPath, { recursive: true })
      } catch (ex) {
        if (ex instanceof Error && 'code' in ex && ex.code !== 'ENOENT') {
          throw ex
        }
      }
    }
    await Fsp.mkdir(dirPath, { recursive: true })
  }

  async ffmpeg(args: string[]): Promise<CommandOutput> {
    this.logger?.trace({ args }, `Executing ffmpeg`)
    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg'
    const output = await execa(ffmpegPath, args, {
      reject: false,
    })
    return {
      exitCode: output.exitCode ?? 0,
      stdout: output.stdout,
      stderr: output.stderr,
    }
  }

  async detectChromeExecutable(preferSystemChrome?: boolean): Promise<ChromeExecutable> {
    if (process.env.CHROME_PATH) {
      this.logger?.debug({}, `Using CHROME_PATH=${process.env.CHROME_PATH} as the browser`)
      return {
        type: 'env',
        path: process.env.CHROME_PATH,
      }
    }

    if (preferSystemChrome) {
      this.logger?.debug({}, `Detecting system chrome`)
      const systemChrome = await computeSystemExecutablePath({
        browser: Browser.CHROME,
        channel: ChromeReleaseChannel.STABLE,
      })

      if (systemChrome) {
        this.logger?.debug({}, `Using system chrome: ${systemChrome}`)
        return {
          type: 'system',
          path: systemChrome,
        }
      }
    }

    this.logger?.debug({}, `Using bundled chrome`)
    return {
      type: 'bundled',
      path: undefined,
    }
  }

  async withPuppeteer(puppeteerOptions: DualLaunchOptions, cb: (page: DualPage) => Promise<void>): Promise<void> {
    // Launch puppeteer and allow to manipulate the page tab
    const options: DualLaunchOptions = {
      ...puppeteerOptions,
    }

    const chrome = await this.detectChromeExecutable(true)
    options.executablePath = chrome.path

    if (!options.executablePath) {
      throw new Error(`No executable path for the browser`)
    }

    const browser = await PuppeteerCore.launch(options as CorePuppeteerLaunchOptions)
    const page = await browser.newPage()
    await cb(page)
    await page.close()
    await browser.close()
  }

  async htmlToImage(html: string, outputFilePath: string, puppeteerArgs?: string[]): Promise<void> {
    const chrome = await this.detectChromeExecutable(false)
    this.logger?.trace({ html, outputFilePath }, `Executing node-html-to-image`)
    await NodeHtmlToImage({
      output: outputFilePath,
      html,
      puppeteer: {
        executablePath: chrome.path,
        args: puppeteerArgs,
      },
    })
  }

  async imageDimensions(imageFilePath: string): Promise<{ width: number; height: number }> {
    return await new Promise<{ width: number; height: number }>((ok, ng) => {
      ImageSize(imageFilePath, (err, result) => {
        if (err) return ng(err)
        if (!result) return ng(new Error(`ImageSize result is undefined`))
        const { width, height } = result
        if (width === undefined || height === undefined) return ng(new Error(`ImageSize result is undefined`))
        ok({ width, height })
      })
    })
  }
}

export class DependencyWithPuppeteer extends Dependency {
  withSubLogger(ns: string) {
    const dependency = new DependencyWithPuppeteer(`${ns}: `)
    return dependency
  }

  async withPuppeteer(
    puppeteerOptions: DualLaunchOptions,
    cb: (page: DualPage) => Promise<void>,
    preferSystemChrome?: boolean,
  ): Promise<void> {
    // Launch puppeteer and allow to manipulate the page tab
    const options: DualLaunchOptions = {
      ...puppeteerOptions,
    }

    const chrome = await this.detectChromeExecutable(preferSystemChrome)
    options.executablePath = chrome.path

    const browser = await Puppeteer.launch(options as PuppeteerLaunchOptions)
    const page = await browser.newPage()
    await cb(page)
    await page.close()
    await browser.close()
  }
}
