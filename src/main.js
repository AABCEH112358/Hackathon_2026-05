import Phaser from "phaser";
import "./style.css";

const ASSETS = {
  aerial: "/assets/aerialm.webp",
  pythonCity: "/assets/map1.jpg",
  javascriptCity: "/assets/map2.webp",
  cCity: "/assets/map3.png",
};

const WATER_BLUE = "#202da6";
const DEBUG_MARKERS = true;

const topicPins = [
  {
    id: "python",
    label: "Python District",
    topic: "python",
    color: 0x6366f1,
    xPercent: 0.49,
    yPercent: 0.66,
    available: true,
  },
  {
    id: "javascript",
    label: "JavaScript District",
    topic: "javascript",
    color: 0xfbbf24,
    xPercent: 0.72,
    yPercent: 0.34,
    available: true,
  },
  {
    id: "c",
    label: "C District",
    topic: "c",
    color: 0x22c55e,
    xPercent: 0.28,
    yPercent: 0.76,
    available: true,
  },
];

const pythonRepos = [
  {
    id: "py-1",
    name: "PyVision Toolkit",
    fileName: "vision.py",
    repoUrl: "https://github.com/example/pyvision-toolkit",
    description: "Computer vision utilities for detecting objects in images.",
    xPercent: 0.34,
    yPercent: 0.43,
  },
  {
    id: "py-2",
    name: "Django Mission Control",
    fileName: "views.py",
    repoUrl: "https://github.com/example/django-mission-control",
    description: "A Django dashboard for managing project missions.",
    xPercent: 0.57,
    yPercent: 0.49,
  },
  {
    id: "py-3",
    name: "Flask API Hub",
    fileName: "app.py",
    repoUrl: "https://github.com/example/flask-api-hub",
    description: "A lightweight Flask API with routes and controllers.",
    xPercent: 0.74,
    yPercent: 0.54,
  },
  {
    id: "py-4",
    name: "Data Pipeline Runner",
    fileName: "pipeline.py",
    repoUrl: "https://github.com/example/data-pipeline-runner",
    description: "ETL scripts for cleaning, transforming, and exporting data.",
    xPercent: 0.45,
    yPercent: 0.62,
  },
  {
    id: "py-5",
    name: "Automation Scripts",
    fileName: "tasks.py",
    repoUrl: "https://github.com/example/automation-scripts",
    description: "Python scripts that automate repetitive developer tasks.",
    xPercent: 0.55,
    yPercent: 0.74,
  },
];

const javascriptRepos = [
  {
    id: "js-1",
    name: "React Component Lab",
    fileName: "App.jsx",
    repoUrl: "https://github.com/example/react-component-lab",
    description: "A React project with reusable UI components and page layouts.",
    xPercent: 0.42,
    yPercent: 0.39,
  },
  {
    id: "js-2",
    name: "Node API Gateway",
    fileName: "server.js",
    repoUrl: "https://github.com/example/node-api-gateway",
    description: "A Node.js backend that handles routes, middleware, and API requests.",
    xPercent: 0.58,
    yPercent: 0.46,
  },
  {
    id: "js-3",
    name: "Vite Starter Kit",
    fileName: "main.js",
    repoUrl: "https://github.com/example/vite-starter-kit",
    description: "A fast Vite app setup with JavaScript modules and frontend tooling.",
    xPercent: 0.71,
    yPercent: 0.53,
  },
  {
    id: "js-4",
    name: "Canvas Animation Engine",
    fileName: "animation.js",
    repoUrl: "https://github.com/example/canvas-animation-engine",
    description: "A browser animation project using canvas rendering and game loops.",
    xPercent: 0.36,
    yPercent: 0.63,
  },
  {
    id: "js-5",
    name: "Dashboard Widgets",
    fileName: "dashboard.js",
    repoUrl: "https://github.com/example/dashboard-widgets",
    description: "Interactive JavaScript dashboard widgets for visualizing project data.",
    xPercent: 0.61,
    yPercent: 0.69,
  },
];

