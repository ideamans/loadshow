/**
 * Deterministic Rendering Playbook Implementation
 *
 * This module provides techniques to make browser rendering deterministic
 * for consistent page load recordings, eliminating variations from:
 * - Animations and transitions
 * - Time and random values
 * - Media autoplay
 * - Lazy loading
 * - Scroll behavior
 * - Web Animations API
 */

/**
 * CSS to disable all animations and transitions
 */
export const DISABLE_ANIMATIONS_CSS = `
  /* LOADSHOW deterministic CSS injected */
  *, *::before, *::after {
    animation: none !important;
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition: none !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  html {
    scroll-behavior: auto !important;
  }
  @media (prefers-reduced-motion: no-preference) {
    :root { --force-no-motion: 1; }
  }
`

/**
 * Generates script to mock Date, Math.random, and performance.now
 * with fixed values for deterministic behavior
 */
export function generateMockTimeScript(fixedTime: string, seed: number): string {
  return `
(function() {
  const OriginalDate = window.Date
  const fixedTimestamp = new OriginalDate('${fixedTime}').valueOf()

  window.Date = class extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fixedTimestamp)
      } else {
        super(...args)
      }
    }
    static now() {
      return fixedTimestamp
    }
  }

  // Copy static methods
  Object.setPrototypeOf(window.Date, OriginalDate)

  // Mock Math.random with Linear congruential generator (LCG) // cspell:disable-line
  let seed = ${seed}
  Math.random = function() {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  // Mock performance.now to return fixed value
  const originalPerformanceNow = performance.now.bind(performance)
  performance.now = function() {
    return 0
  }
})();
`
}

/**
 * Script to disable media autoplay and control timers
 */
export const DISABLE_AUTOPLAY_SCRIPT = `
(function() {
  const intervals = new Set()
  const timeouts = new Set()
  const originalSetInterval = window.setInterval.bind(window)
  const originalSetTimeout = window.setTimeout.bind(window)
  const originalClearInterval = window.clearInterval.bind(window)
  const originalClearTimeout = window.clearTimeout.bind(window)

  window.setInterval = function(...args) {
    const id = originalSetInterval(...args)
    intervals.add(id)
    return id
  }

  window.setTimeout = function(...args) {
    const id = originalSetTimeout(...args)
    timeouts.add(id)
    return id
  }

  window.clearInterval = function(id) {
    intervals.delete(id)
    return originalClearInterval(id)
  }

  window.clearTimeout = function(id) {
    timeouts.delete(id)
    return originalClearTimeout(id)
  }

  // Disable media autoplay
  const OriginalHTMLMediaElement = HTMLMediaElement
  const originalPlay = OriginalHTMLMediaElement.prototype.play
  const originalLoad = OriginalHTMLMediaElement.prototype.load

  OriginalHTMLMediaElement.prototype.play = function() {
    this.pause()
    this.currentTime = 0
    return Promise.resolve()
  }

  OriginalHTMLMediaElement.prototype.load = function() {
    originalLoad.call(this)
    this.pause()
    this.currentTime = 0
  }

  Object.defineProperty(OriginalHTMLMediaElement.prototype, 'autoplay', {
    get() { return false },
    set() {},
  })

  Object.defineProperty(OriginalHTMLMediaElement.prototype, 'loop', {
    get() { return false },
    set() {},
  })

  // Clear all intervals after page load to stop carousels
  window.addEventListener('load', () => {
    originalSetTimeout(() => {
      intervals.forEach((id) => originalClearInterval(id))
      intervals.clear()

      document.querySelectorAll('video, audio').forEach((media) => {
        media.pause()
        media.currentTime = 0
      })
    }, 100)
  })
})();
`

/**
 * Script to force IntersectionObserver to trigger immediately
 * for lazy loading images and infinite scroll
 */
export const FIX_INTERSECTION_OBSERVER_SCRIPT = `
(function() {
  const OriginalIntersectionObserver = window.IntersectionObserver

  window.IntersectionObserver = class IntersectionObserver {
    constructor(callback, options) {
      this.callback = callback
      this.options = options
      this.elements = new Set()
    }

    observe(element) {
      this.elements.add(element)
      setTimeout(() => {
        this.callback(
          [
            {
              target: element,
              isIntersecting: true,
              intersectionRatio: 1.0,
              boundingClientRect: element.getBoundingClientRect(),
              intersectionRect: element.getBoundingClientRect(),
              rootBounds: null,
              time: Date.now(),
            },
          ],
          this,
        )
      }, 0)
    }

    unobserve(element) {
      this.elements.delete(element)
    }

    disconnect() {
      this.elements.clear()
    }

    takeRecords() {
      return []
    }
  }
})();
`

