import { createBanner, defaultBannerSpec, mergeBannerSpec } from './banner.js'
import { Dependency } from './dependency.js'
import { runJuxtapose } from './juxtapose.js'
import { defaultLoadshowSpec, mergeLoadshowSpec, runLoadshow } from './loadshow.js'

const dependency = new Dependency()

export async function adhocBanner() {
  const bannerSpec = mergeBannerSpec(defaultBannerSpec(), {})
  const bannerInput = {
    ...bannerSpec,
    outputFilePath: './tmp/banner.png',
    htmlFilePath: './tmp/banner.html',
    varsFilePath: './tmp/banner.vars.json',
    contextVars: {
      width: 512,
      timestampMs: Date.now(),
      resourceSizeBytes: 1024 * 1024 * 10,
      onLoadTimeMs: 1000,
      url: 'https://github.com/',
      htmlTitle: 'GitHub: Let’s build from here · GitHub',
    },
  }
  const bannerOutput = await createBanner(bannerInput, dependency)

  console.log(bannerOutput.renderedHtml)
}

export async function adhocLoadshow() {
  const tmp = './tmp'
  await dependency.mkdirp(tmp, true)

  const loadshowSpec = mergeLoadshowSpec(defaultLoadshowSpec(), {
    hasBanner: false,
    frameFormat: 'png',
  })
  const loadshowInput = {
    ...loadshowSpec,
    url: 'https://github.com/',
    artifactsDirPath: tmp,
    videoFilePath: `${tmp}/output.mp4`,
  }

  await runLoadshow(loadshowInput, dependency)
}

export async function adhocJuxtapose() {
  await runJuxtapose(
    {
      inputFilePaths: ['./tmp/video1.mp4', './tmp/video2.mp4'],
      outputFilePath: './tmp/output.mp4',
    },
    dependency
  )
  //
}

adhocLoadshow()
