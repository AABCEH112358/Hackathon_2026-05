# Kristen — Platform UI/UX (the shell around the map)
## GitHub Atlas Hackathon

You own the chrome around the map: search, side panel, the "Generate Context.md" button and viewer, the welcome screen. Plus you're the one who creates the GitHub repo and the Next.js project everyone else mounts into.

You've used React but not deeply — this prompt is calibrated for that. We're using **shadcn/ui** which means you compose pre-built components instead of building UI from scratch. Most of your work is wiring + styling, not building primitives.

## Your scope

- Create the GitHub repo + Next.js project (you go first, others clone yours)
- The UI shell: top bar with search, right-side detail panel, welcome screen
- The "Generate Context.md" button + the streaming viewer
- Listening to Abiya's `building:select` event and showing the detail panel
- Calling Anes's API endpoints
- Polish: loading states, smooth animations, dark theme

## Recommended Cursor model

- **Default: Claude Sonnet** — perfect for shadcn/Tailwind/React work
- Sonnet handles 100% of your tasks. No need to switch to Opus.

## Hour 1 first steps (YOU GO FIRST — others wait for your repo)

1. Create a GitHub repo: `github-atlas` (public, MIT license)
2. Add Anes, David, Abiya as collaborators in repo settings
3. Clone it locally, `cd github-atlas`
4. `mkdir web && cd web`
5. `npx create-next-app@latest . --typescript --tailwind --app --no-eslint`
6. `npx shadcn@latest init` (accept defaults, slate theme, "Default" style)
7. `npx shadcn@latest add button card input dialog sheet skeleton tooltip`
8. `npm i @tanstack/react-query zustand lucide-react`
9. Paste the Cursor prompt below into Cursor's agent
10. Once Cursor scaffolds, commit + push so Abiya can pull and start her map work
11. Tell the team "repo is live, my Next.js shell is up, you can pull"

---

## THE CURSOR PROMPT (copy everything below into Cursor's agent)

```
I'm building the UI shell for "GitHub Atlas" — a SimCity-style isometric
map of GitHub repos. The map itself (Phaser canvas) is being built by a
teammate and will mount inside my page. My job is everything around the
map: search bar, side panel for repo detail, the "Generate Context.md"
button and streaming viewer, welcome screen.

Tech stack:
- Next.js 14 with App Router (already initialized)
- TypeScript (be relaxed, don't fight types in third-party APIs)
- Tailwind CSS (already configured)
- shadcn/ui (already initialized, base components added)
- lucide-react for icons
- @tanstack/react-query for API calls
- zustand for global state

Project structure (extend the existing Next.js scaffold):

/web
├── app/
│   ├── layout.tsx              # Root layout, theme provider
│   ├── page.tsx                # Main page (map + UI overlays)
│   ├── providers.tsx           # React Query + theme providers
│   └── globals.css
├── components/
│   ├── TopBar.tsx              # Search + filters
│   ├── SidePanel.tsx           # Right-side repo detail panel
│   ├── ContextMdViewer.tsx     # Streaming markdown viewer for context.md
│   ├── WelcomeScreen.tsx       # First-load onboarding
│   ├── Map/
│   │   └── PhaserMap.tsx       # Teammate Abiya owns this internally
│   └── ui/                     # shadcn components (already present)
├── lib/
│   ├── api.ts                  # API client (fetch wrapper)
│   ├── store.ts                # Zustand global store
│   └── utils.ts                # shadcn util
└── fixtures/
    └── sample_repos.json       # Mock data for offline dev

Layout (visual structure):

- Phaser canvas (Abiya's component) is full-screen: position absolute, inset 0
- TopBar floats absolute-positioned, centered horizontally, 24px from top,
  600px wide, glass-morphism style (backdrop-blur-md bg-slate-900/80
  border border-slate-700 rounded-xl)
- SidePanel slides in from the right when a building is selected:
  - 400px wide, full viewport height
  - Same glass-morphism style as TopBar
  - Slides in via CSS transition (transform: translateX)
- WelcomeScreen overlays the whole viewport on first visit, dismissed
  with a "Start Exploring" button

TopBar contents:
- Search input with magnifier icon (lucide Search)
- Filter row below: Language dropdown (shadcn Select), Trending toggle
  (shadcn Switch), Personalized toggle (shadcn Switch)
- Search input is debounced 300ms, dispatches a window event
  'search:focus-district' with { detail: { language?, query? } } so the
  map can fly to a district

SidePanel contents:
- Close button (X icon, top-right)
- Header: avatar (github.com/{owner}.png), owner / repo-name, star count
  with star icon
- Description (truncated to 200 chars with "show more")
- Quick stats row: forks, last commit, language badge
- Big primary button: "Generate Context.md" (uses emerald accent color)
- When clicked, panel expands to ~70% viewport width and shows the
  ContextMdViewer streaming the result
- "Similar repos" section at bottom: 3 small cards from
  similar_repo_ids in the API response

ContextMdViewer:
- Connects to /api/context/generate via EventSource
- Shows progress messages ("Reading repo...", "Identifying patterns...")
  in a subtle gray text area
- Streams the markdown content into a code-styled prose block
  (use prose-invert from tailwind typography)
- Has a "Copy to clipboard" button at the top once streaming completes
- Has a "Regenerate" button (re-opens EventSource bypassing cache)

WelcomeScreen:
- One screen, centered card
- Headline: "Explore GitHub as a city"
- Subhead: 2 sentences explaining the concept
- Three small cards highlighting:
  1. Discovery — "Find repos by walking through districts"
  2. Predictive — "Glowing buildings predict next week's trends"
  3. Personal — "The city reshapes around what you care about"
- "Start Exploring" button (emerald)
- Sets localStorage flag so it doesn't show again

Global state (zustand store at lib/store.ts):

interface AppStore {
  userId: string                  // generated once, persisted in localStorage
  selectedRepoId: string | null
  searchQuery: string
  filters: {
    language: string | null
    trendingOnly: boolean
    personalized: boolean
  }
  contextMd: {
    repoId: string
    content: string
    progress: string
    streaming: boolean
  } | null

  setSelectedRepoId: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setFilters: (f: Partial<AppStore['filters']>) => void
  setContextMd: (c: AppStore['contextMd']) => void
}

API client (lib/api.ts):

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const fetchLayout = async () => {
  const r = await fetch(`${API}/api/repos/layout`)
  return r.json()
}

export const fetchRepoDetail = async (id: string) => {
  const r = await fetch(`${API}/api/repos/${id}`)
  return r.json()
}

export const logInteraction = async (data: {
  user_id: string, repo_id: string, action: string, duration_ms?: number
}) => {
  await fetch(`${API}/api/interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
}

