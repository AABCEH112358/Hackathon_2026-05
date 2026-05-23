"""PyTorch two-tower model for user-repo affinity."""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class UserTower(nn.Module):
    """Map a user index to a 16-dim latent vector."""

    def __init__(self, num_users: int) -> None:
        super().__init__()
        self.embedding = nn.Embedding(num_users, 32)
        self.fc = nn.Linear(32, 16)

    def forward(self, user_idx: torch.Tensor) -> torch.Tensor:
        """Embed user indices of shape (batch,) -> (batch, 16)."""
        x = F.relu(self.embedding(user_idx))
        return self.fc(x)


class RepoTower(nn.Module):
    """Project a 384-dim repo embedding to a 16-dim latent vector."""

    EMBED_DIM = 384

    def __init__(self, embed_dim: int = EMBED_DIM) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(embed_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
        )

    def forward(self, repo_emb: torch.Tensor) -> torch.Tensor:
        """Project repo embeddings of shape (batch, 384) -> (batch, 16)."""
        return self.net(repo_emb)


class PersonalizationModel(nn.Module):
    """Two-tower model scoring user-repo affinity in [-1, 1]."""

    def __init__(self, num_users: int, embed_dim: int = RepoTower.EMBED_DIM) -> None:
        super().__init__()
        self.user_tower = UserTower(num_users)
        self.repo_tower = RepoTower(embed_dim)

    def score(self, user_idx: torch.Tensor, repo_emb: torch.Tensor) -> torch.Tensor:
        """Cosine similarity between towers, squashed to [-1, 1]. Returns (batch,)."""
        user_vec = self.user_tower(user_idx)
        repo_vec = self.repo_tower(repo_emb)
        user_norm = F.normalize(user_vec, dim=-1)
        repo_norm = F.normalize(repo_vec, dim=-1)
        cosine = (user_norm * repo_norm).sum(dim=-1)
        return torch.tanh(cosine)
