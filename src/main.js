import {
  api,
  normalizeRepoList,
  normalizeScoreMap,
  getRepoId,
  getRepoFullName,
} from "./api.js";
import {
  buildDistricts,
  searchReposByField,
  bestDistrictDefForRepo,
  predictDistrictForRepo,
  slotRepoIntoDistricts,
  REPOS_PER_DISTRICT,
} from "./districts.js";

function isBlockedRepo(repo) {
  if (!repo) return false;
  const haystack = `${repo.name || ""} ${repo.fullName || ""} ${repo.repoId || ""} ${repo.id || ""}`.toLowerCase();
  return haystack.includes("fucking-algorithm") || haystack.includes("fucking algorithm");
}

function withoutBlockedRepos(repos) {
  return (repos || []).filter((repo) => !isBlockedRepo(repo));
}

const mapLayer = document.getElementById("mapLayer");
const pinsLayer = document.getElementById("pinsLayer");

const dashboard = document.getElementById("dashboard");
const dashboardTitle = document.getElementById("dashboardTitle");
const statusText = document.getElementById("statusText");
const eyebrow = document.querySelector(".eyebrow");

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const randomButton = document.getElementById("randomButton");
const backButton = document.getElementById("backButton");

const searchControls =
  document.getElementById("searchControls") || searchInput?.closest(".search-row");

const randomControls =
  document.getElementById("randomControls") || randomButton?.closest(".button-row");

const repoList = document.getElementById("repoList");
const repoListSection = document.getElementById("repoListSection");
const repoListTitle = document.getElementById("repoListTitle");

const markdownPanel = document.getElementById("markdownPanel");
const markdownTitle = document.getElementById("markdownTitle");
const markdownOutput = document.getElementById("markdownOutput");
const agentErrorBox = document.getElementById("agentErrorBox");
const downloadMarkdownButton = document.getElementById("downloadMarkdownButton");

const repoDetailModal = document.getElementById("repoDetailModal");
const repoDetailClose = document.getElementById("repoDetailClose");
const modalRepoDismiss = document.getElementById("modalRepoDismiss");
const modalGenerateContext = document.getElementById("modalGenerateContext");
const modalRepoDistrict = document.getElementById("modalRepoDistrict");
const modalRepoName = document.getElementById("modalRepoName");
const modalRepoMeta = document.getElementById("modalRepoMeta");
const modalRepoLanguage = document.getElementById("modalRepoLanguage");
const modalRepoStars = document.getElementById("modalRepoStars");
const modalRepoForks = document.getElementById("modalRepoForks");
const modalRepoTrend = document.getElementById("modalRepoTrend");

const toast = document.getElementById("toast");
const contextReadyModal = document.getElementById("contextReadyModal");
const contextReadyTitle = document.getElementById("contextReadyTitle");
const contextReadyMessage = document.getElementById("contextReadyMessage");
const contextReadyDownload = document.getElementById("contextReadyDownload");
const contextReadyDismiss = document.getElementById("contextReadyDismiss");

let minimizeDashboardButton = null;

let allRepos = [];
let districts = [];
let activeDistrict = null;
let selectedRepo = null;
let currentView = "aerial";
let currentMarkdown = "";
let currentMarkdownFilename = "context.md";
let activeContextSource = null;
let currentAerialTitle = "World Map";
let pendingSearchRepo = null;

const USER_ID_KEY = "repo_map_user_id";
const REPO_CACHE_KEY = "repopilot_repo_layout_cache_v1";

