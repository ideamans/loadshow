# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## loadshow

`loadshow` is an open-source CLI tool that records web page loading processes as videos. It provides an intuitive way to visualize and compare web page loading speeds, making PageSpeed improvements more understandable to non-technical stakeholders.

### Development Commands

```bash
# Build TypeScript to JavaScript
yarn build
# or
npm run build

# Run tests (builds first, then runs linting, prettier, cspell, and unit tests)
yarn test
# or
npm test

# Fix code style issues
yarn fix
# or
npm run fix

# Watch mode for tests (useful during development)
yarn watch
# or
npm run watch

# Run the CLI during development
yarn command
# or
npm run command

# Run adhoc development scripts (edit src/adhoc.ts first)
yarn adhoc
# or
npm run adhoc
```

### Architecture and Technology Stack

**Core Technologies:**
- Node.js >= 20 (ES Modules)
- TypeScript 5.6+ with strict mode
- Puppeteer Core (browser automation without bundled Chrome)
- Sharp (image processing)
- ffmpeg (video rendering)

**Key Dependencies:**
- `puppeteer-core`: Browser automation for recording page loads
- `sharp`: Image composition and manipulation
- `commander`: CLI argument parsing
- `handlebars`: HTML template rendering for info banners
- `dayjs`: Date/time formatting
- `pino`: Structured logging

### Code Architecture

The codebase follows a functional pipeline architecture with distinct stages:

**Pipeline Stages** (in execution order):

1. **Layout (`layout.ts`)**: Calculates canvas dimensions and positioning
   - Input: Canvas width, columns, gaps, padding
   - Output: Computed layout dimensions for video composition

2. **Recording (`recording.ts`)**: Captures page load with Puppeteer
   - Launches Chrome/Chromium via system installation
   - Applies network throttling and CPU throttling
   - Takes screenshots at regular intervals during page load
   - Monitors resource loading events
   - Output: Screen frames (base64 images), timing data, resource metrics

3. **Banner (`banner.ts`)**: Generates info banner with page metadata
   - Uses Handlebars templates for customization
   - Renders HTML to image via `node-html-to-image`
   - Variables: URL, title, timestamp, resource size, load time
   - Output: Banner image buffer

4. **Composition (`composition.ts`)**: Combines frames with UI elements
   - Composites screenshots with borders, progress bars, and banners
   - Uses Sharp for image manipulation
   - Applies color theme and layout settings
   - Output: Directory of composed frame images

5. **Rendering (`rendering.ts`)**: Creates final video with ffmpeg
   - Generates ffmpeg timeline file with frame durations
   - Invokes ffmpeg to render video from frames
   - Adds outro (static final frame)
   - Output: MP4 video file

**Entry Points:**
- `command.ts`: CLI interface with `record` and `juxtapose` commands
- `index.ts`: Public API exports for programmatic usage
- `adhoc.ts`: Development sandbox for testing

**Core Abstractions:**
- **Spec System** (`spec.ts`): Type-safe configuration with deep merge capabilities
  - Each stage has `{Stage}Spec`, `default{Stage}Spec()`, and `merge{Stage}Spec()` functions
  - CLI options can override spec values via `-u key=value` or `-m spec.yml`
  - Dot notation for nested properties (e.g., `layout.canvasWidth`)

- **Dependency Injection** (`dependency.ts`): External dependencies abstracted for testability
  - `Dependency`: Uses system Chrome via `puppeteer-core`
  - `DependencyWithPuppeteer`: Uses bundled Chrome (experimental, enabled by `BARE_PUPPETEER=1`)
  - Provides logger, file I/O, Chrome launcher, ffmpeg executor

### Browser Selection Strategy

The tool prioritizes **system-installed Chrome** over Puppeteer's bundled Chromium due to rendering inconsistencies in some environments. This requires users to have Chrome pre-installed.

**Browser Resolution Order:**
1. `CHROME_PATH` environment variable (if set)
2. Auto-detected system Chrome (OS-specific paths)
3. If `BARE_PUPPETEER=1`: Use Puppeteer's bundled Chromium (experimental)

**Puppeteer Configuration:**
- Uses `puppeteer-core` (no bundled browser) by default
- Install skips Chromium download: `PUPPETEER_SKIP_DOWNLOAD=1`
- Spec option `recording.preferSystemChrome` controls behavior (only with `BARE_PUPPETEER=1`)

### Testing

Tests use AVA test runner with the following configuration:
- Test files: `build/**/*.test.js` (compiled TypeScript)
- Coverage: nyc (silent mode)
- Timeout: 60 seconds per test
- Locale: `en_US.UTF-8`, Timezone: `UTC`

**Running specific tests:**
```bash
# Build first (tests run on compiled JS)
yarn build

# Run all tests
yarn test:unit

# Run specific test file
npx ava build/layout.test.js

# Watch mode for TDD
yarn watch
```

### Environment Variables

- `LOG_LEVEL`: Pino log level (`fatal` | `error` | `warn` | `info` | `debug` | `trace`) - default: `info`
- `CHROME_PATH`: Explicit path to Chrome/Chromium executable
- `FFMPEG_PATH`: Explicit path to ffmpeg executable - default: `ffmpeg` (Windows: `ffmpeg.exe`)
- `LC_ALL` / `LC_MESSAGES` / `LANG`: Locale for info banner (e.g., `ja-JP`)
- `TZ`: Timezone for info banner (e.g., `Asia/Tokyo`)
- `BARE_PUPPETEER`: Enable experimental bundled Chromium mode (set to `1`)
- `LOG_OBJECTS`: Show objects attached to log messages (for debugging)

### GitHub Actions / CI

The project uses GitHub Actions for CI:
- **testing.yml**: Runs on non-main branches
  - Uses `AnimMouse/setup-ffmpeg@v1` to install ffmpeg
  - Uses `browser-actions/setup-chrome@v1` to install Chrome
  - Sets `CHROME_PATH` from setup output
  - Skips Puppeteer Chromium download with `PUPPETEER_SKIP_DOWNLOAD=1`

**Important**: When working with ffmpeg setup in GitHub Actions, prefer `AnimMouse/setup-ffmpeg@v1` over deprecated alternatives.

### Code Style

Enforced via Prettier and ESLint:
- Single quotes
- No semicolons
- 120-character line width
- Import ordering: Alphabetical with newlines between groups
- TypeScript strict mode enabled
