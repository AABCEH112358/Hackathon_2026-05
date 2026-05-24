/** Themed map districts — 5 repos each, grouped by endeavor. */

export const REPOS_PER_DISTRICT = 5;
const MIN_DISTRICT_SCORE = 5;

export const DISTRICT_DEFS = [
  {
    id: "ai",
    name: "Castle District",
    theme: "AI & Machine Learning",
    map: "/assets/map3.png",
    emoji: "🏰",
    aerial: { x: 74, y: 46 },
    strongKeywords: [
      "machine-learning",
      "deep-learning",
      "large-language-model",
      "llm",
      "stable-diffusion",
      "langchain",
      "huggingface",
      "transformers",
      "pytorch",
      "tensorflow",
      "openai",
      "anthropic",
      "ollama",
      "comfyui",
      "neural-network",
      "gpt-",
      "whisper",
      "rag-",
      "vector-database",
      "fine-tun",
    ],
    keywords: [
      "ai",
      "ml",
      "gpt",
      "neural",
      "diffusion",
      "llama",
      "gemini",
      "claude",
      "prompt",
      "inference",
      "chatbot",
      "copilot",
      "autogen",
      "dify",
      "n8n",
    ],
    negativeKeywords: [
      "awesome-",
      "build-your-own",
      "leetcode",
      "interview",
      "roadmap",
      "tutorial",
      "course",
      "awesome-python",
      "awesome-go",
      "system-design",
      "frontend",
      "react",
      "vue",
      "kubernetes",
      "docker",
      "malware",
      "pentest",
      "exploit",
    ],
  },
  {
    id: "security",
    name: "Desert Outpost",
    theme: "Cybersecurity & Hacking",
    map: "/assets/map1.png",
    emoji: "🏜️",
    aerial: { x: 50, y: 36 },
    strongKeywords: [
      "cybersecurity",
      "pentest",
      "penetration-test",
      "malware",
      "exploit",
      "vulnerability",
      "cve-",
      "metasploit",
      "burp-suite",
      "owasp",
      "reverse-engineer",
      "forensics",
      "infosec",
      "threat-intel",
      "red-team",
      "blue-team",
      "awesome-hacking",
      "awesome-security",
      "kali-linux",
      "wireshark",
    ],
    keywords: [
      "security",
      "cyber",
      "hack",
      "crypto",
      "encryption",
      "privacy",
      "tor",
      "vpn",
      "proxy",
      "defense",
      "phishing",
      "ransomware",
      "ctf",
      "osint",
    ],
    negativeKeywords: [
      "awesome-python",
      "awesome-go",
      "build-your-own",
      "machine-learning",
      "tensorflow",
      "pytorch",
      "react",
      "vue",
      "nextjs",
      "leetcode",
      "interview",
      "roadmap",
      "tutorial",
      "course",
      "freecodecamp",
    ],
  },
  {
    id: "education",
    name: "Volcano Academy",
    theme: "Math, CS & Algorithms",
    map: "/assets/map2.png",
    emoji: "🌋",
    aerial: { x: 26, y: 40 },
    strongKeywords: [
      "leetcode",
      "competitive-programming",
      "algorithms",
      "data-structures",
      "discrete-math",
      "linear-algebra",
      "calculus",
      "mathematics",
      "mathjax",
      "katex",
      "proof-assistant",
      "project-euler",
      "coding-interview-university",
      "javascript-algorithms",
      "mit-missing",
      "computer-science",
      "cs50",
      "numerical-comput",
      "symbolic-math",
      "theorem-prover",
    ],
    keywords: [
      "algorithm",
      "math",
      "geometry",
      "statistics",
      "probability",
      "combinatorics",
      "graph-theory",
      "dynamic-programming",
      "sorting",
      "complexity",
      "big-o",
      "recursion",
      "tree",
      "heap",
      "sort",
    ],
    negativeKeywords: [
      "awesome-",
      "build-your-own",
      "machine-learning",
      "deep-learning",
      "llm",
      "gpt",
      "stable-diffusion",
      "react",
      "vue",
      "angular",
      "docker",
      "kubernetes",
      "terraform",
      "malware",
      "pentest",
      "exploit",
      "hacking",
      "v2ray",
      "clash",
      "proxy-list",
    ],
  },
];

