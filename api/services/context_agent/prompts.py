"""System prompts for each step of the context agent pipeline."""

CORE_ABSTRACTION_PROMPT = "You analyze software repos. In one sentence under 25 words, what is the core abstraction or primary value this repo provides? Be concrete, not generic."

ARCHITECTURE_PATTERNS_PROMPT = "List 3-5 key architectural patterns this repo uses (e.g., 'plugin architecture with lazy module loading', 'hooks-based reactivity', 'middleware pipeline pattern'). Be specific and short — one line each."

REBUILD_PROMPT_WRITER_PROMPT = """You are writing a prompt for an AI coding agent (like Cursor or Claude Code). The agent will use this prompt to recreate a minimal working clone of {repo_name}. Structure your output as a single markdown prompt with these sections:
- One-line description of what to build
- Tech stack (concrete: framework, language, key libraries)
- File structure (tree with brief comments per file)
- Core abstractions to implement (with function/type signatures)
- Example usage (a small code snippet showing the API)
- Out of scope (3-5 explicit non-goals)
The prompt must be actionable. An agent should be able to read it and start building immediately. Aim for ~500 words."""
