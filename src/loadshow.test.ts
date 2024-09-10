import Fs from 'fs'
import Http from 'http'
import Path from 'path'

import test from 'ava'
import GetPort from 'get-port'
import Tmp from 'tmp-promise'

import { Dependency } from './dependency.js'
import { defaultLoadshowSpec, LoadshowInput, runLoadshow } from './loadshow.js'

test('loadshow', async (t) => {
  const dependency = new Dependency()
  delete dependency.logger

  const port = await GetPort()
  const server = Http.createServer((_, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Dummy Page</title>
    <style>
      body {
        background-color: #000000;
        color: #ffffff;
        min-height: 3000px;
      }
    </style>
  </head>
  <body>
    <h1>Dummy Page</h1>
  </body>
</html>`

    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
    }, 500)
  })

  server.listen(port)

  try {
    await Tmp.withDir(
      async ({ path }) => {
        const spec = defaultLoadshowSpec()
        const steps: string[] = []
        const input: LoadshowInput = {
          ...spec,
          url: `http://localhost:${port}`,
          artifactsDirPath: path,
          videoFilePath: Path.join(path, 'loadshow.mp4'),
          progressListener: {
            afterCalculateLayout: () => {
              steps.push('afterCalculateLayout')
            },
            afterRecordPageLoading: () => {
              steps.push('afterRecordPageLoading')
            },
            afterCreateBanner: () => {
              steps.push('afterCreateBanner')
            },
            afterComposeFrames: () => {
              steps.push('afterComposeFrames')
            },
            afterRenderVideo: () => {
              steps.push('afterRenderVideo')
            },
          },
        }

        await runLoadshow(input, dependency)

        t.true(Fs.existsSync(Path.join(path, 'banner.html')))
        t.true(Fs.existsSync(Path.join(path, 'banner.vars.json')))
        t.true(Fs.existsSync(Path.join(path, 'banner.png')))
        t.true(Fs.existsSync(Path.join(path, 'ffmpeg.args.txt')))
        t.true(Fs.existsSync(Path.join(path, 'timeline.txt')))
        t.true(Fs.existsSync(input.videoFilePath))

        t.deepEqual(steps, [
          'afterCalculateLayout',
          'afterRecordPageLoading',
          'afterCreateBanner',
          'afterComposeFrames',
          'afterRenderVideo',
        ])
      },
      { unsafeCleanup: true }
    )
  } finally {
    server.close()
  }
})