const SEARCH_ALIASES = [
  {
    phrases: ["cyber security", "cybersecurity", "infosec", "security"],
    terms: ["security", "cyber", "hack", "pentest", "malware", "owasp", "kali", "awesome-hacking"],
  },
  {
    phrases: ["ai", "artificial intelligence", "machine learning", "ml", "llm"],
    terms: ["ai", "ml", "machine-learning", "llm", "gpt", "transformer", "openai", "langchain", "neural", "huggingface"],
  },
  {
    phrases: ["math", "mathematics", "algorithms", "leetcode", "cs education"],
    terms: ["algorithm", "math", "leetcode", "computer-science", "competitive-programming", "data-structures"],
  },
  { phrases: ["web", "frontend", "react", "javascript"], terms: ["javascript", "react", "typescript", "frontend", "next.js", "vue", "web"] },
  { phrases: ["python", "data science"], terms: ["python", "numpy", "pandas", "data", "jupyter"] },
];

function repoHaystack(repo) {
  const topics = Array.isArray(repo.topics) ? repo.topics.join(" ") : "";
  return `${repo.name} ${repo.fullName} ${repo.description || ""} ${repo.language || ""} ${topics}`
    .toLowerCase()
    .replace(/_/g, "-");
}

function scoreRepoForDistrict(repo, district) {
  const haystack = repoHaystack(repo);
  let score = 0;

  for (const keyword of district.strongKeywords || []) {
    if (haystack.includes(keyword)) score += 6;
  }
  for (const keyword of district.keywords || []) {
    if (haystack.includes(keyword)) score += 3;
  }
  for (const keyword of district.negativeKeywords || []) {
    if (haystack.includes(keyword)) score -= 5;
  }

  return Math.max(0, score);
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
      [...(district.strongKeywords || []), ...(district.keywords || [])].forEach((kw) =>
        terms.add(kw)
      );
    }
  }

  return [...terms];
}

export function buildDistricts(allRepos) {
  const buckets = DISTRICT_DEFS.map((def) => ({
    ...def,
    repos: [],
  }));
  const assigned = new Set();

  for (const bucket of buckets) {
    const candidates = allRepos
      .filter((repo) => !assigned.has(repo.repoId))
      .map((repo) => ({ repo, score: scoreRepoForDistrict(repo, bucket) }))
      .filter((entry) => entry.score >= MIN_DISTRICT_SCORE)
      .sort((a, b) => b.score - a.score || b.repo.stars - a.repo.stars);

    for (const entry of candidates.slice(0, REPOS_PER_DISTRICT)) {
      bucket.repos.push(entry.repo);
      assigned.add(entry.repo.repoId);
    }
  }

  for (const bucket of buckets) {
    while (bucket.repos.length < REPOS_PER_DISTRICT) {
      const fallback = allRepos
        .filter((repo) => !assigned.has(repo.repoId))
        .map((repo) => ({ repo, score: scoreRepoForDistrict(repo, bucket) }))
        .sort((a, b) => b.score - a.score || b.repo.stars - a.repo.stars)[0];

      if (!fallback || fallback.score === 0) {
        const any = allRepos.find((repo) => !assigned.has(repo.repoId));
        if (!any) break;
        bucket.repos.push(any);
        assigned.add(any.repoId);
        continue;
      }

      bucket.repos.push(fallback.repo);
      assigned.add(fallback.repo.repoId);
    }
  }

  return buckets.map((bucket) => ({
    ...bucket,
    repos: bucket.repos.slice(0, REPOS_PER_DISTRICT).map((repo) => ({
      ...repo,
      cityMap: bucket.map,
      districtId: bucket.id,
      districtName: bucket.name,
    })),
  }));
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
