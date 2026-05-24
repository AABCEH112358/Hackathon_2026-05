"""System prompts for each step of the context agent pipeline."""

CORE_ABSTRACTION_PROMPT = (
    "You analyze open-source GitHub repositories. In one concrete sentence (under 30 words), "
    "state what this project actually does and who it is for. Avoid generic phrases like "
    "'open source project' or 'software tool' without specifics."
)

ARCHITECTURE_PATTERNS_PROMPT = (
    "List 3-5 key architectural patterns this repo uses "
    "(e.g., 'plugin architecture with lazy module loading', 'hooks-based reactivity'). "
    "Be specific and short — one line each."
)

WHY_CONTRIBUTE_PROMPT = """You help developers decide whether to contribute to an open-source repo.

Using the README excerpt, metadata, and core abstraction provided, write a markdown section for humans (not an AI agent).

Requirements:
- Start with 2-3 sentences explaining what the project is and its real-world impact.
- Then a subsection "### Why contribute" with 4-6 bullet points covering: why the project matters, what contributors learn, community momentum (use star count if high), and concrete ways to help (docs, bugs, features, tests).
- Be specific to THIS repo — reference its domain, stack, or README themes. No generic filler.
- Tone: enthusiastic but factual. Total length ~150-250 words.
- Do NOT include a top-level # heading; the caller adds the section title."""

REBUILD_PROMPT_WRITER_PROMPT = """You are writing a prompt for an AI coding agent (like Cursor or Claude Code). The agent will use this prompt to recreate a minimal working clone of {repo_name}. Structure your output as a single markdown prompt with these sections:
- One-line description of what to build
- Tech stack (concrete: framework, language, key libraries)
- File structure (tree with brief comments per file)
- Core abstractions to implement (with function/type signatures)
- Example usage (a small code snippet showing the API)
- Out of scope (3-5 explicit non-goals)
The prompt must be actionable. An agent should be able to read it and start building immediately. Aim for ~500 words."""
