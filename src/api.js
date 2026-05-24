const RepoApi = (() => {
  const API_BASE_URL = "http://localhost:8000";
  const LAYOUT_ENDPOINT = `${API_BASE_URL}/api/repos/layout`;

  async function fetchRepoLayout() {
    const response = await fetch(LAYOUT_ENDPOINT);

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    const payload = await response.json();
    return normalizeRepoPayload(payload);
  }

  function normalizeRepoPayload(payload) {
    const rawRepos = Array.isArray(payload)
      ? payload
      : payload.repos || payload.items || payload.data || [];

    return rawRepos
      .map((repo, index) => {
        const tileX = Number(repo.tile_x ?? repo.tileX ?? repo.x ?? 0);
        const tileY = Number(repo.tile_y ?? repo.tileY ?? repo.y ?? 0);

        return {
          id: repo.id ?? repo.repo_id ?? index,
          name: repo.name || getNameFromFullName(repo.full_name) || `Repo ${index + 1}`,
          fullName: repo.full_name || repo.fullName || repo.name || `Repo ${index + 1}`,
          owner:
            repo.owner ||
            repo.owner_login ||
            getOwnerFromFullName(repo.full_name) ||
            "Unknown owner",
          language: repo.language || "Unknown",
          tileX: clamp(tileX, 0, 63),
          tileY: clamp(tileY, 0, 63),
          height: clamp(Number(repo.height ?? 1), 1, 6),
          stars: Number(repo.stars ?? repo.stargazers_count ?? 0),
          forks: Number(repo.forks ?? repo.forks_count ?? 0),
          trendingScore: Number(repo.trending_score ?? repo.trendingScore ?? 0),
          description: repo.description || "No description provided.",
          url: repo.html_url || repo.url || "",
          raw: repo,
        };
      })
      .filter((repo) => Number.isFinite(repo.tileX) && Number.isFinite(repo.tileY));
  }

  function getNameFromFullName(fullName) {
    if (!fullName || typeof fullName !== "string") return "";
    return fullName.split("/").pop();
  }

  function getOwnerFromFullName(fullName) {
    if (!fullName || typeof fullName !== "string") return "";
    return fullName.split("/")[0];
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  }

  return {
    fetchRepoLayout,
    API_BASE_URL,
    LAYOUT_ENDPOINT,
  };
})();