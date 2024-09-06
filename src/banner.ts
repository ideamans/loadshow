import Handlebars from 'handlebars'

import { DeepPartial, DependencyInterface } from './types.js'

// i10n
export const Lexicon = {
  'ja-JP': {
    'Resource Size': 'リソースサイズ',
    'OnLoad Time': '読み込み時間 (OnLoad)',
  },
}

// Handlebars helpers
{
  const rawLocale = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || 'en-US'
  const locale = rawLocale.split('.')[0]?.replace(/_/g, '-') || 'en-US'
  const tz = process.env.TZ || 'UTC'

  // FIXME: I don't know why, but body width in CSS is 8px larger than the actual width.
  // So this helper is used to adjust between the width in CSS and the expected width.
  Handlebars.registerHelper('adjustWidth', (value: string | number) => {
    return (Number(value) - 8).toString()
  })

  Handlebars.registerHelper('datetime', (value: string | number) => {
    return new Date(Number(value)).toLocaleString(locale, { timeZone: tz })
  })

  Handlebars.registerHelper('mb', (value: string | number) => {
    return (Number(value) / 1024 / 1024).toFixed(2) + ' MB'
  })

  Handlebars.registerHelper('msToSec', (value: string | number) => {
    return (Number(value) / 1000).toFixed(2) + ' sec.'
  })

  Handlebars.registerHelper('i18n', (value: string) => {
    const dictionary = Lexicon[locale] || {}
    return dictionary[value] || value
  })
}

export type FreeVars = { [key: string]: string | number }

export interface DefaultTemplateVars {
  bodyWidth: string
  mainTitle: string
  subTitle: string
  credit: string
  createdAt: string
  resourceSizeLabel: string
  resourceSizeValue: string
  onLoadTimeLabel: string
  onLoadTimeValue: string
}

export interface ContextVars {
  width: number
  url: string
  htmlTitle: string
  timestampMs: number
  resourceSizeBytes: number
  onLoadTimeMs: number
}

export interface BannerSpec {
  templateFilePath: string
  htmlTemplate: string
  vars: FreeVars | DefaultTemplateVars
}

export function defaultBannerSpec() {
  return {
    templateFilePath: '', // HTML template file path (if blank, use default HTML template)
    htmlTemplate: '', // HTML template string (if blank, use default HTML template)
    vars: {
      // I don't know why, but body width in CSS is 8px larger than the expected width.
      // So bodyWidth is adjusted by `adjustWidth` helper above.
      bodyWidth: '{{adjustWidth width}}',
      mainTitle: '{{htmlTitle}}',
      subTitle: '{{url}}',
      credit: 'loadshow',
      createdAt: '{{datetime timestampMs}}',
      resourceSizeLabel: 'Resource Size',
      resourceSizeValue: '{{mb resourceSizeBytes}}',
      onLoadTimeLabel: 'OnLoad Time',
      onLoadTimeValue: '{{msToSec onLoadTimeMs}}',
    }, // User variables for rendering
  }
}

export function mergeBannerSpec(base: BannerSpec, optional?: DeepPartial<BannerSpec>): BannerSpec {
  return {
    ...base,
    ...(optional ?? {}),
    vars: { ...base.vars, ...(optional?.vars || {}) },
  }
}

export interface BannerInput extends BannerSpec {
  outputFilePath: string
  htmlFilePath: string
  varsFilePath: string
  contextVars: ContextVars
}

export interface BannerOutput {
  inputVars: { [key: string]: string | number }
  renderedVars: { [key: string]: string }
  renderedHtml: string
  outputFilePath: string
  htmlFilePath: string
  varsFilePath: string
  width: number
  height: number
}

export async function createBanner(
  input: BannerInput,
  dependency: Pick<
    DependencyInterface,
    'logger' | 'readStringFile' | 'writeStringFile' | 'htmlToImage' | 'imageDimensions'
  >
) {
  dependency.logger?.trace({ input }, `createBanner received input`)

  // Vars
  // A variable can be a template. So render each var as handlebars once.
  dependency.logger?.trace({ vars: input.vars }, `Rendering each variable as a template`)
  const inputVars = { ...input.contextVars, ...input.vars }
  const renderedVars = Object.entries(inputVars).reduce<{ [name: string]: string }>((vars, [key, value]) => {
    try {
      if (typeof value === 'number') vars[key] = value.toString()
      else if (typeof value === 'string' && value.includes('{{')) {
        const template = Handlebars.compile(value)
        vars[key] = template(vars)
      } else {
        vars[key] = value
      }
    } catch (err) {
      dependency.logger?.error(
        { key, value, err },
        `Failed to render the variable ${key}=${value} because of ${err.message}`
      )
    }
    return vars
  }, {})
  dependency.writeStringFile(input.varsFilePath, JSON.stringify(renderedVars, null, 2))

  // HTML template and rendering
  dependency.logger?.debug({}, `Rendering HTML template`)
  dependency.logger?.trace({ renderedVars }, `HTML template variables`)
  const htmlTemplateSrc = input.templateFilePath
    ? await dependency.readStringFile(input.templateFilePath)
    : input.htmlTemplate || defaultHtmlTemplate
  const htmlTemplate = Handlebars.compile(htmlTemplateSrc)
  const renderedHtml = htmlTemplate(renderedVars)
  dependency.writeStringFile(input.htmlFilePath, renderedHtml)

  // Render to image
  dependency.logger?.trace({}, `Rendering HTML to image`)
  const outputFilePath = input.outputFilePath
  await dependency.htmlToImage(renderedHtml, outputFilePath)

  // Banner image size
  dependency.logger?.debug({}, `Measuring the banner image size`)
  const { width, height } = await dependency.imageDimensions(outputFilePath)

  return {
    inputVars,
    renderedVars,
    renderedHtml,
    outputFilePath,
    htmlFilePath: input.htmlFilePath,
    varsFilePath: input.varsFilePath,
    width,
    height,
  }
}

// Default HTML template
const defaultHtmlTemplate = `
<html>
  <head>
    <style>
      body {
        font-family: sans-serif;
        width: {{bodyWidth}}px;
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
    <div class="main-title ellipsis">{{mainTitle}}</div>
    <div class="sub-title ellipsis">{{subTitle}}</div>
    <div class="meta">
      <div class="credit">{{credit}}</div>
      <div class="datetime">{{createdAt}}</div>
    </div>
    <div class="property cols">
      <div class="col">
        <div class="label">{{i18n resourceSizeLabel}}</div>
        <div class="value">{{resourceSizeValue}}</div>
      </div>
      <div class="col">
        <div class="label">{{i18n onLoadTimeLabel}}</div>
        <div class="value">{{onLoadTimeValue}}</div>
      </div>
    </div>
  </body>
</html>
`
