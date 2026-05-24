# RepoPilot

**Live demo:** [https://hackathon-2026-05.vercel.app](https://hackathon-2026-05.vercel.app)  
**API:** [https://hackathon2026-05-production.up.railway.app](https://hackathon2026-05-production.up.railway.app)

> A SimCity-style isometric map of GitHub — fly over themed districts, explore repos as buildings, and summon an AI agent that writes **context.md** contribution briefs.

Built for the **Cursor Calgary Hackathon 2026** ([playbook](./cursor_hackathon_playbook.md)).

---

## The pitch

Most repo discovery tools are lists. **RepoPilot turns GitHub into a city you can walk through.**

- **Castle District** — AI & machine learning  
- **Desert Outpost** — cybersecurity & hacking  
- **Volcano Academy** — math, CS & algorithms  

Click a building (or pick from the sidebar), open the repo brief, and generate a downloadable **context.md** powered by our multi-step LLM agent.

**Innovation lines we lean on:**

1. *"Most repo discovery tools are lists. We made GitHub a city you can walk through."*  
2. *"Two neural networks — one predicts trending repos, one personalizes the map from your clicks."*  
3. *"Click any building and an AI agent doesn't just describe the repo — it gives you a rebuild prompt."*

---

## Features

| Layer | What it does |
|--------|----------------|
| **Discovery map** | Aerial god-view → fly into 3 districts → 5 on-theme repos each |
| **Trending ML** | PyTorch MLP scores repos likely to rise (pins glow by trend) |
| **Personalization ML** | Two-tower model learns from clicks to reshape recommendations |
| **Context agent** | SSE-streamed pipeline: read repo → abstract → patterns → *why contribute* → assemble markdown |
| **Field search** | Search by endeavor (`cybersecurity`, `AI`, `math`, …) not just repo name |

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Vite + Vanilla JS (frontend)          Vercel               │
│  • Isometric map UI, districts, modals                      │
│  • Calls Railway API + EventSource for context stream         │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│  FastAPI (api/)                         Railway              │
│  • /api/repos/layout   UMAP tiles + metadata                  │
│  • /api/context/generate   SSE context agent                  │
│  • /api/trending/scores   /api/personalize/score              │
│  • /api/interactions     click & dwell logging                │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Neon Postgres + pgvector                                    │
│  • Repo embeddings, layout cache, context cache, events      │
└─────────────────────────────────────────────────────────────┘
```

---

## Repository structure

```text
Hackathon_2026-05/
├── README.md                 ← you are here
├── index.html                # Vite entry
├── src/
│   ├── main.js               # Map UX, districts, modals
│   ├── districts.js          # Themed grouping + field search
│   ├── repoFilter.js         # Content blocklist
│   ├── api.js                # Railway client + SSE
│   └── style.css
├── public/assets/            # Aerial + district map art
├── api/                      # FastAPI backend
│   ├── main.py
│   ├── routes/               # repos, context, trending, personalize
│   ├── services/             # ingestion, layout, context agent
│   ├── ml/                   # PyTorch models + train scripts
│   └── db/                   # SQLAlchemy + schema
├── vercel.json               # Frontend deploy (api/ ignored)
└── cursor_hackathon_playbook.md
```

---

## Quick start (local)

### Frontend

```bash
npm install
npm run dev
# → http://localhost:5173
```

Optional: point at a different API:

```bash
VITE_API_URL=http://localhost:8000 npm run dev
```

### Backend

```bash
cd api
cp .env.example .env
# Set DATABASE_URL, GITHUB_TOKEN, OPENAI_API_KEY

pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Seed repos + warm layout (first run)
curl -X POST http://localhost:8000/api/repos/seed -H "Content-Type: application/json" -d '{}'
```

See [api/README.md](./api/README.md) for database setup and ML training notes.

---

## Deploy

| Service | Platform | Notes |
|---------|----------|--------|
| Frontend | **Vercel** | `npm run build` → `dist/`; `api/` excluded via `.vercelignore` |
| Backend | **Railway** | `api/nixpacks.toml`; set env vars below |

**Railway env (required for context.md):**

- `DATABASE_URL` — Neon Postgres  
- `GITHUB_TOKEN` — higher API rate limits  
- `OPENAI_API_KEY` — context agent  
- `CORS_ORIGINS` — include your Vercel URL (also allows `*.vercel.app`)

**Vercel env (optional):**

- `VITE_API_URL` — defaults to production Railway URL in code

---

## Demo path (judges)

1. Open the live URL → world map with three district pins.  
2. Click **Desert** / **Castle** / **Volcano** → fly-in → five themed repos.  
3. Click a pin → repo modal → **Generate context.md**.  
4. Download the brief when the ready modal appears.  
5. Try **Search** for `cybersecurity` or `AI` to show field-based discovery.

---

## Team & roles

| Area | Focus |
|------|--------|
| Map / UI | Isometric experience, districts, pins, modals |
| Backend / data | FastAPI, Neon, ingestion, UMAP layout |
| AI / ML | Trending + personalization models, context agent |
| Glue / deploy | Vercel + Railway, demo narrative |

Task breakdown: [`Task Division/`](./Task%20Division/).

---

## Judging alignment

From our [hackathon playbook](./cursor_hackathon_playbook.md) — we optimize for:

- **Innovation (25%)** — spatial discovery vs flat lists; dual NN + agentic briefs  
- **Technical execution (20%)** — full stack, pgvector, PyTorch, SSE agent pipeline  
- **Functional completeness (20%)** — end-to-end demo path above  
- **Problem–solution fit (20%)** — developers drowning in repos need context, not more links  

---

## License

Hackathon project — see repository owner for license terms.
