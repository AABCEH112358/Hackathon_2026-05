-- GitHub Atlas initial schema (Neon Postgres + pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS repos (
    id VARCHAR(512) PRIMARY KEY,
    github_id BIGINT NOT NULL UNIQUE,
    owner VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stars INTEGER NOT NULL DEFAULT 0,
    forks INTEGER NOT NULL DEFAULT 0,
    language VARCHAR(128),
    topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_commit_at TIMESTAMPTZ,
    embedding vector(384),
    tile_x INTEGER,
    tile_y INTEGER,
    height INTEGER NOT NULL DEFAULT 1,
    trending_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repos_stars ON repos (stars DESC);
CREATE INDEX IF NOT EXISTS idx_repos_trending ON repos (trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_repos_embedding ON repos USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS user_interactions (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    repo_id VARCHAR(512) NOT NULL REFERENCES repos (id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactions_user ON user_interactions (user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_repo ON user_interactions (repo_id);

CREATE TABLE IF NOT EXISTS star_history (
    repo_id VARCHAR(512) NOT NULL REFERENCES repos (id) ON DELETE CASCADE,
    date DATE NOT NULL,
    stars INTEGER NOT NULL,
    PRIMARY KEY (repo_id, date)
);

CREATE INDEX IF NOT EXISTS idx_star_history_repo_date ON star_history (repo_id, date DESC);

CREATE TABLE IF NOT EXISTS context_cache (
    id VARCHAR(512) PRIMARY KEY,
    repo_id VARCHAR(512) NOT NULL REFERENCES repos (id) ON DELETE CASCADE,
    content_md TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_version VARCHAR(128) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_context_cache_repo_generated ON context_cache (repo_id, generated_at DESC);
