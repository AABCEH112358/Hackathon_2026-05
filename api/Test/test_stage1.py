import asyncio
from services.context_agent.repo_reader import fetch_repo_data


async def test():
    data = await fetch_repo_data("obra", "superpowers")
    print("metadata:", data["metadata"])
    print("readme length:", len(data["readme"]))
    print("dep file:", data["dependency_file"]["name"] if data["dependency_file"] else None)
    print("source files:", [f["path"] for f in data["source_files"]])


asyncio.run(test())


