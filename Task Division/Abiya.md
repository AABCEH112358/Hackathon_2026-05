# Abiya — Map + Phaser (the visual centerpiece)
## Repo Pilot Hackathon

You own the visual centerpiece. **This IS the demo.** Buildings, glow, camera, the whole isometric SimCity feel — it's all yours. Make it beautiful and make it run smooth.

You're confident with frontend but new to Phaser. That's fine — Phaser 3 has good docs and Cursor will scaffold the basics. Expect 1-2 hours of ramp time, then it's just iteration.

## Your scope

- Phaser 3 isometric tilemap (64×64 grid)
- Buildings rendered with height, color, glow
- Camera (pan + zoom)
- Click + hover interactions, emitting events up to Kristen's React state
- Visual effects: pulsing glow for trending repos, scale for personalization
- Performance: 60fps with 5000 buildings on a mid-range laptop

## Recommended Cursor model

- **Default: Claude Sonnet** — game/canvas code is well within its range
- **Switch to Claude Opus** for: isometric coordinate math debugging, Phaser performance issues (object pooling, culling)

## Hour 1 first steps

1. Wait for Kristen to push the initial Next.js scaffold (~20 min after kickoff)
2. Pull, `cd <repo>/web`, `npm i phaser`
3. Paste the Cursor prompt below into Cursor's agent inside `/web`
4. **While the backend is being built**, create `/web/fixtures/sample_repos.json` with ~50 mock repos so you can develop in isolation — don't wait for Anes's API to validate your map

---

## THE CURSOR PROMPT (copy everything below into Cursor's agent)

```
I'm building the visual centerpiece of "Repo Pilot" — an isometric
SimCity-style map where every GitHub repo is a building. Integrate
Phaser 3 into our existing Next.js 14 App Router app (located at /web).

Tech stack:
- Phaser 3 (latest)
- TypeScript (strict mode where possible)
- React 18 / Next.js 14 (App Router) — Phaser mounts inside a React component
- Use dynamic import for Phaser to avoid SSR errors

Add this structure inside /web:

/web/components/Map/
├── PhaserMap.tsx              # React wrapper that mounts the Phaser canvas
├── scenes/
│   ├── CityScene.ts           # Main Phaser scene with the city
│   └── PreloadScene.ts        # Asset loading (mostly procedural, minimal assets)
├── entities/
│   ├── Building.ts            # Building game object class
│   └── BuildingPool.ts        # Object pool for efficient rendering
├── systems/
│   ├── isometric.ts           # iso ↔ cartesian conversion helpers
│   ├── camera.ts              # Pan + zoom controls
│   └── highlight.ts           # Glow effect system
└── types.ts                   # Shared TypeScript types

Data shape (what /api/repos/layout returns):

type Repo = {
  id: string
  name: string
  owner: string
  stars: number
  language: string
  tile_x: number      // 0-63
  tile_y: number      // 0-63
  height: number      // 1-6
  trending_score: number      // 0-1
  description_short: string
}

Visual design — flat-shaded modern indie game aesthetic. Think Monument
Valley or Mini Metro. NOT realistic, NOT GTA-fidelity.

Tilemap:
- 64×64 grid of isometric tiles
- Tile dimensions: 64w × 32h (standard 2:1 isometric ratio)
- Empty tiles: dark navy/charcoal ground (#0f172a-ish with subtle gradient)
- District backgrounds: very subtle color overlay tinting groups of tiles
  by dominant language in that cluster

Buildings:
- Drawn as stacked isometric boxes using Phaser graphics or pre-rendered
  sprites
- Height = repo.height (1-6 floors, each ~24px tall in screen space)
- Color = language color palette:
  - JavaScript/TypeScript: amber (#fbbf24)
  - Python: indigo (#6366f1)
  - Rust: orange (#f97316)
  - Go: cyan (#06b6d4)
  - Java: red (#ef4444)
  - C/C++: violet (#8b5cf6)
  - Ruby: rose (#f43f5e)
  - default: slate (#94a3b8)
- Soft drop shadow below each building (offset 2px down-right, low opacity)
- Hover state: subtle outline + 4px raise

Visual effects:
- Trending glow: animated outer glow on building top, pulsing at 1Hz,
  intensity = trending_score (0 = no glow, 1 = bright emerald glow)
- Personalization: subtle vertical scale (scale_y = 1.0 + 0.3 *
  personalized_boost), where boost can be -1 to 1
- Apply both effects without conflicting

Camera (systems/camera.ts):
- Pan: drag with mouse (or single-finger touch on mobile)
- Zoom: scroll wheel or pinch (range 0.3x to 3x)
- Smooth interpolation on all camera movements
- Method panToTile(x, y, zoom?) → smoothly animates camera to a tile,
  used when the search bar wants to focus a district

Interactions:
- Click a building → dispatch window event 'building:select' with
  { detail: { repoId } }
- Hover a building → dispatch 'building:hover' with { detail: { repoId } }
- These are listened to by Kristen's React components

Performance requirements:
- Use object pooling for buildings (you'll have 5000+)
- Cull buildings outside the camera viewport + 200px margin
- Phaser's built-in WebGL renderer (default)
- Target 60fps at 5000 buildings on a mid-range laptop

Data fetching:
- On mount, fetch from process.env.NEXT_PUBLIC_API_URL + '/api/repos/layout'
- If API_URL is not set or fetch fails, fall back to loading
  /fixtures/sample_repos.json (this lets you develop without the backend)
- Refresh every 60 seconds to pick up new trending scores

Implementation order:
1. Install phaser. Set up PhaserMap.tsx with dynamic import to avoid SSR.
2. PreloadScene + CityScene rendering an empty 64x64 isometric grid.
   Verify iso math (tiles should look like proper diamonds).
3. Render 10 hardcoded buildings at known positions to validate Building.ts.
4. Wire to /fixtures/sample_repos.json — render real buildings from data.
5. Add language-based coloring.
6. Add camera controls (pan + zoom).
7. Add hover + click interactions, emit window events.
8. Add trending glow effect.
9. Add personalization scaling.
10. Implement BuildingPool with culling for performance.
11. Wire to live API endpoint (fallback to fixture if API unreachable).
12. Polish: shadows, ambient animation, smooth panToTile.

Conventions:
- TypeScript strict where possible (Phaser types are sometimes loose, OK
  to relax in scene files)
- Pure functions for iso math in systems/isometric.ts (so they're testable)
- All Phaser-specific code lives in /scenes and /entities, nothing leaks
  into the rest of the app
- Component files < 200 lines each

Start with step 1-3. Hardcoded buildings on the grid IS your hour-1 win.
Real data comes after.
```

