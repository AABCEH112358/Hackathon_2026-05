# Anes — Neural Networks + Backend/Data
## GitHub Atlas Hackathon

You own the data layer and both neural networks. You're full-stack, so the backend/data part folds into your role naturally — the NNs need data to train on, so the ingestion pipeline is yours.

## Your scope

- Postgres schema with pgvector
- GitHub ingestion pipeline (top 5000 repos)
- UMAP-based layout algorithm (snap to 64×64 grid)
- Trending NN (small MLP, ~770 parameters)
- Personalization NN (two-tower, ~10k parameters)
- FastAPI endpoints serving all of the above

## Recommended Cursor model

- **Default: Claude Sonnet** for all coding
- **Switch to Claude Opus** for: PyTorch architecture decisions, debugging UMAP layout issues, anything where reasoning matters more than speed

## Hour 1 first steps

1. Wait for Kristen's repo to be created and accept her invite
2. `cd <repo>/api` (create the folder if needed)
3. Paste the Cursor prompt below into Cursor's agent
4. While Cursor scaffolds, sign up for [Neon](https://neon.tech), create a Postgres DB, enable pgvector via `CREATE EXTENSION vector;` in the SQL console
5. Get your GitHub Personal Access Token from github.com/settings/tokens
6. Drop both into `/api/.env` as `NEON_DATABASE_URL` and `GH_TOKEN`
7. Get an Anthropic API key from console.anthropic.com (you and David share this)
8. Run the seed script with just 100 repos first to validate the pipeline before going to 5000

---

## THE CURSOR PROMPT (copy everything below into Cursor's agent)

```
You are scaffolding the backend + ML stack for "GitHub Atlas", a SimCity-style
isometric map of GitHub repos. My role: data ingestion, layout algorithm, two
neural networks, and FastAPI endpoints to serve everything.

Tech stack:
- Python 3.11+
- FastAPI with async SQLAlchemy 2.0
- Neon Postgres with pgvector extension
- sentence-transformers (all-MiniLM-L6-v2, 384 dims) for embeddings
- umap-learn for layout
- PyTorch for both neural networks (tiny models)
- scikit-learn for utilities
- UV for package management

Create this structure in /api:

/api
├── pyproject.toml
├── .env.example
├── main.py
├── db/
│   ├── models.py            # SQLAlchemy models
│   ├── schema.sql           # Initial schema (pgvector)
│   └── session.py
├── routes/
│   ├── repos.py
│   ├── trending.py
│   ├── personalize.py
│   └── interactions.py
├── services/
│   ├── github_ingestion.py
│   ├── embeddings.py
│   └── layout.py
├── ml/
│   ├── trending_model.py
│   ├── personalization_model.py
│   ├── train_trending.py
│   ├── train_personalize.py
│   └── checkpoints/
└── scripts/
    └── seed.py

Schema:
- repos: id (str pk), github_id, owner, name, description, stars, forks,
  language, topics (jsonb), last_commit_at, embedding (vector(384)),
  tile_x (int), tile_y (int), height (int), trending_score (float)
- user_interactions: id, user_id, repo_id, action, duration_ms, timestamp
- star_history: repo_id, date, stars

API endpoints (all async, all JSON, CORS-enabled for localhost:3000 and *.vercel.app):

1. POST /api/repos/seed
   - Fetches top N repos from GitHub (default 5000), computes embeddings on
     description+topics, stores them. Returns {ingested: int}.
   - Handle GitHub rate limits with tenacity (exponential backoff).

2. GET /api/repos/layout
   - Returns all repos with tile_x, tile_y, height computed via UMAP on
     embeddings → snap to 64x64 grid. Height = log(stars) scaled 1-6.
   - Cache the computed layout in DB after first call.
   - Response: {repos: [{id, name, owner, stars, language, tile_x, tile_y,
     height, trending_score, description_short}]}

3. GET /api/repos/{repo_id}
   - Full detail. Response includes similar_repo_ids: 3 nearest by cosine.

4. POST /api/interactions
   - body: {user_id, repo_id, action, duration_ms}. Returns {ok: true}.

5. GET /api/trending/scores
   - Returns {repo_id: trending_score (0-1)} for all repos.

6. POST /api/personalize/score
   - body: {user_id}. Returns {repo_id: boost (-1 to 1)}.

Trending NN (PyTorch):
- Input: 7 standardized features (log current_stars, log growth_7d,
  log growth_30d, fork_ratio, log commits_7d, log issues_7d, log age_days)
- Architecture: Linear(7,32) → ReLU → Linear(32,16) → ReLU → Linear(16,1) → Sigmoid
- Train on synthetic data (5000 samples). Label "trending" if growth_7d >
  80th percentile for the repo's age bucket.
- Save: ml/checkpoints/trending.pt + ml/checkpoints/scaler.pkl

Personalization NN (PyTorch two-tower):
- user_tower: nn.Embedding(num_users, 32) → MLP(32→16)
- repo_tower: Linear(384, 32) → ReLU → Linear(32, 16)  // from repo embedding
- Output: cosine similarity → personalization boost
- Training: BPR-style implicit feedback. Retrain every 100 new interactions
  (background task).

Implementation order:
1. pyproject.toml with all deps, .env.example
2. db/ — models, schema.sql, session.py, connection test
3. services/github_ingestion.py — start with top 100 to validate
4. services/embeddings.py — sentence-transformers wrapper
5. services/layout.py — UMAP + grid snapping
6. routes/repos.py — GET /repos/layout (THIS UNBLOCKS THE FRONTEND TEAM)
7. ml/trending_model.py + train_trending.py
8. routes/trending.py
9. ml/personalization_model.py + train_personalize.py
10. routes/personalize.py
11. routes/interactions.py
12. GET /repos/{id} endpoint

Conventions:
- Async/await throughout
- Type hints on every function
- Pydantic models for all request/response
- structlog for logging
- One class/concern per file

Start with steps 1-6. Step 6 unblocks Abiya — prioritize getting layout
returning even with 100 repos before doing anything else.
```

---

## Data contract you expose to the frontend

```typescript
// What GET /api/repos/layout returns to Abiya & Kristen
type Repo = {
  id: string
  name: string
  owner: string
  stars: number
  language: string
  tile_x: number      // 0-63
  tile_y: number      // 0-63
  height: number      // 1-6
  trending_score: number     // 0-1
  description_short: string
}
```

## Coordinate with

- **David**: he adds his agent module into the same `/api` app. Agree on how his router mounts into `main.py` (he'll add `from routes.context import router as context_router; app.include_router(context_router)`)
- **Abiya**: she consumes `/api/repos/layout`. Get a stub response shape to her within 30 min so she can mock against it
- **Kristen**: she'll need your deployed Railway URL — give her `NEXT_PUBLIC_API_URL` once your backend is live

## If you finish early

- Add `/api/repos/search?q=` with vector similarity search (huge demo win for the search bar)
- Pre-cache context.md for the top 50 trending repos so the demo is instant
- Add a "discover similar" endpoint for the side panel