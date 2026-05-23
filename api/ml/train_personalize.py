"""Train the two-tower personalization model on synthetic user preferences."""

from __future__ import annotations

import asyncio
import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
from sqlalchemy import select

from db.models import Repo
from db.session import get_session_factory, init_db, test_connection
from ml.personalization_model import PersonalizationModel

CHECKPOINT_DIR = Path(__file__).resolve().parent / "checkpoints"
MODEL_PATH = CHECKPOINT_DIR / "personalize.pt"
USER_INDEX_PATH = CHECKPOINT_DIR / "user_index.json"

NUM_SYNTHETIC_USERS = 20
SAMPLES_PER_CLASS = 50
NUM_EPOCHS = 30
LEARNING_RATE = 1e-3
RNG_SEED = 42


@dataclass(frozen=True)
class RepoRecord:
    id: str
    language: str | None
    topics: list[str]
    embedding: np.ndarray


@dataclass(frozen=True)
class Triplet:
    user_idx: int
    pos_repo_idx: int
    neg_repo_idx: int


def _topics_as_strings(topics: Any) -> list[str]:
    if not topics:
        return []
    return [str(topic) for topic in topics]


async def load_repos_from_db() -> list[RepoRecord]:
    """Load repos with embeddings from the database."""
    if not await test_connection():
        raise RuntimeError("Database unreachable — check DATABASE_URL in .env")

    await init_db()
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(Repo.id, Repo.language, Repo.topics, Repo.embedding).where(
                Repo.embedding.is_not(None)
            )
        )
        rows = result.all()

    repos: list[RepoRecord] = []
    for repo_id, language, topics, embedding in rows:
        if embedding is None:
            continue
        repos.append(
            RepoRecord(
                id=repo_id,
                language=language,
                topics=_topics_as_strings(topics),
                embedding=np.asarray(embedding, dtype=np.float32),
            )
        )
    return repos


def build_user_index() -> dict[str, int]:
    return {f"synthetic_user_{i}": i for i in range(NUM_SYNTHETIC_USERS)}


def _assign_user_preferences(
    repos: list[RepoRecord],
    rng: random.Random,
) -> list[tuple[list[str], list[str]]]:
    languages = sorted({repo.language for repo in repos if repo.language})
    topics = sorted({topic for repo in repos for topic in repo.topics})
    if not languages:
        languages = ["Python"]
    if not topics:
        topics = ["machine-learning"]

    preferences: list[tuple[list[str], list[str]]] = []
    for _ in range(NUM_SYNTHETIC_USERS):
        pref_langs = rng.sample(languages, k=rng.randint(2, min(3, len(languages))))
        pref_topics = rng.sample(topics, k=rng.randint(2, min(3, len(topics))))
        preferences.append((pref_langs, pref_topics))
    return preferences


def _repo_matches(repo: RepoRecord, pref_langs: list[str], pref_topics: list[str]) -> bool:
    if repo.language and repo.language in pref_langs:
        return True
    return bool(set(repo.topics) & set(pref_topics))


def generate_triplets(
    repos: list[RepoRecord],
    user_index: dict[str, int],
    rng: random.Random,
) -> list[Triplet]:
    """Build BPR triplets from synthetic user language/topic preferences."""
    preferences = _assign_user_preferences(repos, rng)
    triplets: list[Triplet] = []

    for user_id, user_idx in user_index.items():
        pref_langs, pref_topics = preferences[user_idx]
        positive_indices = [
            idx for idx, repo in enumerate(repos) if _repo_matches(repo, pref_langs, pref_topics)
        ]
        negative_indices = [
            idx
            for idx, repo in enumerate(repos)
            if not _repo_matches(repo, pref_langs, pref_topics)
        ]

        if not positive_indices or not negative_indices:
            raise RuntimeError(
                f"Insufficient repos to build triplets for {user_id}. "
                "Seed more repos with varied languages/topics."
            )

        for _ in range(SAMPLES_PER_CLASS):
            pos_idx = rng.choice(positive_indices)
            neg_idx = rng.choice(negative_indices)
            triplets.append(Triplet(user_idx=user_idx, pos_repo_idx=pos_idx, neg_repo_idx=neg_idx))

    rng.shuffle(triplets)
    return triplets


def bpr_loss(score_pos: torch.Tensor, score_neg: torch.Tensor) -> torch.Tensor:
    return -torch.log(torch.sigmoid(score_pos - score_neg) + 1e-8).mean()


async def train() -> float:
    """Train personalization model and persist checkpoints. Returns final loss."""
    rng = random.Random(RNG_SEED)
    repos = await load_repos_from_db()
    if len(repos) < 2:
        raise RuntimeError("Need at least 2 repos with embeddings. Run repo seeding first.")

    user_index = build_user_index()
    triplets = generate_triplets(repos, user_index, rng)

    repo_embeddings = np.stack([repo.embedding for repo in repos], axis=0)
    user_idxs = torch.tensor([t.user_idx for t in triplets], dtype=torch.long)
    pos_idxs = torch.tensor([t.pos_repo_idx for t in triplets], dtype=torch.long)
    neg_idxs = torch.tensor([t.neg_repo_idx for t in triplets], dtype=torch.long)
    repo_tensor = torch.from_numpy(repo_embeddings)

    model = PersonalizationModel(num_users=len(user_index))
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)

    model.train()
    final_loss = 0.0
    for _epoch in range(NUM_EPOCHS):
        optimizer.zero_grad()
        pos_embs = repo_tensor[pos_idxs]
        neg_embs = repo_tensor[neg_idxs]
        score_pos = model.score(user_idxs, pos_embs)
        score_neg = model.score(user_idxs, neg_embs)
        loss = bpr_loss(score_pos, score_neg)
        loss.backward()
        optimizer.step()
        final_loss = loss.item()

    model.eval()
    sample_user_idx = 0
    sample_repo_indices = list(range(min(5, len(repos))))
    with torch.no_grad():
        sample_user = torch.tensor([sample_user_idx] * len(sample_repo_indices), dtype=torch.long)
        sample_embs = repo_tensor[sample_repo_indices]
        sample_scores = model.score(sample_user, sample_embs).tolist()

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), MODEL_PATH)
    with USER_INDEX_PATH.open("w", encoding="utf-8") as fh:
        json.dump(user_index, fh, indent=2)

    param_count = sum(p.numel() for p in model.parameters())
    print(f"Saved model ({param_count} parameters) to {MODEL_PATH}")
    print(f"Saved user index ({len(user_index)} users) to {USER_INDEX_PATH}")
    print(f"Final training loss: {final_loss:.4f}")
    print(f"Sample scores for synthetic_user_0:")
    for repo_idx, score in zip(sample_repo_indices, sample_scores, strict=True):
        print(f"  {repos[repo_idx].id}: {score:.4f}")
    return final_loss


def main() -> None:
    asyncio.run(train())


if __name__ == "__main__":
    main()
