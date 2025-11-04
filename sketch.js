
let capture;
let previousFrame;
let grainBuffer;

// --- Painterly Background Globals ---
let paintLayer; // The off-screen canvas for the background painting
let blueBrushes = []; // Brushes for the background
let splashes = []; // For motion-triggered orange splashes
let backgroundColoar, splashColor; // To hold the specific colors

// --- Interactivity Globals ---
let presenceButton;
let isHoldingButton = false;
let holdStartTime = 0;
let font;
let textPoints = [];
let textAnimation = { isAnimating: false, startTime: 0, duration: 3000 };
let textGlowBuffer;

// --- FONT SELECTION ---
const FONT_PATH = 'Montserrat-Thin.ttf';

// --- SENSITIVITY CONTROL ---
const sensitivity = 0.7;

// --- PERFORMANCE CONTROLS ---
const MOTION_DETECT_STEP = 4;

// --- PAINTERLY BACKGROUND CONTROLS ---
const NUM_BLUE_BRUSHES = 4;
const BRUSH_SPEED = 0.0005;
const BRUSH_STROKE_DENSITY = 15;
const BRUSH_STROKE_RADIUS = 60;
const BACKGROUND_DECAY_ALPHA = 0.05; // NEW: Low value for slow decay, letting old strokes fade over ~120s.
const BRUSH_TRAVEL_MARGIN = 0.2; // NEW: Allows brushes to travel 20% outside the canvas for better coverage.

// --- SPLASH STYLE CONTROLS ---
const splashStyles = ['BURST', 'FLOWER'];
// Style 1: BURST (Classic explosion)
const BURST_PARTICLE_COUNT = 30;
const BURST_MIN_SPEED = 1,
  BURST_MAX_SPEED = 5;
// Style 2: FLOWER (5-petal burst)
const FLOWER_PARTICLE_COUNT = 100;
const FLOWER_PETAL_COUNT = 5;
const FLOWER_MIN_SPEED = 1,
  FLOWER_MAX_SPEED = 5;
const FLOWER_PETAL_SPREAD = 0.5; // In radians, the width of each petal

// --- BUTTON CONTROL ---
const BUTTON_VISIBILITY_TIMEOUT = 12000,
  BUTTON_SIZE = 80,
  BUTTON_FADE_SPEED = 0.05,
  MAX_HOLD_TIME = 3000;
const BUTTON_COOLDOWN_DURATION = 4000,
  BUTTON_GROW_SPEED = 0.2,
  BUTTON_GROW_FACTOR = 1.5;
const BUTTON_DRAW_SPEED = 0.04,
  BUTTON_STROKE_WEIGHT = 3;

// --- TEXT & MESSAGE CONTROL ---
const MESSAGES = ["Life is beautiful", "Dream bigger", "Stay curious", "Create your sunshine", "The future is bright", "Embrace the journey", "Choose joy", "Be present", "You are enough", "Invent your world"];
const TEXT_FONT_SIZE = 96,
  TEXT_OPACITY = 90,
  TEXT_BREATHING_MIN_SIZE = 6,
  TEXT_BREATHING_MAX_SIZE = 10;
const TEXT_BREATHING_SPEED = 0.002,
  TEXT_ANIM_MIN_DURATION = 1500,
  TEXT_ANIM_MAX_DURATION = 4000,
  TEXT_GLOW_BLUR = 4;

// --- VISUAL EFFECTS ---
const GRAIN_AMOUNT = 0.1;

// --- Internal Tuning Parameters ---
let motionSensitivityThreshold, activationThreshold;
let motionEnergy = 0,
  lastMotionTriggerTime = 0;
const MOTION_TRIGGER_COOLDOWN = 1000;

function preload() {
  font = loadFont(FONT_PATH);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);

  motionSensitivityThreshold = map(sensitivity, 0, 1, 20, 70);
  activationThreshold = map(sensitivity, 0, 1, 50, 250);

  let constraints = {
    video: {
      width: {
        ideal: 160
      },
      height: {
        ideal: 120
      }
    }
  };
  capture = createCapture(constraints);
  capture.hide();

  previousFrame = createGraphics(capture.width, capture.height);
  previousFrame.pixelDensity(1);

  setupGraphics();
  setupButton();
  textFont(font);
}

function setupGraphics() {
  paintLayer = createGraphics(width, height);
  paintLayer.colorMode(HSB, 360, 100, 100, 100);

  backgroundColor = color('#F7F2EE');
  splashColor = color('#FF5017');
  const bluePaintColors = [color('#CBEB6A'), color('#062DEC')];

  blueBrushes = [];
  for (let i = 0; i < NUM_BLUE_BRUSHES; i++) {
    blueBrushes.push({
      pos: createVector(random(width), random(height)),
      noiseSeedX: random(1000),
      noiseSeedY: random(1000),
      color: random(bluePaintColors)
    });
  }

  textGlowBuffer = createGraphics(width, height);
  textGlowBuffer.colorMode(HSB, 360, 100, 100, 100);

  createGrainTexture();
}