/**
 * Script to disable all scroll-related methods
 */
export const DISABLE_SCROLL_SCRIPT = `
(function() {
  const noop = () => {}

  window.scrollTo = noop
  window.scroll = noop

  Element.prototype.scrollIntoView = function() {}
  Element.prototype.scrollTo = function() {}
  Element.prototype.scroll = function() {}
})();
`

/**
 * Script to disable Web Animations API
 */
export const DISABLE_WEB_ANIMATIONS_SCRIPT = `
(function() {
  const dummyAnimation = {
    cancel() {},
    finish() {},
    pause() {},
    play() {},
    reverse() {},
    updatePlaybackRate() {},
    playbackRate: 0,
    playState: 'finished',
    ready: Promise.resolve(),
    finished: Promise.resolve(),
    oncancel: null,
    onfinish: null,
    onremove: null, // cspell:disable-line
    id: '',
    timeline: null,
    startTime: null,
    currentTime: null,
  }

  Element.prototype.animate = function() {
    return dummyAnimation
  }

  document.getAnimations = () => []
  Element.prototype.getAnimations = () => []

  if (window.Animation) {
    const OriginalAnimation = window.Animation
    window.Animation = class Animation extends OriginalAnimation {
      constructor() {
        super()
        this.pause()
      }
    }
  }
})();
`

/**
 * Options for deterministic rendering
 */
export interface DeterministicOptions {
  enabled: boolean
  mockTime?: string
  randomSeed?: number
  disableAnimations?: boolean
  disableAutoplay?: boolean
  disableScroll?: boolean
  fixIntersectionObserver?: boolean
  disableWebAnimations?: boolean
  maskSelectors?: string[]
}

/**
 * Default deterministic options
 * Deterministic mode is enabled by default for consistent recordings
 */
export function defaultDeterministicOptions(): DeterministicOptions {
  return {
    enabled: true,
    mockTime: '2025-01-01T00:00:00Z',
    randomSeed: 42,
    disableAnimations: true,
    disableAutoplay: true,
    disableScroll: true,
    fixIntersectionObserver: true,
    disableWebAnimations: true,
    maskSelectors: [],
  }
}

/**
 * Generates all deterministic scripts based on options
 */
export function getAllDeterministicScripts(options: DeterministicOptions): string {
  if (!options.enabled) {
    return ''
  }

  const scripts: string[] = []

  // Add a marker to verify injection
  scripts.push(`console.log('[LOADSHOW] Deterministic scripts loaded at', new Date().toISOString());`)

  // Mock time and random
  if (options.mockTime !== undefined && options.randomSeed !== undefined) {
    scripts.push(generateMockTimeScript(options.mockTime, options.randomSeed))
  }

  // Disable autoplay and control timers
  if (options.disableAutoplay) {
    scripts.push(DISABLE_AUTOPLAY_SCRIPT)
  }

  // Fix IntersectionObserver for lazy loading
  if (options.fixIntersectionObserver) {
    scripts.push(FIX_INTERSECTION_OBSERVER_SCRIPT)
  }

  // Disable scroll
  if (options.disableScroll) {
    scripts.push(DISABLE_SCROLL_SCRIPT)
  }

  // Disable Web Animations API
  if (options.disableWebAnimations) {
    scripts.push(DISABLE_WEB_ANIMATIONS_SCRIPT)
  }

  return scripts.join('\n\n')
}

/**
 * Get CSS for deterministic rendering
 */
export function getDeterministicCSS(options: DeterministicOptions): string {
  if (!options.enabled || !options.disableAnimations) {
    return ''
  }

  return DISABLE_ANIMATIONS_CSS
}

/**
 * Generates script to mask specific elements
 */
export function generateMaskScript(selectors: string[]): string {
  if (selectors.length === 0) {
    return ''
  }

  return `
(function() {
  const selectors = ${JSON.stringify(selectors)}
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.visibility = 'hidden'
      }
    })
  })
})();
`
}