const cityRepoPositions = [
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

  randomButton.addEventListener("click", reshuffleDistricts);

  backButton.addEventListener("click", returnToAerialView);
  downloadMarkdownButton.addEventListener("click", downloadCurrentMarkdown);
  modalGenerateContext?.addEventListener("click", () => {
    if (selectedRepo) {
      hideRepoDetailModal();
      generateRepoContext(selectedRepo, { name: "context.md" });
    }
  });
  repoDetailClose?.addEventListener("click", hideRepoDetailModal);
  modalRepoDismiss?.addEventListener("click", hideRepoDetailModal);
  repoDetailModal?.addEventListener("click", (event) => {
    if (event.target === repoDetailModal) {
      hideRepoDetailModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideRepoDetailModal();
      hideContextReadyModal();
    }
  });
  contextReadyDownload?.addEventListener("click", () => {
    downloadCurrentMarkdown();
    hideContextReadyModal();
  });
  contextReadyDismiss?.addEventListener("click", hideContextReadyModal);
  contextReadyModal?.addEventListener("click", (event) => {
    if (event.target === contextReadyModal) {
      hideContextReadyModal();
    }
  });

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
    allRepos = withoutBlockedRepos(cachedRepos);
    districts = buildDistricts(allRepos);
    renderAerialWorld();
    setStatus(`Loaded ${allRepos.length} repos from cache. Refreshing in background...`);
  }

  try {
    const layoutPayload = await api.getLayout();
    const layoutRepos = normalizeRepoList(layoutPayload).map(normalizeBackendRepo);

    if (!layoutRepos.length) {
      throw new Error("API returned no repos.");
    }

    allRepos = withoutBlockedRepos(layoutRepos);
    saveCachedRepos(allRepos);

    districts = buildDistricts(allRepos);

    if (!cachedRepos.length && currentView === "aerial") {
      renderAerialWorld();
    }

    setStatus(`Loaded ${allRepos.length} repos across 3 themed districts.`);

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

    districts = buildDistricts(allRepos);

    if (currentView === "aerial") {
      renderAerialWorld();
    } else if (currentView === "city" && activeDistrict) {
      const refreshed = districts.find((d) => d.id === activeDistrict.id);
      if (refreshed) {
        activeDistrict = refreshed;
        if (selectedRepo) {
          const updated = refreshed.repos.find((r) => r.repoId === selectedRepo.repoId);
          if (updated) selectedRepo = updated;
        }
        renderDistrictCityView(activeDistrict);
      }
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

  };
}

function reshuffleDistricts() {
  if (!allRepos.length) return;
  districts = buildDistricts(allRepos, { randomize: true });
  returnToAerialView();
  showToast("Districts reshuffled — new random repos per theme.");
}

function renderAerialWorld() {
  currentView = "aerial";
  activeDistrict = null;
  selectedRepo = null;
  pendingSearchRepo = null;
  currentAerialTitle = "World Map";

  dashboardTitle.textContent = currentAerialTitle;
  if (repoListTitle) repoListTitle.textContent = "Districts";

  showAerialControls();
  repoListSection.classList.remove("hidden");
  markdownPanel.classList.add("hidden");
  hideRepoDetailModal();
  backButton.classList.add("hidden");

  renderAerialMap();
  renderAerialDistrictPins();
  renderDistrictChooserList();

  setStatus("Pick a district — Castle (AI), Desert (cyber), or Volcano (math & CS).");
}

function pickRandomItems(items, count) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]];
  }

  return copy.slice(0, Math.min(count, copy.length));
}

function renderDistrictChooserList() {
  repoList.innerHTML = "";

  if (!districts.length) {
    repoList.innerHTML = `<p class="list-empty">No districts loaded yet.</p>`;
    return;
  }

  districts.forEach((district) => {
    const card = document.createElement("article");
    card.className = "repo-card district-card";

    card.innerHTML = `
      <strong>${district.emoji} ${escapeHtml(district.name)}</strong>
      <p>${escapeHtml(district.theme)}</p>
      <div class="repo-tags">
        <span class="repo-tag">${REPOS_PER_DISTRICT} repos</span>
        <span class="repo-tag">Enter district →</span>
      </div>
    `;

    card.addEventListener("click", () => flyIntoDistrict(district));
    repoList.appendChild(card);
  });
}

function renderDistrictRepoList(district) {
  if (!repoList) return;
  repoList.innerHTML = "";

  district.repos.forEach((repo, index) => {
    const isSelected =
      selectedRepo &&
      (selectedRepo.repoId === repo.repoId || selectedRepo.fullName === repo.fullName);

    const card = document.createElement("article");
    card.className = `repo-card${isSelected ? " repo-card-active" : ""}`;

    card.innerHTML = `
      <strong>${index + 1}. ${escapeHtml(repo.name)}</strong>
      <p>${escapeHtml(repo.fullName)}</p>
      <div class="repo-tags">
        <span class="repo-tag">${escapeHtml(repo.language || "—")}</span>
        <span class="repo-tag">★ ${formatCompactNumber(repo.stars)}</span>
      </div>
    `;

    card.addEventListener("click", () => selectRepoInDistrict(repo));
    repoList.appendChild(card);
  });
}