function draw() {
  let now = millis();

  let totalMotion = detectMotion();
  if (totalMotion > 10) motionEnergy += totalMotion;
  motionEnergy *= 0.95;

  if (motionEnergy > activationThreshold && now > lastMotionTriggerTime + MOTION_TRIGGER_COOLDOWN) {
    presenceButton.isVisible = true;
    presenceButton.lastActiveTime = now;
    createSplash();
    motionEnergy = 0;
    lastMotionTriggerTime = now;
  }

  // --- Apply a slow decay to the paint layer to allow for new forms ---
  paintLayer.noStroke();
  paintLayer.fill(hue(backgroundColor), saturation(backgroundColor), brightness(backgroundColor), BACKGROUND_DECAY_ALPHA);
  paintLayer.rect(0, 0, width, height);

  updateAndDrawBackgroundBrushes(paintLayer);
  updateAndDrawSplashes(paintLayer);

  background(backgroundColor);
  image(paintLayer, 0, 0);

  updateButton();
  drawButton();
  updateAndDrawText();
  applyGrain();

  splashes = splashes.filter(s => !s.isDead());
}

// ---- PAINTERLY BACKGROUND LOGIC ----
function updateAndDrawBackgroundBrushes(pg) {
  let time = millis() * BRUSH_SPEED;
  const marginX = width * BRUSH_TRAVEL_MARGIN;
  const marginY = height * BRUSH_TRAVEL_MARGIN;

  for (const brush of blueBrushes) {
    // Map noise to a wider area to ensure full canvas coverage
    brush.pos.x = map(noise(brush.noiseSeedX + time), 0, 1, -marginX, width + marginX);
    brush.pos.y = map(noise(brush.noiseSeedY + time), 0, 1, -marginY, height + marginY);

    pg.noStroke();
    pg.fill(hue(brush.color), saturation(brush.color), brightness(brush.color), 5);
    for (let i = 0; i < BRUSH_STROKE_DENSITY; i++) {
      const angle = random(TWO_PI);
      const radius = random(BRUSH_STROKE_RADIUS);
      const x = brush.pos.x + cos(angle) * radius;
      const y = brush.pos.y + sin(angle) * radius;
      pg.circle(x, y, random(2, 6));
    }
  }
}

// ---- DYNAMIC SPLASH LOGIC ----

// Master function to choose and create a splash style
function createSplash() {
  const style = random(splashStyles);
  let newSplash;

  switch (style) {
    case 'BURST':
      newSplash = createBurstSplash();
      break;
    case 'FLOWER':
      newSplash = createFlowerSplash();
      break;
    default:
      newSplash = createBurstSplash();
  }
  splashes.push(newSplash);
}

// Splash Style Creation Functions
function createBurstSplash() {
  const splash = {
    pos: createVector(random(width), random(height)),
    particles: [],
    style: 'BURST',
    isDead: function() {
      return this.particles.length > 0 && this.particles.every(p => p.lifespan <= 0);
    }
  };
  for (let i = 0; i < BURST_PARTICLE_COUNT; i++) {
    splash.particles.push({
      pos: splash.pos.copy(),
      vel: p5.Vector.random2D().mult(random(BURST_MIN_SPEED, BURST_MAX_SPEED)),
      lifespan: random(60, 120),
      maxLifespan: 120
    });
  }
  return splash;
}

function createFlowerSplash() {
  const splash = {
    pos: createVector(random(width * 0.2, width * 0.8), random(height * 0.2, height * 0.8)),
    particles: [],
    style: 'FLOWER',
    isDead: function() {
      return this.particles.length > 0 && this.particles.every(p => p.lifespan <= 0);
    }
  };
  const angleStep = TWO_PI / FLOWER_PETAL_COUNT;
  for (let i = 0; i < FLOWER_PARTICLE_COUNT; i++) {
    const petalIndex = i % FLOWER_PETAL_COUNT;
    const centerAngle = petalIndex * angleStep;

    const angle = centerAngle + random(-FLOWER_PETAL_SPREAD, FLOWER_PETAL_SPREAD);

    // Make particles in the center of the petal faster
    const distFromCenter = abs(angle - centerAngle);
    const speedMultiplier = map(distFromCenter, 0, FLOWER_PETAL_SPREAD, 1, 0.4);
    const speed = random(FLOWER_MIN_SPEED, FLOWER_MAX_SPEED) * speedMultiplier;

    splash.particles.push({
      pos: splash.pos.copy(),
      vel: p5.Vector.fromAngle(angle).mult(speed),
      lifespan: random(80, 140),
      maxLifespan: 140
    });
  }
  return splash;
}


