# 6FB Content Studio — Desktop App

A native macOS/Windows desktop application (Electron + React + Vite) that provides a unified content creation studio for barbers and barbershop owners. It bridges the Python AI pipeline (`ix-social-media-manager`) with a polished Tailwind UI.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Electron 34 |
| Build tool | electron-vite 3 |
| UI framework | React 19 + TypeScript |
| Styling | Tailwind CSS 3 |
| Animations | Framer Motion 12 |
| Icons | lucide-react |
| Routing | react-router-dom 7 |
| AI | @anthropic-ai/sdk, openai |
| Python bridge | `electron/python-bridge.ts` → `python/clip_extractor/` |

## Project Structure

```
6fb-content-studio/
├── electron/
│   ├── main.ts              # Main process — window, IPC, menu, auto-updater
│   ├── preload.ts           # Secure context bridge (exposes electronAPI to renderer)
│   └── python-bridge.ts    # Spawns + communicates with Python clip_extractor subprocess
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx    # Home — quick stats, recent clips, activity feed
│   │   ├── ClipExtractor.tsx # Video upload → clip selection → face-tracked reframe
│   │   ├── CarouselStudio.tsx # AI carousel builder with slide editor + live preview
│   │   ├── BrandStudio.tsx  # Brand kit editor — colors, fonts, logos, WCAG contrast
│   │   ├── BlogWriter.tsx   # AI blog post writer (pulls from clip pipeline content)
│   │   └── Settings.tsx     # API keys, brand config, Python path config
│   ├── components/
│   │   ├── Sidebar.tsx      # Main nav sidebar (icon + label, active state)
│   │   ├── ErrorBoundary.tsx # React error boundary with restart button
│   │   └── carousel/
│   │       └── SlidePreview.tsx # Live HTML-rendered carousel slide preview
│   └── hooks/
│       └── useGoogleFonts.ts # Dynamic Google Font injection for Brand Studio
├── python/
│   └── clip_extractor/      # Bundled Python scripts (copied from ix-social-media-manager)
├── assets/
│   └── icon.png             # App icon (macOS .icns source)
├── public/                  # Static assets accessible in renderer
└── release/                 # Packaged distributables output (DMG, ZIP, NSIS)
```

## Dev Commands

```bash
# In /Users/bossio/clawd/projects/6fb-content-studio/
npm run dev           # Start Electron + Vite hot-reload dev server
npm run build         # Build for production (no package)
npm run package:mac   # Build + package macOS DMG + ZIP → release/
npm run package:win   # Build + package Windows NSIS → release/
```

## IPC Architecture

The renderer (React) communicates with main process through a strict preload bridge:

```
React Page
  → window.electronAPI.xyz()        # Defined in preload.ts
  → ipcRenderer.invoke('channel')   # Secure IPC call
  → ipcMain.handle('channel')       # main.ts handler
  → python-bridge.ts (if Python)    # Spawns Python subprocess
  → stdout/stderr parsed as JSON
```

**Never** use `nodeIntegration: true`. All Node access goes through the preload bridge.

## Python Bridge

`electron/python-bridge.ts` manages the Python clip extractor subprocess:
- Detects system Python / venv Python automatically
- Streams stdout line-by-line — parses `[PROGRESS] {pct} {message}` lines for UI progress bars
- Sends JSON payloads via stdin, receives JSON via stdout
- Errors surface via stderr and are forwarded to the renderer as IPC error events

The bundled Python scripts live in `python/clip_extractor/` and mirror the tools from `ix-social-media-manager/tools/clip_extractor/`.

## Pages Overview

### ClipExtractor.tsx
The most complex page. Flow:
1. User drops a video file
2. `python-bridge.ts` calls `full_pipeline.py` with `--no-post --format auto`
3. Progress streamed via IPC to update the UI progress bar
4. Clip cards rendered with title, score, duration, and thumbnail
5. Download or post buttons per clip

### CarouselStudio.tsx
- Left panel: slide list + add/remove
- Center: live `SlidePreview.tsx` rendering HTML-to-image via `html-to-image`
- Right panel: text editor, color pickers, font selector
- Brand colors pulled from BrandStudio config via electron-store

### BrandStudio.tsx
- Live Google Font preview via `useGoogleFonts.ts` hook
- WCAG AA/AAA contrast checker (luminance calculation)
- Logo upload → stored as base64 in electron-store
- Exports `brand.json` compatible with `ix-social-media-manager/brands/`

### BlogWriter.tsx
- AI-powered blog post generator
- Pulls clip transcripts from `ix-social-media-manager` output directory
- Uses Codex (Anthropic SDK) to expand transcript excerpts into SEO blog posts

## State Management

No Redux or Zustand — state is local to each page via React hooks. Persistent state (brand config, API keys, settings) stored via `electron-store` accessed through IPC.

## Styling Conventions

- Tailwind utility classes only — no custom CSS files (except `index.css` for base resets)
- Dark mode: `bg-gray-900` / `bg-gray-800` backgrounds, `text-white` / `text-gray-300` text
- Accent color: `#22C55E` (green-500) for active states, CTAs, progress
- Framer Motion for page transitions and card animations (always `duration: 0.2` or less)
- All interactive elements need `hover:` and `focus:` states

## Critical Rules

1. **Never break the preload bridge** — all new IPC channels need entries in `preload.ts` AND `main.ts`
2. **Python path is configurable** — never hardcode `/usr/bin/python3`; always read from Settings
3. **electron-store keys are typed** — define the schema in `main.ts` `store` initialization
4. **Two copies exist** — canonical source is `/Users/bossio/clawd/projects/6fb-content-studio/`. The scratch copy at `/Users/bossio/.gemini/antigravity/scratch/6fb-content-studio/` is a working duplicate; consolidate when possible
5. **Auto-updater** is configured for `https://6fbmentorship.com/downloads` — don't change the publish URL without updating the server

## Connection to ix-social-media-manager

The desktop app is the **UI layer** on top of the Python AI pipeline:

```
6fb-content-studio (Electron UI)
  └── python-bridge.ts
        └── ix-social-media-manager/tools/pipeline/full_pipeline.py
              ├── clip_extractor/  (face tracking, split renderer)
              ├── ai_composer.py   (Codex composition)
              └── config.yaml      (tuned by ClipQA AutoEvolver)
```

Changes to `config.yaml` in `ix-social-media-manager` affect clip quality in this app automatically.
