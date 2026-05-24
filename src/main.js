import {
  api,
  normalizeRepoList,
  normalizeScoreMap,
  getRepoId,
  getRepoFullName,
} from "./api.js";

const mapLayer = document.getElementById("mapLayer");
const pinsLayer = document.getElementById("pinsLayer");

const dashboard = document.getElementById("dashboard");
const dashboardTitle = document.getElementById("dashboardTitle");
const statusText = document.getElementById("statusText");
const eyebrow = document.querySelector(".eyebrow");

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const randomButton = document.getElementById("randomButton");
const resetButton = document.getElementById("resetButton");
const backButton = document.getElementById("backButton");

const searchControls =
  document.getElementById("searchControls") || searchInput?.closest(".search-row");

const randomControls =
  document.getElementById("randomControls") || randomButton?.closest(".button-row");

const repoList = document.getElementById("repoList");
const repoListSection = document.getElementById("repoListSection");

const repoDetails = document.getElementById("repoDetails");
const selectedRepoName = document.getElementById("selectedRepoName");
const selectedRepoMeta = document.getElementById("selectedRepoMeta");
const selectedRepoHeight = document.getElementById("selectedRepoHeight");
const selectedRepoStars = document.getElementById("selectedRepoStars");
const selectedRepoForks = document.getElementById("selectedRepoForks");
const selectedRepoTrend = document.getElementById("selectedRepoTrend");

const markdownPanel = document.getElementById("markdownPanel");
const markdownTitle = document.getElementById("markdownTitle");
const markdownOutput = document.getElementById("markdownOutput");
const downloadMarkdownButton = document.getElementById("downloadMarkdownButton");

const toast = document.getElementById("toast");

let minimizeDashboardButton = null;

let allRepos = [];
let visibleRepos = [];
let selectedRepo = null;
let currentView = "aerial";
let currentMarkdown = "";
let currentMarkdownFilename = "repo-file.md";
let currentAerialTitle = "Random Entry Points";

const USER_ID_KEY = "repo_map_user_id";
const REPO_CACHE_KEY = "repopilot_repo_layout_cache_v1";

const CITY_MAPS = [
  "/assets/map1.png",
  "/assets/map2.png",
  "/assets/map3.png",
];

const cityFilePositions = [
  { x: 22, y: 38 },
  { x: 39, y: 25 },
  { x: 56, y: 45 },
  { x: 68, y: 31 },
  { x: 47, y: 64 },
];

window.addEventListener("DOMContentLoaded", () => {
  setupBranding();
  setupDashboardMinimize();
  attachEventListeners();
  loadRepoLayout();
});

function setupBranding() {
  document.title = "RepoPilot";

  if (eyebrow) {
    eyebrow.textContent = "RepoPilot";
  }
}

function setupDashboardMinimize() {
  injectDashboardMinimizeStyles();

  minimizeDashboardButton = document.getElementById("minimizeDashboardButton");

  if (!minimizeDashboardButton) {
    minimizeDashboardButton = document.createElement("button");
    minimizeDashboardButton.id = "minimizeDashboardButton";
    minimizeDashboardButton.className = "minimize-dashboard-button";
    minimizeDashboardButton.type = "button";
    minimizeDashboardButton.textContent = "−";
    minimizeDashboardButton.setAttribute("aria-label", "Minimize dashboard");

    dashboard.prepend(minimizeDashboardButton);
  }
}

function injectDashboardMinimizeStyles() {
  if (document.getElementById("dashboardMinimizeStyles")) return;

  const style = document.createElement("style");
  style.id = "dashboardMinimizeStyles";

  style.textContent = `
    #dashboard {
      position: fixed;
      transition:
        width 0.25s ease,
        height 0.25s ease,
        max-height 0.25s ease,
        padding 0.25s ease,
        opacity 0.25s ease,
        transform 0.25s ease;
    }

    .minimize-dashboard-button {
      position: absolute;
      top: 18px;
      right: 18px;
      width: 38px;
      height: 38px;
      border: 1px solid rgba(120, 190, 230, 0.75);
      border-radius: 14px;
      background: rgba(57, 82, 118, 0.9);
      color: white;
      font-size: 24px;
      font-weight: 800;
      line-height: 1;
      cursor: pointer;
      z-index: 50;
      display: grid;
      place-items: center;
      transition: transform 0.2s ease, background 0.2s ease;
    }

    .minimize-dashboard-button:hover {
      transform: translateY(-1px);
      background: rgba(77, 112, 155, 0.95);
    }

    #dashboard.minimized {
      width: 72px !important;
      height: 72px !important;
      min-height: 72px !important;
      max-height: 72px !important;
      padding: 0 !important;
      overflow: hidden !important;
      border-radius: 24px !important;
    }

    #dashboard.minimized > *:not(.minimize-dashboard-button) {
      display: none !important;
    }

    #dashboard.minimized .minimize-dashboard-button {
      top: 16px;
      right: 16px;
    }
  `;

  document.head.appendChild(style);
}

