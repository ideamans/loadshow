import { DeepPartial, DependencyInterface } from './types.js'

export interface LayoutSpec {
  canvasWidth: number
  canvasHeight: number
  columns: number
  gap: number
  padding: number
  borderWidth: number
  indent: number
  outdent: number
  progressHeight: number
}

export function defaultLayoutSpec() {
  return {
    canvasWidth: 512, // Width of the video output
    canvasHeight: 640, // Height of the video output
    columns: 3, // Columns of the browser screen
    gap: 20, // Gap between columns
    padding: 20, // Padding around columns
    borderWidth: 1, // Border width of columns
    indent: 20, // Top padding after the first column
    outdent: 20, // Bottom padding of the first column
    progressHeight: 16, // Height of the progress bar
  }
}

export function mergeLayoutSpec(base: LayoutSpec, optional?: DeepPartial<LayoutSpec>): LayoutSpec {
  return {
    ...base,
    ...(optional ?? {}),
  }
}

export type LayoutInput = LayoutSpec

export interface Dimension {
  width: number
  height: number
}

export interface Rectangle extends Dimension {
  x: number
  y: number
}

export interface Window extends Rectangle {
  scrollTop: number
}

export interface LayoutOutput {
  scroll: Dimension
  columns: Rectangle[]
  windows: Window[]
}

export function computeLayout(input: LayoutSpec, dependency: Pick<DependencyInterface, 'logger'>): LayoutOutput {
  dependency.logger?.trace({ input }, `computeLayout received input`)

  const columnWidth = Math.floor(
    (input.canvasWidth - input.padding * 2 - input.gap * (input.columns - 1)) / input.columns
  )
  const columns: Rectangle[] = []
  const windows: Window[] = []

  let currentScrollTop = 0
  for (let i = 0; i < input.columns; i++) {
    const isFirst = i === 0
    const isLast = i === input.columns - 1

    // Column
    const column: Rectangle = { x: 0, y: 0, width: 0, height: 0 }
    column.x = input.padding + i * (columnWidth + input.gap)
    column.y = input.padding + (isFirst ? 0 : input.indent)
    column.width = columnWidth
    const baseHeight = input.canvasHeight - input.padding * 2
    column.height = baseHeight - (isFirst ? input.outdent : input.indent)
    columns.push(column)

    // Screen window
    const window: Window = { x: 0, y: 0, width: 0, height: 0, scrollTop: 0 }
    window.x = column.x + input.borderWidth
    window.y = column.y + (isFirst ? input.borderWidth : 0)
    window.width = column.width - input.borderWidth * 2
    window.height = column.height - (isLast ? input.borderWidth : 0)
    window.scrollTop = currentScrollTop
    windows.push(window)

    currentScrollTop += window.height
  }

  // Required scroll dimensions
  const scroll = {
    width: columnWidth,
    height: windows.reduce<number>((height, window) => height + window.height, 0),
  }

  return { scroll, columns, windows }
}
