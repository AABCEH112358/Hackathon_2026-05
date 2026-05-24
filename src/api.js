const rawBaseUrl =
  (import.meta.env.VITE_API_URL || "").trim() ||
  "https://hackathon2026-05-production.up.railway.app";

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

console.log("VITE API URL:", import.meta.env.VITE_API_URL);
console.log("Using API base URL:", API_BASE_URL);

async function apiFetch(path, options = {}, timeoutMs = 15000) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${cleanPath}`;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error(`API fetch failed for ${url}:`, error);
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function encodeRepoFullName(fullName) {
  return String(fullName || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

export function normalizeRepoList(payload) {
  if (Array.isArray(payload)) return payload;

  return (
    payload?.repos ||
    payload?.items ||
    payload?.data ||
    payload?.results ||
    []
  );
}

export function getRepoFullName(repo) {
  if (!repo) return null;

  return (
    repo.full_name ||
    repo.fullName ||
    repo.repo_full_name ||
    repo.repoFullName ||
    repo.name_with_owner ||
    repo.nameWithOwner ||
    (repo.owner && repo.name ? `${repo.owner}/${repo.name}` : null)
  );
}

export function getRepoId(repo) {
  if (!repo) return null;

  return (
    repo.repo_id ||
    repo.repoId ||
    repo.id ||
    getRepoFullName(repo)
  );
}

export function normalizeScoreMap(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : payload?.scores ||
      payload?.repos ||
      payload?.items ||
      payload?.data ||
      payload?.results ||
      [];

  const map = {};

  for (const row of rows) {
    const key =
      row.repo_id ||
      row.repoId ||
      row.id ||
      row.full_name ||
      row.fullName ||
      row.repo_full_name ||
      row.repoFullName;

    const value =
      row.trending_score ??
      row.trendingScore ??
      row.score ??
      row.personalization_score ??
      row.personalizationScore;

    if (key !== undefined && key !== null && value !== undefined && value !== null) {
      map[key] = Number(value);
    }
  }

  return map;
}

export const api = {
  getLayout() {
    return apiFetch("/api/repos/layout", {}, 15000);
  },

  getTrendingScores() {
    return apiFetch("/api/trending/scores", {}, 15000);
  },

  getPersonalizedScores(userId) {
    return apiFetch(
      "/api/personalize/score",
      {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
        }),
      },
      15000
    );
  },

  logInteraction({ userId, repoId, action, durationMs = 0 }) {
    return apiFetch(
      "/api/interactions",
      {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          repo_id: repoId,
          action,
          duration_ms: durationMs,
        }),
      },
      8000
    );
  },

  getRepoDetails(fullName) {
    const encoded = encodeRepoFullName(fullName);
    return apiFetch(`/api/repos/${encoded}`, {}, 15000);
  },

  /**
   * Stream context.md generation via SSE.
   * Returns the EventSource — call .close() to cancel.
   */
  streamRepoContext(repoId, { onProgress, onChunk, onComplete, onError, regenerate = false } = {}) {
    const params = new URLSearchParams({ repo_id: repoId });
    if (regenerate) {
      params.set("regenerate", "true");
    }

    const url = `${API_BASE_URL}/api/context/generate?${params.toString()}`;
    const source = new EventSource(url);
    let finished = false;

    const fail = (message) => {
      if (finished) return;
      finished = true;
      source.close();
      onError?.(new Error(message));
    };

    source.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress?.(data.message || "Working...");
      } catch (error) {
        console.warn("Invalid progress SSE payload", error);
      }
    });

    source.addEventListener("chunk", (event) => {
      try {
        const data = JSON.parse(event.data);
        onChunk?.(data.content || "");
      } catch (error) {
        console.warn("Invalid chunk SSE payload", error);
      }
    });

    source.addEventListener("complete", (event) => {
      if (finished) return;
      finished = true;
      try {
        const data = JSON.parse(event.data);
        onComplete?.(data);
      } catch {
        onComplete?.({});
      } finally {
        source.close();
      }
    });

    source.addEventListener("error", (event) => {
      let message = "Context generation failed";
      try {
        if (event.data) {
          const data = JSON.parse(event.data);
          message = data.message || message;
        }
      } catch {
        // use default message
      }
      fail(message);
    });

    source.onerror = () => {
      if (finished || source.readyState === EventSource.CLOSED) {
        return;
      }
      fail("Lost connection to context generator");
    };

    return source;
  },
};