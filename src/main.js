const mapLayer = document.getElementById("mapLayer");
const pinsLayer = document.getElementById("pinsLayer");

const dashboardTitle = document.getElementById("dashboardTitle");
const statusText = document.getElementById("statusText");

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const randomButton = document.getElementById("randomButton");
const resetButton = document.getElementById("resetButton");
const backButton = document.getElementById("backButton");

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

let allRepos = [];
let visibleRepos = [];
let selectedRepo = null;
let currentView = "aerial";
let currentMarkdown = "";
let currentMarkdownFilename = "repo-file.md";

const CITY_MAPS = [
  "./public/assets/map1.png",
  "./public/assets/map2.png",
  "./public/assets/map3.png",
];

const cityFilePositions = [
  { x: 22, y: 38 },
  { x: 39, y: 25 },
  { x: 56, y: 45 },
  { x: 68, y: 31 },
  { x: 47, y: 64 },
];

window.addEventListener("DOMContentLoaded", () => {
  attachEventListeners();
  loadRepoLayout();
});

function assignCityMaps(repos) {
  return repos.map((repo, index) => ({
    ...repo,
    cityMap: CITY_MAPS[index % CITY_MAPS.length],
    cityMapNumber: index + 1,
  }));
}

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
}

async function loadRepoLayout() {
  setStatus("Loading repo layout from API...");

  try {
    allRepos = await RepoApi.fetchRepoLayout();

    if (!allRepos.length) {
      throw new Error("API returned no repos.");
    }

    pickAndRenderRandomRepos(allRepos);
    setStatus(`Loaded ${allRepos.length} repos. Showing 3 random entry points.`);
  } catch (error) {
    console.error(error);
    setStatus("Could not load repo layout. Check that localhost:8000 is running.");
    showToast("API fetch failed. Make sure backend is running on port 8000.");
  }
}

function pickAndRenderRandomRepos(sourceRepos) {
  if (!sourceRepos.length) {
    visibleRepos = [];
    clearPins();
    renderRepoList();
    setStatus("No repos available to display.");
    return;
  }

  visibleRepos = assignCityMaps(pickRandomItems(sourceRepos, 3));
  selectedRepo = null;
  currentView = "aerial";

  dashboardTitle.textContent = "Random Entry Points";

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
        <span class="repo-tag">height ${repo.height}</span>
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
      subtitle: repo.language,
      height: repo.height,
      className: "repo-pin",
      onClick: () => flyIntoRepo(repo),
    });
  });
}

function tileToScreenPosition(tileX, tileY) {
  return {
    x: (tileX / 63) * window.innerWidth,
    y: (tileY / 63) * window.innerHeight,
  };
}

function createPin({ x, y, title, subtitle, height = 1, className = "", onClick }) {
  const pin = document.createElement("button");
  pin.className = `map-pin ${className}`;
  pin.style.left = `${x}px`;
  pin.style.top = `${y}px`;
  pin.setAttribute("aria-label", title);

  const scale = 1 + height * 0.06;

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

  clearPins();
  mapLayer.classList.add("flying");

  setStatus(`Flying into ${repo.name}...`);

  window.setTimeout(() => {
    renderCityView(repo);
  }, 720);
}

function renderCityView(repo) {
  currentView = "city";

  mapLayer.classList.remove("aerial-view", "flying");
  mapLayer.classList.add("city-view", "city-active");

  mapLayer.style.backgroundImage = `url("${repo.cityMap}")`;

  dashboardTitle.textContent = "City View";

  repoListSection.classList.add("hidden");
  repoDetails.classList.remove("hidden");
  markdownPanel.classList.add("hidden");
  backButton.classList.remove("hidden");

  selectedRepoName.textContent = repo.name;
  selectedRepoMeta.textContent = `${repo.fullName} • ${repo.language} • ${repo.description}`;

  selectedRepoHeight.textContent = repo.height;
  selectedRepoStars.textContent = formatNumber(repo.stars);
  selectedRepoForks.textContent = formatNumber(repo.forks);
  selectedRepoTrend.textContent = repo.trendingScore.toFixed(2);

  renderCityFilePins(repo);

  setStatus("City view loaded. Click a file pin to generate markdown.");
}

function renderCityFilePins(repo) {
  clearPins();

  const files = getPlaceholderFilesForRepo(repo);

  files.forEach((file, index) => {
    const position = cityFilePositions[index];

    createPin({
      x: (position.x / 100) * window.innerWidth,
      y: (position.y / 100) * window.innerHeight,
      title: file.name,
      subtitle: "Generate MD",
      height: 2,
      className: "file-pin",
      onClick: () => generateMarkdownForFile(repo, file),
    });
  });
}

function getPlaceholderFilesForRepo(repo) {
  const language = repo.language.toLowerCase();

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

  return [
    { name: "README.md", role: "project overview" },
    { name: "src/main", role: "main source file" },
    { name: "config/layout.json", role: "layout configuration" },
    { name: "tests/spec", role: "test coverage" },
    { name: "docs/architecture.md", role: "architecture notes" },
  ];
}

function generateMarkdownForFile(repo, file) {
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
| Tile X | ${repo.tileX} |
| Tile Y | ${repo.tileY} |
| Height | ${repo.height} |
| Stars | ${repo.stars} |
| Forks | ${repo.forks} |
| Trending Score | ${repo.trendingScore} |

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
      repo.name.toLowerCase().includes(normalizedQuery) ||
      repo.fullName.toLowerCase().includes(normalizedQuery) ||
      repo.owner.toLowerCase().includes(normalizedQuery) ||
      repo.language.toLowerCase().includes(normalizedQuery) ||
      repo.description.toLowerCase().includes(normalizedQuery)
    );
  });

  if (!matches.length) {
    setStatus(`No matches found for "${query}". Showing random repos instead.`);
    showToast(`No matches for "${query}".`);
    pickAndRenderRandomRepos(allRepos);
    return;
  }

  visibleRepos = assignCityMaps(pickRandomItems(matches, 3));

  renderAerialMap();
  renderAerialPins(visibleRepos);
  renderRepoList();

  dashboardTitle.textContent = "Search Entry Points";

  repoListSection.classList.remove("hidden");
  repoDetails.classList.add("hidden");
  markdownPanel.classList.add("hidden");
  backButton.classList.add("hidden");

  setStatus(`Found ${matches.length} matches for "${query}". Showing 3 random matches.`);
}

function returnToAerialView() {
  currentView = "aerial";
  selectedRepo = null;

  dashboardTitle.textContent = "Random Entry Points";

  repoListSection.classList.remove("hidden");
  repoDetails.classList.add("hidden");
  markdownPanel.classList.add("hidden");
  backButton.classList.add("hidden");

  renderAerialMap();
  renderAerialPins(visibleRepos);

  setStatus(`Back to aerial view. Showing ${visibleRepos.length} entry points.`);
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

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0";

  return new Intl.NumberFormat("en", {
    notation: number >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(number);
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value)
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