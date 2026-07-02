(() => {
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const gameOverScreen = document.getElementById("game-over-screen");
  const pauseScreen = document.getElementById("pause-screen");
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

  const MARSUPIAL_PIXEL = 2;
  const MARSUPIAL_MIN_INTERVAL = 5000; // ms
  const MARSUPIAL_MAX_INTERVAL = 9000; // ms
  const PHOTO_BONUS = 50;
  const PHOTO_TOLERANCE = 14; // px of extra horizontal leeway for "passing over"

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

  // The bird is drawn procedurally (ellipse body/head + triangle
  // beak/tail/wing) rather than as hand-typed pixel art - see drawBird().
  const EAGLE_WIDTH = 40;
  const EAGLE_HEIGHT = 22;

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

  // Ground-dwelling marsupial: ears, upright body, small forearms, a big
  // hind leg + tail for balance, and a long tapering nose (bandicoot-style).
  // Static, standing on the ground line.
  const MARSUPIAL_FRAME = [
    "......XX....",
    ".....XXXX...",
    "XXXXXXXXXXX.",
    "..XXXXXXXXX.",
    "..XXXXXXXXXX",
    "...XXXXXXXXX",
    "...XX...XX.X",
    "...XX...XX.X",
    "..XXX.XXX...",
  ];

  function spriteWidth(frame, pixelSize) {
    return Math.max(...frame.map((row) => row.length)) * pixelSize;
  }
  function spriteHeight(frame, pixelSize) {
    return frame.length * pixelSize;
  }

  const DRONE_WIDTH = spriteWidth(DRONE_FRAMES[0], DRONE_PIXEL);
  const DRONE_HEIGHT = spriteHeight(DRONE_FRAMES[0], DRONE_PIXEL);
  const PILOT_WIDTH = spriteWidth(PILOT_FRAME, PILOT_PIXEL);
  const PILOT_HEIGHT = spriteHeight(PILOT_FRAME, PILOT_PIXEL);
  const MARSUPIAL_WIDTH = spriteWidth(MARSUPIAL_FRAME, MARSUPIAL_PIXEL);
  const MARSUPIAL_HEIGHT = spriteHeight(MARSUPIAL_FRAME, MARSUPIAL_PIXEL);

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

  function drawPixelEllipse(cx, cy, rx, ry, pixelSize, color) {
    ctx.fillStyle = color;
    const stepsX = Math.max(1, Math.round(rx / pixelSize));
    const stepsY = Math.max(1, Math.round(ry / pixelSize));
    for (let dy = -stepsY; dy <= stepsY; dy++) {
      for (let dx = -stepsX; dx <= stepsX; dx++) {
        if ((dx * dx) / (stepsX * stepsX) + (dy * dy) / (stepsY * stepsY) <= 1) {
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

  function triangleSign(px, py, ax, ay, bx, by) {
    return (px - bx) * (ay - by) - (ax - bx) * (py - by);
  }

  function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
    const d1 = triangleSign(px, py, ax, ay, bx, by);
    const d2 = triangleSign(px, py, bx, by, cx, cy);
    const d3 = triangleSign(px, py, cx, cy, ax, ay);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  function drawPixelTriangle(ax, ay, bx, by, cx, cy, pixelSize, color) {
    ctx.fillStyle = color;
    const minX = Math.min(ax, bx, cx);
    const maxX = Math.max(ax, bx, cx);
    const minY = Math.min(ay, by, cy);
    const maxY = Math.max(ay, by, cy);
    for (let y = minY; y <= maxY; y += pixelSize) {
      for (let x = minX; x <= maxX; x += pixelSize) {
        const px = x + pixelSize / 2;
        const py = y + pixelSize / 2;
        if (pointInTriangle(px, py, ax, ay, bx, by, cx, cy)) {
          ctx.fillRect(Math.round(x), Math.round(y), pixelSize, pixelSize);
        }
      }
    }
  }

  // Side-view bird: round body, round head with a pointed beak facing its
  // direction of travel (left), a tail point at the back, and a triangular
  // wing on its back that swaps between two angles to read as a flap.
  function drawBird(x, y, width, height, wingUp) {
    const bodyCx = x + width * 0.58;
    const bodyCy = y + height * 0.55;
    const bodyRx = width * 0.3;
    const bodyRy = height * 0.32;
    drawPixelEllipse(bodyCx, bodyCy, bodyRx, bodyRy, EAGLE_PIXEL, WHITE);

    const headCx = x + width * 0.22;
    const headCy = y + height * 0.4;
    const headR = height * 0.26;
    drawPixelEllipse(headCx, headCy, headR, headR, EAGLE_PIXEL, WHITE);

    drawPixelTriangle(
      headCx - headR * 0.2,
      headCy - headR * 0.5,
      headCx - headR * 0.2,
      headCy + headR * 0.5,
      x - width * 0.05,
      headCy,
      EAGLE_PIXEL,
      WHITE
    );

    drawPixelTriangle(
      bodyCx + bodyRx * 0.5,
      bodyCy - bodyRy * 0.6,
      bodyCx + bodyRx * 0.5,
      bodyCy + bodyRy * 0.6,
      x + width,
      bodyCy - bodyRy * 0.1,
      EAGLE_PIXEL,
      WHITE
    );

    if (wingUp) {
      drawPixelTriangle(
        bodyCx - bodyRx * 0.5,
        bodyCy - bodyRy * 0.2,
        bodyCx + bodyRx * 0.6,
        bodyCy - bodyRy * 0.1,
        bodyCx,
        y,
        EAGLE_PIXEL,
        WHITE
      );
    } else {
      drawPixelTriangle(
        bodyCx - bodyRx * 0.4,
        bodyCy - bodyRy * 0.1,
        bodyCx + bodyRx * 0.5,
        bodyCy - bodyRy * 0.1,
        bodyCx + bodyRx * 0.1,
        bodyCy - bodyRy * 0.9,
        EAGLE_PIXEL,
        WHITE
      );
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

  let state = "playing"; // "playing" | "paused" | "gameover"
  let droneY = HEIGHT / 2;
  let moveUp = false;
  let moveDown = false;

  let trees = [];
  let eagle = null;
  let marsupials = [];
  let scrollSpeed = BASE_SCROLL_SPEED;
  let spawnTimer = 0;
  let eagleTimer = 3000;
  let marsupialTimer = 1500;
  let rightPressed = false;
  let photoFlashTimer = 0;
  let photoPopup = null;
  let marsupialHintShown = false;
  let marsupialHintTimer = 0;
  let elapsed = 0; // seconds survived
  let score = 0;
  let bonusScore = 0;
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
    marsupials = [];
    scrollSpeed = BASE_SCROLL_SPEED;
    spawnTimer = 0;
    eagleTimer = 3000;
    marsupialTimer = 1500;
    photoFlashTimer = 0;
    photoPopup = null;
    marsupialHintShown = false;
    marsupialHintTimer = 0;
    elapsed = 0;
    score = 0;
    bonusScore = 0;
    scrollTickOffset = 0;
    lastHitBy = null;
    state = "playing";
    gameOverScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");
  }

  function spawnTree() {
    const trunkHeight = 30 + Math.random() * 130;
    const canopyRadius = 14 + Math.random() * 12;
    trees.push({ x: WIDTH + canopyRadius, trunkHeight, canopyRadius });
  }

  function spawnMarsupial() {
    marsupials.push({ x: WIDTH + MARSUPIAL_WIDTH, photographed: false });
    if (!marsupialHintShown) {
      marsupialHintShown = true;
      marsupialHintTimer = 3.5;
    }
  }

  function attemptPhoto() {
    if (state !== "playing") return;
    const droneLeft = DRONE_X - DRONE_WIDTH / 2 - PHOTO_TOLERANCE;
    const droneRight = DRONE_X + DRONE_WIDTH / 2 + PHOTO_TOLERANCE;
    const target = marsupials.find(
      (m) => !m.photographed && droneLeft < m.x + MARSUPIAL_WIDTH && droneRight > m.x
    );
    if (target) {
      target.photographed = true;
      bonusScore += PHOTO_BONUS;
      photoFlashTimer = 0.25;
      photoPopup = { x: target.x, y: GROUND_Y - MARSUPIAL_HEIGHT - 10, timer: 1 };
    }
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

    // Spawn marsupial (only one active at a time)
    if (marsupials.length === 0) {
      marsupialTimer -= dt * 1000;
      if (marsupialTimer <= 0) {
        spawnMarsupial();
        marsupialTimer =
          MARSUPIAL_MIN_INTERVAL +
          Math.random() * (MARSUPIAL_MAX_INTERVAL - MARSUPIAL_MIN_INTERVAL);
      }
    }

    // Move marsupials, remove offscreen
    for (const m of marsupials) {
      m.x -= scrollSpeed * dt;
    }
    marsupials = marsupials.filter((m) => m.x + MARSUPIAL_WIDTH > 0);

    if (photoFlashTimer > 0) photoFlashTimer = Math.max(0, photoFlashTimer - dt);
    if (photoPopup) {
      photoPopup.timer -= dt;
      if (photoPopup.timer <= 0) photoPopup = null;
    }
    if (marsupialHintTimer > 0) marsupialHintTimer = Math.max(0, marsupialHintTimer - dt);

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

    // Score = distance survived + bonus points from photographing wildlife
    score = Math.floor(elapsed * 10) + bonusScore;
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
      lastHitBy === "eagle"
        ? "Oh no - the kite attacked the drone"
        : "Crashed into a tree!";
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

  function drawMarsupials() {
    for (const m of marsupials) {
      drawPixelSprite(
        MARSUPIAL_FRAME,
        m.x,
        GROUND_Y - MARSUPIAL_HEIGHT,
        MARSUPIAL_PIXEL,
        WHITE
      );
    }
  }

  function drawMarsupialHint() {
    if (marsupialHintTimer <= 0) return;
    ctx.fillStyle = WHITE;
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Look a marsupial.", WIDTH / 2, 46);
    ctx.fillText("Take a photo >", WIDTH / 2, 64);
    ctx.textAlign = "left";
  }

  function drawPhotoPopup() {
    if (!photoPopup) return;
    const alpha = Math.min(1, photoPopup.timer);
    const riseY = photoPopup.y - (1 - alpha) * 20;
    ctx.fillStyle = `rgba(242, 242, 242, ${alpha})`;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("+50 PHOTO!", photoPopup.x + MARSUPIAL_WIDTH / 2, riseY);
    ctx.textAlign = "left";
  }

  function drawPhotoFlash() {
    if (photoFlashTimer <= 0) return;
    const alpha = (photoFlashTimer / 0.25) * 0.6;
    ctx.fillStyle = `rgba(242, 242, 242, ${alpha})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawEagle() {
    if (!eagle) return;
    drawBird(
      eagle.x,
      eagle.y - eagle.height / 2,
      eagle.width,
      eagle.height,
      animFrame === 0
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
    drawMarsupials();
    drawTrees();
    drawEagle();
    drawDrone();
    drawPilot();
    drawPhotoPopup();
    drawPhotoFlash();
    drawMarsupialHint();
  }

  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      pauseScreen.classList.remove("hidden");
    } else if (state === "paused") {
      state = "playing";
      pauseScreen.classList.add("hidden");
    }
  }

  // Keyboard input
  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowUp" || e.code === "KeyW") moveUp = true;
    if (e.code === "ArrowDown" || e.code === "KeyS") moveDown = true;
    if (e.code === "ArrowRight" && !rightPressed) {
      rightPressed = true;
      attemptPhoto();
    }
    if (e.code === "Space") {
      e.preventDefault();
      if (state === "gameover") resetGame();
      else togglePause();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowUp" || e.code === "KeyW") moveUp = false;
    if (e.code === "ArrowDown" || e.code === "KeyS") moveDown = false;
    if (e.code === "ArrowRight") rightPressed = false;
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