---

## Mock data for offline development

Create `/web/fixtures/sample_repos.json`:

```json
{
  "repos": [
    {
      "id": "1",
      "name": "next.js",
      "owner": "vercel",
      "stars": 120000,
      "language": "JavaScript",
      "tile_x": 32,
      "tile_y": 30,
      "height": 6,
      "trending_score": 0.7,
      "description_short": "The React framework"
    }
    // ... add ~50 of these with varied positions and languages
  ]
}
```

Cursor can generate these for you — ask it to "generate 50 realistic sample repos with varied tile positions across the 64x64 grid, varied languages, and varied star counts from 100 to 200000."

## Events you emit (Kristen listens to these)

```typescript
// When user clicks a building
window.dispatchEvent(new CustomEvent('building:select', {
  detail: { repoId: '123' }
}))

// When user hovers a building
window.dispatchEvent(new CustomEvent('building:hover', {
  detail: { repoId: '123' }
}))
```

## Coordinate with

- **Kristen**: she owns the surrounding UI (top bar, side panel). Your Phaser canvas should be **full-screen** (`position: absolute; inset: 0`). Her UI overlays on top with absolute positioning. Don't put UI inside the Phaser canvas.
- **Anes**: he provides `/api/repos/layout`. You consume it. Use his fixture or mock data while his API is being built.

## If you finish early

- Add a "district name" label that floats above the camera when zoomed out (e.g., "React Town", "Python Plaza")
- Add a day/night cycle (cycles slowly, ~30 sec each, adjusts ground color and building glow intensity)
- Add a "fly to random trending repo" button that smoothly cinemas the camera
- Particle effects on click (small burst of color matching the building's language)