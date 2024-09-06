import Fsp from 'fs/promises'

import { execa } from 'execa'
import ImageSize from 'image-size'
import NodeHtmlToImage from 'node-html-to-image'
import Pino from 'pino'
import Puppeteer, { LaunchOptions, Page } from 'puppeteer'

import { CommandOutput, DependencyInterface } from './types.js'

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
        },
      },
    })
  }

  withSubLogger(ns: string): Dependency {
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
    const output = await execa(process.env.FFMPEG_PATH || 'ffmpeg', args, {
      reject: false,
    })
    return {
      exitCode: output.exitCode,
      stdout: output.stdout,
      stderr: output.stderr,
    }
  }

  async withPuppeteer(puppeteerOptions: LaunchOptions, cb: (page: Page) => Promise<void>): Promise<void> {
    // Launch puppeteer and allow to manipulate the page tab
    const options = {
      ...puppeteerOptions,
    }
    if (process.env.CHROME_PATH) {
      options.executablePath = process.env.CHROME_PATH
    }
    const browser = await Puppeteer.launch(options)
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
