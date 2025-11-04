
let capture;
let previousFrame;
let grainBuffer;
let bgBuffer; // Off-screen buffer for the background gradient
let lightSources = []; // Objects for our moving gradient lights

// --- Interactivity Globals ---
let presenceButton;
let isHoldingButton = false;
let holdStartTime = 0;
let font; 
let textPoints = []; 
let textAnimation = { isAnimating: false, startTime: 0, duration: 3000 };
let textGlowBuffer; 
// buttonGlowBuffer is no longer needed for the new design

// --- FONT SELECTION ---
const FONT_PATH = 'Montserrat-Thin.ttf'; 

// --- SENSITIVITY CONTROL ---
const sensitivity = 0.7; 

// --- PERFORMANCE CONTROLS ---
const MOTION_DETECT_STEP = 4;
const BG_DOWNSCALE_FACTOR = 8; 

// --- GRADIENT BACKGROUND CONTROLS ---
const NUM_LIGHTS = 4;
const LIGHT_SPEED = 0.0002;
const BG_BLUR_AMOUNT = 100;

// --- BUTTON CONTROL ---
const BUTTON_VISIBILITY_TIMEOUT = 12000, BUTTON_SIZE = 80, BUTTON_FADE_SPEED = 0.05, MAX_HOLD_TIME = 3000; 
const BUTTON_COOLDOWN_DURATION = 4000, BUTTON_GROW_SPEED = 0.2, BUTTON_GROW_FACTOR = 1.5;
const BUTTON_DRAW_SPEED = 0.03; // How fast the stroke draws itself (0 to 1)
const BUTTON_STROKE_WEIGHT = 2;

// --- TEXT & MESSAGE CONTROL ---
const MESSAGES = ["Life is beautiful", "Dream bigger", "Stay curious", "Create your sunshine", "The future is bright", "Embrace the journey", "Choose joy", "Be present", "You are enough", "Invent your world"];
const TEXT_FONT_SIZE = 96, TEXT_OPACITY = 90, TEXT_BREATHING_MIN_SIZE = 6, TEXT_BREATHING_MAX_SIZE = 10;
const TEXT_BREATHING_SPEED = 0.002, TEXT_ANIM_MIN_DURATION = 1500, TEXT_ANIM_MAX_DURATION = 4000, TEXT_GLOW_BLUR = 4;

// --- VISUAL EFFECTS ---
const GRAIN_AMOUNT = 0.2;

// --- Internal Tuning Parameters ---
let motionSensitivityThreshold, activationThreshold;
let motionEnergy = 0, lastMotionTriggerTime = 0;
const MOTION_TRIGGER_COOLDOWN = 1000;

function preload() {
  font = loadFont(FONT_PATH);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  
  // --- Motion Detection Setup ---
  motionSensitivityThreshold = map(sensitivity, 0, 1, 20, 70);
  activationThreshold = map(sensitivity, 0, 1, 50, 250);
  capture = createCapture(VIDEO);
  capture.size(160, 120);
  capture.hide();
  previousFrame = createGraphics(capture.width, capture.height);
  previousFrame.pixelDensity(1);

  setupGraphics();
  setupButton();
  textFont(font);
}

function setupGraphics() {
  // --- Background Setup ---
  bgBuffer = createGraphics(width / BG_DOWNSCALE_FACTOR, height / BG_DOWNSCALE_FACTOR);
  bgBuffer.colorMode(HSB, 360, 100, 100, 100);
  bgBuffer.noStroke();
  lightSources = [];
  const colors = [ color(230, 80, 70), color(280, 60, 80), color(190, 70, 90), color(320, 50, 90) ];
  for (let i = 0; i < NUM_LIGHTS; i++) {
    lightSources.push({
      noiseSeedX: random(1000), noiseSeedY: random(1000), color: random(colors),
      radius: random(bgBuffer.width * 0.4, bgBuffer.width * 0.8)
    });
  }

  // --- Interactivity Buffers ---
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
    motionEnergy = 0;
    lastMotionTriggerTime = now;
  }

  // --- MAIN RENDER PIPELINE ---
  background(0);
  drawBackground();
  
  updateButton();
  drawButton();
  
  updateAndDrawText();
  
  applyGrain();
}

// --- MOUSE AND TOUCH INPUT ---
function mousePressed() { handlePress(); }
function mouseReleased() { handleRelease(); }
function touchStarted() { handlePress(); return false; }
function touchEnded() { handleRelease(); return false; }

