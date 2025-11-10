import test from 'ava'

import {
  defaultDeterministicOptions,
  DISABLE_ANIMATIONS_CSS,
  DISABLE_AUTOPLAY_SCRIPT,
  DISABLE_SCROLL_SCRIPT,
  DISABLE_WEB_ANIMATIONS_SCRIPT,
  FIX_INTERSECTION_OBSERVER_SCRIPT,
  generateMaskScript,
  generateMockTimeScript,
  getAllDeterministicScripts,
  getDeterministicCSS,
} from './deterministic.js'

test('defaultDeterministicOptions returns correct defaults', (t) => {
  const options = defaultDeterministicOptions()

  t.true(options.enabled) // Deterministic mode is now enabled by default
  t.is(options.mockTime, '2025-01-01T00:00:00Z')
  t.is(options.randomSeed, 42)
  t.true(options.disableAnimations)
  t.true(options.disableAutoplay)
  t.true(options.disableScroll)
  t.true(options.fixIntersectionObserver)
  t.true(options.disableWebAnimations)
  t.deepEqual(options.maskSelectors, [])
})

test('getDeterministicCSS returns CSS when enabled and disableAnimations is true', (t) => {
  const options = defaultDeterministicOptions()
  options.enabled = true
  options.disableAnimations = true

  const css = getDeterministicCSS(options)

  t.is(css, DISABLE_ANIMATIONS_CSS)
  t.true(css.includes('animation: none !important'))
  t.true(css.includes('transition: none !important'))
})

test('getDeterministicCSS returns empty string when disabled', (t) => {
  const options = defaultDeterministicOptions()
  options.enabled = false

  const css = getDeterministicCSS(options)

  t.is(css, '')
})

test('generateMockTimeScript generates valid script with fixed time and seed', (t) => {
  const script = generateMockTimeScript('2025-01-01T00:00:00Z', 42)

  t.true(script.includes('2025-01-01T00:00:00Z'))
  t.true(script.includes('42'))
  t.true(script.includes('window.Date'))
  t.true(script.includes('Math.random'))
  t.true(script.includes('performance.now'))
})

test('getAllDeterministicScripts returns empty string when disabled', (t) => {
  const options = defaultDeterministicOptions()
  options.enabled = false

  const scripts = getAllDeterministicScripts(options)

  t.is(scripts, '')
})

test('getAllDeterministicScripts includes all scripts when enabled with defaults', (t) => {
  const options = defaultDeterministicOptions()
  options.enabled = true

  const scripts = getAllDeterministicScripts(options)

  t.true(scripts.includes('window.Date'))
  t.true(scripts.includes('Math.random'))
  t.true(scripts.includes('HTMLMediaElement'))
  t.true(scripts.includes('IntersectionObserver'))
  t.true(scripts.includes('scrollTo'))
  t.true(scripts.includes('Element.prototype.animate'))
})

test('getAllDeterministicScripts excludes scripts based on options', (t) => {
  const options = defaultDeterministicOptions()
  options.enabled = true
  options.disableAutoplay = false
  options.fixIntersectionObserver = false
  options.disableScroll = false
  options.disableWebAnimations = false

  const scripts = getAllDeterministicScripts(options)

  t.false(scripts.includes('HTMLMediaElement'))
  t.false(scripts.includes('IntersectionObserver'))
  t.false(scripts.includes('scrollTo'))
  t.false(scripts.includes('Element.prototype.animate'))
  t.true(scripts.includes('window.Date')) // mockTime still included
})

test('generateMaskScript returns empty string for empty selectors', (t) => {
  const script = generateMaskScript([])

  t.is(script, '')
})

test('generateMaskScript generates valid script with selectors', (t) => {
  const script = generateMaskScript(['.ad-banner', '#live-chat'])

  t.true(script.includes('.ad-banner'))
  t.true(script.includes('#live-chat'))
  t.true(script.includes('visibility'))
  t.true(script.includes('hidden'))
})

test('DISABLE_ANIMATIONS_CSS contains expected rules', (t) => {
  t.true(DISABLE_ANIMATIONS_CSS.includes('animation: none !important'))
  t.true(DISABLE_ANIMATIONS_CSS.includes('transition: none !important'))
  t.true(DISABLE_ANIMATIONS_CSS.includes('caret-color: transparent !important'))
  t.true(DISABLE_ANIMATIONS_CSS.includes('scroll-behavior: auto !important'))
})

test('DISABLE_AUTOPLAY_SCRIPT contains expected code', (t) => {
  t.true(DISABLE_AUTOPLAY_SCRIPT.includes('setInterval'))
  t.true(DISABLE_AUTOPLAY_SCRIPT.includes('setTimeout'))
  t.true(DISABLE_AUTOPLAY_SCRIPT.includes('HTMLMediaElement'))
  t.true(DISABLE_AUTOPLAY_SCRIPT.includes('autoplay'))
})

test('FIX_INTERSECTION_OBSERVER_SCRIPT contains expected code', (t) => {
  t.true(FIX_INTERSECTION_OBSERVER_SCRIPT.includes('IntersectionObserver'))
  t.true(FIX_INTERSECTION_OBSERVER_SCRIPT.includes('isIntersecting'))
  t.true(FIX_INTERSECTION_OBSERVER_SCRIPT.includes('intersectionRatio'))
})

test('DISABLE_SCROLL_SCRIPT contains expected code', (t) => {
  t.true(DISABLE_SCROLL_SCRIPT.includes('scrollTo'))
  t.true(DISABLE_SCROLL_SCRIPT.includes('scroll'))
  t.true(DISABLE_SCROLL_SCRIPT.includes('scrollIntoView'))
})

test('DISABLE_WEB_ANIMATIONS_SCRIPT contains expected code', (t) => {
  t.true(DISABLE_WEB_ANIMATIONS_SCRIPT.includes('Element.prototype.animate'))
  t.true(DISABLE_WEB_ANIMATIONS_SCRIPT.includes('getAnimations'))
  t.true(DISABLE_WEB_ANIMATIONS_SCRIPT.includes('finished'))
})
