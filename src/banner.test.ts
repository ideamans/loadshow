import test from 'ava'

import { createBanner, defaultBannerSpec, mergeBannerSpec } from './banner.js'

test('createBanner - defaultTemplate', async (t) => {
  const spec = mergeBannerSpec(defaultBannerSpec(), {})
  const output = await createBanner(
    {
      ...spec,
      outputFilePath: './tmp/banner.png',
      htmlFilePath: './tmp/banner.html',
      varsFilePath: './tmp/banner.vars.json',
      contextVars: {
        width: 512,
        timestampMs: Date.parse('2024-09-04T00:00:00Z'),
        resourceSizeBytes: 1024 * 1024 * 10,
        onLoadTimeMs: 10 * 1000,
        url: 'https://github.com/',
        htmlTitle: 'GitHub',
      },
    },
    {
      readStringFile: async () => {
        throw new Error('Unexpected readStringFile call')
      },
      writeStringFile: async (filePath: string, content: string) => {
        if (filePath === './tmp/banner.html') {
          t.is(content, expectedHtml)
        } else if (filePath === './tmp/banner.vars.json') {
          t.deepEqual(JSON.parse(content), expectedVars)
        } else {
          t.fail(`Unexpected file path: ${filePath}`)
        }
      },
      htmlToImage: async (html: string, filePath: string) => {
        t.is(html, expectedHtml)
        t.is(filePath, './tmp/banner.png')
      },
      imageDimensions: async (filePath: string) => {
        t.is(filePath, './tmp/banner.png')
        return { width: 512, height: 256 }
      },
    }
  )

  t.deepEqual(output.renderedVars, expectedVars)
})

test('createBanner - custom template', async (t) => {
  const spec = mergeBannerSpec(defaultBannerSpec(), {
    htmlTemplate: `<html>{{b}}</html>`,
    vars: {
      a: 'the custom value',
      b: 'a={{a}}',
    },
  })
  const output = await createBanner(
    {
      ...spec,
      outputFilePath: './tmp/banner.png',
      htmlFilePath: './tmp/banner.html',
      varsFilePath: './tmp/banner.vars.json',
      contextVars: {
        width: 512,
        timestampMs: Date.parse('2024-09-04T00:00:00Z'),
        resourceSizeBytes: 1024 * 1024 * 10,
        onLoadTimeMs: 10 * 1000,
        url: 'https://github.com/',
        htmlTitle: 'GitHub',
      },
    },
    {
      readStringFile: async () => {
        throw new Error('Unexpected readStringFile call')
      },
      writeStringFile: async (filePath: string, content: string) => {
        if (filePath === './tmp/banner.html') {
          t.is(content, `<html>a&#x3D;the custom value</html>`)
        } else if (filePath === './tmp/banner.vars.json') {
          t.deepEqual(JSON.parse(content), {
            ...expectedVars,
            a: 'the custom value',
            b: 'a=the custom value',
          })
        } else {
          t.fail(`Unexpected file path: ${filePath}`)
        }
      },
      htmlToImage: async (html: string, filePath: string) => {
        t.is(html, `<html>a&#x3D;the custom value</html>`)
        t.is(filePath, './tmp/banner.png')
      },
      imageDimensions: async (filePath: string) => {
        t.is(filePath, './tmp/banner.png')
        return { width: 512, height: 256 }
      },
    }
  )

  t.deepEqual(output.renderedVars, {
    ...expectedVars,
    a: 'the custom value',
    b: 'a=the custom value',
  })
})

const expectedVars = {
  width: '512',
  timestampMs: '1725408000000',
  resourceSizeBytes: '10485760',
  onLoadTimeMs: '10000',
  url: 'https://github.com/',
  htmlTitle: 'GitHub',
  bodyWidth: '504',
  mainTitle: 'GitHub',
  subTitle: 'https://github.com/',
  credit: 'loadshow',
  createdAt: '9/4/2024, 12:00:00 AM',
  resourceSizeLabel: 'Resource Size',
  resourceSizeValue: '10.00 MB',
  onLoadTimeLabel: 'OnLoad Time',
  onLoadTimeValue: '10.00 sec.',
}

const expectedHtml = `
<html>
  <head>
    <style>
      body {
        font-family: sans-serif;
        width: 504px;
        height: 95px;
        padding: 4px;
        margin: 0px;
        background-color: #efefef;
        line-height: 1.4;
      }
      .ellipsis {
        max-width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .main-title {
        font-size: 16px;
      }
      .sub-title {
        font-size: 12px;
        color: #00e;
      }
      .meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #ccc;
        padding-top: 4px;
        padding-bottom: 4px;
      }
      .datetime {
        font-size: 13px;
      }
      .credit {
        font-size: 15px;
      }
      .cols {
        padding-top: 4px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .col {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .label {
        font-size: 13px;
      }
      .value {
        font-size: 15px;
      }
    </style>
  </head>
  <body>
    <div class="main-title ellipsis">GitHub</div>
    <div class="sub-title ellipsis">https://github.com/</div>
    <div class="meta">
      <div class="credit">loadshow</div>
      <div class="datetime">9/4/2024, 12:00:00 AM</div>
    </div>
    <div class="property cols">
      <div class="col">
        <div class="label">Resource Size</div>
        <div class="value">10.00 MB</div>
      </div>
      <div class="col">
        <div class="label">OnLoad Time</div>
        <div class="value">10.00 sec.</div>
      </div>
    </div>
  </body>
</html>
`
