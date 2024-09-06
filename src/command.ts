#!/usr/bin/env node

import Path from 'path'

import { Command } from 'commander'
import Tmp from 'tmp-promise'
import Yaml from 'yaml'

import { Dependency } from './dependency.js'
import { runJuxtapose } from './juxtapose.js'
import { defaultLoadshowSpec, LoadshowInput, mergeLoadshowSpec, runLoadshow } from './loadshow.js'
import { mergeDeepProperties, parseSpecPhrase, SpecObject, updateDeepProperty } from './spec.js'

const program = new Command()

function helpAndExit(cmd: Command, message: string) {
  console.error(message)
  cmd.outputHelp()
  process.exit(1)
}

const record = program
  .command('record')
  .description('Record loading video of the URL')
  .option('-m, --merge <path>', 'Path to the options YAML file')
  .option('-u, --update <key=value>', 'Update spec (multiple)')
  .option('-a, --artifacts <artifactsDir>', 'Artifacts directory path (default to tmp dir)')
  .argument('<url>', 'URL to record')
  .argument('<videoFilePath>', 'Working directory path')
  .action(async (url: string, videoFilePath: string, options: { [key: string]: string | string[] }) => {
    if (!url || !videoFilePath) {
      helpAndExit(record, 'URL and artifactsDir are required')
    }

    const dependency = new Dependency()

    const userSpec: SpecObject = {}
    const defaultSpec = defaultLoadshowSpec()

    // Options from YAML file
    if (options.merge && typeof options.merge === 'string') {
      const yaml = await dependency.readStringFile(options.merge)
      try {
        const opts = Yaml.parse(yaml)
        mergeDeepProperties(userSpec, opts, defaultSpec as unknown as SpecObject)
      } catch (err) {
        dependency.logger?.fatal({ err }, `Failed to parse ${options.merge} as YAML: ${err.message}`)
        process.exit(1)
      }
    }

    // Overwrite options from options
    if (options.update) {
      for (const u of Array.isArray(options.update) ? options.update : [options.update]) {
        try {
          const [k, v] = parseSpecPhrase(u)
          updateDeepProperty(userSpec, k, v, defaultSpec as unknown as SpecObject)
        } catch (ex) {
          dependency.logger?.warn({}, ex.message)
        }
      }
    }

    await Tmp.withDir(
      async ({ path }) => {
        // Artifacts directory path
        const artifacts = Array.isArray(options.artifacts) ? options.artifacts[0] : options.artifacts
        const artifactsDirPath = artifacts || path

        // Build input from options
        dependency.logger?.debug(userSpec, 'User defined loadshow spec')
        const loadshowSpec = mergeLoadshowSpec(defaultLoadshowSpec(), userSpec)
        const loadshowInput: LoadshowInput = {
          ...loadshowSpec,
          url,
          artifactsDirPath,
          videoFilePath,
        }

        await dependency.mkdirp(artifactsDirPath, true)
        await dependency.mkdirp(Path.dirname(videoFilePath))
        await runLoadshow(loadshowInput, dependency)
      },
      { unsafeCleanup: true }
    )
  })

const juxtapose = program
  .command('juxtapose')
  .description('Juxtapose multiple videos into one to compare')
  .option('-o, --output <outputPath>', 'Output video file path (required)')
  .argument('<inputPaths...>', 'Input video file paths (at least 2)')
  .action(async (inputFilePaths: string[], options: { [key: string]: string | string[] }) => {
    const output = options.output

    if (!output) helpAndExit(juxtapose, 'Output path (-o) is required')
    if (Array.isArray(output)) helpAndExit(juxtapose, 'Only one output path is allowed')
    if (inputFilePaths.length < 2) helpAndExit(juxtapose, 'At least 2 input paths are required')

    const outputFilePath = output as string

    const dependency = new Dependency()
    await runJuxtapose(
      {
        inputFilePaths,
        outputFilePath,
      },
      dependency
    )
  })

program.parse(process.argv)