const cRepos = [
  {
    id: "c-1",
    name: "Embedded Sensor Core",
    fileName: "sensor.c",
    repoUrl: "https://github.com/example/embedded-sensor-core",
    description: "C code for reading sensor values and processing embedded data.",
    xPercent: 0.38,
    yPercent: 0.42,
  },
  {
    id: "c-2",
    name: "Memory Manager",
    fileName: "memory.c",
    repoUrl: "https://github.com/example/memory-manager",
    description: "A low-level C project focused on pointers, allocation, and memory safety.",
    xPercent: 0.55,
    yPercent: 0.36,
  },
  {
    id: "c-3",
    name: "Microcontroller Driver Kit",
    fileName: "driver.c",
    repoUrl: "https://github.com/example/microcontroller-driver-kit",
    description: "Device driver code for configuring registers and controlling hardware pins.",
    xPercent: 0.68,
    yPercent: 0.51,
  },
  {
    id: "c-4",
    name: "Terminal Game Engine",
    fileName: "game.c",
    repoUrl: "https://github.com/example/terminal-game-engine",
    description: "A C terminal game project with loops, input handling, and game state logic.",
    xPercent: 0.44,
    yPercent: 0.66,
  },
  {
    id: "c-5",
    name: "Systems Utilities",
    fileName: "utils.c",
    repoUrl: "https://github.com/example/systems-utilities",
    description: "Utility functions for file handling, strings, and command-line tools.",
    xPercent: 0.62,
    yPercent: 0.72,
  },
];

class GitHubAtlasScene extends Phaser.Scene {
  constructor() {
    super("GitHubAtlasScene");

    this.mode = "aerial";

    this.mapLayer = null;
    this.mapImage = null;
    this.activePinGroups = [];

    this.baseScale = 1;
    this.currentZoom = 1;
    this.tiltY = 1;

    this.rotationSpeed = 0.018;
    this.tiltSpeed = 0.015;

    this.keys = null;
    this.entryLabel = null;
  }

  preload() {
    this.load.image("aerialMap", ASSETS.aerial);
    this.load.image("pythonCityMap", ASSETS.pythonCity);
    this.load.image("javascriptCityMap", ASSETS.javascriptCity);
    this.load.image("cCityMap", ASSETS.cCity);
  }

  create() {
    this.cameras.main.setBackgroundColor(WATER_BLUE);

    this.injectDashboardMinimizeStyles();
    this.createDashboardMinimizeButton();

    this.createMap("aerialMap");
    this.createControls();
    this.setupDashboard();

    this.updateStatus(
      "Search <strong>python</strong>, <strong>javascript</strong>, or <strong>C</strong> to reveal a district pin."
    );
  }

  createMap(textureKey) {
    this.destroyCurrentMap();
    this.hideEntryLabel();

    this.cameras.main.setBackgroundColor(WATER_BLUE);

    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;

    this.mapLayer = this.add.container(screenWidth / 2, screenHeight / 2);

    this.mapImage = this.add.image(0, 0, textureKey);
    this.mapImage.setOrigin(0.5);

    this.mapLayer.add(this.mapImage);

    this.currentZoom = 1;
    this.tiltY = 1;

    this.fitMapToScreen();

    this.scale.off("resize");
    this.scale.on("resize", (gameSize) => {
      this.resizeMap(gameSize.width, gameSize.height);
    });
  }

  destroyCurrentMap() {
    this.activePinGroups = [];

    if (this.mapLayer) {
      this.mapLayer.destroy(true);
      this.mapLayer = null;
    }

    this.mapImage = null;
  }

  fitMapToScreen() {
    if (!this.mapImage || !this.mapLayer) return;

    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;

    const scaleX = screenWidth / this.mapImage.width;
    const scaleY = screenHeight / this.mapImage.height;

    this.baseScale = Math.max(scaleX, scaleY);

    this.currentZoom = 1;
    this.tiltY = 1;

    this.mapLayer.setPosition(screenWidth / 2, screenHeight / 2);
    this.mapLayer.setRotation(0);

    this.applyMapScale();
  }

  resizeMap(width, height) {
    if (!this.mapLayer || !this.mapImage) return;

    this.mapLayer.setPosition(width / 2, height / 2);

    const scaleX = width / this.mapImage.width;
    const scaleY = height / this.mapImage.height;

    this.baseScale = Math.max(scaleX, scaleY);

    this.applyMapScale();
  }

