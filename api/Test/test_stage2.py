import asyncio
from services.context_agent.repo_reader import fetch_repo_data
from services.context_agent.analyzer import identify_core_abstraction, extract_architecture_patterns
from services.context_agent.prompt_writer import generate_rebuild_prompt


async def test():
    # STEP 1 — fetch repo data (same as stage 1)
    print("=" * 50)
    print("STEP 1: Fetching repo from GitHub...")
    print("=" * 50)
    data = await fetch_repo_data("tiangolo", "fastapi")
    print(f"✅ Repo fetched: {data['metadata']['name']} ({data['metadata']['stars']} stars)")
    print(f"   Source files: {[f['path'] for f in data['source_files']]}")

    # STEP 2 — identify core abstraction (OpenAI call #1 — gpt-4o-mini)
    print()
    print("=" * 50)
    print("STEP 2: Identifying core abstraction...")
    print("=" * 50)
    abstraction, _ = await identify_core_abstraction(data)
    print(f"✅ Abstraction:\n   {abstraction}")\

    # STEP 3 — extract architectural patterns (OpenAI call #2 — gpt-4o-mini)
    print()
    print("=" * 50)
    print("STEP 3: Extracting architectural patterns...")
    print("=" * 50)
    patterns, _ = await extract_architecture_patterns(data)
    print(f"✅ Patterns ({len(patterns)} found):")
    for i, p in enumerate(patterns, 1):
        print(f"   {i}. {p}")

    # STEP 4 — generate rebuild prompt (OpenAI call #3 — gpt-4o)
    print()
    print("=" * 50)
    print("STEP 4: Generating rebuild prompt (gpt-4o — slower)...")
    print("=" * 50)
    rebuild, tokens = await generate_rebuild_prompt(data, abstraction, patterns)
    print(f"✅ Rebuild prompt ({len(rebuild)} chars, {tokens} tokens):")
    print("-" * 40)
    print(rebuild[:600] + "..." if len(rebuild) > 600 else rebuild)

    print()
    print("=" * 50)
    print("✅ ALL STEPS PASSED")
    print("=" * 50)


asyncio.run(test())
