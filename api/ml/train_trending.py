"""Train the trending detection MLP on synthetic repo metrics."""

from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.preprocessing import StandardScaler

from ml.trending_model import TrendingModel, raw_to_model_features

CHECKPOINT_DIR = Path(__file__).resolve().parent / "checkpoints"
MODEL_PATH = CHECKPOINT_DIR / "trending.pt"
SCALER_PATH = CHECKPOINT_DIR / "scaler.pkl"

NUM_SAMPLES = 5000
NUM_EPOCHS = 50
LEARNING_RATE = 1e-3
AGE_BINS = 10
TRENDING_PERCENTILE = 80


def generate_synthetic_dataset(n: int = NUM_SAMPLES) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generate raw metrics, model features, and binary trending labels."""
    rng = np.random.default_rng(42)

    current_stars = rng.uniform(np.log(10), np.log(500_000), size=n)
    current_stars = np.exp(current_stars)

    growth_7d = np.exp(rng.uniform(np.log(1), np.log(10_000), size=n))
    growth_30d = np.exp(rng.uniform(np.log(1), np.log(50_000), size=n))
    fork_ratio = rng.uniform(0.0, 0.5, size=n)
    commits_7d = np.exp(rng.uniform(np.log(1), np.log(500), size=n))
    issues_7d = np.exp(rng.uniform(np.log(1), np.log(200), size=n))
    age_days = np.exp(rng.uniform(np.log(1), np.log(3650), size=n))

    features = np.array(
        [
            raw_to_model_features(
                current_stars=float(current_stars[i]),
                growth_7d=float(growth_7d[i]),
                growth_30d=float(growth_30d[i]),
                fork_ratio=float(fork_ratio[i]),
                commits_7d=float(commits_7d[i]),
                issues_7d=float(issues_7d[i]),
                age_days=float(age_days[i]),
            )
            for i in range(n)
        ],
        dtype=np.float32,
    )

    growth_ratio = growth_7d / np.maximum(current_stars, 1.0)
    age_bin = np.digitize(age_days, bins=np.quantile(age_days, np.linspace(0, 1, AGE_BINS + 1)[1:-1]))

    labels = np.zeros(n, dtype=np.float32)
    for bin_id in np.unique(age_bin):
        mask = age_bin == bin_id
        threshold = np.percentile(growth_ratio[mask], TRENDING_PERCENTILE)
        labels[mask] = (growth_ratio[mask] > threshold).astype(np.float32)

    raw = np.column_stack(
        [current_stars, growth_7d, growth_30d, fork_ratio, commits_7d, issues_7d, age_days]
    )
    return raw.astype(np.float32), features, labels


def train() -> float:
    """Fit scaler + MLP and persist checkpoints. Returns final training accuracy."""
    _, features, labels = generate_synthetic_dataset()

    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(features).astype(np.float32)
    y = labels.reshape(-1, 1)

    x_tensor = torch.from_numpy(x_scaled)
    y_tensor = torch.from_numpy(y)

    model = TrendingModel()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    criterion = nn.BCELoss()

    model.train()
    for _epoch in range(NUM_EPOCHS):
        optimizer.zero_grad()
        preds = model(x_tensor)
        loss = criterion(preds, y_tensor)
        loss.backward()
        optimizer.step()

    model.eval()
    with torch.no_grad():
        preds = model(x_tensor)
        accuracy = ((preds >= 0.5).float() == y_tensor).float().mean().item()

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), MODEL_PATH)
    with SCALER_PATH.open("wb") as fh:
        pickle.dump(scaler, fh)

    param_count = sum(p.numel() for p in model.parameters())
    print(f"Saved model ({param_count} parameters) to {MODEL_PATH}")
    print(f"Saved scaler to {SCALER_PATH}")
    print(f"Final training accuracy: {accuracy:.4f}")
    return accuracy


if __name__ == "__main__":
    train()
