import test from 'ava'

import { defaultRenderingSpec, mergeRenderingSpec, RenderingInput, renderVideo } from './rendering.js'

test('renderVideo', async (t) => {
  const renderingSpec = mergeRenderingSpec(defaultRenderingSpec(), {
    outroMs: 3000,
    ffmpegArgs: ['-custom', '-args'],
  })
  const input: RenderingInput = {
    ...renderingSpec,
    frameFiles: [
      {
        path: './tmp/frame1.png',
        time: 1000,
      },
      {
        path: './tmp/frame2.png',
        time: 3000,
      },
    ],
    timelineFilePath: './tmp/timeline.txt',
    ffmpegArgsPath: './tmp/ffmpeg.args.txt',
    videoFilePath: './tmp/video.mp4',
  }
  const output = await renderVideo(input, {
    writeStringFile: async (filePath: string, content: string) => {
      if (filePath === './tmp/timeline.txt') {
        t.is(
          content,
          `file 'frame1.png'
duration 1
file 'frame2.png'
duration 2
file 'frame2.png'
duration 3
file 'frame2.png'`
        )
      } else if (filePath === './tmp/ffmpeg.args.txt') {
        t.is(
          content,
          '-y -f concat -safe 0 -i ./tmp/timeline.txt -vsync vfr -c:v libx264 -pix_fmt yuv420p -custom -args ./tmp/video.mp4'
        )
      } else {
        t.fail(`Unexpected file path: ${filePath}`)
      }
    },
    ffmpeg: async (args: string[]) => {
      t.deepEqual(args, [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        './tmp/timeline.txt',
        '-vsync',
        'vfr',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-custom',
        '-args',
        './tmp/video.mp4',
      ])
      return { exitCode: 0, stdout: 'STDOUT', stderr: 'STDERR' }
    },
  })

  t.is(output.ffmpegCommandOutput.exitCode, 0)
  t.is(output.ffmpegCommandOutput.stdout, 'STDOUT')
  t.is(output.ffmpegCommandOutput.stderr, 'STDERR')
})
