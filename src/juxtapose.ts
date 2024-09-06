import { DependencyInterface } from './types.js'

export interface JuxtaposeInput {
  inputFilePaths: string[]
  outputFilePath: string
}

export interface JuxtaposeOutput {
  outputFilePath: string
}

export async function runJuxtapose(
  input: JuxtaposeInput,
  dependency: Pick<DependencyInterface, 'logger' | 'ffmpeg'>
): Promise<JuxtaposeOutput> {
  // Stack horizontally multiple videos to compare them side by side.

  dependency.logger?.debug({}, `Compositing videos with ffmpeg`)
  // ffmpeg -i left.mp4 -i right.mp4 -filter_complex "[0:v][1:v][2:v]hstack=inputs=3[v]" -map "[v]" -vcodec libx264 -crf 23 output.mp4
  const args: string[] = []
  for (const inputFilePath of input.inputFilePaths) {
    args.push('-i', inputFilePath)
  }

  const filterComplex =
    input.inputFilePaths.map((_, index) => `[${index}:v]`).join('') + `hstack=inputs=${input.inputFilePaths.length}[v]`
  args.push('-filter_complex', filterComplex)

  args.push('-map', '[v]')
  args.push('-vcodec', 'libx264', '-crf', '23', input.outputFilePath)

  dependency.logger?.trace({ args }, 'Running ffmpeg')
  await dependency.ffmpeg(args)

  return {
    outputFilePath: input.outputFilePath,
  }
}