function handlePress() {
  // Only allow pressing if the button is visible, not on cooldown, and fully drawn.
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

// ---- DYNAMIC GRADIENT BACKGROUND ----
function drawBackground() {
  bgBuffer.background(240, 50, 5);
  let time = millis() * LIGHT_SPEED;
  for(const light of lightSources) {
    let x = noise(light.noiseSeedX + time) * bgBuffer.width;
    let y = noise(light.noiseSeedY + time) * bgBuffer.height;
    bgBuffer.fill(light.color);
    bgBuffer.circle(x, y, light.radius);
  }
  bgBuffer.drawingContext.filter = `blur(${BG_BLUR_AMOUNT / BG_DOWNSCALE_FACTOR}px)`;
  image(bgBuffer, 0, 0, width, height);
}

// ---- TEXT ANIMATION FUNCTIONS ----
function startTextAnimation(holdDuration) {
  const currentMessage = random(MESSAGES);
  const bounds = font.textBounds(currentMessage, 0, 0, TEXT_FONT_SIZE);
  const x = width / 2 - bounds.w / 2, y = height / 3 + bounds.h / 2;
  textPoints = font.textToPoints(currentMessage, x, y, TEXT_FONT_SIZE, { sampleFactor: 0.1, simplifyThreshold: 0 });
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
  textGlowBuffer.noStroke(); textGlowBuffer.fill(0, 0, 100, TEXT_OPACITY); 
  for (let i = 0; i < pointsToDraw; i++) {
    const p = textPoints[i];
    if (i > 0) { const prev = textPoints[i - 1]; if (dist(prev.x, prev.y, p.x, p.y) > TEXT_FONT_SIZE * 0.5) continue; }
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
    pos: createVector(width / 2, height * 3 / 4), size: BUTTON_SIZE, isVisible: false, lastActiveTime: 0,
    currentAlpha: 0, targetAlpha: 0, currentSize: BUTTON_SIZE, targetSize: BUTTON_SIZE,
    isOnCooldown: false, cooldownStartTime: 0,
    drawProgress: 0, isFullyDrawn: false // New properties for animation
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

  // Handle the drawing animation
  if (presenceButton.targetAlpha > 0 && !presenceButton.isFullyDrawn) {
    presenceButton.drawProgress = min(1, presenceButton.drawProgress + BUTTON_DRAW_SPEED);
    if (presenceButton.drawProgress >= 1) {
      presenceButton.isFullyDrawn = true;
    }
  } else if (presenceButton.targetAlpha === 0) {
    // Reset when it fades out
    presenceButton.drawProgress = 0;
    presenceButton.isFullyDrawn = false;
  }
}

function drawButton() {
  if (presenceButton.currentAlpha < 1) return;
  push();
  
  let overallAlpha = presenceButton.currentAlpha;
  
  // 1. Draw the animated stroke
  strokeWeight(BUTTON_STROKE_WEIGHT);
  stroke(0, 0, 100, 80 * (overallAlpha / 100)); // White, 80% base opacity
  noFill();
  
  // arc(x, y, w, h, start, stop)
  let endAngle = -HALF_PI + presenceButton.drawProgress * TWO_PI;
  arc(presenceButton.pos.x, presenceButton.pos.y, presenceButton.currentSize, presenceButton.currentSize, -HALF_PI, endAngle);
  
  // 2. Draw the faint fill only when the stroke is complete
  if (presenceButton.isFullyDrawn) {
    noStroke();
    fill(0, 0, 100, 5 * (overallAlpha / 100)); // White, 5% base opacity
    circle(presenceButton.pos.x, presenceButton.pos.y, presenceButton.currentSize);
  }
  
  pop();
}

// ---- OPTIMIZED GRAIN FUNCTION ----
function createGrainTexture() {
    grainBuffer = createGraphics(width, height);
    let numParticles = (width * height / 100) * GRAIN_AMOUNT;
    let alpha = 25;
    grainBuffer.strokeWeight(1.5);
    for (let i = 0; i < numParticles; i++) {
        let x = random(width); let y = random(height);
        grainBuffer.stroke(0, 0, random() > 0.5 ? 100 : 0, alpha);
        grainBuffer.point(x, y);
    }
}
function applyGrain() {
  if (GRAIN_AMOUNT <= 0) return;
  push();
  blendMode(OVERLAY);
  tint(255, 50);
  image(grainBuffer, 0, 0);
  pop();
}

// ---- OPTIMIZED MOTION DETECTION ----
function detectMotion() {
  let motionCount = 0;
  capture.loadPixels();
  if (capture.pixels.length === 0) return 0;
  previousFrame.loadPixels();
  if (previousFrame.pixels.length === 0) {
      previousFrame.drawingContext.drawImage(capture.elt, 0, 0, previousFrame.width, previousFrame.height);
      return 0;
  }
  for (let y = 0; y < capture.height; y += MOTION_DETECT_STEP) {
    for (let x = 0; x < capture.width; x += MOTION_DETECT_STEP) {
      const i = (x + y * capture.width) * 4;
      const d = dist(capture.pixels[i], capture.pixels[i+1], capture.pixels[i+2], 
                     previousFrame.pixels[i], previousFrame.pixels[i+1], previousFrame.pixels[i+2]);
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
  textAnimation.isAnimating = false;
}
