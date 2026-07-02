(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const gameOverScreen = document.getElementById("game-over-screen");
  const finalScoreEl = document.getElementById("final-score");
  const gameOverTitle = document.getElementById("game-over-title");
  const restartButton = document.getElementById("restart-button");
  const touchUp = document.getElementById("touch-up");
  const touchDown = document.getElementById("touch-down");

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  const WHITE = "#f2f2f2";
  const BLACK = "#000000";

  const GROUND_Y = HEIGHT - 30;
  const SKY_TOP = 20;

  const DRONE_X = 68; // fixed horizontal position; the world scrolls past it
  const DRONE_SPEED = 170; // px/sec, vertical
  const DRONE_PIXEL = 2;

  const PILOT_PIXEL = 3;
  const PILOT_X = 6; // static, bottom-left corner

  const BASE_SCROLL_SPEED = 90; // px/sec
  const MAX_SCROLL_SPEED = 280;
  const SCROLL_ACCEL = 2.2; // px/sec added per second survived

  const BASE_SPAWN_INTERVAL = 1150; // ms
  const MIN_SPAWN_INTERVAL = 550;

  const TREE_TRUNK_WIDTH = 8;
  const TREE_PIXEL = 4;

  const EAGLE_MIN_INTERVAL = 3200; // ms
  const EAGLE_MAX_INTERVAL = 7500; // ms
  const EAGLE_SPEED = 150; // px/sec, horizontal
  const EAGLE_BOB_AMPLITUDE = 45; // px
  const EAGLE_BOB_FREQUENCY = 2.4; // radians/sec
  const EAGLE_PIXEL = 2;

  const BEST_SCORE_KEY = "droneGameBestScore";

  // Pixel-art sprites: each row is a string, "X" = filled pixel. Rows may
  // vary in length; the renderer only draws the characters present.
  // Side-view drone: rotor blur bar on top, boxy body, legs below.
  const DRONE_FRAMES = [
    [
      "..XXXXXXXXXX....",
      "....X......X....",
      ".XXXXXXXXXXXXXX.",
      "X..............X",
      "X..............X",
      "X..............X",
      ".XXXXXXXXXXXXXX.",
      "...X........X...",
      "...X........X...",
      "..X..........X..",
    ],
    [
      ".X.X.X.X.X.X.X..",
      "....X......X....",
      ".XXXXXXXXXXXXXX.",
      "X..............X",
      "X..............X",
      "X..............X",
      ".XXXXXXXXXXXXXX.",
      "...X........X...",
      "...X........X...",
      "..X..........X..",
    ],
  ];

  // Simplified side-view bird: a plain body silhouette with a beak, and a
  // single wing that toggles between frames to read as a flap.
  const EAGLE_FRAMES = [
    [
      "....XXX.........",
      "...XXXXX........",
      "XX.XXXXXXXXXXXX.",
      "XXXXXXXXXXXXXXX.",
      ".XXXXXXXXXXXXX..",
      "....X.......X...",
    ],
    [
      ".................",
      "...XXX...........",
      "XX.XXXXXXXXXXXX.",
      "XXXXXXXXXXXXXXX.",
      ".XXXXXXXXXXXXX..",
      "....X.......X...",
    ],
  ];

  // Static pilot: ponytail + head, arm extended holding a remote, dress
  // silhouette, legs. Drawn at a fixed screen position, never scrolls.
  const PILOT_FRAME = [
    "...XXXX.....",
    "..XXXXXX....",
    "..XXXXXX....",
    "XXXXXXXXX....",
    ".XXXXXXX....",
    "..XXXXXXXXXXXX",
    "..XXXXXX..XXX",
    "..XXXXXX..XXX",
    "..XXXXXX.....",
    "..XXXXXX.....",
    ".XXXXXXXX....",
    "XXXXXXXXXX....",
    "XXXXXXXXXX....",
    "..XX..XX.....",
    "..XX..XX.....",
    "..XX..XX.....",
    ".XXX..XXX....",
  ];

  function spriteWidth(frame, pixelSize) {
    return Math.max(...frame.map((row) => row.length)) * pixelSize;
  }
  function spriteHeight(frame, pixelSize) {
    return frame.length * pixelSize;
  }

  const DRONE_WIDTH = spriteWidth(DRONE_FRAMES[0], DRONE_PIXEL);
  const DRONE_HEIGHT = spriteHeight(DRONE_FRAMES[0], DRONE_PIXEL);
  const EAGLE_WIDTH = spriteWidth(EAGLE_FRAMES[0], EAGLE_PIXEL);
  const EAGLE_HEIGHT = spriteHeight(EAGLE_FRAMES[0], EAGLE_PIXEL);
  const PILOT_HEIGHT = spriteHeight(PILOT_FRAME, PILOT_PIXEL);

  function drawPixelSprite(frame, x, y, pixelSize, color) {
    ctx.fillStyle = color;
    for (let row = 0; row < frame.length; row++) {
      const line = frame[row];
      for (let col = 0; col < line.length; col++) {
        if (line[col] === "X") {
          ctx.fillRect(
            Math.round(x + col * pixelSize),
            Math.round(y + row * pixelSize),
            pixelSize,
            pixelSize
          );
        }
      }
    }
  }

  function drawPixelCircle(cx, cy, radius, pixelSize, color) {
    ctx.fillStyle = color;
    const steps = Math.round(radius / pixelSize);
    for (let dy = -steps; dy <= steps; dy++) {
      for (let dx = -steps; dx <= steps; dx++) {
        if (dx * dx + dy * dy <= steps * steps) {
          ctx.fillRect(
            Math.round(cx + dx * pixelSize - pixelSize / 2),
            Math.round(cy + dy * pixelSize - pixelSize / 2),
            pixelSize,
            pixelSize
          );
        }
      }
    }
  }

  function drawTree(tree) {
    const trunkX = tree.x - TREE_TRUNK_WIDTH / 2;
    const trunkY = GROUND_Y - tree.trunkHeight;
    ctx.fillStyle = WHITE;
    ctx.fillRect(
      Math.round(trunkX),
      Math.round(trunkY),
      TREE_TRUNK_WIDTH,
      tree.trunkHeight + 4 // slight overlap into the ground line
    );
    const canopyCy = trunkY - tree.canopyRadius * 0.4;
    drawPixelCircle(tree.x, canopyCy, tree.canopyRadius, TREE_PIXEL, WHITE);
  }

  function circleRectOverlap(cx, cy, r, rect) {
    const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= r * r;
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  let state = "playing"; // "playing" | "gameover"
  let droneY = HEIGHT / 2;
  let moveUp = false;
  let moveDown = false;

  let trees = [];
  let eagle = null;
  let scrollSpeed = BASE_SCROLL_SPEED;
  let spawnTimer = 0;
  let eagleTimer = 3000;
  let elapsed = 0; // seconds survived
  let score = 0;
  let bestScore = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
  let animTimer = 0;
  let animFrame = 0;
  let lastHitBy = null;

  let scrollTickOffset = 0;

  bestEl.textContent = `Best: ${bestScore}`;

  function resetGame() {
    droneY = HEIGHT / 2;
    trees = [];
    eagle = null;
    scrollSpeed = BASE_SCROLL_SPEED;
    spawnTimer = 0;
    eagleTimer = 3000;
    elapsed = 0;
    score = 0;
    scrollTickOffset = 0;
    lastHitBy = null;
    state = "playing";
    gameOverScreen.classList.add("hidden");
  }

  function spawnTree() {
    const trunkHeight = 30 + Math.random() * 130;
    const canopyRadius = 14 + Math.random() * 12;
    trees.push({ x: WIDTH + canopyRadius, trunkHeight, canopyRadius });
  }

  function spawnEagle() {
    const baseY = SKY_TOP + 20 + Math.random() * (GROUND_Y - SKY_TOP - 100);
    eagle = {
      x: WIDTH + EAGLE_WIDTH,
      baseY,
      age: 0,
      width: EAGLE_WIDTH,
      height: EAGLE_HEIGHT,
    };
  }

  function update(dt) {
    if (state !== "playing") return;

    // Vertical movement
    if (moveUp) droneY -= DRONE_SPEED * dt;
    if (moveDown) droneY += DRONE_SPEED * dt;
    droneY = Math.max(
      SKY_TOP,
      Math.min(GROUND_Y - DRONE_HEIGHT / 2, droneY)
    );

    // Difficulty ramp
    elapsed += dt;
    scrollSpeed = Math.min(
      MAX_SCROLL_SPEED,
      BASE_SCROLL_SPEED + elapsed * SCROLL_ACCEL
    );

    // Motion ticks along the ground
    scrollTickOffset = (scrollTickOffset + scrollSpeed * dt) % 28;

    // Rotor / wing flap animation
    animTimer += dt;
    if (animTimer > 0.09) {
      animTimer = 0;
      animFrame = 1 - animFrame;
    }

    // Spawn trees
    spawnTimer -= dt * 1000;
    if (spawnTimer <= 0) {
      spawnTree();
      const interval = Math.max(
        MIN_SPAWN_INTERVAL,
        BASE_SPAWN_INTERVAL - elapsed * 15
      );
      spawnTimer = interval;
    }

    // Spawn eagle (only one active at a time)
    if (!eagle) {
      eagleTimer -= dt * 1000;
      if (eagleTimer <= 0) {
        spawnEagle();
        const interval = Math.max(
          EAGLE_MIN_INTERVAL,
          EAGLE_MAX_INTERVAL - elapsed * 60
        );
        eagleTimer = interval;
      }
    }

    const droneRect = {
      x: DRONE_X - DRONE_WIDTH / 2,
      y: droneY - DRONE_HEIGHT / 2,
      width: DRONE_WIDTH,
      height: DRONE_HEIGHT,
    };

    // Move trees, remove offscreen
    for (const tree of trees) {
      tree.x -= scrollSpeed * dt;
    }
    trees = trees.filter((t) => t.x + t.canopyRadius > 0);

    // Move eagle: flies leftward while bobbing up and down
    if (eagle) {
      eagle.age += dt;
      eagle.x -= EAGLE_SPEED * dt;
      eagle.y =
        eagle.baseY +
        Math.sin(eagle.age * EAGLE_BOB_FREQUENCY) * EAGLE_BOB_AMPLITUDE;
      if (eagle.x + eagle.width < 0) eagle = null;
    }

    // Collisions: trunk (rect) and canopy (circle) per tree
    for (const tree of trees) {
      const trunkRect = {
        x: tree.x - TREE_TRUNK_WIDTH / 2,
        y: GROUND_Y - tree.trunkHeight,
        width: TREE_TRUNK_WIDTH,
        height: tree.trunkHeight,
      };
      const canopyCy = GROUND_Y - tree.trunkHeight - tree.canopyRadius * 0.4;
      if (
        rectsOverlap(droneRect, trunkRect) ||
        circleRectOverlap(tree.x, canopyCy, tree.canopyRadius, droneRect)
      ) {
        lastHitBy = "tree";
        endGame();
        break;
      }
    }
    if (
      state === "playing" &&
      eagle &&
      rectsOverlap(droneRect, {
        x: eagle.x,
        y: eagle.y - eagle.height / 2,
        width: eagle.width,
        height: eagle.height,
      })
    ) {
      lastHitBy = "eagle";
      endGame();
    }

    // Score = distance survived
    score = Math.floor(elapsed * 10);
    scoreEl.textContent = `Score: ${score}`;
  }

  function endGame() {
    state = "gameover";
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
      bestEl.textContent = `Best: ${bestScore}`;
    }
    gameOverTitle.textContent =
      lastHitBy === "eagle" ? "Caught by the eagle!" : "Crashed into a tree!";
    finalScoreEl.textContent = `Score: ${score}`;
    gameOverScreen.classList.remove("hidden");
  }

  function drawBackground() {
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Ground line, scrolling
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, GROUND_Y, WIDTH, 2);
    ctx.fillStyle = "rgba(242,242,242,0.35)";
    for (let x = WIDTH - scrollTickOffset; x > -28; x -= 28) {
      ctx.fillRect(x, GROUND_Y + 6, 10, 3);
    }
  }

  function drawTrees() {
    for (const tree of trees) {
      drawTree(tree);
    }
  }

  function drawEagle() {
    if (!eagle) return;
    drawPixelSprite(
      EAGLE_FRAMES[animFrame],
      eagle.x,
      eagle.y - eagle.height / 2,
      EAGLE_PIXEL,
      WHITE
    );
  }

  function drawDrone() {
    const x = DRONE_X - DRONE_WIDTH / 2;
    const y = droneY - DRONE_HEIGHT / 2;
    drawPixelSprite(DRONE_FRAMES[animFrame], x, y, DRONE_PIXEL, WHITE);
  }

  function drawPilot() {
    const y = GROUND_Y - PILOT_HEIGHT;
    drawPixelSprite(PILOT_FRAME, PILOT_X, y, PILOT_PIXEL, WHITE);
  }

  function draw() {
    drawBackground();
    drawTrees();
    drawEagle();
    drawDrone();
    drawPilot();
  }

  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // Keyboard input
  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowUp" || e.code === "KeyW") moveUp = true;
    if (e.code === "ArrowDown" || e.code === "KeyS") moveDown = true;
    if (e.code === "Space" && state === "gameover") resetGame();
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowUp" || e.code === "KeyW") moveUp = false;
    if (e.code === "ArrowDown" || e.code === "KeyS") moveDown = false;
  });

  // Touch / mouse input for on-screen tap zones (top = up, bottom = down)
  function bindZone(el, onStart, onEnd) {
    el.addEventListener("touchstart", (e) => {
      e.preventDefault();
      onStart();
    });
    el.addEventListener("touchend", (e) => {
      e.preventDefault();
      onEnd();
    });
    el.addEventListener("mousedown", onStart);
    el.addEventListener("mouseup", onEnd);
    el.addEventListener("mouseleave", onEnd);
  }

  bindZone(
    touchUp,
    () => (moveUp = true),
    () => (moveUp = false)
  );
  bindZone(
    touchDown,
    () => (moveDown = true),
    () => (moveDown = false)
  );

  document
    .getElementById("touch-controls")
    .addEventListener("touchstart", () => {
      if (state === "gameover") resetGame();
    });

  restartButton.addEventListener("click", resetGame);

  requestAnimationFrame(loop);
})();