// Universal update and draw function for all splash styles
function updateAndDrawSplashes(pg) {
  for (const splash of splashes) {
    for (const p of splash.particles) {
      if (p.lifespan > 0) {

        // --- COMMON PHYSICS & DRAWING ---
        p.pos.add(p.vel);
        p.vel.mult(0.97); // Friction
        p.lifespan--;

        const alpha = map(p.lifespan, 0, p.maxLifespan, 0, 15);
        pg.noStroke();
        pg.fill(hue(splashColor), saturation(splashColor), brightness(splashColor), alpha);
        pg.circle(p.pos.x, p.pos.y, random(3, 8));
      }
    }
  }
}

// --- MOUSE AND TOUCH INPUT ---
function mousePressed() {
  handlePress();
}

function mouseReleased() {
  handleRelease();
}

function touchStarted() {
  handlePress();
  return false;
}

function touchEnded() {
  handleRelease();
  return false;
}

function handlePress() {
  if (presenceButton.isVisible && !isHoldingButton && !presenceButton.isOnCooldown && presenceButton.isFullyDrawn) {
    let d = dist(mouseX, mouseY, presenceButton.pos.x, presenceButton.pos.y);
    if (d < presenceButton.currentSize / 2) {
      isHoldingButton = true;
      holdStartTime = millis();
      textPoints = [];
      textAnimation.isAnimating = false;
    }
  }
}

function handleRelease() {
  if (isHoldingButton) {
    isHoldingButton = false;
    let holdDuration = min(millis() - holdStartTime, MAX_HOLD_TIME);
    startTextAnimation(holdDuration);
    presenceButton.isOnCooldown = true;
    presenceButton.cooldownStartTime = millis();
  }
}

// ---- TEXT ANIMATION FUNCTIONS ----
function startTextAnimation(holdDuration) {
  const currentMessage = random(MESSAGES);
  const bounds = font.textBounds(currentMessage, 0, 0, TEXT_FONT_SIZE);
  const x = width / 2 - bounds.w / 2,
    y = height / 3 + bounds.h / 2;
  textPoints = font.textToPoints(currentMessage, x, y, TEXT_FONT_SIZE, {
    sampleFactor: 0.1,
    simplifyThreshold: 0
  });
  textAnimation.duration = map(holdDuration, 0, MAX_HOLD_TIME, TEXT_ANIM_MIN_DURATION, TEXT_ANIM_MAX_DURATION);
  textAnimation.startTime = millis();
  textAnimation.isAnimating = true;
}

function updateAndDrawText() {
  if (textPoints.length === 0) return;
  textGlowBuffer.clear();
  let progress = 1.0;
  if (textAnimation.isAnimating) {
    progress = constrain((millis() - textAnimation.startTime) / textAnimation.duration, 0, 1);
    if (progress >= 1) textAnimation.isAnimating = false;
  }
  const pointsToDraw = floor(progress * textPoints.length);
  const time = millis() * TEXT_BREATHING_SPEED;
  textGlowBuffer.noStroke();
  textGlowBuffer.fill(0, 0, 0, TEXT_OPACITY);
  for (let i = 0; i < pointsToDraw; i++) {
    const p = textPoints[i];
    if (i > 0) {
      const prev = textPoints[i - 1];
      if (dist(prev.x, prev.y, p.x, p.y) > TEXT_FONT_SIZE * 0.5) continue;
    }
    const noiseValue = noise(i * 0.1, time);
    const currentDotSize = map(noiseValue, 0, 1, TEXT_BREATHING_MIN_SIZE, TEXT_BREATHING_MAX_SIZE);
    textGlowBuffer.circle(p.x, p.y, currentDotSize);
  }
  push();
  drawingContext.filter = `blur(${TEXT_GLOW_BLUR}px)`;
  image(textGlowBuffer, 0, 0);
  drawingContext.filter = 'none';
  image(textGlowBuffer, 0, 0);
  pop();
}

// ---- PRESENCE BUTTON FUNCTIONS ----
function setupButton() {
  presenceButton = {
    pos: createVector(width / 2, height * 3 / 4),
    size: BUTTON_SIZE,
    isVisible: false,
    lastActiveTime: 0,
    currentAlpha: 0,
    targetAlpha: 0,
    currentSize: BUTTON_SIZE,
    targetSize: BUTTON_SIZE,
    isOnCooldown: false,
    cooldownStartTime: 0,
    drawProgress: 0,
    isFullyDrawn: false
  };
}

