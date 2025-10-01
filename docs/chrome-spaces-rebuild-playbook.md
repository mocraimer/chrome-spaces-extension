# Chrome Spaces Rebuild Playbook (2025)

This playbook guides an implementation agent through rebuilding the Chrome Spaces extension from scratch using 2025-era Chrome Extension best practices. Chrome Spaces treats each Chrome window as a named workspace ("space") and must deliver fast context switching, reliable persistence, and polished UX for keyboard-first and first-time users.

## Target Capabilities To Deliver

- Each browser window is a space tracked in real time with metadata: name, color/theme, tab list, tab group mapping, last active timestamp.
- Keyboard-first flows: open popup, fuzzy search, rename, switch, move tabs, and show help overlay without touching the mouse.
- Robust persistence: autosave active/closed spaces to storage, restore on startup, support manual export/import with conflict resolution.
- Tab operations: move tab between spaces, clone space, reopen closed spaces, optionally merge windows.
- Progressive onboarding: first-run checklist, tooltips, discoverable shortcuts, and recoverable actions.
- Settings surface (options or side panel) for autosave cadence, naming conventions, telemetry opt-in, accountless sync via manual bundles.
- Offline friendly, no remote persistence by default, optional integrations behind explicit opt-in.

## Phase 0: Research And Alignment

1. Inventory current knowledge:
   - Review `README.md`, `ACTIVE_CONTEXT.md`, and docs in `docs/` (personas, UX specs, import/export plan).
   - Extract must-have behaviors verified by existing automated tests.
2. Refresh platform knowledge for 2024-2025:
   - Manifest V3 updates (service worker lifetime rules, offscreen documents, user scripts API, side panel API).
   - Tab strip and tab group API improvements, `chrome.storage.session`, and persistent storage quotas.
   - Chrome Web Store policy changes (privacy requirements, screenshot sizes, review process).
3. Competitive scan:
   - Review current tab manager extensions for UX trends (side panel usage, AI-assisted naming, sync strategies).
   - Identify differentiators we want (fast restore, offline-first, a11y).
4. Product validation:
   - Confirm personas in `docs/USER_PERSONAS.md`; update pain points or success metrics if new research exists.
   - Reconcile with UX specs (`docs/popup-ux-spec.md`, `docs/options-architecture.md`) and update as needed.
5. Define success metrics:
   - Time to restore workspace, keyboard-only completion rate, storage write/read reliability, crash-free sessions, onboarding completion.

Deliverables: Updated requirements brief, API research notes, prioritized feature list, updated success metrics dashboard definition.

## Technical Foundations

### Core Tooling Stack

- Node.js 20 LTS, pnpm 9.x for deterministic installs.
- TypeScript 5.4+ with strictest compiler flags, `tsconfig` shared across packages.
- React 19 (or latest stable) with concurrent features where appropriate; fallback to 18 if 19 is not GA.
- State management: Zustand or Redux Toolkit Query for deterministic stores and background sync.
- Build system: Vite 5 with `@crxjs/vite-plugin` for MV3 bundling, plus SWC/Esbuild for fast TS transforms.
- UI styling: Tailwind CSS 4 alpha (if stable) or PostCSS modules with tokens; pick one and enforce via stylelint.
- Polyfill: `webextension-polyfill` for promise-based Chrome APIs.
- Package scripts for linting (ESLint flat config), formatting (Prettier 3), type checking, testing, and building.

### Project Layout

```
extension/
  packages/
    core/                    // shared types, domain logic, selectors
    platform/                // Chrome API wrappers, message bus, telemetry
    ui-components/           // design system primitives
  apps/
    popup/                   // popup React app
    sidepanel/               // optional side panel app
    options/                 // options React app
    onboarding/              // first-run page or in-app tour
  service-worker/            // background entry (TypeScript module)
  offscreen-documents/       // search indexer, data exporters
  scripts/                   // build, release, packaging scripts
  tests/                     // unit, integration, e2e specs
```

Adopt Turborepo or Nx for task orchestration, caching, and incremental builds.

### Coding Standards

- ESLint with type-aware rules, React hooks lint, accessibility lint.
- Prettier enforced in CI and pre-commit via lint-staged.
- Commit message convention (Conventional Commits) and automated changelog generation.
- Strict module boundaries using TS project references and path aliases.

### Observability And Telemetry

- Structured logging util that writes to Chrome `runtime.lastError` safe console and optionally to `chrome.storage.local` for debug sessions.
- Opt-in telemetry module that batches anonymized events and respects Do Not Track; default disabled.
- Error reporter capturing unhandled promise rejections from service worker and UI surfaces.
- Feature flags driven by local storage to toggle experimental flows.

## Platform Architecture Blueprint