export const streamContextMd = (
  repoId: string,
  onProgress: (msg: string) => void,
  onChunk: (text: string) => void,
  onComplete: () => void
) => {
  const es = new EventSource(`${API}/api/context/generate?repo_id=${repoId}`)
  es.addEventListener('progress', (e) => onProgress(JSON.parse(e.data).message))
  es.addEventListener('chunk', (e) => onChunk(JSON.parse(e.data).content))
  es.addEventListener('complete', () => { onComplete(); es.close() })
  return () => es.close()
}

Listen to Abiya's events:

useEffect(() => {
  const onSelect = (e: CustomEvent) => {
    const repoId = e.detail.repoId
    store.setSelectedRepoId(repoId)
    logInteraction({ user_id: store.userId, repo_id: repoId, action: 'click' })
  }
  window.addEventListener('building:select', onSelect as EventListener)
  return () => window.removeEventListener('building:select', onSelect as EventListener)
}, [])

Implementation order:
1. app/providers.tsx — React Query provider, theme
2. lib/store.ts — Zustand store with userId persisted to localStorage
3. lib/api.ts — API client functions
4. app/page.tsx — page layout with placeholder for PhaserMap (just a
   div with a border for now)
5. components/TopBar.tsx — search + filters
6. components/SidePanel.tsx — repo detail panel
7. components/ContextMdViewer.tsx — SSE streaming markdown
8. components/WelcomeScreen.tsx — onboarding
9. Wire up event listener for building:select
10. Polish: animations, loading skeletons

Aesthetic:
- Dark theme (slate-900 background, slate-100 text)
- Glass-morphism panels: backdrop-blur-md bg-slate-900/80 border border-slate-700
- Accent color: emerald-500 for CTAs and trending indicators
- Generous whitespace, large readable type
- Use lucide icons throughout
- Smooth transitions on all interactive elements

Conventions:
- Use shadcn components as starting points
- All API calls through lib/api.ts
- All state mutations through the zustand store
- Keep components under 150 lines
- Mock data fallback: if NEXT_PUBLIC_API_URL is not set, use
  fixtures/sample_repos.json so the UI is always demo-able

Start with step 1-4. Get the page rendering with a placeholder for the
map, then build out the panels.
```

---

## Coordinate with

- **Abiya**: she mounts her `PhaserMap.tsx` inside your `/components/Map/`. Tell her her component should be full-screen absolute. Yours sits on top as overlays.
- **Anes**: he provides `/api/repos/layout`, `/api/repos/{id}`, `/api/interactions`, `/api/trending/scores`, `/api/personalize/score`. Get his deployed Railway URL when ready and set it as `NEXT_PUBLIC_API_URL` in Vercel.
- **David**: he provides `/api/context/generate` (SSE). Your `ContextMdViewer` consumes it. Get a working endpoint from him by hour 8.

## Hour 1 priority for the team

YOU are the unblocker for everyone else. Your priority:
1. **Repo created + invited** within 10 min
2. **Next.js scaffold pushed** within 30 min
3. **PhaserMap.tsx placeholder div** committed so Abiya can clone and start

Everything else can come later. Don't perfect the welcome screen before pushing the scaffold.

## If you finish early

- Add keyboard shortcuts: ⌘K to focus search, Esc to close panel
- Add a stats bar at the bottom showing "5,247 repos · 12 districts · trending pulse on 87"
- Add an "About this project" modal (lucide info icon, top-right) that explains the two neural networks — judges will appreciate this and it earns you Demo & Communication points
- Add subtle ambient sound (very low volume city hum) — surprising touch that lands in a demo