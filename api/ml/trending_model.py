"""PyTorch MLP for repo trending probability."""

from __future__ import annotations

import math

import torch
import torch.nn as nn


class TrendingModel(nn.Module):
    """Small MLP: 7 input features -> trending probability in [0, 1]."""

    INPUT_DIM = 7

    def __init__(self) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(self.INPUT_DIM, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Run inference on a batch of shape (batch, 7). Returns (batch, 1)."""
        return self.net(x)


def raw_to_model_features(
    *,
    current_stars: float,
    growth_7d: float,
    growth_30d: float,
    fork_ratio: float,
    commits_7d: float,
    issues_7d: float,
    age_days: float,
) -> list[float]:
    """Convert raw repo metrics into the 7 model input features (log where indicated)."""
    return [
        math.log(max(current_stars, 1.0)),
        math.log(max(growth_7d, 1.0)),
        math.log(max(growth_30d, 1.0)),
        fork_ratio,
        math.log(max(commits_7d, 1.0)),
        math.log(max(issues_7d, 1.0)),
        math.log(max(age_days, 1.0)),
    ]
