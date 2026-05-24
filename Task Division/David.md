# David — Context.md AI Agent
## Repo Pilot Hackathon

You own the AI agent that's the "kicker" of the demo. Given any repo on our map, your agent generates a `context.md` that's both human-readable AND structured to be fed back into an AI coding agent (Cursor, Claude Code) to recreate a working clone of that tool.

You're confident with Python/API, intermediate elsewhere. This prompt is calibrated to that. You'll be working inside the same `/api` directory as Anes (the backend) but in your own module — no conflicts.

## Your scope

- A multi-step LLM agent (Anthropic API)
- Reads repo content from GitHub
- Produces a structured `context.md` (human brief + rebuild prompt)
- Streams the output via Server-Sent Events
- Caches results in the database

## Recommended Cursor model

- **Default: Claude Sonnet** for all coding
- **Switch to Claude Opus** for: prompt engineering on your agent's internal Claude calls (the prompts your agent sends to Claude itself), since that quality directly affects the demo output

## Hour 1 first steps

1. Wait for Kristen's repo invite, accept it
2. Wait for Anes's `/api` scaffold to exist (~30 min after kickoff)
3. Get the Anthropic API key from Anes (share one)
4. Get a GitHub PAT from github.com/settings/tokens (separate from Anes's so you don't burn rate limits)
5. `cd <repo>/api` and paste the Cursor prompt below into Cursor's agent
6. Coordinate with Anes on the schema migration for your `context_cache` table

---

## THE CURSOR PROMPT (copy everything below into Cursor's agent)

