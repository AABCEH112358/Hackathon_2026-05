/** Repos excluded from the public map (client-side filter + cache hygiene). */

const BLOCKED_FRAGMENTS = ["fucking-algorithm", "fucking algorithm"];

export function isRepoBlocked(repo) {
  if (!repo) return true;

  const haystack = [
    repo.name,
    repo.fullName,
    repo.repoId,
    repo.id,
    repo.description,
    repo.owner && repo.name ? `${repo.owner}/${repo.name}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (BLOCKED_FRAGMENTS.some((fragment) => haystack.includes(fragment))) {
    return true;
  }

  const normalizedName = String(repo.name || "")
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .trim();

  return normalizedName === "fucking algorithm";
}

export function filterBlockedRepos(repos) {
  return (repos || []).filter((repo) => !isRepoBlocked(repo));
}