function updateButton() {
  const now = millis();
  if (presenceButton.isOnCooldown && now > presenceButton.cooldownStartTime + BUTTON_COOLDOWN_DURATION) {
    presenceButton.isOnCooldown = false;
  }
  if (isHoldingButton) {
    presenceButton.targetSize = BUTTON_SIZE * BUTTON_GROW_FACTOR;
    presenceButton.targetAlpha = 100;
  } else if (presenceButton.isOnCooldown) {
    presenceButton.targetAlpha = 0;
    presenceButton.targetSize = BUTTON_SIZE;
  } else {
    presenceButton.targetSize = BUTTON_SIZE;
    if (presenceButton.isVisible && now > presenceButton.lastActiveTime + BUTTON_VISIBILITY_TIMEOUT) {
      presenceButton.isVisible = false;
    }
    presenceButton.targetAlpha = presenceButton.isVisible ? 100 : 0;
  }
  presenceButton.currentAlpha = lerp(presenceButton.currentAlpha, presenceButton.targetAlpha, BUTTON_FADE_SPEED);
  presenceButton.currentSize = lerp(presenceButton.currentSize, presenceButton.targetSize, BUTTON_GROW_SPEED);

  if (presenceButton.targetAlpha > 0 && !presenceButton.isFullyDrawn) {
    presenceButton.drawProgress = min(1, presenceButton.drawProgress + BUTTON_DRAW_SPEED);
    if (presenceButton.drawProgress >= 1) presenceButton.isFullyDrawn = true;
  } else if (presenceButton.targetAlpha === 0) {
    presenceButton.drawProgress = 0;
    presenceButton.isFullyDrawn = false;
  }
}

function drawButton() {
  if (presenceButton.currentAlpha < 1) return;
  push();
  let overallAlpha = presenceButton.currentAlpha;

  strokeWeight(BUTTON_STROKE_WEIGHT);
  stroke(0, 0, 0, 80 * (overallAlpha / 100));
  noFill();
  let endAngle = -HALF_PI + presenceButton.drawProgress * TWO_PI;
  arc(presenceButton.pos.x, presenceButton.pos.y, presenceButton.currentSize, presenceButton.currentSize, -HALF_PI, endAngle);

  if (presenceButton.isFullyDrawn) {
    noStroke();
    fill(0, 0, 0, 5 * (overallAlpha / 100));
    circle(presenceButton.pos.x, presenceButton.pos.y, presenceButton.currentSize);
  }
  pop();
}

// ---- OPTIMIZED GRAIN FUNCTION ----
function createGrainTexture() {
  grainBuffer = createGraphics(width, height);
  let numParticles = (width * height / 100) * GRAIN_AMOUNT;
  grainBuffer.strokeWeight(1.5);
  for (let i = 0; i < numParticles; i++) {
    grainBuffer.stroke(0, 0, 0, 15);
    grainBuffer.point(random(width), random(height));
  }
}

function applyGrain() {
  if (GRAIN_AMOUNT <= 0) return;
  push();
  blendMode(MULTIPLY);
  tint(255, 50);
  image(grainBuffer, 0, 0);
  pop();
}

// ---- OPTIMIZED MOTION DETECTION ----
function detectMotion() {
  let motionCount = 0;
  capture.loadPixels();
  if (capture.pixels.length === 0) return 0;

  if (previousFrame.width !== capture.width || previousFrame.height !== capture.height) {
    previousFrame = createGraphics(capture.width, capture.height);
    previousFrame.pixelDensity(1);
  }

  previousFrame.loadPixels();
  if (previousFrame.pixels.length === 0) {
    previousFrame.drawingContext.drawImage(capture.elt, 0, 0, previousFrame.width, previousFrame.height);
    return 0;
  }

  for (let y = 0; y < capture.height; y += MOTION_DETECT_STEP) {
    for (let x = 0; x < capture.width; x += MOTION_DETECT_STEP) {
      const i = (x + y * capture.width) * 4;
      const d = dist(capture.pixels[i], capture.pixels[i + 1], capture.pixels[i + 2],
        previousFrame.pixels[i], previousFrame.pixels[i + 1], previousFrame.pixels[i + 2]);
      if (d > motionSensitivityThreshold) motionCount++;
    }
  }
  previousFrame.drawingContext.drawImage(capture.elt, 0, 0, previousFrame.width, previousFrame.height);
  return motionCount;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  setupGraphics();
  setupButton();
  textPoints = [];
  splashes = [];
  textAnimation.isAnimating = false;
}