function renderSearchResults(matches, query) {
  currentView = "aerial";
  activeDistrict = null;
  selectedRepo = null;
  currentAerialTitle = `Search: ${query}`;

  dashboardTitle.textContent = currentAerialTitle;
  if (repoListTitle) repoListTitle.textContent = `Matches (${matches.length})`;

  showAerialControls();
  repoListSection.classList.remove("hidden");
  markdownPanel.classList.add("hidden");
  hideRepoDetailModal();
  backButton.classList.add("hidden");

  renderAerialMap();
  clearPins();

  setStatus(
    `Found ${matches.length} matches. Click a repo to fly in — we'll slot it into the best district.`
  );

  repoList.innerHTML = "";

  matches.slice(0, 25).forEach((repo) => {
    const district = predictDistrictForRepo(districts, repo);
    const card = document.createElement("article");
    card.className = "repo-card";

    card.innerHTML = `
      <strong>${escapeHtml(repo.name)}</strong>
      <p>${escapeHtml(repo.fullName)}</p>
      <div class="repo-tags">
        <span class="repo-tag">${district.emoji} ${district.name}</span>
        <span class="repo-tag">★ ${formatCompactNumber(repo.stars)}</span>
      </div>
    `;

    card.addEventListener("click", () => openRepoFromSearch(repo));
    repoList.appendChild(card);
  });
}

function resolveFullRepo(repo) {
  const key = repo.repoId || getRepoId(repo) || repo.fullName;
  return (
    allRepos.find(
      (item) =>
        item.repoId === key ||
        item.fullName === key ||
        item.id === key
    ) || repo
  );
}

function renderAerialMap() {
  currentView = "aerial";

  mapLayer.style.backgroundImage = "";

  mapLayer.classList.remove("city-view", "city-active", "flying");
  mapLayer.classList.add("aerial-view");

  clearPins();
}

function renderAerialDistrictPins() {
  clearPins();

  const width = pinsLayer.clientWidth || window.innerWidth;
  const height = pinsLayer.clientHeight || window.innerHeight;

  districts.forEach((district) => {
    createPin({
      x: (district.aerial.x / 100) * width,
      y: (district.aerial.y / 100) * height,
      title: `${district.emoji} ${district.name}`,
      subtitle: district.theme,
      height: 5,
      className: "district-pin",
      onClick: () => flyIntoDistrict(district),
    });
  });
}