```
You are building the AI agent for "Repo Pilot" that generates context.md
files for GitHub repos. The context.md serves two purposes:
  1. Human-readable brief of the repo
  2. A "rebuild prompt" — structured instructions an AI coding agent can
     use to recreate a working clone of the tool.

You're working inside an existing /api FastAPI project (built by another
developer, Anes). Add your module without conflicting with his code.

Tech stack:
- Python 3.11+ (matches the existing project)
- FastAPI router mounted into the main app
- Anthropic Python SDK (use claude-sonnet-4-5 or current Sonnet by default;
  use Opus only for the final prompt-writer step)
- httpx for async GitHub API calls
- Server-Sent Events for streaming
- Same Postgres DB as the rest of /api (use existing session.py)

Add this structure to /api:

/api
├── routes/
│   └── context.py                # /api/context endpoints
└── services/
    └── context_agent/
        ├── __init__.py
        ├── agent.py              # Main multi-step orchestrator
        ├── repo_reader.py        # Fetches repo content from GitHub
        ├── analyzer.py           # Identifies abstractions, patterns
        ├── prompt_writer.py      # Generates the rebuild prompt
        └── prompts.py            # System prompts for each step

Database addition (coordinate with Anes before applying):
- context_cache table: id (str pk), repo_id (fk), content_md (text),
  generated_at (timestamp), model_version (str)

Multi-step agent flow:

STEP 1 — Skim the repo (repo_reader.py):
- Fetch via GitHub API:
  - Repo metadata (description, language, topics, stars, license)
  - README.md (truncate to 5000 chars if longer)
  - package.json OR requirements.txt OR pyproject.toml OR Cargo.toml
  - The 5-10 most "important" source files (heuristic: src/index.*, src/main.*,
    src/core.*, lib/*.* at top level, or root-level files matching common
    entry-point names). Truncate each to 2000 chars.
- Return a structured dict with all of the above.

STEP 2 — Identify core abstraction (analyzer.py):
- Anthropic call (Sonnet) with system prompt:
  "You analyze software repos. In one sentence under 25 words, what is the
  core abstraction or primary value this repo provides? Be concrete, not generic."
- User message: README excerpt + file list + dependencies.

STEP 3 — Extract architectural patterns (analyzer.py):
- Anthropic call (Sonnet) with system prompt:
  "List 3-5 key architectural patterns this repo uses (e.g., 'plugin
  architecture with lazy module loading', 'hooks-based reactivity',
  'middleware pipeline pattern'). Be specific and short — one line each."
- User message: source file excerpts + dependencies.

STEP 4 — Generate the rebuild prompt (prompt_writer.py):
- Anthropic call (use OPUS here — quality matters more than speed) with
  system prompt:
  "You are writing a prompt for an AI coding agent (like Cursor or Claude
  Code). The agent will use this prompt to recreate a minimal working clone
  of [REPO_NAME]. Structure your output as a single markdown prompt with
  these sections:
    - One-line description of what to build
    - Tech stack (concrete: framework, language, key libraries)
    - File structure (tree with brief comments per file)
    - Core abstractions to implement (with function/type signatures)
    - Example usage (a small code snippet showing the API)
    - Out of scope (3-5 explicit non-goals)
  The prompt must be actionable. An agent should be able to read it and
  start building immediately. Aim for ~500 words."
- User message: results from steps 1-3.

STEP 5 — Assemble final markdown (agent.py):
- Format the response as:
  # [Repo Name]
  > [one-line description from step 2]

  ## Overview
  [2-3 sentence summary]

  ## Tech Stack
  [extracted dependencies]

  ## Architecture
  [3-5 patterns from step 3, as bulleted list]

  ## Rebuild Prompt
  [the full output from step 4 — this is the actionable part]
- Cache to context_cache table.

API endpoint (routes/context.py):

GET /api/context/generate?repo_id={id}
- Returns Server-Sent Events streaming the markdown as it generates
- Stream pattern: emit a chunk after each step completes ("Reading repo...",
  "Identifying core abstraction...", etc.) so the UI shows progress
- If a cached version < 24h old exists, stream it immediately
- Errors: return SSE with type=error and a message

Implementation order:
1. Install dependencies (anthropic, httpx)
2. services/context_agent/repo_reader.py — manual test against vercel/next.js
3. services/context_agent/prompts.py — define each step's system prompt
4. services/context_agent/analyzer.py + prompt_writer.py — implement
   Claude calls. Test each in isolation with a known repo.
5. services/context_agent/agent.py — orchestrate steps 1-5 with proper
   error handling
6. routes/context.py — SSE endpoint
7. Add caching logic (check cache before running pipeline)
8. End-to-end test with 3 real repos: a popular framework, a small library,
   a complex app

Conventions:
- Match existing /api code style (async, type hints, Pydantic)
- Wrap every Anthropic call in retry logic (tenacity, 3 retries,
  exponential backoff, only retry on rate limit / 5xx)
- Log each step's input length + output length to stdout
- Single Anthropic client instance, reused across requests
- Use anthropic.AsyncAnthropic, not the sync client

Cost target: ~$0.10 per repo, ~20-30 seconds end-to-end.

Start with steps 1-2. Get repo_reader.py working against a real repo before
touching Claude calls.
```

---

## What the frontend expects from you

Kristen's `ContextMdViewer` component opens an EventSource against:

```
GET /api/context/generate?repo_id={id}
```

And expects SSE events. Use these event types so the UI can show progress:

```
event: progress
data: {"step": "reading", "message": "Reading repo structure..."}

event: progress
data: {"step": "analyzing", "message": "Identifying patterns..."}

event: chunk
data: {"content": "# Next.js\n\n> A React framework..."}

event: complete
data: {"cached": false, "tokens_used": 4500}
```

## Coordinate with

- **Anes**: he owns `main.py` and the DB session. Agree on:
  - Where to mount your router (add `app.include_router(context_router, prefix="/api/context")`)
  - When to apply your `context_cache` schema migration (add to his `schema.sql`)
- **Kristen**: she consumes your SSE endpoint. Give her a working endpoint by hour 8 — even with just one hardcoded repo working — so she can build her UI against it
- **Abiya**: no direct coordination needed

## If you finish early

- Add a "regenerate" endpoint that bypasses cache (for the demo: "watch it generate live")
- Build a "compare two repos" mode that generates a unified rebuild prompt covering both
- Add specific repo-type templates (CLI tool, web framework, library, app) so the rebuild prompt is more tailored