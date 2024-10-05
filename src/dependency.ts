import Fsp from 'fs/promises'

import { Browser, ChromeReleaseChannel, computeSystemExecutablePath } from '@puppeteer/browsers'
import { execa } from 'execa'
import ImageSize from 'image-size'
import NodeHtmlToImage from 'node-html-to-image'
import Pino from 'pino'
import Puppeteer, { PuppeteerLaunchOptions } from 'puppeteer'
import PuppeteerCore, { PuppeteerLaunchOptions as CorePuppeteerLaunchOptions } from 'puppeteer-core'

import { CommandOutput, DependencyInterface, DualLaunchOptions, DualPage } from './types.js'

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
          hideObject: !Boolean(process.env.LOG_OBJECTS),
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
        if (ex.code !== 'ENOENT') {
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
      exitCode: output.exitCode,
      stdout: output.stdout,
      stderr: output.stderr,
    }
  }

  async withPuppeteer(puppeteerOptions: DualLaunchOptions, cb: (page: DualPage) => Promise<void>): Promise<void> {
    // Launch puppeteer and allow to manipulate the page tab
    const options: DualLaunchOptions = {
      ...puppeteerOptions,
    }

    if (process.env.CHROME_PATH) {
      this.logger?.debug({}, `Using CHROME_PATH=${process.env.CHROME_PATH} as the browser`)
      options.executablePath = process.env.CHROME_PATH
    } else {
      const systemChrome = await computeSystemExecutablePath({
        browser: Browser.CHROME,
        channel: ChromeReleaseChannel.STABLE,
      })
      if (systemChrome) {
        this.logger?.debug({}, `Using browser system chrome: ${systemChrome} as the browser`)
        options.executablePath = systemChrome
      }
    }

    if (!options.executablePath) {
      throw new Error(`No executable path for the browser`)
    }

    const browser = await PuppeteerCore.launch(options as CorePuppeteerLaunchOptions)
    const page = await browser.newPage()
    await cb(page)
    await page.close()
    await browser.close()
  }

  async htmlToImage(html: string, outputFilePath: string): Promise<void> {
    this.logger?.trace({ html, outputFilePath }, `Executing node-html-to-image`)
    await NodeHtmlToImage({
      output: outputFilePath,
      html,
    })
  }

  async imageDimensions(imageFilePath: string): Promise<{ width: number; height: number }> {
    return await new Promise<{ width: number; height: number }>((ok, ng) => {
      ImageSize(imageFilePath, (err, { width, height }) => {
        if (err) return ng(err)
        else ok({ width, height })
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
    preferSystemChrome?: boolean
  ): Promise<void> {
    // Launch puppeteer and allow to manipulate the page tab
    const options: DualLaunchOptions = {
      ...puppeteerOptions,
    }

    if (process.env.CHROME_PATH) {
      this.logger?.debug({}, `Using CHROME_PATH=${process.env.CHROME_PATH} as the browser`)
      options.executablePath = process.env.CHROME_PATH
    } else if (preferSystemChrome) {
      const systemChrome = await computeSystemExecutablePath({
        browser: Browser.CHROME,
        channel: ChromeReleaseChannel.STABLE,
      })
      if (systemChrome) {
        this.logger?.debug({}, `Using browser system chrome: ${systemChrome} as the browser`)
        options.executablePath = systemChrome
      }
    } else {
      this.logger?.debug({}, `Using puppeteer's bundled chrome as the browser`)
    }

    const browser = await Puppeteer.launch(options as PuppeteerLaunchOptions)
    const page = await browser.newPage()
    await cb(page)
    await page.close()
    await browser.close()
  }
}
