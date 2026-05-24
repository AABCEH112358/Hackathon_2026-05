# Cursor Calgary Hackathon — Strategic Playbook

*Living document. Updates as we go through chat deep-dives.*

---

## TL;DR — How you win this thing

A team of 4 (3 strangers + 1 known), same fixed prompt as ~50 other teams, 24 hours, judged on 4 criteria. You don't win by having the best idea — the idea is given to you. You win by:

1. **Picking a sharp interpretation of the prompt early** and refusing to drift from it.
2. **Executing cleanly** — a working demo beats an ambitious half-built thing every single time.
3. **Visibly using Cursor's advanced features** (agents, MCP, model switching) — this is a Cursor-community event and "Use of Cursor" is an explicit criterion.
4. **Demoing like you mean it** — the final 3 hours go to polish and demo prep, not features.

Your single biggest risk as a first-time hackathoner with a stranger team: over-scoping in hour 2 and being unable to ship by hour 22. The playbook below is engineered to prevent that.

---

## 1. The Event — what we're working with

| | |
|---|---|
| **Venue** | SAIT, Aldred Centre, CA121 – East Aldred Hall, Calgary |
| **Kickoff** | Per official schedule on the hackathon portal |
| **Format** | 24-hour build window → submission cutoff → screening → finalist demos → judging |
| **Team size** | 4 (max allowed — you're at max, good) |
| **Prompt** | Single fixed prompt, same for every team |
| **Tooling** | Cursor with credits provided by event |
| **Prize pool** | $1,000 USD in Cursor credits across top 3 teams |
| **Attendees** | ~225 registered, likely 40-55 teams competing |

**Critical constraints:**
- First team meeting is at the kickoff. No pre-alignment possible.
- You know 1 of 3 teammates (backend-leaning: Python, SQL, C/C++). 2 are unknowns.
- Only you confirmed on Cursor Pro. Event credits cover the others during the event.

---

## 2. The Actual Judging Rubric (7 weighted criteria, 100% total)

| Criterion | Weight | What it means | How to win it |
|---|---|---|---|
| **Innovation & Originality** | **25%** | How novel and surprising the concept is | Be different from the field. Claude does pool comparison — copycats lose hard here. |
| **Technical Execution** | **20%** | Cleverness of the engineering | Multi-system architecture, real ML, agentic flows. Make the code itself impressive. |
| **Functional Completeness** | **20%** | Does the core loop actually work? | Demo path must work end-to-end. No "imagine if..." moments. |
| **Problem-Solution Fit** | **20%** | Solving a real problem convincingly | Specific pain, specific user, vivid framing. Judges must feel "yes, that's a real thing." |
| **UX & Design** | 5% | Visual polish and usability | Screenshots are scored by Claude — invest in 5 great ones. |
| **Demo & Communication** | 5% | How clearly the project is presented | Matters most in human round (top 8). README clarity matters in AI round. |
| **Learning & Ambition** | 5% | Did the team stretch themselves? | Real NN training counts here. Real new tech counts here. |

**Critical strategic implications:**

- **85% of points go to the first 4 criteria** — Innovation, Tech, Functional, Problem-Solution. Optimize there first.
- **Innovation is the single highest weight (25%).** This is the criterion to prioritize at the concept level.
- **Functional Completeness (20%) is the silent killer.** Beautiful but broken = zero. Demo path must work.
- **"Use of Cursor" is NOT a criterion.** Earlier playbook over-weighted this — ignore that section's framing.

## 2b. The AI Screening Round — what Claude actually scores

The first cut is done by Claude, running 6 passes per project in ~3 minutes:

1. **Repo structure** — folder organization, naming, modularity
2. **Code quality** — readability, idioms, no obvious smells
3. **Innovation** — novelty assessed against the rest of the submission pool
4. **Visual UX** — read from your uploaded screenshots (max 5)
5. **Pool comparison** — explicit comparison against other teams' projects
6. **Final synthesis** — overall score

What this means in practice:

- **Make the repo PUBLIC before submission.** Mentioned in tips. Easy to forget.
- **Screenshots are judged directly.** Take 5 great ones at hour 18-19. Avoid: cluttered debug UI, half-loaded states, default placeholders. Include: hero shot, key feature in action, NN visualization, mobile/responsive if applicable.
- **The README is read by Claude** for the innovation and synthesis passes. Make it explicit about what's novel. Don't make Claude guess.
- **Code quality matters more than at a typical hackathon.** Claude reads the code. Use type hints, sensible structure, real names. Skip the `temp2.py` files.
- **Pool comparison favors weird.** If 30 teams build inbox-summarizers and you built a city map of GitHub, that's a structural advantage. Lean into the strangeness in the README.

---

## 3. Pre-Kickoff Prep — what YOU do tonight

You can't pre-align the team (first meeting is at kickoff). But you CAN walk in with prep that makes you the de-facto coordinator without claiming the title.

### Your machine setup (do tonight, takes ~1 hour)

- Cursor updated to latest version
- Agent mode + background agents enabled in settings
- At least one MCP server connected and tested (filesystem MCP is the easiest demo win)
- Node.js LTS + Python 3.11+ installed and working
- GitHub account ready, 2–3 empty starter repos staged with different stacks (you don't push them; they're ready to clone if needed)
- A bookmarked deploy target (Vercel for web, Railway/Render for backends — both have free tiers + GitHub integration)
- Your `.cursorrules` patterns ready to drop in (we'll customize at kickoff once we know the prompt)

### Starter stacks to have in mind (decide AT kickoff based on prompt)

| Use case | Stack | Why |
|---|---|---|
| Web app with AI features (most likely) | Next.js 14+ App Router, Tailwind, shadcn/ui, Vercel AI SDK, Postgres on Neon | Fastest from zero to deployed, AI SDK is purpose-built |
| Data/backend-heavy with simple UI | FastAPI + SQLite + minimal React frontend | Plays to your known teammate's strengths (Python/SQL) |
| Agent / automation tool | Python + LangGraph or simple loop, with a thin Next.js dashboard | If the prompt is agent-themed |
| Quick MVP / prototype | Vite + React + Tailwind, no backend | When the demo doesn't need persistence |

### Bring to the event

- Laptop fully charged + charger + power strip / extension cord (outlets will be scarce)
- Headphones (24h with 3 strangers in a noisy room — focus protection matters)
- Snacks, water, caffeine of choice
- Sleep gear if you're crashing on-site (small blanket, eye mask)
- A printed or saved copy of section 4 below (the kickoff playbook)

### Pre-kickoff mental prep

- You're playing to win but it's also your first hackathon. The realistic ceiling is top 5 / top 10 on a stranger team. Anything more is a bonus.
- Your edge: you came prepared. Most teams will burn 2 hours on stack debates and group chat setup. You won't.
- Bring energy, not pressure. The team will follow the most prepared person — that's you.

---

## 4. Kickoff Hour Playbook — the first 60 minutes after the prompt drops

This is the highest-leverage hour of the weekend. Use it well.

### Min 0–10: Meet the team

Quick intros — 1 minute each:
- Name + what they do
- One project they're proud of
- Cursor experience level (be honest)
- What they want out of this hackathon

You're listening for: actual skill level (vs claimed), real Cursor familiarity, willingness to take direction or push back productively.

**Red flags to note silently:**
- Someone hasn't used Cursor before → they go on simpler tasks
- Someone wants to be the "ideas person" only → push them into the demo/glue role
- Someone is dismissive of others → assign them clearly bounded work, no shared surfaces

### Min 10–25: Interpret the prompt — together

The single most leveraged 15 minutes of the weekend. Write the answers down in a shared doc:

1. **What is the core problem in the prompt?** (1 sentence, no jargon)
2. **Who specifically is the user?** Not "developers" — "a junior PM trying to clear 30 Jira tickets a day." Get specific.
3. **What's the smallest version that demos well?** Cut hard. Then cut again.
4. **What's our wedge?** One sentence on the angle that makes ours different from the other 40 teams building against the same prompt. Examples: opinionated UX, weird input modality, novel agent architecture, surprisingly fast, embarrassingly simple.
5. **What's the 30-second demo story?** The narrative arc you'll show judges. "User has problem X → does Y → product does Z → outcome."

Don't move on until all 5 are answered and the team has actually nodded. If anyone is checked out at this stage, address it now, not at hour 8.

### Min 25–35: Stack and repo

- Default to whatever your strongest builder is fastest in. Speed of execution > theoretical fit.
- One person creates the GitHub repo, invites everyone, sets up basic README and `.cursorrules`.
- Set up a Vercel/Railway project pre-wired to the repo if there's any deploy involved. Don't leave deploy for hour 23.

### Min 35–50: Role assignment

Canonical 4-person split for a Cursor hackathon:

| Role | Owns | Best fit |
|---|---|---|
| **Frontend / UX** | Pages, components, styling, demo-facing layer | Strongest React/UI person |
| **Backend / API / data** | Routes, database, integrations, auth if needed | Your known teammate likely fits here (Python/SQL) |
| **AI / agents / core logic** | The "smart" part — LLM calls, agent loops, MCP integrations | Whoever's most comfortable with AI APIs |
| **Glue / demo / polish** | End-to-end wire-up, deploys, owns the demo narrative and dry runs | Whoever's least specialized — often the most strategically valuable role |

Match people to roles based on what you saw in the intro round, not what they claim. The Glue/Demo role is the most under-appreciated and the most critical for hackathon wins — guard it.

**If you can't immediately tell where someone fits:** put them on Glue/Demo. It's the role that benefits most from a versatile generalist.

### Min 50–60: Communication and sync protocol

- Discord voice channel always open in background (or in-person if everyone is at the venue)
- 1-minute standup every 4 hours per person — what shipped, what's blocked, what's next
- Anyone blocked > 20 minutes shouts in chat immediately
- One shared `STATUS.md` in the repo, updated by each person at each standup
- Demo run-through at hour 21 and hour 23 — non-negotiable

### Team dynamics — what to watch for

Three of four teammates are strangers. Risks to manage:

- **Teammate is way less skilled than they claimed.** Reassign tasks early without making a thing of it. Move them to support work — testing, docs, demo dry-runs, polish.
- **Teammate tries to take over and pushes a bad direction.** Don't fight on the floor. Use the 5-question framework (section 4) as a neutral arbiter. "Cool — how does that fit our 30-second demo story?"
- **Teammate is checked out / not pulling weight.** Don't escalate. Just route work around them and brief the rest of the team quietly. Their absence becomes your team's silent advantage.
- **You're being overruled on something important.** Pick your battles. Lose small ones. Win the demo and scope battles.

---

## 5. Build Phase Strategy — hours 1 through 21

### Scope discipline (the thing that loses you the hackathon if ignored)

At hour 6, ask: "If we shipped what we have RIGHT NOW, would it demo?" If no, cut something. Repeat at hour 12. Repeat at hour 18.

**The 60/30/10 time rule:**
- 60% of remaining time on core feature
- 30% on polish (UX, error states, copy, visual design)
- 10% on demo prep (script, dry runs, fallbacks)

Most teams do 95/5/0 and lose to teams that did 60/30/10. This is the single most counterintuitive lesson of competitive hackathons.

### Model selection — principles, not religion

Cursor lets you pick the model per chat / per agent. Use the right tool for the task — but don't agonize. Pick a default and switch only when you hit something hard.

| Task type | Model class | Why |
|---|---|---|
| Architecture decisions, gnarly bugs, complex refactors | Biggest thinking model (Claude Opus, o-series reasoning models) | Reasoning > speed when stuck |
| Day-to-day coding, edits, new components, most agent work | Fast frontier (Claude Sonnet) | The workhorse — best speed/quality tradeoff |
| Repetitive tasks, simple completions, tab-autocomplete | Fast/small (Haiku, GPT-mini class) | Don't burn credits on trivial completions |
| Long-context: read entire codebase, summarize large docs | Long-context models (Gemini Pro) | Context window > raw smarts for this task |
| Background agents (parallel work) | Sonnet typically | Reliability and speed both matter |

**Default rule:** Sonnet for everything. Switch up to Opus/o-series when stuck on something hard. Switch down to fast models only for clearly trivial things.

We'll deep-dive on this in chat once the prompt drops — exact model picks depend on what subsystems you're building.

### "Use of Cursor" plays — earn criterion #4

Visible, Cursor-native moves that score this criterion:

- **Run parallel background agents** on independent tasks during the demo. Show it.
- **Use MCP for at least one integration** — filesystem, GitHub, a database, a real third-party API. Mention it in the demo.
- **Custom `.cursorrules`** tailored to your stack and prompt interpretation. Show the judges if asked.
- **Multi-model strategy you can articulate.** "We used Opus for the agent planner, Sonnet for code generation, Haiku for tab-complete." Say this in the demo.
- **One genuinely AI-native feature in the product itself.** Not just dev-time — a feature that exists because of AI.

### Sync cadence

- **Every 4 hours:** 1-minute standup per person
- **Hour 12 — mid-point checkpoint:** is the demo path working end-to-end, even ugly?
- **Hour 18 — feature freeze:** only bug fixes and polish from here. No new features. Enforce this hard.
- **Hour 21:** full demo run-through #1
- **Hour 23:** demo run-through #2 + buffer for crashes
- **Hour 24:** submit

---

## 6. Demo Prep — the final 3-4 hours

This is where teams that built more lose to teams that demoed better. Hackathons are won in the demo room as often as in the build hours.

### The 3-minute demo structure

| Time | What happens |
|---|---|
| **0:00–0:20** | **Hook.** State the problem from the prompt in one sentence. State your wedge in one sentence. |
| **0:20–2:00** | **Live demo of the happy path.** Don't show settings pages. Don't show edge cases. Show the magic moment. |
| **2:00–2:40** | **How you built it.** Mention Cursor specifics: model choices, parallel agents, MCP integrations. This explicitly earns criterion #4. |
| **2:40–3:00** | **Close.** What's next, what you learned, thank judges. |

### Demo rules — non-negotiable

- One person presents. Everyone else is on stage but quiet unless asked.
- Demo on local or a stable deploy — never depend on flaky third-party APIs you can't mock or cache.
- Pre-load all data, pre-open all tabs, pre-warm any caches.
- Practice the full demo twice. Time it. Cut if over 3 minutes.
- Prepare a 30-second fallback in case something breaks live.

### Slide deck (optional but high-leverage)

3–4 slides max:
1. Problem (the prompt, your interpretation)
2. Demo (just a title — live demo happens here)
3. How (stack, Cursor moves, model strategy)
4. What's next

Don't use AI-generated slop. Two clean slides beat ten busy ones.

---

## 7. Stretch Goal — "Self-Improving" Feature

You mentioned wanting to integrate a neural network that learns from usage if time permits. Honest expert take before strategy: this is genuinely differentiating but it's a trap if approached as "train a real NN in 24 hours." Most teams who try the academically pure version lose execution polish chasing something that doesn't demo. Here's how to do it without sinking the win.

### What "self-improving" can realistically mean in a 24h hackathon

A spectrum, easiest to hardest:

| Approach | What it is | Real ML? | Setup time | Demo strength | Risk |
|---|---|---|---|---|---|
| **A. Growing RAG / vector store** | Every user interaction → embedded → added to vector DB. Future queries retrieve more relevant context as usage grows. | Uses embeddings, no training | 1–2h | Strong — easy to show "look how much better it got" | Low |
| **B. In-context few-shot accumulation** | Successful interactions stored. Future prompts include top-N relevant past interactions as few-shots. Model "learns" via context. | None, but feels like learning | 30–60 min | Strong | Very low |
| **C. Lightweight classifier that retrains** | Small scikit-learn or tiny PyTorch model retrains every N interactions on user-action data. Predicts / recommends. | Yes, real | 2–4h | Strongest — actual numbers improving in real-time on stage | Medium |
| **D. Preference / reward learning** | Thumbs up/down → updates a small reward model → biases future generations. Real DPO-lite. | Yes | 4–6h | Strong if it works | High |
| **E. Fine-tuning a real NN online** | Real training, real epochs, real data, real GPU. | Yes | 6h+ | Strong in theory | Very high — almost never finishes in time |

### My recommendation

**Default stretch goal: combine A + B.** They're cheap, they ship reliably, they look like learning to a judge in a 30-second demo segment, and together they're more than the sum of their parts. This is the path I'd push.

**If you're way ahead at hour 14 with a working core demo: add C.** A small classifier that genuinely retrains on user interactions earns you a real "we trained a model on usage data" line in the demo. Keep it tiny — a model with a few thousand parameters trained on ~50 synthetic interactions is plenty. The demo isn't about benchmark numbers, it's about showing a metric moving on stage.

**Don't do D or E.** They're hackathon graveyards. Risk-adjusted value is negative in a 24-hour build with a stranger team. The only exception is if the prompt is *specifically* about ML training, in which case rethink.

### How to architect for it from hour 1 — even before deciding to pursue it

Even if you don't end up adding the self-improving feature, design the system from the start so it COULD have one. This costs almost nothing if planned in early:

- **Log every user interaction** (input, output, optional feedback, timestamp) to your database from the first deploy. Free option value.
- **Wrap every LLM call behind a thin abstraction** — `getResponse(query, context)` not direct API calls sprinkled everywhere. Lets you swap in retrieval, few-shot accumulation, or fine-tuned models later without surgery.
- **Include a feedback UI hook** — even just thumbs up / thumbs down on every output. Costs 10 minutes; opens the door to options C and D if you have time.
- **Pick a vector-store-ready database** — Postgres with pgvector (free, simple, no extra service) or Chroma (Python, embedded). Avoid Pinecone / Weaviate for a hackathon — the setup tax isn't worth it.

If you do all four of these in hour 1–2, you can choose to add A/B/C at hour 14 for an additional 2–5 hours of work. If you skip these in hour 1, retrofitting at hour 14 is 6+ hours and will sink the demo.

### The demo framing — how to talk about it

Don't say "we trained a neural network." That invites technical scrutiny you don't have time to defend against in a 3-minute demo. Say one of these, depending on what you actually built:

- "The product gets smarter the more you use it — every interaction adds to its memory."
- "Watch the recommendations change as I give it feedback."
- "Fresh account on the left, my account after 20 interactions on the right — see the difference."

The line that lands with judges: **a visible delta in product behavior** between "first use" and "after some use." Whether the underlying mechanism is RAG, few-shot, or a real classifier matters less than whether the delta is convincing on stage.

### When to abandon it

Hour 18 is feature freeze. If by hour 16 you don't have at least the "growing context" version (A or B) working end-to-end, **abandon the self-improving angle entirely** and put the time into demo polish. A polished simple product beats an unpolished impressive one every single time, and the judging criteria back this up — 3 of 4 criteria reward execution and product quality, not technical ambition.

---

## 8. Open Questions / Decisions Pending

Things we'll nail down in chat deep-dives, in rough priority order:

1. **The actual prompt** — drops Sunday morning. Everything in sections 4–6 specializes to it.
2. **Final stack decision** — depends on prompt + on-the-ground team skills assessment.
3. **Cursor prompts library** — per-role prompts (frontend, backend, AI/agent, glue) tailored to your stack and the actual prompt.
4. **MCP server selection** — which integrations earn the most "Use of Cursor" points without eating build time.
5. **The "judging via Claude" question** — you said you'd verify with organizers. If true, we add specific moves for AI judges (clearer naming, structured READMEs, explicit criteria mapping in submission).
6. **Demo deck template** — once we know the prompt and the product.
7. **Final scope decision** — at the kickoff, with the team, using the 5-question framework.

---

## 9. THE PROJECT: Repo Pilot

**The pitch in one line:** A SimCity-style isometric map of GitHub where buildings are repos, districts are programming domains, two neural networks make the city predictive and personal, and an AI agent generates "rebuild prompts" from any repo.

**The four pieces:**
1. **Discovery map** (Phaser 3 isometric) — fly to any district, see buildings sized by stars, glowing if trending
2. **Trending NN** — predicts which repos will rise in stars next 7 days, visualized as glowing/pulsing buildings
3. **Personalization NN** — learns from user clicks/dwell, reshapes the city to surface what they care about
4. **Context.md agent** — click any building → multi-step LLM agent generates a rebuild-prompt for that repo

**Stack:**
- Frontend: Next.js 14 + TypeScript + Tailwind + shadcn + **Phaser 3** for the isometric map
- Backend: FastAPI (Python) + Neon Postgres + pgvector
- ML: PyTorch (trending MLP + personalization two-tower) + sklearn (utilities)
- Agent: Anthropic API in multi-step loop
- Deploy: Vercel (frontend) + Railway (backend)

**Roles:**
- **Map / Phaser** — most demo-visible role
- **Backend / Data** — your known teammate (Python/SQL)
- **AI / ML** — whoever among unknowns has ML chops
- **Glue / Demo / Polish** — the other unknown
- **You** — Map OR AI/ML based on what unknowns can do

**Critical risks for this project specifically:**
- **GitHub API rate limits** — cache aggressively, every teammate uses their own token
- **Phaser learning curve** — if Map role hasn't used it, expect 2-3h of ramp time; lean on Cursor for the basics
- **Demo path completeness** — Functional Completeness is 20% of score. The demo path (load city → fly to district → click building → generate context.md) MUST work end-to-end by hour 14. Cut everything else if needed.

**The innovation pitch — practice these lines for the README and demo:**
- "Most repo discovery tools are lists. We made GitHub a city you can walk through."
- "Two neural networks — one predicts which repos will trend, one learns what each visitor cares about. The city changes for every person."
- "Click any building and an AI agent doesn't just describe the repo — it gives you a prompt that recreates it."

---

| Moment | Move |
|---|---|
| **Tonight** | Machine setup, repos staged, this doc skimmed |
| **Kickoff hour 0** | Intros, 5-question framework, stack + roles + sync protocol |
| **Hour 6** | "Would this demo right now?" check |
| **Hour 12** | Mid-point: demo path end-to-end working, even ugly |
| **Hour 14** | Stretch goal go/no-go: add "self-improving" layer only if core demo path is solid |
| **Hour 18** | Feature freeze. Polish + demo prep only from here. |
| **Hour 21** | Demo dry run #1 |
| **Hour 23** | Demo dry run #2 + buffer |
| **Hour 24** | Submit |
| **Demo time** | 3 minutes. Hook, happy path, how, close. |

---

*Ping me the moment the prompt drops tomorrow. That's when we go from prep to execution mode.*