function openRepoFromSearch(repo) {
  if (!allRepos.length) {
    showToast("Repos still loading — try again in a moment.");
    return;
  }

  const fullRepo = resolveFullRepo(repo);
  const districtDef = bestDistrictDefForRepo(fullRepo);
  const { districts: nextDistricts, district, replaced } = slotRepoIntoDistricts(
    districts,
    fullRepo,
    districtDef
  );

  if (!district) {
    showToast("Could not place this repo in a district.");
    return;
  }

  districts = nextDistricts;
  pendingSearchRepo = fullRepo;

  if (replaced) {
    showToast(
      `Swapped into ${district.emoji} ${district.name} (replaced ${replaced.name}).`
    );
  } else {
    showToast(`Opened in ${district.emoji} ${district.name}.`);
  }

  flyIntoDistrict(district);
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

function flyIntoDistrict(district) {
  if (!district) return;

  activeDistrict = district;
  selectedRepo = null;
  currentView = "transitioning";

  clearPins();
  mapLayer.classList.add("flying");
  setStatus(`Flying into ${district.name}...`);

  window.setTimeout(() => {
    renderDistrictCityView(district);
    if (pendingSearchRepo) {
      const target = district.repos.find(
        (r) =>
          r.repoId === pendingSearchRepo.repoId ||
          r.fullName === pendingSearchRepo.fullName
      );
      pendingSearchRepo = null;
      if (target) selectRepoInDistrict(target);
    }
  }, 720);
}

function renderDistrictCityView(district) {
  currentView = "city";
  activeDistrict = district;

  mapLayer.classList.remove("aerial-view", "flying");
  mapLayer.classList.add("city-view", "city-active");
  mapLayer.style.backgroundImage = `url("${district.map}")`;

  dashboardTitle.textContent = `${district.emoji} ${district.name}`;
  if (repoListTitle) repoListTitle.textContent = `Repos in district (${district.repos.length})`;

  hideCityControls();
  repoListSection.classList.remove("hidden");
  markdownPanel.classList.add("hidden");
  hideRepoDetailModal();
  backButton.classList.remove("hidden");

  renderDistrictRepoPins(district);
  renderDistrictRepoList(district);

  setStatus(`${district.theme} — click a pin or list item to open repo details.`);
}

function selectRepoInDistrict(repo) {
  if (!repo || !activeDistrict) return;

  selectedRepo = repo;
  logRepoAction(repo, "click", 0);

  showRepoDetailModal(repo);
  renderDistrictRepoPins(activeDistrict);
  renderDistrictRepoList(activeDistrict);
  loadRepoDetails(repo);

  setStatus(`${repo.name} — generate context.md or close to keep exploring.`);
}

function showRepoDetailModal(repo) {
  if (!repoDetailModal) return;

  updateRepoModalContent(repo);
  repoDetailModal.classList.remove("hidden");
}

function hideRepoDetailModal() {
  repoDetailModal?.classList.add("hidden");
}

function updateRepoModalContent(repo) {
  const districtLabel = activeDistrict
    ? `${activeDistrict.emoji} ${activeDistrict.name} · ${activeDistrict.theme}`
    : repo.districtName || "District";

  if (modalRepoDistrict) modalRepoDistrict.textContent = districtLabel;
  if (modalRepoName) modalRepoName.textContent = repo.name || "Repository";
  if (modalRepoMeta) {
    modalRepoMeta.textContent = repo.description || repo.fullName || "";
  }
  if (modalRepoLanguage) {
    modalRepoLanguage.textContent = repo.language
      ? `${repo.language} · ${repo.fullName || ""}`
      : repo.fullName || "";
  }
  if (modalRepoStars) modalRepoStars.textContent = formatCompactNumber(repo.stars);
  if (modalRepoForks) modalRepoForks.textContent = formatCompactNumber(repo.forks);
  if (modalRepoTrend) modalRepoTrend.textContent = formatTrendLabel(repo.trendingScore);
}

function renderDistrictRepoPins(district) {
  clearPins();

  const width = pinsLayer.clientWidth || window.innerWidth;
  const height = pinsLayer.clientHeight || window.innerHeight;

  district.repos.forEach((repo, index) => {
    const position = cityRepoPositions[index % cityRepoPositions.length];
    const isSelected =
      selectedRepo &&
      (selectedRepo.repoId === repo.repoId || selectedRepo.fullName === repo.fullName);

    createPin({
      x: (position.x / 100) * width,
      y: (position.y / 100) * height,
      title: repo.name,
      subtitle: `${repo.language || "repo"} · ★ ${formatCompactNumber(repo.stars)}`,
      height: Math.min(6, 2 + Math.floor((repo.stars || 0) / 80000)),
      className: `repo-pin${isSelected ? " pin-selected" : ""}`,
      onClick: () => selectRepoInDistrict(repo),
    });
  });
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
    normalizedDetails.similarRepos =
      detailPayload.similar_repo_ids ||
      detailPayload.similarRepoIds ||
      rawDetails.similar_repo_ids ||
      normalizedDetails.similarRepos ||
      [];

    selectedRepo = normalizedDetails;
    if (repoDetailModal && !repoDetailModal.classList.contains("hidden")) {
      updateRepoModalContent(normalizedDetails);
    }
    if (currentView === "city" && activeDistrict) {
      renderDistrictRepoPins(activeDistrict);
      renderDistrictRepoList(activeDistrict);
    }

    console.log("Repo details loaded:", detailPayload);
  } catch (error) {
    console.warn("Could not load full repo detail. Using layout data.", error);
  }
}

function formatAgentError(rawMessage) {
  const message = String(rawMessage || "").toLowerCase();

  if (
    message.includes("api_key") ||
    message.includes("credentials") ||
    message.includes("openai") ||
    message.includes("authentication")
  ) {
    return {
      emoji: "💀",
      title: "Oops — the agent flatlined",
      body: "Our context bot forgot its API keys. Anes needs to revive it on Railway (OPENAI_API_KEY), then try again.",
    };
  }

  if (
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("insufficient")
  ) {
    return {
      emoji: "🪫",
      title: "Agent is out of juice",
      body: "Looks like we hit the OpenAI quota wall. Wait a minute or beg for more credits, then respawn the agent.",
    };
  }

  if (message.includes("timeout") || message.includes("timed out")) {
    return {
      emoji: "☕",
      title: "Agent went on a coffee break",
      body: "The request took too long and wandered off. Try again — or pick a smaller repo.",
    };
  }

  if (message.includes("connection") || message.includes("network")) {
    return {
      emoji: "📡",
      title: "Agent lost signal",
      body: "Could not reach the server. Check your Wi‑Fi and that the Railway backend is awake.",
    };
  }

  return {
    emoji: "🤖",
    title: "The agent glitched",
    body: rawMessage || "Something unexpected happened. Try again in a sec.",
  };
}