  applyMapScale() {
    if (!this.mapLayer) return;

    const scaleX = this.baseScale * this.currentZoom;
    const scaleY = this.baseScale * this.currentZoom * this.tiltY;

    this.mapLayer.setScale(scaleX, scaleY);
  }

  createControls() {
    this.keys = this.input.keyboard.addKeys({
      q: Phaser.Input.Keyboard.KeyCodes.Q,
      e: Phaser.Input.Keyboard.KeyCodes.E,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      r: Phaser.Input.Keyboard.KeyCodes.R,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
    });

    this.input.on("pointermove", (pointer) => {
      if (!pointer.isDown || !this.mapLayer) return;
      if (this.mode !== "aerial") return;

      this.mapLayer.x += pointer.velocity.x / 10;
      this.mapLayer.y += pointer.velocity.y / 10;
    });

    this.input.on("wheel", (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.mapLayer) return;
      if (this.mode !== "aerial") return;

      if (deltaY > 0) {
        this.currentZoom -= 0.08;
      } else {
        this.currentZoom += 0.08;
      }

      this.currentZoom = Phaser.Math.Clamp(this.currentZoom, 0.45, 4);

      this.applyMapScale();
    });
  }

  update() {
    if (!this.keys || !this.mapLayer) return;
    if (this.mode !== "aerial") return;

    if (this.keys.q.isDown || this.keys.left.isDown) {
      this.mapLayer.rotation -= this.rotationSpeed;
    }

    if (this.keys.e.isDown || this.keys.right.isDown) {
      this.mapLayer.rotation += this.rotationSpeed;
    }

    if (this.keys.w.isDown || this.keys.up.isDown) {
      this.tiltY += this.tiltSpeed;
      this.tiltY = Phaser.Math.Clamp(this.tiltY, 0.45, 1.35);
      this.applyMapScale();
    }

    if (this.keys.s.isDown || this.keys.down.isDown) {
      this.tiltY -= this.tiltSpeed;
      this.tiltY = Phaser.Math.Clamp(this.tiltY, 0.45, 1.35);
      this.applyMapScale();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.r)) {
      this.resetView();
    }
  }

  setupDashboard() {
    const topicInput = document.getElementById("topicInput");
    const searchButton = document.getElementById("searchButton");
    const quickButtons = document.querySelectorAll("[data-topic]");
    const backButton = document.getElementById("backButton");

    searchButton.addEventListener("click", () => {
      this.handleSearch(topicInput.value);
    });

    topicInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.handleSearch(topicInput.value);
      }
    });

    quickButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const topic = button.getAttribute("data-topic");
        topicInput.value = topic;
        this.handleSearch(topic);
      });
    });

    backButton.addEventListener("click", () => {
      this.switchToAerial();
    });
  }

  handleSearch(rawTopic) {
    const normalizedTopic = rawTopic.trim().toLowerCase();

    const topicPin = topicPins.find((pin) => {
      return pin.topic.toLowerCase() === normalizedTopic;
    });

    if (!topicPin) {
      this.updateStatus(
        `No district found for "<strong>${rawTopic}</strong>". Try python, javascript, or C.`
      );
      this.setResultBox("");
      return;
    }

    if (this.mode !== "aerial") {
      this.switchToAerial(false);
    }

    this.showTopicPin(topicPin);

    this.updateStatus(
      `<strong>${topicPin.label}</strong> found. Click the glowing map pin to enter the district.`
    );

    this.setResultBox(`
      <div class="result-card">
        <h3>${topicPin.label}</h3>
        <p>
          A district pin has appeared on the aerial map.
          ${
            topicPin.available
              ? "Click the glowing map pin to enter this district."
              : "This district is hardcoded for now, but the city view is coming later."
          }
        </p>
      </div>
    `);
  }

  showTopicPin(topicPin) {
    this.clearPins();

    const { localX, localY } = this.percentToLocal(
      topicPin.xPercent,
      topicPin.yPercent
    );

    const group = this.createMapPin({
      localX,
      localY,
      color: topicPin.color,
      label: topicPin.label,
      size: 20,
      onClick: () => {
        if (topicPin.id === "python") {
          this.enterPythonCity();
        } else if (topicPin.id === "javascript") {
          this.enterJavaScriptCity();
        } else if (topicPin.id === "c") {
          this.enterCCity();
        } else {
          this.updateStatus(
            `<strong>${topicPin.label}</strong> was clicked. This district is not connected to a city view right now.`
          );
        }
      },
    });

    this.activePinGroups.push(group);

    this.flyToPoint({
      localX,
      localY,
      targetZoom: 1.35,
      targetTiltY: 1,
      targetRotation: 0,
      duration: 900,
      labelText: topicPin.label,
    });
  }

  enterPythonCity() {
    this.mode = "city";

    this.createMap("pythonCityMap");
    this.lockCityMapToFullScreen();
    this.showBackButton(true);

    this.updateStatus(
      "Entered <strong>Python City</strong>. Click one of the repo file pins to generate a Mission Brief.md file."
    );

    this.setResultBox(`
      <div class="result-card">
        <h3>Python City</h3>
        <p>
          5 placeholder Python repo files are pinned on the city view.
          Click any glowing repo pin to generate a Mission Brief.
        </p>
      </div>
    `);

    pythonRepos.forEach((repo) => {
      this.createPythonRepoPin(repo);
    });
  }

  enterJavaScriptCity() {
    this.mode = "city";

    this.createMap("javascriptCityMap");
    this.lockCityMapToFullScreen();
    this.showBackButton(true);

    this.updateStatus(
      "Entered <strong>JavaScript District</strong>. Click one of the repo file pins to generate a Mission Brief.md file."
    );

    this.setResultBox(`
      <div class="result-card">
        <h3>JavaScript District</h3>
        <p>
          5 placeholder JavaScript repo files are pinned on the city view.
          Click any glowing repo pin to generate a Mission Brief.
        </p>
      </div>
    `);

    javascriptRepos.forEach((repo) => {
      this.createJavaScriptRepoPin(repo);
    });
  }

  enterCCity() {
    this.mode = "city";

    this.createMap("cCityMap");
    this.lockCityMapToFullScreen();
    this.showBackButton(true);

    this.updateStatus(
      "Entered <strong>C District</strong>. Click one of the repo file pins to generate a Mission Brief.md file."
    );

    this.setResultBox(`
      <div class="result-card">
        <h3>C District</h3>
        <p>
          5 placeholder C repo files are pinned on the city view.
          Click any glowing repo pin to generate a Mission Brief.
        </p>
      </div>
    `);

    cRepos.forEach((repo) => {
      this.createCRepoPin(repo);
    });
  }

  lockCityMapToFullScreen() {
    if (!this.mapLayer || !this.mapImage) return;

    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;

    const scaleX = screenWidth / this.mapImage.width;
    const scaleY = screenHeight / this.mapImage.height;

    this.baseScale = Math.max(scaleX, scaleY);
    this.currentZoom = 1;
    this.tiltY = 1;

    this.mapLayer.setPosition(screenWidth / 2, screenHeight / 2);
    this.mapLayer.setRotation(0);
    this.mapLayer.setScale(this.baseScale, this.baseScale);
  }

  createPythonRepoPin(repo) {
    this.createRepoPin(repo, 0x6366f1);
  }

  createJavaScriptRepoPin(repo) {
    this.createRepoPin(repo, 0xfbbf24);
  }

  createCRepoPin(repo) {
    this.createRepoPin(repo, 0x22c55e);
  }

  createRepoPin(repo, color) {
    const { localX, localY } = this.percentToLocal(repo.xPercent, repo.yPercent);

    const group = this.createMapPin({
      localX,
      localY,
      color,
      label: repo.fileName,
      size: 15,
      onClick: () => {
        this.generateMissionBrief(repo);
      },
    });

    this.activePinGroups.push(group);
  }

  createMapPin({ localX, localY, color, label, size, onClick }) {
    const group = this.add.container(localX, localY);

    const glow = this.add.circle(
      0,
      0,
      size * 2.7,
      color,
      DEBUG_MARKERS ? 0.22 : 0
    );

    const marker = this.add.circle(
      0,
      0,
      size,
      color,
      DEBUG_MARKERS ? 0.95 : 0
    );

    marker.setStrokeStyle(3, 0xffffff, DEBUG_MARKERS ? 0.9 : 0);

    const dot = this.add.circle(
      0,
      0,
      size * 0.35,
      0xffffff,
      DEBUG_MARKERS ? 1 : 0
    );

    const labelText = this.add
      .text(0, -size * 2.1, label, {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#ffffff",
        fontStyle: "bold",
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        padding: {
          x: 7,
          y: 4,
        },
      })
      .setOrigin(0.5, 1);

    const clickZone = this.add.circle(0, 0, size * 3.5, 0xffffff, 0.001);
    clickZone.setInteractive({ useHandCursor: true });

    group.add([glow, marker, dot, labelText, clickZone]);

    this.mapLayer.add(group);

    this.tweens.add({
      targets: glow,
      alpha: DEBUG_MARKERS ? 0.55 : 0,
      scale: 1.35,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    clickZone.on("pointerover", () => {
      this.tweens.add({
        targets: group,
        scale: 1.2,
        duration: 120,
        ease: "Sine.easeOut",
      });
    });

    clickZone.on("pointerout", () => {
      this.tweens.add({
        targets: group,
        scale: 1,
        duration: 120,
        ease: "Sine.easeOut",
      });
    });

    clickZone.on("pointerdown", onClick);

    return group;
  }

  percentToLocal(xPercent, yPercent) {
    return {
      localX: xPercent * this.mapImage.width - this.mapImage.width / 2,
      localY: yPercent * this.mapImage.height - this.mapImage.height / 2,
    };
  }

  flyToPoint({
    localX,
    localY,
    targetZoom = 2,
    targetTiltY = 1,
    targetRotation = 0,
    duration = 1000,
    labelText = "",
    onComplete,
  }) {
    if (this.mode !== "aerial") {
      if (onComplete) {
        onComplete();
      }
      return;
    }

    const screenCenterX = this.scale.width / 2;
    const screenCenterY = this.scale.height / 2;

    const targetScaleX = this.baseScale * targetZoom;
    const targetScaleY = this.baseScale * targetZoom * targetTiltY;

    const cos = Math.cos(targetRotation);
    const sin = Math.sin(targetRotation);

    const transformedX =
      localX * targetScaleX * cos - localY * targetScaleY * sin;

    const transformedY =
      localX * targetScaleX * sin + localY * targetScaleY * cos;

    const targetX = screenCenterX - transformedX;
    const targetY = screenCenterY - transformedY;

    this.hideEntryLabel();

    this.tweens.add({
      targets: this.mapLayer,
      scaleX: this.baseScale * 0.92,
      scaleY: this.baseScale * 0.92 * this.tiltY,
      duration: 200,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.currentZoom = targetZoom;
        this.tiltY = targetTiltY;

        this.tweens.add({
          targets: this.mapLayer,
          x: targetX,
          y: targetY,
          scaleX: targetScaleX,
          scaleY: targetScaleY,
          rotation: targetRotation,
          duration,
          ease: "Cubic.easeInOut",
          onComplete: () => {
            if (labelText) {
              this.showEntryLabel(labelText);
            }

            if (onComplete) {
              onComplete();
            }
          },
        });
      },
    });
  }

  generateMissionBrief(repo) {
    const markdown = `# Mission Brief: ${repo.name}

## File
${repo.fileName}

## Repository
${repo.repoUrl}

## What this repo does
${repo.description}

## Code Overview
This placeholder mission brief explains the purpose of the repo, the important files, and how a new contributor can start understanding the project.

## How to Run
1. Clone the repository.
2. Install dependencies.
3. Run the development server.
4. Open the main file and trace how data moves through the project.

## Suggested Contribution Ideas
- Improve documentation.
- Add comments to confusing sections.
- Write beginner-friendly tests.
- Refactor repeated logic.
- Add a small feature related to this file.

## Good First Mission
Open ${repo.fileName}, read through the main functions, and add a short explanation above each major block of logic.
`;

    const blob = new Blob([markdown], {
      type: "text/markdown",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${repo.name.replaceAll(" ", "_")}_MISSION_BRIEF.md`;
    link.click();

    URL.revokeObjectURL(url);

    this.updateStatus(
      `<strong>${repo.fileName}</strong> opened. Mission Brief.md has been generated and downloaded.`
    );

    this.setResultBox(`
      <div class="result-card">
        <h3>${repo.name}</h3>
        <p>
          Generated a placeholder Mission Brief for <strong>${repo.fileName}</strong>.
          Later this can call your backend AI agent instead of creating a static file.
        </p>
      </div>
    `);
  }

  switchToAerial(resetText = true) {
    this.mode = "aerial";

    this.createMap("aerialMap");
    this.showBackButton(false);

    if (resetText) {
      this.updateStatus(
        "Back on the aerial map. Search <strong>python</strong>, <strong>javascript</strong>, or <strong>C</strong> to reveal a district pin."
      );

      this.setResultBox("");
    }
  }

  resetView() {
    if (!this.mapLayer) return;

    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;

    this.currentZoom = 1;
    this.tiltY = 1;

    this.mapLayer.setPosition(screenWidth / 2, screenHeight / 2);
    this.mapLayer.setRotation(0);
    this.applyMapScale();

    this.hideEntryLabel();
  }

  clearPins() {
    this.activePinGroups.forEach((group) => {
      group.destroy(true);
    });

    this.activePinGroups = [];
  }

  showEntryLabel(text) {
    this.hideEntryLabel();

    this.entryLabel = this.add
      .text(this.scale.width / 2, this.scale.height - 90, text, {
        fontFamily: "Arial",
        fontSize: "26px",
        color: "#ffffff",
        fontStyle: "bold",
        backgroundColor: "rgba(15, 23, 42, 0.82)",
        padding: {
          x: 22,
          y: 14,
        },
      })
      .setOrigin(0.5)
      .setDepth(5000);

    this.time.delayedCall(1800, () => {
      this.hideEntryLabel();
    });
  }

  hideEntryLabel() {
    if (this.entryLabel) {
      this.entryLabel.destroy();
      this.entryLabel = null;
    }
  }

  updateStatus(message) {
    const statusBox = document.getElementById("statusBox");

    if (statusBox) {
      statusBox.innerHTML = message;
    }
  }

  setResultBox(html) {
    const resultBox = document.getElementById("resultBox");

    if (resultBox) {
      resultBox.innerHTML = html;
    }
  }

  showBackButton(show) {
    const backButton = document.getElementById("backButton");

    if (!backButton) return;

    if (show) {
      backButton.classList.remove("hidden");
    } else {
      backButton.classList.add("hidden");
    }
  }

  injectDashboardMinimizeStyles() {
    const existingStyle = document.getElementById("dashboard-minimize-styles");

    if (existingStyle) return;

    const style = document.createElement("style");
    style.id = "dashboard-minimize-styles";
    style.innerHTML = `
      .dashboard-minimize-button {
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 9999;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.88);
        color: white;
        font-weight: 800;
        font-size: 14px;
        padding: 10px 14px;
        cursor: pointer;
        backdrop-filter: blur(12px);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      }

      .dashboard-minimize-button:hover {
        background: rgba(30, 41, 59, 0.95);
      }

      body.dashboard-collapsed .dashboard,
      body.dashboard-collapsed .panel,
      body.dashboard-collapsed .sidebar,
      body.dashboard-collapsed .control-panel,
      body.dashboard-collapsed .dashboard-panel,
      body.dashboard-collapsed #dashboard,
      body.dashboard-collapsed #sidePanel {
        opacity: 0;
        pointer-events: none;
        transform: translateX(110%);
        transition: 180ms ease;
      }
    `;

    document.head.appendChild(style);
  }

  createDashboardMinimizeButton() {
    const existingButton = document.getElementById("dashboardMinimizeButton");

    if (existingButton) return;

    const button = document.createElement("button");
    button.id = "dashboardMinimizeButton";
    button.className = "dashboard-minimize-button";
    button.textContent = "Hide Dashboard";

    button.addEventListener("click", () => {
      document.body.classList.toggle("dashboard-collapsed");

      if (document.body.classList.contains("dashboard-collapsed")) {
        button.textContent = "Show Dashboard";
      } else {
        button.textContent = "Hide Dashboard";
      }
    });

    document.body.appendChild(button);
  }
}

const config = {
  type: Phaser.AUTO,
  parent: "app",
  width: window.innerWidth,
  height: window.innerHeight,

  backgroundColor: WATER_BLUE,

  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  scene: [GitHubAtlasScene],
};

new Phaser.Game(config);