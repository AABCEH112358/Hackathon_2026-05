# GitHub Atlas API

Backend for the isometric GitHub repo map.

## Setup

```bash
cd api
cp .env.example .env
# Edit DATABASE_URL and GITHUB_TOKEN

uv sync
uv run python -c "import asyncio; from db.session import test_connection; asyncio.run(test_connection())"
```

Apply schema on Neon (or let `init_db()` create tables in dev):

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

## Run

```bash
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Unblock frontend (layout)

```bash
# 1. Seed ~100 repos (dev default)
curl -X POST http://localhost:8000/api/repos/seed -H "Content-Type: application/json" -d '{}'

# 2. Fetch layout tiles
curl http://localhost:8000/api/repos/layout
```

Or use the script:

```bash
uv run python scripts/seed.py 100
```