function showAgentError(rawMessage) {
  const err = formatAgentError(rawMessage);
  agentErrorBox.classList.remove("hidden");
  agentErrorBox.innerHTML = `
    <div class="agent-error-emoji">${err.emoji}</div>
    <strong class="agent-error-title">${escapeHtml(err.title)}</strong>
    <p class="agent-error-body">${escapeHtml(err.body)}</p>
  `;
  markdownOutput.classList.add("hidden");
}

function hideAgentError() {
  agentErrorBox.classList.add("hidden");
  agentErrorBox.innerHTML = "";
  markdownOutput.classList.remove("hidden");
}

function generateRepoContext(repo, file) {
  const repoId = repo.repoId || getRepoId(repo);
  if (!repoId) {
    showToast("Missing repo id for context generation.");
    return;
  }

  logRepoAction(repo, "generate_context", 0);

  if (activeContextSource) {
    activeContextSource.close();
    activeContextSource = null;
  }

  currentMarkdown = "";
  currentMarkdownFilename = sanitizeFilename(`${repo.name || "repo"}-context.md`);
  markdownTitle.textContent = file?.name || "context.md";
  hideAgentError();
  markdownOutput.textContent = "🛫 Summoning the context agent...\n";
  markdownPanel.classList.remove("hidden");
  repoListSection?.classList.add("hidden");
  showToast(`Waking the agent for ${repo.name}...`);

  activeContextSource = api.streamRepoContext(repoId, {
    onProgress: (message) => {
      hideAgentError();
      markdownOutput.textContent = `🛫 ${message}\n\n(hang tight — writing context.md...)`;
    },
    onChunk: (content) => {
      hideAgentError();
      currentMarkdown = content;
      markdownOutput.textContent = content;
    },
    onComplete: (meta) => {
      activeContextSource = null;
      hideAgentError();
      const cached = meta?.cached ? " (from cache)" : "";
      showToast(`Agent delivered context.md${cached} ✨`);
      showContextReadyModal(repo, cached);
    },
    onError: (error) => {
      activeContextSource = null;
      showAgentError(error.message);
      showToast(formatAgentError(error.message).title);
    },
  });
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
    returnToAerialView();
    return;
  }

  if (!allRepos.length) {
    showToast("Repos still loading — try again in a moment.");
    return;
  }

  const matches = searchReposByField(allRepos, query);

  if (!matches.length) {
    setStatus(`No matches for "${query}". Try: AI, cybersecurity, math, python.`);
    showToast(`No field matches for "${query}".`);
    return;
  }

  renderSearchResults(matches, query);
}

function returnToAerialView() {
  activeDistrict = null;
  selectedRepo = null;
  pendingSearchRepo = null;
  searchInput.value = "";
  hideRepoDetailModal();
  repoListSection?.classList.remove("hidden");
  renderAerialWorld();
}

function showContextReadyModal(repo, cachedSuffix = "") {
  if (!contextReadyModal) return;

  const name = repo?.name || "repo";
  if (contextReadyTitle) {
    contextReadyTitle.textContent = `${name} — context.md is ready!`;
  }
  if (contextReadyMessage) {
    contextReadyMessage.textContent = `Your AI contribution brief${cachedSuffix} is ready to download.`;
  }

  contextReadyModal.classList.remove("hidden");
}

function hideContextReadyModal() {
  contextReadyModal?.classList.add("hidden");
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

function formatCompactNumber(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTrendLabel(score) {
  const n = toNumber(score, 0);
  if (n >= 0.37) return "🔥 Hot";
  if (n >= 0.34) return "📈 Rising";
  return "😴 Cool";
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
    renderAerialDistrictPins();
  }

  if (currentView === "city" && activeDistrict) {
    renderDistrictRepoPins(activeDistrict);
  }
});