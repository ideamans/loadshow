import test from 'ava'

import { computeLayout, defaultLayoutSpec } from './layout.js'

test('calculateLayout', async (t) => {
  const spec = defaultLayoutSpec()
  const output = computeLayout(spec, {})
  t.deepEqual(output, {
    scroll: { width: 144, height: 1739 },
    columns: [
      { x: 20, y: 20, width: 144, height: 580 },
      { x: 184, y: 40, width: 144, height: 580 },
      { x: 348, y: 40, width: 144, height: 580 },
    ],
    windows: [
      { x: 21, y: 21, width: 142, height: 580, scrollTop: 0 },
      { x: 185, y: 40, width: 142, height: 580, scrollTop: 580 },
      { x: 349, y: 40, width: 142, height: 579, scrollTop: 1160 },
    ],
  })
})