### Manifest And Permissions

- Manifest V3 ("manifest_version": 3, "background.service_worker" entry).
- Narrow permissions: "tabs", "windows", "storage", "sessions", "commands", "sidePanel", "scripting" if context menu scripts needed. Request "downloads" only for export feature.
- Consider optional host permissions for future integrations (ex: capturing favicons) requested at runtime.
- Use "minimum_chrome_version" targeting Chrome 121+ to guarantee latest APIs.
- Register keyboard commands and populate `commands` section with default accelerators and placeholders for user customization.
- Define default icons, side panel, options page, and action popup.

### Background Service Worker

Responsibilities:

- Maintain authoritative state of spaces (active windows, metadata, closed spaces queue).
- Subscribe to `chrome.windows.onCreated/Removed`, `chrome.tabs.onUpdated/onRemoved/onAttached`, `chrome.sessions.onChanged`.
- Persist state to storage with debounced writes (for example, flush within 500ms of change, plus `chrome.alarms` fallback).
- Manage messaging bus to UI surfaces (popup, side panel, options) via `chrome.runtime.onMessage` and `chrome.runtime.Port`.
- Handle keyboard commands (`chrome.commands.onCommand`) to trigger space switching.
- Spawn offscreen document for heavy work (search indexing, export packaging) using `chrome.offscreen.createDocument` with lifetime management.

### Data And Storage Model

| Entity      | Fields                                                                 | Notes |
|-------------|-------------------------------------------------------------------------|-------|
| Space       | id, name, color, windowId, tabIds[], tabSummaries[], lastActiveAt, pinned, isClosed | id stable even if window closes; `isClosed` toggled for history |
| TabSummary  | tabId, url, title, faviconUrl, groupId, lastAccessed, muted, pinned     | store minimal info to restore window |
| WorkspaceSettings | autosaveIntervalMs, onboardingComplete, telemetryOptIn, namingTemplate, keyboardOverlayDismissed | stored per profile |
| ClosedSpace | snapshot of tabs, window geometry, closedAt, restoreCount               | limit list size, e.g., 25 |

Storage layers:

1. In-memory store inside service worker using Zustand store.
2. Persistence using `chrome.storage.local` with schema versioning and migrations.
3. Optional sync path using `chrome.storage.sync` (behind feature flag due to quota).
4. Export/import using zipped JSON anchored by schema version.

### Messaging And Synchronization

- Implement message contracts in `packages/platform` (TypeScript discriminated unions).
- Use streaming updates from service worker via `chrome.runtime.connect` and `Port.postMessage`.
- UI stores subscribe to service worker updates and request actions (rename, move tab, create space).
- Guard concurrency with optimistic updates and ack responses; fallback to full state reload if mismatch.

### UI Surfaces

- Popup: quick overview (list, search, actions). Optimized for keyboard and 300ms render budget.
- Side panel (optional but recommended 2025 best practice) for advanced management: drag-drop spaces, analytics, favorite spaces.
- Options page: settings, data management, telemetry opt-in, advanced shortcuts.
- Onboarding overlay: show on first run with ability to replay from options.

UI uses accessible components with high contrast, supports reduced motion, screen reader roles, and focus management.

### Search And Discovery

- Build fuzzy search index using Fuse.js or minisearch running in offscreen document to avoid blocking UI.
- Index includes space names, tab titles, URLs, tags.
- Provide caching strategy to refresh index on state updates with debounced worker messages.

### Tab Operations

- `chrome.tabs.move` for moving between windows; handle pinned tab semantics.
- `chrome.windows.create` for cloning space; ensure geometry captured.
- Use `chrome.tabGroups` to optionally map space sections to tab groups; behind toggle.
- Provide recovery flows for failures (for example, if window closed unexpectedly, rehydrate from storage).

### Accessibility And Internationalization

- Use `aria` attributes, focus traps, and keyboard testing.
- Internationalization via `@lingui` or `i18next` with message catalogs; hold off on translation until base strings stable.
- Support right-to-left layout toggles in design system.

## Implementation Roadmap

### Phase 0: Bootstrap (1 sprint)

- Initialize repository with monorepo tool (Turborepo or Nx).
- Configure pnpm workspace, package scripts, linting, formatting, GitHub Actions CI.
- Scaffold Vite-based builds for popup, options, side panel, and service worker entries.
- Add sample manifest, icons, and environment config.
- Acceptance: `pnpm build` outputs unpacked extension in `dist/` with placeholder UI.

### Phase 1: Domain Model And Persistence (1-2 sprints)