function getUserId() {
  let userId = localStorage.getItem(USER_ID_KEY);

  if (!userId) {
    userId =
      crypto.randomUUID?.() ||
      `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(USER_ID_KEY, userId);
  }

  return userId;
}

const USER_ID = getUserId();

function attachEventListeners() {
  searchButton.addEventListener("click", handleSearch);

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  });

  randomButton.addEventListener("click", () => {
    const query = searchInput.value.trim();

    if (query) {
      pickRandomFromSearch(query);
    } else {
      pickAndRenderRandomRepos(allRepos);
    }
  });

  resetButton.addEventListener("click", () => {
    searchInput.value = "";
    pickAndRenderRandomRepos(allRepos);
  });

  backButton.addEventListener("click", returnToAerialView);
  downloadMarkdownButton.addEventListener("click", downloadCurrentMarkdown);

  minimizeDashboardButton.addEventListener("click", toggleDashboardMinimize);
}

function toggleDashboardMinimize() {
  dashboard.classList.toggle("minimized");

  const isMinimized = dashboard.classList.contains("minimized");

  minimizeDashboardButton.textContent = isMinimized ? "+" : "−";
  minimizeDashboardButton.setAttribute(
    "aria-label",
    isMinimized ? "Expand dashboard" : "Minimize dashboard"
  );
}

async function loadRepoLayout() {
  setStatus("Loading RepoPilot...");

  const cachedRepos = loadCachedRepos();

  if (cachedRepos.length) {
    allRepos = cachedRepos;
    pickAndRenderRandomRepos(allRepos);
    setStatus(`Loaded ${allRepos.length} repos instantly from cache. Refreshing in background...`);
  }

  try {
    const layoutPayload = await api.getLayout();
    const layoutRepos = normalizeRepoList(layoutPayload).map(normalizeBackendRepo);

    if (!layoutRepos.length) {
      throw new Error("API returned no repos.");
    }

    allRepos = layoutRepos;
    saveCachedRepos(allRepos);

    if (!cachedRepos.length && currentView === "aerial") {
      pickAndRenderRandomRepos(allRepos);
    }

    setStatus(`Loaded ${allRepos.length} repos. Showing 3 random entry points.`);

    loadExtraScoresInBackground();
  } catch (error) {
    console.error("Repo layout failed:", error);

    if (cachedRepos.length) {
      setStatus("Using cached repos because live API is slow.");
      showToast("Using cached repo data.");
      return;
    }

    setStatus("Could not load repo layout from the live API.");
    showToast("Backend/API fetch failed. Check Console and Network tab.");
  }
}

async function loadExtraScoresInBackground() {
  try {
    const [trendingPayload, personalizedPayload] = await Promise.allSettled([
      api.getTrendingScores(),
      api.getPersonalizedScores(USER_ID),
    ]);

    let trendingScores = {};
    let personalizedScores = {};

    if (trendingPayload.status === "fulfilled") {
      trendingScores = normalizeScoreMap(trendingPayload.value);
    }

    if (personalizedPayload.status === "fulfilled") {
      personalizedScores = normalizeScoreMap(personalizedPayload.value);
    }

    allRepos = allRepos.map((repo) => {
      const repoId = repo.repoId;
      const fullName = repo.fullName;

      return {
        ...repo,
        trendingScore: toNumber(
          trendingScores[repoId] ??
            trendingScores[fullName] ??
            repo.trendingScore,
          0
        ),
        personalizationScore: toNumber(
          personalizedScores[repoId] ??
            personalizedScores[fullName] ??
            repo.personalizationScore,
          0
        ),
      };
    });

    saveCachedRepos(allRepos);

    visibleRepos = visibleRepos.map((repo) => {
      const updatedRepo =
        allRepos.find((item) => item.repoId === repo.repoId) || repo;

      return {
        ...updatedRepo,
        cityMap: repo.cityMap,
        cityMapNumber: repo.cityMapNumber,
      };
    });

    if (currentView === "aerial") {
      renderAerialPins(visibleRepos);
      renderRepoList();
    }

    console.log("Extra scores loaded in background.");
  } catch (error) {
    console.warn("Extra score loading failed:", error);
  }
}

function normalizeBackendRepo(rawRepo, index = 0) {
  const fullName =
    getRepoFullName(rawRepo) ||
    rawRepo.full_name ||
    rawRepo.fullName ||
    rawRepo.repo_full_name ||
    "";

  const repoId =
    getRepoId(rawRepo) ||
    rawRepo.repo_id ||
    rawRepo.repoId ||
    fullName ||
    `repo-${index}`;

  const owner =
    rawRepo.owner ||
    rawRepo.owner_login ||
    rawRepo.ownerName ||
    fullName.split("/")[0] ||
    "unknown";

  const name =
    rawRepo.name ||
    rawRepo.repo_name ||
    rawRepo.repoName ||
    fullName.split("/")[1] ||
    `repo-${index + 1}`;

  const normalizedFullName = fullName || `${owner}/${name}`;

  const tileX = toNumber(
    rawRepo.tileX ??
      rawRepo.tile_x ??
      rawRepo.x ??
      rawRepo.layout_x ??
      rawRepo.grid_x,
    stableTile(`${repoId}-x`)
  );

  const tileY = toNumber(
    rawRepo.tileY ??
      rawRepo.tile_y ??
      rawRepo.y ??
      rawRepo.layout_y ??
      rawRepo.grid_y,
    stableTile(`${repoId}-y`)
  );

  return {
    ...rawRepo,

    repoId,
    id: repoId,

    name,
    owner,
    fullName: normalizedFullName,

    language: rawRepo.language || rawRepo.primary_language || "Unknown",
    description:
      rawRepo.description ||
      rawRepo.summary ||
      rawRepo.about ||
      "No description available.",

    tileX: clamp(tileX, 0, 63),
    tileY: clamp(tileY, 0, 63),

    height: toNumber(
      rawRepo.height ??
        rawRepo.tile_height ??
        rawRepo.repo_height ??
        rawRepo.visual_height,
      1
    ),

    stars: toNumber(
      rawRepo.stars ??
        rawRepo.stargazers_count ??
        rawRepo.star_count,
      0
    ),

    forks: toNumber(
      rawRepo.forks ??
        rawRepo.forks_count ??
        rawRepo.fork_count,
      0
    ),

    trendingScore: toNumber(
      rawRepo.trendingScore ??
        rawRepo.trending_score ??
        rawRepo.score,
      0
    ),

    personalizationScore: toNumber(
      rawRepo.personalizationScore ??
        rawRepo.personalization_score,
      0
    ),

    htmlUrl: rawRepo.html_url || rawRepo.htmlUrl || rawRepo.url || "",
    similarRepos: rawRepo.similar_repos || rawRepo.similarRepos || rawRepo.similar || [],

    cityMap: rawRepo.cityMap || CITY_MAPS[0],
    cityMapNumber: rawRepo.cityMapNumber || 1,
  };
}

function assignCityMaps(repos) {
  return repos.map((repo, index) => ({
    ...repo,
    cityMap: CITY_MAPS[index % CITY_MAPS.length],
    cityMapNumber: (index % CITY_MAPS.length) + 1,
  }));
}

function pickAndRenderRandomRepos(sourceRepos) {
  if (!sourceRepos.length) {
    visibleRepos = [];
    selectedRepo = null;
    clearPins();
    renderRepoList();
    setStatus("No repos available to display.");
    return;
  }

  visibleRepos = assignCityMaps(pickRandomItems(sourceRepos, 3));
  selectedRepo = null;
  currentView = "aerial";
  currentAerialTitle = "Random Entry Points";

  dashboardTitle.textContent = currentAerialTitle;

  showAerialControls();

  repoListSection.classList.remove("hidden");
  repoDetails.classList.add("hidden");
  markdownPanel.classList.add("hidden");
  backButton.classList.add("hidden");

  renderAerialMap();
  renderAerialPins(visibleRepos);
  renderRepoList();

  setStatus(`Showing ${visibleRepos.length} randomly selected repo entry points.`);
}

function pickRandomItems(items, count) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]];
  }

  return copy.slice(0, Math.min(count, copy.length));
}

function renderRepoList() {
  repoList.innerHTML = "";

  if (!visibleRepos.length) {
    repoList.innerHTML = `<p>No repos found.</p>`;
    return;
  }

  visibleRepos.forEach((repo, index) => {
    const card = document.createElement("article");
    card.className = "repo-card";

    card.innerHTML = `
      <strong>${index + 1}. ${escapeHtml(repo.name)}</strong>
      <p>${escapeHtml(repo.fullName)}</p>
      <div class="repo-tags">
        <span class="repo-tag">${escapeHtml(repo.language)}</span>
        <span class="repo-tag">height ${formatNumber(repo.height)}</span>
        <span class="repo-tag">★ ${formatNumber(repo.stars)}</span>
      </div>
    `;

    card.addEventListener("click", () => flyIntoRepo(repo));
    repoList.appendChild(card);
  });
}

function renderAerialMap() {
  currentView = "aerial";

  mapLayer.style.backgroundImage = "";

  mapLayer.classList.remove("city-view", "city-active", "flying");
  mapLayer.classList.add("aerial-view");

  clearPins();
}

function renderAerialPins(repos) {
  clearPins();

  repos.forEach((repo) => {
    const position = tileToScreenPosition(repo.tileX, repo.tileY);

    createPin({
      x: position.x,
      y: position.y,
      title: repo.name,
      subtitle: `${repo.language} • trend ${toNumber(repo.trendingScore, 0).toFixed(2)}`,
      height: repo.height,
      className: "repo-pin",
      onClick: () => flyIntoRepo(repo),
    });
  });
}

function tileToScreenPosition(tileX, tileY) {
  const width = pinsLayer.clientWidth || window.innerWidth;
  const height = pinsLayer.clientHeight || window.innerHeight;

  return {
    x: (clamp(tileX, 0, 63) / 63) * width,
    y: (clamp(tileY, 0, 63) / 63) * height,
  };
}

function createPin({ x, y, title, subtitle, height = 1, className = "", onClick }) {
  const pin = document.createElement("button");
  pin.className = `map-pin ${className}`;
  pin.style.left = `${x}px`;
  pin.style.top = `${y}px`;
  pin.setAttribute("aria-label", title);

  const scale = 1 + Math.min(Math.max(Number(height) || 1, 1), 8) * 0.06;

  pin.innerHTML = `
    <div class="pin-pulse"></div>
    <div class="pin-marker" style="scale: ${scale};"></div>
    <div class="pin-label">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(subtitle)}</span>
    </div>
  `;

  pin.addEventListener("click", onClick);
  pinsLayer.appendChild(pin);
}

function flyIntoRepo(repo) {
  if (!repo) return;

  selectedRepo = repo;
  currentView = "transitioning";

  logRepoAction(repo, "click", 0);

  clearPins();
  mapLayer.classList.add("flying");

  setStatus(`Flying into ${repo.name}...`);

  window.setTimeout(() => {
    renderCityView(repo);
    loadRepoDetails(repo);
  }, 720);
}

function renderCityView(repo) {
  currentView = "city";

  mapLayer.classList.remove("aerial-view", "flying");
  mapLayer.classList.add("city-view", "city-active");

  mapLayer.style.backgroundImage = `url("${repo.cityMap}")`;

  dashboardTitle.textContent = "City View";

  hideCityControls();

  repoListSection.classList.add("hidden");
  repoDetails.classList.remove("hidden");
  markdownPanel.classList.add("hidden");
  backButton.classList.remove("hidden");

  updateSelectedRepoDetails(repo);
  renderCityFilePins(repo);

  setStatus("City view loaded. Click a file pin to generate markdown.");
}

function hideCityControls() {
  searchControls?.classList.add("hidden");
  randomControls?.classList.add("hidden");
}

function showAerialControls() {
  searchControls?.classList.remove("hidden");
  randomControls?.classList.remove("hidden");
}

async function loadRepoDetails(repo) {
  if (!repo.fullName) return;

  try {
    const detailPayload = await api.getRepoDetails(repo.fullName);
    const rawDetails = detailPayload.repo || detailPayload.data || detailPayload;

    const normalizedDetails = normalizeBackendRepo(
      {
        ...repo,
        ...rawDetails,
        similar_repos:
          detailPayload.similar_repos ||
          detailPayload.similarRepos ||
          rawDetails.similar_repos ||
          rawDetails.similarRepos ||
          repo.similarRepos,
      },
      0
    );

    normalizedDetails.cityMap = repo.cityMap;
    normalizedDetails.cityMapNumber = repo.cityMapNumber;

    selectedRepo = normalizedDetails;
    updateSelectedRepoDetails(normalizedDetails);

    console.log("Repo details loaded:", detailPayload);
  } catch (error) {
    console.warn("Could not load full repo detail. Using layout data.", error);
  }
}

function updateSelectedRepoDetails(repo) {
  selectedRepoName.textContent = repo.name;

  const metaParts = [
    repo.fullName,
    repo.language,
    repo.description,
  ].filter(Boolean);

  selectedRepoMeta.textContent = metaParts.join(" • ");

  selectedRepoHeight.textContent = formatNumber(repo.height);
  selectedRepoStars.textContent = formatNumber(repo.stars);
  selectedRepoForks.textContent = formatNumber(repo.forks);
  selectedRepoTrend.textContent = toNumber(repo.trendingScore, 0).toFixed(2);
}

function renderCityFilePins(repo) {
  clearPins();

  const files = getPlaceholderFilesForRepo(repo);

  files.forEach((file, index) => {
    const position = cityFilePositions[index];
    const width = pinsLayer.clientWidth || window.innerWidth;
    const height = pinsLayer.clientHeight || window.innerHeight;

    createPin({
      x: (position.x / 100) * width,
      y: (position.y / 100) * height,
      title: file.name,
      subtitle: "Generate MD",
      height: 2,
      className: "file-pin",
      onClick: () => generateMarkdownForFile(repo, file),
    });
  });
}

function getPlaceholderFilesForRepo(repo) {
  const language = String(repo.language || "").toLowerCase();

  if (language.includes("python")) {
    return [
      { name: "README.md", role: "project overview" },
      { name: "src/app.py", role: "main application entry" },
      { name: "src/layout.py", role: "repo layout logic" },
      { name: "tests/test_app.py", role: "test coverage" },
      { name: "docs/architecture.md", role: "architecture notes" },
    ];
  }

  if (
    language.includes("javascript") ||
    language.includes("typescript") ||
    language.includes("react")
  ) {
    return [
      { name: "README.md", role: "project overview" },
      { name: "src/main.js", role: "main app entry" },
      { name: "src/components/Map.jsx", role: "map component" },
      { name: "package.json", role: "project scripts" },
      { name: "docs/architecture.md", role: "architecture notes" },
    ];
  }

  if (
    language.includes("c") ||
    language.includes("c++") ||
    language.includes("cpp")
  ) {
    return [
      { name: "README.md", role: "project overview" },
      { name: "src/main.c", role: "main source file" },
      { name: "include/config.h", role: "configuration header" },
      { name: "tests/test_main.c", role: "test coverage" },
      { name: "docs/architecture.md", role: "architecture notes" },
    ];
  }

  return [
    { name: "README.md", role: "project overview" },
    { name: "src/main", role: "main source file" },
    { name: "config/layout.json", role: "layout configuration" },
    { name: "tests/spec", role: "test coverage" },
    { name: "docs/architecture.md", role: "architecture notes" },
  ];
}

function generateMarkdownForFile(repo, file) {
  logRepoAction(repo, "generate_md", 0);

  currentMarkdownFilename = sanitizeFilename(`${repo.name}-${file.name}.md`);

  currentMarkdown = `# ${file.name}

## Repository

**Name:** ${repo.name}  
**Full name:** ${repo.fullName}  
**Owner:** ${repo.owner}  
**Language:** ${repo.language}

## File Purpose

This file represents the **${file.role}** for the selected repository entry point.

## Map Metadata

| Property | Value |
|---|---|
| Repo ID | ${repo.repoId} |
| Tile X | ${repo.tileX} |
| Tile Y | ${repo.tileY} |
| Height | ${repo.height} |
| Stars | ${repo.stars} |
| Forks | ${repo.forks} |
| Trending Score | ${toNumber(repo.trendingScore, 0).toFixed(2)} |
| Personalization Score | ${toNumber(repo.personalizationScore, 0).toFixed(2)} |

## Generated Notes

This markdown file was generated from the city-view file pin for **${repo.name}**.
`;

  markdownTitle.textContent = file.name;
  markdownOutput.textContent = currentMarkdown;
  markdownPanel.classList.remove("hidden");

  showToast(`Generated markdown for ${file.name}`);
}

function downloadCurrentMarkdown() {
  if (!currentMarkdown) {
    showToast("Click a file pin first to generate markdown.");
    return;
  }

  if (selectedRepo) {
    logRepoAction(selectedRepo, "download_md", 0);
  }

  const blob = new Blob([currentMarkdown], {
    type: "text/markdown;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = currentMarkdownFilename;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

function handleSearch() {
  const query = searchInput.value.trim();

  if (!query) {
    pickAndRenderRandomRepos(allRepos);
    return;
  }

  pickRandomFromSearch(query);
}

function pickRandomFromSearch(query) {
  const normalizedQuery = query.toLowerCase();

  const matches = allRepos.filter((repo) => {
    return (
      safeIncludes(repo.name, normalizedQuery) ||
      safeIncludes(repo.fullName, normalizedQuery) ||
      safeIncludes(repo.owner, normalizedQuery) ||
      safeIncludes(repo.language, normalizedQuery) ||
      safeIncludes(repo.description, normalizedQuery)
    );
  });

  if (!matches.length) {
    setStatus(`No matches found for "${query}". Showing random repos instead.`);
    showToast(`No matches for "${query}".`);
    pickAndRenderRandomRepos(allRepos);
    return;
  }

  visibleRepos = assignCityMaps(pickRandomItems(matches, 3));
  selectedRepo = null;
  currentView = "aerial";
  currentAerialTitle = "Search Entry Points";

  renderAerialMap();
  renderAerialPins(visibleRepos);
  renderRepoList();

  dashboardTitle.textContent = currentAerialTitle;

  showAerialControls();

  repoListSection.classList.remove("hidden");
  repoDetails.classList.add("hidden");
  markdownPanel.classList.add("hidden");
  backButton.classList.add("hidden");

  setStatus(`Found ${matches.length} matches for "${query}". Showing up to 3 random matches.`);
}

function returnToAerialView() {
  currentView = "aerial";
  selectedRepo = null;

  dashboardTitle.textContent = currentAerialTitle;

  showAerialControls();

  repoListSection.classList.remove("hidden");
  repoDetails.classList.add("hidden");
  markdownPanel.classList.add("hidden");
  backButton.classList.add("hidden");

  renderAerialMap();
  renderAerialPins(visibleRepos);

  setStatus(`Back to aerial view. Showing ${visibleRepos.length} entry points.`);
}

function logRepoAction(repo, action, durationMs = 0) {
  const repoId = repo.repoId || repo.fullName || repo.id;

  if (!repoId) return;

  api.logInteraction({
    userId: USER_ID,
    repoId,
    action,
    durationMs,
  }).catch((error) => {
    console.warn(`Could not log interaction: ${action}`, error);
  });
}

function stableTile(value) {
  return 8 + (hashString(String(value)) % 48);
}

function hashString(value) {
  let hash = 0;

  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function clearPins() {
  pinsLayer.innerHTML = "";
}

function setStatus(message) {
  statusText.textContent = message;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");

  window.clearTimeout(showToast.timeoutId);

  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 2600);
}

function loadCachedRepos() {
  try {
    const cached = JSON.parse(localStorage.getItem(REPO_CACHE_KEY) || "null");

    if (!cached || !Array.isArray(cached.repos)) {
      return [];
    }

    return cached.repos;
  } catch (error) {
    console.warn("Could not read repo cache:", error);
    return [];
  }
}

function saveCachedRepos(repos) {
  try {
    localStorage.setItem(
      REPO_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        repos,
      })
    );
  } catch (error) {
    console.warn("Could not save repo cache:", error);
  }
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0";

  return new Intl.NumberFormat("en", {
    notation: number >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(number);
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.min(Math.max(number, min), max);
}

function safeIncludes(value, query) {
  return String(value || "").toLowerCase().includes(query);
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.addEventListener("resize", () => {
  if (currentView === "aerial") {
    renderAerialPins(visibleRepos);
  }

  if (currentView === "city" && selectedRepo) {
    renderCityFilePins(selectedRepo);
  }
});