/** Themed map districts — 5 repos each, grouped by endeavor. */

export const REPOS_PER_DISTRICT = 5;

export const DISTRICT_DEFS = [
  {
    id: "ai",
    name: "Castle District",
    theme: "AI & Machine Learning",
    map: "/assets/map3.png",
    emoji: "🏰",
    aerial: { x: 74, y: 46 },
    keywords: [
      "ai",
      "ml",
      "machine-learning",
      "llm",
      "gpt",
      "neural",
      "transformer",
      "openai",
      "langchain",
      "deep-learning",
      "tensorflow",
      "pytorch",
      "stable-diffusion",
      "comfy",
      "ollama",
      "agent",
      "prompt",
      "llama",
      "huggingface",
      "anthropic",
      "claude",
      "gemini",
      "diffusion",
      "n8n",
      "dify",
    ],
  },
  {
    id: "security",
    name: "Desert Outpost",
    theme: "Cybersecurity & Hacking",
    map: "/assets/map1.png",
    emoji: "🏜️",
    aerial: { x: 50, y: 36 },
    keywords: [
      "security",
      "cyber",
      "hack",
      "pentest",
      "exploit",
      "malware",
      "cve",
      "privacy",
      "tor",
      "vpn",
      "forensic",
      "owasp",
      "kali",
      "awesome-hacking",
      "v2ray",
      "clash",
      "proxy",
      "encryption",
      "cryptography",
      "defense",
    ],
  },
  {
    id: "education",
    name: "Volcano Academy",
    theme: "Math, CS & Algorithms",
    map: "/assets/map2.png",
    emoji: "🌋",
    aerial: { x: 26, y: 40 },
    keywords: [
      "algorithm",
      "leetcode",
      "math",
      "computer-science",
      "education",
      "interview",
      "roadmap",
      "tutorial",
      "learn",
      "course",
      "book",
      "structure",
      "coding-interview",
      "freecodecamp",
      "awesome-python",
      "developer-roadmap",
      "system-design",
      "university",
      "study",
      "guide",
      "javascript-algorithms",
    ],
  },
];

/** Expand user search into terms that match repo text or district themes. */
const SEARCH_ALIASES = [
  { phrases: ["cyber security", "cybersecurity", "infosec", "security"], terms: ["security", "cyber", "hack", "pentest", "malware", "owasp", "kali", "awesome-hacking"] },
  { phrases: ["ai", "artificial intelligence", "machine learning", "ml", "llm"], terms: ["ai", "ml", "machine-learning", "llm", "gpt", "transformer", "openai", "langchain", "neural", "huggingface"] },
  { phrases: ["math", "mathematics", "algorithms", "leetcode", "cs education"], terms: ["algorithm", "math", "computer-science", "education", "interview", "roadmap", "coding-interview", "learn"] },
  { phrases: ["web", "frontend", "react", "javascript"], terms: ["javascript", "react", "typescript", "frontend", "next.js", "vue", "web"] },
  { phrases: ["python", "data science"], terms: ["python", "numpy", "pandas", "data", "jupyter"] },
];

function repoHaystack(repo) {
  const topics = Array.isArray(repo.topics) ? repo.topics.join(" ") : "";
  return `${repo.name} ${repo.fullName} ${repo.description || ""} ${repo.language || ""} ${topics}`.toLowerCase();
}

function scoreRepoForDistrict(repo, district) {
  const haystack = repoHaystack(repo);
  let score = 0;
  for (const keyword of district.keywords) {
    if (haystack.includes(keyword)) {
      score += keyword.length > 4 ? 2 : 1;
    }
  }
  return score;
}

function expandSearchTerms(query) {
  const normalized = query.toLowerCase().trim();
  const terms = new Set(normalized.split(/\s+/).filter(Boolean));

  for (const alias of SEARCH_ALIASES) {
    if (alias.phrases.some((phrase) => normalized.includes(phrase))) {
      alias.terms.forEach((term) => terms.add(term));
    }
  }

  for (const district of DISTRICT_DEFS) {
    if (
      district.name.toLowerCase().includes(normalized) ||
      district.theme.toLowerCase().includes(normalized) ||
      district.id === normalized
    ) {
      district.keywords.forEach((kw) => terms.add(kw));
    }
  }

  return [...terms];
}