- Implement domain entities, selectors, and schema versioning in `packages/core`.
- Build service worker state store with hydration from `chrome.storage.local`.
- Implement storage adapters with migration pipeline and integration tests.
- Deliver background event listeners that keep store in sync with browser windows/tabs.
- Acceptance: extension tracks open windows as spaces, persists across reloads via console instrumentation.

### Phase 2: Popup MVP (1 sprint)

- Build popup UI with React, list spaces, show active window, keyboard navigation skeleton.
- Wire popup to service worker via message bus; implement rename, switch, close, reopen actions.
- Implement keyboard overlay and fuzzy search scaffold (wired to offscreen index stub).
- Acceptance: user can rename, switch, close, and reopen spaces via popup using keyboard-only flows.

### Phase 3: Advanced Features (2-3 sprints)

- Complete fuzzy search with offscreen index and highlight.
- Implement move tab between spaces, clone space, and bulk actions.
- Add closed spaces history with restore, limit, and analytics.
- Integrate side panel for advanced management and drag-and-drop (use React DnD or native API).
- Acceptance: features validated against personas (Marcus keyboard flows and Sarah recovery flows).

### Phase 4: Options, Settings, And Import/Export (1-2 sprints)

- Build options app for settings, data export/import, telemetry controls.
- Implement export to JSON/zip, import with validation, and optional downloads permission gating.
- Persist settings and integrate with service worker (autosave cadence, onboarding toggles).
- Acceptance: settings edit flows covered by e2e tests, import/export passes schema validation.

### Phase 5: Polish And Readiness (ongoing)

- Add onboarding experience, help overlay, contextual toasts.
- Performance tuning (Chrome Performance panel, memory snapshots).
- A11y audit with screen readers, color contrast, focus outlines.
- Localization scaffolding, theming, responsive layout tuning.
- Harden error handling, implement feature flag toggles, finalize telemetry.

### Phase 6: Release Preparation

- Finalize manifest metadata, icons, promotional assets.
- Set up automated packaging script (`pnpm package`) that emits zipped artifact and version bump.
- Draft privacy policy and data handling statements aligned with Chrome Web Store requirements.
- Run full regression suite, manual exploratory testing, and beta distribution.

## Quality And Testing Strategy

- Unit tests with Vitest covering domain logic, reducers, storage adapters (>=90 percent branch coverage for core packages).
- Component tests with Playwright component runner or React Testing Library for popup and options.
- Integration tests using `@crxjs/vite-plugin` test harness to simulate service worker and UI flows.
- E2E tests using Playwright in headed mode with `--headless=new`, launching persistent context that loads unpacked extension. Reuse existing helper patterns documented in `HEADLESS_MODE_MIGRATION.md`.
- Contract tests for message bus schemas using Zod or TypeBox to ensure runtime validation.
- Performance tests: measure popup render (<150 ms), command to window switch (<500 ms), search results (<100 ms).
- Accessibility tests with Axe automated checks and manual screen reader runs.
- CI pipeline: lint, type-check, unit tests, integration tests (CI), e2e tests (nightly), package build, artifact upload.

## Release And Operations

- Versioning with `npm version` automation or Changesets; follow semantic versioning.
- Packaging script builds, zips, signs (if needed), and uploads to Chrome Web Store using `chrome-webstore-upload-cli`.
- Maintain release checklist: bump version, update changelog, run regression, gather screenshots, update store listing.
- Telemetry review before release to ensure no private data stored without consent.
- Establish support rotation, triage process, and error logging review cadence.

## Acceptance Checklist For Completion

- Manifest validated by `chrome://extensions` and `web-ext lint` equivalent.
- All MVP capabilities verified against personas and success metrics.
- Storage migration tests cover schema evolution from v1 onwards.
- Full automated suite passing in CI with reproducible results.
- Packaging pipeline produces signed artifact and uploads to staging listing.
- Documentation updated: README, user guide, architecture, API.

## Appendix A: Environment Setup

1. Install Node.js 20 LTS and pnpm 9 (`corepack enable`).
2. `pnpm install` at repo root to bootstrap workspace.
3. `pnpm dev` launches Vite dev servers for popup/options with HMR and reloads service worker.
4. Use Chrome Canary or Dev channel for testing new APIs (offscreen, side panel).
5. Configure VS Code with recommended extensions: ESLint, Prettier, Chrome Extensions Tools.

## Appendix B: Reference Documents

- Personas: `docs/USER_PERSONAS.md`
- Popup UX: `docs/popup-ux-spec.md`
- Import/export plan: `docs/spaces-import-export.md`
- Testing patterns: `HEADLESS_MODE_MIGRATION.md`, `E2E_TEST_DIAGNOSIS.md`
- Current state summary: `ACTIVE_CONTEXT.md`

Keep these synchronized as the rebuild progresses; update this playbook whenever APIs or requirements change.
