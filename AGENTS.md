# Repository Guidelines

## Project Structure & Module Organization
Source lives in `src/` (TypeScript, pure ESM). `command.ts` wires Commander, while `recording.ts`, `rendering.ts`, and `composition.ts` manage Puppeteer capture and ffmpeg specs; shared contracts sit in `types.ts`. Tests (`*.test.ts`) stay beside their modules, so keep any helpers local. `build/` contains generated JS and `.d.ts` output from `tsc`—never edit it directly. Demo media belongs in `readme/`, deterministic fixtures in `testdata/`, and ad-hoc recordings in `artifacts/` or `tmp/` so git stays clean.

## Build, Test, and Development Commands
Run `yarn build` to transpile before invoking the CLI or publishing. `yarn command -- record <url> ./out.mp4` and `yarn adhoc` wrap the compiled binaries for local experiments. `yarn watch` runs `ava` in watch mode for rapid feedback. `yarn test` executes lint, prettier, spell-check, and unit tests; reach for `yarn test:unit`, `yarn test:lint`, or `yarn test:cspell` when isolating failures.

## Coding Style & Naming Conventions
Respect the stricter `tsconfig.json` (no implicit `any`, ES2022 modules). Prettier enforces single quotes, no semicolons, and 120 character lines; format via `yarn fix:prettier`. ESLint (`eslint.config.js`) layers `@typescript-eslint` plus import ordering rules, so keep grouped, alphabetical imports and prefer descriptive `verbNoun` function names. Shared enums/interfaces belong in `src/types.ts` to avoid circular refs, and new files should export a single default behavior when possible.

## Testing Guidelines
`ava` runs against compiled files, so rebuild before `yarn test:unit` or rely on the `yarn test` script which compiles first. Coverage comes from `nyc`; avoid regressions by adding assertions whenever changing rendering, layout, or banner code paths. Name new specs `<module>.test.ts`, colocate them with the implementation, and store heavy fixtures or snapshots under `testdata/` so reviewers can reproduce results deterministically.

## Commit & Pull Request Guidelines
Git history favors short, imperative summaries (e.g., `Fix htmlToImage arg`), so cap subjects near 72 characters and squash noisy WIP commits locally. Pull requests should spell out intent, describe affected CLI flags, link issues, and attach before/after frames or command logs when behavior changes. Include test commands in the description so CI expectations are transparent.

## Security & Configuration Tips
Local runs require Chrome/Chromium and `ffmpeg`. Set `CHROME_PATH` or `FFMPEG_PATH` when deviating from defaults, and toggle `LOG_LEVEL=debug` or `BARE_PUPPETEER=1` only for targeted debugging. Never commit recordings containing sensitive URLs; keep temporary media in ignored folders and scrub them before review.