function shuffleInPlace(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function decorateRepoForDistrict(repo, bucket) {
  return {
    ...repo,
    cityMap: bucket.map,
    districtId: bucket.id,
    districtName: bucket.name,
  };
}

function finalizeBuckets(buckets) {
  return buckets.map((bucket) => ({
    ...bucket,
    repos: bucket.repos
      .slice(0, REPOS_PER_DISTRICT)
      .map((repo) => decorateRepoForDistrict(repo, bucket)),
  }));
}

/** Best-matching district theme for a repo (even if not currently slotted). */
export function bestDistrictDefForRepo(repo) {
  let best = DISTRICT_DEFS[0];
  let bestScore = -1;

  for (const def of DISTRICT_DEFS) {
    const score = scoreRepoForDistrict(repo, def);
    if (score > bestScore) {
      bestScore = score;
      best = def;
    }
  }

  return best;
}

export function predictDistrictForRepo(districts, repo) {
  const slotted = findDistrictForRepo(districts, repo);
  if (slotted) return slotted;

  const def = bestDistrictDefForRepo(repo);
  return (
    districts.find((d) => d.id === def.id) || {
      ...def,
      repos: [],
    }
  );
}

/**
 * Place repo into a district. If full, replaces the lowest-star repo.
 * Returns { districts, district, replaced }.
 */
export function slotRepoIntoDistricts(districts, repo, districtDef) {
  const updated = districts.map((d) => ({
    ...d,
    repos: [...d.repos],
  }));

  const target = updated.find((d) => d.id === districtDef.id);
  if (!target) {
    return { districts: updated, district: null, replaced: null };
  }

  const key = repo.repoId || repo.fullName;
  const existingIdx = target.repos.findIndex(
    (r) => (r.repoId || r.fullName) === key
  );

  const normalized = decorateRepoForDistrict(repo, target);
  let replaced = null;

  if (existingIdx >= 0) {
    target.repos[existingIdx] = normalized;
    return { districts: updated, district: target, replaced: null };
  }

  if (target.repos.length < REPOS_PER_DISTRICT) {
    target.repos.push(normalized);
    return { districts: updated, district: target, replaced: null };
  }

  let lowestIdx = 0;
  for (let i = 1; i < target.repos.length; i++) {
    if ((target.repos[i].stars || 0) < (target.repos[lowestIdx].stars || 0)) {
      lowestIdx = i;
    }
  }

  replaced = target.repos[lowestIdx];
  target.repos[lowestIdx] = normalized;

  return { districts: updated, district: target, replaced };
}

export function buildDistricts(allRepos, options = {}) {
  const randomize = options.randomize === true;
  const buckets = DISTRICT_DEFS.map((def) => ({
    ...def,
    repos: [],
  }));

  const assigned = new Set();

  if (randomize) {
    for (const def of DISTRICT_DEFS) {
      const bucket = buckets.find((b) => b.id === def.id);
      if (!bucket) continue;

      const themed = shuffleInPlace(
        allRepos
          .filter((repo) => !assigned.has(repo.repoId))
          .map((repo) => ({ repo, score: scoreRepoForDistrict(repo, def) }))
          .filter((entry) => entry.score > 0)
      );

      const picks = themed.slice(0, REPOS_PER_DISTRICT);

      while (picks.length < REPOS_PER_DISTRICT) {
        const pool = allRepos.filter((repo) => !assigned.has(repo.repoId));
        if (!pool.length) break;
        const randomRepo = pool[Math.floor(Math.random() * pool.length)];
        picks.push({ repo: randomRepo, score: 0 });
      }

      for (const { repo } of picks) {
        bucket.repos.push(repo);
        assigned.add(repo.repoId);
      }
    }

    return finalizeBuckets(buckets);
  }

  const ranked = allRepos
    .map((repo) => {
      const scores = DISTRICT_DEFS.map((d) => scoreRepoForDistrict(repo, d));
      const bestIdx = scores.indexOf(Math.max(...scores));
      return { repo, bestIdx, bestScore: scores[bestIdx] };
    })
    .sort((a, b) => b.repo.stars - a.repo.stars);

  for (const { repo, bestIdx } of ranked) {
    if (buckets[bestIdx].repos.length >= REPOS_PER_DISTRICT) continue;
    buckets[bestIdx].repos.push(repo);
    assigned.add(repo.repoId);
  }

  for (const bucket of buckets) {
    while (bucket.repos.length < REPOS_PER_DISTRICT) {
      const filler = ranked.find(({ repo }) => !assigned.has(repo.repoId))?.repo;
      if (!filler) break;
      bucket.repos.push(filler);
      assigned.add(filler.repoId);
    }
  }

  return finalizeBuckets(buckets);
}

export function searchReposByField(allRepos, query) {
  const terms = expandSearchTerms(query);
  if (!terms.length) return [];

  return allRepos
    .filter((repo) => {
      const haystack = repoHaystack(repo);
      return terms.some((term) => haystack.includes(term));
    })
    .sort((a, b) => b.stars - a.stars);
}

export function findDistrictForRepo(districts, repo) {
  const key = repo.repoId || repo.fullName;
  return districts.find((d) => d.repos.some((r) => (r.repoId || r.fullName) === key)) || null;
}
