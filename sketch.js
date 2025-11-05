
let capture;
let previousFrame;
let grainBuffer;

// --- Painterly Background Globals ---
let paintLayer;
let activeEffects = []; 
let backgroundColor;
let strokeColorPalette = [];
let dotBurstColorPalette = [];
let bgBrushes = [];

// --- Global Direction for Swarms ---
let swarmDirection;
let lastDirectionChangeTime = 0;
const DIRECTION_CHANGE_INTERVAL = 30000; 

// --- Interactivity Globals ---
let presenceButton;
let isHoldingButton = false;
let holdStartTime = 0;
let font;
let textPoints = [];
let textAnimation = { isAnimating: false, startTime: 0, duration: 3000 };
let textGlowBuffer;
let textColor; 
let mainSwarmsColor; 

// --- Data from Google Sheet ---
let messagesTable;
let loadedMessages = []; 
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0mNWVCtB6splBEobm2KLRHdwadKP-yenf2by4QBT2CRQtosg4YvMTXwef8CWp3GVmksq3SLfV2GYG/pub?output=csv';

// --- FONT SELECTION ---
const FONT_PATH = 'PlaywriteDKUloopet-Thin.ttf';

// --- SENSITIVITY CONTROL ---
const sensitivity = 0.2;

// --- PERFORMANCE CONTROLS ---
const MOTION_DETECT_STEP = 6;

// --- PAINTERLY BACKGROUND CONTROLS ---
const NUM_BG_BRUSHES = 4;
const BG_BRUSH_SPEED = 0.0005;
const BG_STROKE_DENSITY = 10;
const BG_STROKE_RADIUS = 60;
const BACKGROUND_DECAY_ALPHA = 1;
const BG_BRUSH_TRAVEL_MARGIN = 0.2;

// --- EFFECT CONTROLS ---
const EFFECT_TYPES = ['swarm', 'dotBurst', 'flowerBurst'];
const SWARM_DRAW_DURATION = 1000, SWARM_HOLD_DURATION = 10000, SWARM_FADE_DURATION = 3000;
const SWARM_TOTAL_LIFESPAN = SWARM_DRAW_DURATION + SWARM_HOLD_DURATION + SWARM_FADE_DURATION;
const NUM_STROKES_IN_SWARM = 4, SWARM_SPREAD = 20, STROKE_SEGMENTS = 60;
const STROKE_MIN_WEIGHT = 2, STROKE_MAX_WEIGHT = 16;
const SWARM_MIN_DISTANCE = 150, SWARM_MAX_DISTANCE = 1800;
const BURST_DRAW_DURATION = 500, BURST_HOLD_DURATION = 10000, BURST_FADE_DURATION = 3000;
const BURST_TOTAL_LIFESPAN = BURST_DRAW_DURATION + BURST_HOLD_DURATION + BURST_FADE_DURATION;
const DOT_BURST_COUNT = 25, DOT_BURST_MIN_SPEED = 0.6, DOT_BURST_MAX_SPEED = 5;
const DOT_BURST_MIN_SIZE = 5, DOT_BURST_MAX_SIZE = 15;
const FLOWER_BURST_COUNT = 60, FLOWER_PETAL_COUNT = 5, FLOWER_PETAL_SPREAD = 0.4; 
const FLOWER_BURST_MIN_SPEED = 0.5, FLOWER_BURST_MAX_SPEED = 2.0;
const FLOWER_BURST_MIN_SIZE = 4, FLOWER_BURST_MAX_SIZE = 12;

// --- BUTTON CONTROL ---
const BUTTON_VISIBILITY_TIMEOUT = 12000, BUTTON_SIZE = 60, BUTTON_FADE_SPEED = 0.05, MAX_HOLD_TIME = 3000;
const BUTTON_COOLDOWN_DURATION = 4000, BUTTON_GROW_SPEED = 0.2, BUTTON_GROW_FACTOR = 1.5;
const BUTTON_DRAW_SPEED = 0.04, BUTTON_STROKE_WEIGHT = 1;

// --- TEXT & MESSAGE CONTROL ---
const TEXT_FONT_SIZE = 48, TEXT_OPACITY = 60;
const TEXT_SAMPLE_FACTOR = 0.45;
const TEXT_BREATHING_MIN_SIZE = 2.5;
const TEXT_BREATHING_MAX_SIZE = 4.0;
const TEXT_ANIM_MIN_DURATION = 1500, TEXT_ANIM_MAX_DURATION = 4000;

// --- VISUAL EFFECTS ---
const GRAIN_AMOUNT = 0;

// --- Internal Tuning Parameters ---
let motionSensitivityThreshold, activationThreshold;
let motionEnergy = 0, lastMotionTriggerTime = 0;
const MOTION_TRIGGER_COOLDOWN = 300;


// --- EMBEDDED P5.BRUSH LIBRARY LOGIC ---
(function() {
  p5.prototype.brush = {
    _styles: {}, _current: null, _color: { h: 0, s: 0, v: 0, a: 255 }, _weight: 1,
  };
  p5.prototype.brush.define = function(name, options) { this._styles[name] = options; };
  p5.prototype.brush.set = function(name) {
    if (!this._styles[name]) throw `Brush "${name}" not found!`;
    this._current = this._styles[name];
  };
  p5.prototype.brush.stroke = function(h, s, v, a) {
    let c = this._color;
    if (h instanceof p5.Color) {
      c.h = hue(h); c.s = saturation(h); c.v = brightness(h);
      c.a = s === undefined ? 100 : s; 
    } else { c.h = h; c.s = s; c.v = v; c.a = a; }
  };
  p5.prototype.brush.strokeWeight = function(weight) { this._weight = weight; };
  p5.prototype.brush.line = function(x1, y1, x2, y2, pg) {
    let target = pg || window;
    if (!this._current) return;
    let d = dist(x1, y1, x2, y2); let s = this._current.spacing * this._weight;
    let steps = Math.max(1, Math.round(d / s));
    for (let i = 0; i < steps; i++) {
      let t = i / steps;
      this._drawBrush(lerp(x1, x2, t), lerp(y1, y2, t), this._weight, target);
    }
  };
  p5.prototype.brush._drawBrush = function(x, y, w, target) {
    for (let i = 0; i < this._current.layers.length; i++) {
      let layer = this._current.layers[i];
      if (layer.mode) target.blendMode(layer.mode);
      let c = layer.color || this._color;
      let alpha = this._color.a === undefined ? 100 : this._color.a;
      target.fill(c.h, c.s, c.v, (layer.flow / 100) * alpha);
      target.noStroke();
      for (let j = 0; j < layer.strokes; j++) {
        let sx = x + (randomGaussian() * layer.jitter * w);
        let sy = y + (randomGaussian() * layer.jitter * w);
        let sw = max(0.1, w + (randomGaussian() * layer.scale * w));
        target.circle(sx, sy, sw);
      }
    }
  };
})();
// --- END OF EMBEDDED LIBRARY ---

function preload() {
  font = loadFont(FONT_PATH);
  messagesTable = loadTable(SPREADSHEET_URL, 'csv');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);

  if (messagesTable) {
    for (let r = 0; r < messagesTable.getRowCount(); r++) {
      const msg = messagesTable.getString(r, 0); 
      if (msg && msg.trim() !== '') { 
        loadedMessages.push(msg.trim());
      }
    }
  }
  if (loadedMessages.length === 0) {
    loadedMessages.push("Stay curious"); 
    console.warn("Could not load messages from spreadsheet or it was empty. Using default message.");
  }

  motionSensitivityThreshold = map(sensitivity, 0, 1, 20, 70);
  activationThreshold = map(sensitivity, 0, 1, 50, 250);

  let constraints = { video: { width: { ideal: 160 }, height: { ideal: 120 } } };
  capture = createCapture(constraints);
  capture.hide();

  previousFrame = createGraphics(capture.width, capture.height);
  previousFrame.pixelDensity(1);

  setupGraphics();

  brush.define('performanceStroke', {
    spacing: 0.2, 
    layers: [{ strokes: 10, jitter: 0.05, scale: 0.25, flow: 25 }]
  });
  
  updateSwarmDirection();
  setupButton();
  textFont(font);
}

function setupGraphics() {
  paintLayer = createGraphics(width, height);
  paintLayer.colorMode(HSB, 360, 100, 100, 100);
  
  backgroundColor = color('#F7F2EE');
  
  mainSwarmsColor = color('#FF5017');
  const secondColor = color('#062DEC');
  const otherColors = [
      color(45, 80, 100),
      color(340, 70, 100),
      color(260, 75, 100),
      color(190, 80, 100),
      color(170, 70, 90),
      color(320, 70, 90)
  ];
  
  strokeColorPalette = [];
  for (let i = 0; i < 5; i++) { strokeColorPalette.push(mainSwarmsColor); }
  for (let i = 0; i < 3; i++) { strokeColorPalette.push(secondColor); }
  for (const c of otherColors) { strokeColorPalette.push(c); }

  dotBurstColorPalette = [mainSwarmsColor, secondColor, ...otherColors];
  textColor = color(0, 0, 100); 
  
  const bgPaintColors = [color('#CBEB6A'), color('#062DEC')];
  bgBrushes = [];
  for (let i = 0; i < NUM_BG_BRUSHES; i++) {
    bgBrushes.push({
      pos: createVector(random(width), random(height)),
      noiseSeedX: random(1000), noiseSeedY: random(1000),
      color: bgPaintColors[i % bgPaintColors.length]
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
    
    if (now - lastDirectionChangeTime > DIRECTION_CHANGE_INTERVAL) {
        updateSwarmDirection();
    }
    
    createEffect();
    motionEnergy = 0;
    lastMotionTriggerTime = now;
  }

  paintLayer.noStroke();
  paintLayer.fill(hue(backgroundColor), saturation(backgroundColor), brightness(backgroundColor), BACKGROUND_DECAY_ALPHA);
  paintLayer.rect(0, 0, width, height);
  updateAndDrawBackgroundBrushes(paintLayer);

  background(backgroundColor);
  image(paintLayer, 0, 0);

  updateAndDrawEffects();

  updateButton();
  drawButton();
  updateAndDrawText();
  applyGrain();

  activeEffects = activeEffects.filter(e => !e.isDead());
}

function updateAndDrawBackgroundBrushes(pg) {
  let time = millis() * BG_BRUSH_SPEED;
  for (const brush of bgBrushes) {
    brush.pos.x = map(noise(brush.noiseSeedX + time), 0, 1, -width*BG_BRUSH_TRAVEL_MARGIN, width*(1+BG_BRUSH_TRAVEL_MARGIN));
    brush.pos.y = map(noise(brush.noiseSeedY + time), 0, 1, -height*BG_BRUSH_TRAVEL_MARGIN, height*(1+BG_BRUSH_TRAVEL_MARGIN));
    pg.noStroke();
    pg.fill(hue(brush.color), saturation(brush.color), brightness(brush.color), 5);
    for (let i = 0; i < BG_STROKE_DENSITY; i++) {
      pg.circle(brush.pos.x + random(-BG_STROKE_RADIUS, BG_STROKE_RADIUS), brush.pos.y + random(-BG_STROKE_RADIUS, BG_STROKE_RADIUS), random(2, 6));
    }
  }
}

// ---- EFFECT LOGIC ----

function updateSwarmDirection() {
    swarmDirection = p5.Vector.random2D();
    lastDirectionChangeTime = millis();
}

function createEffect() {
    if (random(1) < 0.7) {
        createStrokeSwarm();
    } else {
        if (random(1) < 0.5) {
            createDotBurst();
        } else {
            createFlowerBurst();
        }
    }
}

function createStrokeSwarm() {
  const swarm = {
    type: 'swarm', strokes: [], buffer: createGraphics(width, height),
    creationTime: millis(), isRendered: false, isMainColorSwarm: false,
    isDead: function() { return millis() > this.creationTime + SWARM_TOTAL_LIFESPAN; }
  };
  swarm.buffer.colorMode(HSB, 360, 100, 100, 100);
  swarm.buffer.noStroke();

  const start = createVector(randomGaussian(width / 2, width / 4), randomGaussian(height / 2, height / 4));
  const travelDistance = random(SWARM_MIN_DISTANCE, SWARM_MAX_DISTANCE);
  const travelVector = swarmDirection.copy().mult(travelDistance);
  const end = p5.Vector.add(start, travelVector);
  const perpDirection = swarmDirection.copy().rotate(HALF_PI);
  const curveAmount = travelDistance * random(0.2, 0.5) * random([-1, 1]);
  const midPoint = p5.Vector.lerp(start, end, 0.5);
  const cp1 = p5.Vector.lerp(start, midPoint, 0.5).add(perpDirection.copy().mult(curveAmount));
  const cp2 = p5.Vector.lerp(midPoint, end, 0.5).add(perpDirection.copy().mult(curveAmount));

  for (let i = 0; i < NUM_STROKES_IN_SWARM; i++) {
    const path = []; const weights = [];
    const offsetNoiseSeed = random(3000);
    const lengthMultiplier = random(0.6, 1.0);
    const strokeColor = random(strokeColorPalette);
    if (strokeColor === mainSwarmsColor) { swarm.isMainColorSwarm = true; }

    for (let t = 0; t <= 1; t += 1/STROKE_SEGMENTS) {
      const leaderX = bezierPoint(start.x, cp1.x, cp2.x, end.x, t);
      const leaderY = bezierPoint(start.y, cp1.y, cp2.y, end.y, t);
      const tx = bezierTangent(start.x, cp1.x, cp2.x, end.x, t);
      const ty = bezierTangent(start.y, cp1.y, cp2.y, end.y, t);
      const normalAngle = atan2(ty, tx) + HALF_PI;
      const offset = (noise(offsetNoiseSeed + i*10, t*2) - 0.5) * 2 * SWARM_SPREAD;
      path.push(createVector(leaderX + cos(normalAngle)*offset, leaderY + sin(normalAngle)*offset));
      const taperShape = sin(t*PI);
      weights.push(map(taperShape, 0, 1, STROKE_MIN_WEIGHT, STROKE_MAX_WEIGHT));
    }
    swarm.strokes.push({ path: path, weights: weights, color: strokeColor, lengthMultiplier: lengthMultiplier });
  }
  activeEffects.push(swarm);
}

function createDotBurst() {
    const burst = {
        type: 'dotBurst', particles: [], buffer: createGraphics(width, height),
        creationTime: millis(), isRendered: false, isMainColorSwarm: false,
        isDead: function() { return millis() > this.creationTime + BURST_TOTAL_LIFESPAN; }
    };
    burst.buffer.colorMode(HSB, 360, 100, 100, 100);
    const center = createVector(randomGaussian(width / 2, width / 5), randomGaussian(height / 2, height / 5));
    for (let i = 0; i < DOT_BURST_COUNT; i++) {
        burst.particles.push({
            pos: center.copy(),
            vel: p5.Vector.random2D().mult(random(DOT_BURST_MIN_SPEED, DOT_BURST_MAX_SPEED)),
            size: random(DOT_BURST_MIN_SIZE, DOT_BURST_MAX_SIZE),
            color: random(dotBurstColorPalette)
        });
    }
    activeEffects.push(burst);
}

function createFlowerBurst() {
    const burst = {
        type: 'flowerBurst', particles: [], buffer: createGraphics(width, height),
        creationTime: millis(), isRendered: false, isMainColorSwarm: false,
        isDead: function() { return millis() > this.creationTime + BURST_TOTAL_LIFESPAN; }
    };
    burst.buffer.colorMode(HSB, 360, 100, 100, 100);
    const center = createVector(randomGaussian(width / 2, width / 5), randomGaussian(height / 2, height / 5));
    for (let i = 0; i < FLOWER_BURST_COUNT; i++) {
        const petalIndex = i % FLOWER_PETAL_COUNT;
        const centerAngle = petalIndex * (TWO_PI / FLOWER_PETAL_COUNT);
        const angle = centerAngle + random(-FLOWER_PETAL_SPREAD, FLOWER_PETAL_SPREAD);
        const speed = random(FLOWER_BURST_MIN_SPEED, FLOWER_BURST_MAX_SPEED);
        burst.particles.push({
            pos: center.copy(),
            vel: p5.Vector.fromAngle(angle).mult(speed),
            size: random(FLOWER_BURST_MIN_SIZE, FLOWER_BURST_MAX_SIZE),
            color: random(dotBurstColorPalette)
        });
    }
    activeEffects.push(burst);
}


function updateAndDrawEffects() {
  noStroke();
  activeEffects.sort((a, b) => a.isMainColorSwarm - b.isMainColorSwarm);
  for (const effect of activeEffects) {
    switch(effect.type) {
      case 'swarm': updateAndDrawSwarm(effect); break;
      case 'dotBurst': updateAndDrawDotBurst(effect); break;
      case 'flowerBurst': updateAndDrawDotBurst(effect); break;
    }
  }
  blendMode(BLEND);
}

function updateAndDrawSwarm(swarm) {
    const age = millis() - swarm.creationTime;
    let alpha = 100;
    
    if (age < SWARM_DRAW_DURATION && !swarm.isRendered) {
      let drawProgress = easeOutCubic(age / SWARM_DRAW_DURATION);
      swarm.buffer.clear();
      brush.set('performanceStroke');
      for (const stroke of swarm.strokes) {
        const maxPointsForThisStroke = floor(stroke.path.length * stroke.lengthMultiplier);
        const pointsToDraw = floor(maxPointsForThisStroke * drawProgress);
        if (pointsToDraw < 2) continue;
        const c = stroke.color;
        brush.stroke(hue(c), saturation(c), brightness(c), 100);
        for (let i = 1; i < pointsToDraw; i++) {
          const p1 = stroke.path[i-1]; const p2 = stroke.path[i];
          const avgWeight = (stroke.weights[i-1] + stroke.weights[i]) / 2;
          brush.strokeWeight(avgWeight);
          brush.line(p1.x, p1.y, p2.x, p2.y, swarm.buffer);
        }
      }
      if (drawProgress >= 1.0) { swarm.isRendered = true; }
    }
    
    if (age > SWARM_DRAW_DURATION + SWARM_HOLD_DURATION) {
      alpha = map(age, SWARM_DRAW_DURATION + SWARM_HOLD_DURATION, SWARM_TOTAL_LIFESPAN, 100, 0);
    }
    if (alpha <= 0) return;

    push();
    tint(255, alpha);
    image(swarm.buffer, 0, 0);
    pop();
}

function updateAndDrawDotBurst(burst) {
    const age = millis() - burst.creationTime;
    let alpha = 100;
    
    if (age < BURST_DRAW_DURATION && !burst.isRendered) {
        burst.buffer.clear();
        brush.set('performanceStroke');
        for (let p of burst.particles) {
            let currentPos = p5.Vector.add(p.pos, p5.Vector.mult(p.vel, age * 0.05));
            const c = p.color;
            brush.stroke(hue(c), saturation(c), brightness(c), 100);
            brush.strokeWeight(p.size);
            brush.line(currentPos.x, currentPos.y, currentPos.x, currentPos.y, burst.buffer);
        }
        if (age >= BURST_DRAW_DURATION) { burst.isRendered = true; }
    }

    if (age > BURST_DRAW_DURATION + BURST_HOLD_DURATION) {
        alpha = map(age, BURST_DRAW_DURATION + BURST_HOLD_DURATION, BURST_TOTAL_LIFESPAN, 100, 0);
    }
    if (alpha <= 0) return;

    push();
    tint(255, alpha);
    image(burst.buffer, 0, 0);
    pop();
}

function easeOutCubic(x) { return 1 - pow(1 - x, 3); }

// --- MOUSE AND TOUCH INPUT ---
function mousePressed() { handlePress(); }
function mouseReleased() { handleRelease(); }
function touchStarted() { handlePress(); return false; }
function touchEnded() { handleRelease(); return false; }

function handlePress() {
  if (presenceButton.isVisible && !isHoldingButton && !presenceButton.isOnCooldown && presenceButton.isFullyDrawn) {
    let d = dist(mouseX, mouseY, presenceButton.pos.x, presenceButton.pos.y);
    if (d < presenceButton.currentSize / 2) {
      isHoldingButton = true; holdStartTime = millis(); textPoints = []; textAnimation.isAnimating = false;
    }
  }
}

function handleRelease() {
  if (isHoldingButton) {
    isHoldingButton = false;
    let holdDuration = min(millis() - holdStartTime, MAX_HOLD_TIME);
    startTextAnimation(holdDuration);
    presenceButton.isOnCooldown = true; presenceButton.cooldownStartTime = millis();
  }
}

// ---- TEXT ANIMATION FUNCTIONS ----
function startTextAnimation(holdDuration) {
  const currentMessage = random(loadedMessages);
  
  textPoints = font.textToPoints(currentMessage, 0, 0, TEXT_FONT_SIZE, { 
      sampleFactor: TEXT_SAMPLE_FACTOR, 
      simplifyThreshold: 0 
  });
  
  let minX = Infinity, maxX = -Infinity;
  for(let p of textPoints) {
    if(p.x < minX) minX = p.x;
    if(p.x > maxX) maxX = p.x;
  }
  const textW = maxX - minX;

  const x = width / 2 - textW / 2;
  const y = height / 2 - 30;
  textPoints = font.textToPoints(currentMessage, x, y, TEXT_FONT_SIZE, { 
      sampleFactor: TEXT_SAMPLE_FACTOR, 
      simplifyThreshold: 0 
  });
  
  textAnimation.duration = map(holdDuration, 0, MAX_HOLD_TIME, TEXT_ANIM_MIN_DURATION, TEXT_ANIM_MAX_DURATION);
  textAnimation.startTime = millis(); textAnimation.isAnimating = true;
}

function updateAndDrawText() {
  if (textPoints.length === 0) return;
  textGlowBuffer.clear();
  let progress = 1.0;
  if (textAnimation.isAnimating) {
    progress = constrain((millis()-textAnimation.startTime)/textAnimation.duration, 0, 1);
    if (progress >= 1) textAnimation.isAnimating = false;
  }
  const pointsToDraw = floor(progress * textPoints.length);
  
  textGlowBuffer.noStroke();
  textGlowBuffer.fill(hue(textColor), saturation(textColor), brightness(textColor), TEXT_OPACITY);

  for (let i = 0; i < pointsToDraw; i++) {
    const p = textPoints[i];
    
    textGlowBuffer.push();
    textGlowBuffer.translate(p.x, p.y);
    
    const angle = map(noise(i * 0.05, millis() * 0.0005), 0, 1, -QUARTER_PI, QUARTER_PI);
    textGlowBuffer.rotate(angle);
    
    // SỬA LỖI: Bỏ đi biến không tồn tại
    const noiseValue = noise(i * 0.1, millis() * 0.002);
    const currentDotSize = map(noiseValue, 0, 1, TEXT_BREATHING_MIN_SIZE, TEXT_BREATHING_MAX_SIZE);
    
    textGlowBuffer.ellipse(0, 0, currentDotSize * 1.5, currentDotSize);
    textGlowBuffer.pop();
  }
  
  push();
  blendMode(DIFFERENCE);
  image(textGlowBuffer, 0, 0);
  pop(); 
}

// ---- PRESENCE BUTTON FUNCTIONS ----
function setupButton() {
  presenceButton = {
    pos: createVector(width/2, height*3/4), size: BUTTON_SIZE, isVisible: false, lastActiveTime: 0,
    currentAlpha: 0, targetAlpha: 0, currentSize: BUTTON_SIZE, targetSize: BUTTON_SIZE,
    isOnCooldown: false, cooldownStartTime: 0, drawProgress: 0, isFullyDrawn: false
  };
}

function updateButton() {
  const now = millis();
  if (presenceButton.isOnCooldown && now > presenceButton.cooldownStartTime+BUTTON_COOLDOWN_DURATION) {
    presenceButton.isOnCooldown = false;
  }
  if (isHoldingButton) {
    presenceButton.targetSize = BUTTON_SIZE * BUTTON_GROW_FACTOR; presenceButton.targetAlpha = 100;
  } else if (presenceButton.isOnCooldown) {
    presenceButton.targetAlpha = 0; presenceButton.targetSize = BUTTON_SIZE;
  } else {
    presenceButton.targetSize = BUTTON_SIZE;
    if (presenceButton.isVisible && now > presenceButton.lastActiveTime+BUTTON_VISIBILITY_TIMEOUT) {
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
    presenceButton.drawProgress = 0; presenceButton.isFullyDrawn = false;
  }
}

function drawButton() {
  if (presenceButton.currentAlpha < 1) return;
  push();
  let overallAlpha = presenceButton.currentAlpha;
  strokeWeight(BUTTON_STROKE_WEIGHT); stroke(0, 0, 0, 80*(overallAlpha/100)); noFill();
  let endAngle = -HALF_PI + presenceButton.drawProgress * TWO_PI;
  arc(presenceButton.pos.x, presenceButton.pos.y, presenceButton.currentSize, presenceButton.currentSize, -HALF_PI, endAngle);
  if (presenceButton.isFullyDrawn) {
    noStroke(); fill(0, 0, 0, 5 * (overallAlpha/100));
    circle(presenceButton.pos.x, presenceButton.pos.y, presenceButton.currentSize);
  }
  pop();
}

// ---- OPTIMIZED GRAIN FUNCTION ----
function createGrainTexture() {
  if (GRAIN_AMOUNT <= 0) return;
  grainBuffer = createGraphics(width, height);
  let numParticles = (width * height / 100) * GRAIN_AMOUNT;
  grainBuffer.strokeWeight(1.5);
  for (let i = 0; i < numParticles; i++) {
    grainBuffer.stroke(0, 0, 0, 15);
    grainBuffer.point(random(width), random(height));
  }
}

function applyGrain() {
  if (GRAIN_AMOUNT <= 0 || !grainBuffer) return;
  push();
  blendMode(MULTIPLY); tint(255, 50);
  image(grainBuffer, 0, 0);
  pop();
}

// ---- OPTIMIZED MOTION DETECTION ----
function detectMotion() {
  let motionCount = 0;
  capture.loadPixels();
  if (capture.pixels.length === 0) return 0;
  if (previousFrame.width !== capture.width || previousFrame.height !== capture.height) {
    previousFrame = createGraphics(capture.width, capture.height); previousFrame.pixelDensity(1);
  }
  previousFrame.loadPixels();
  if (previousFrame.pixels.length === 0) {
    previousFrame.drawingContext.drawImage(capture.elt, 0, 0, previousFrame.width, previousFrame.height);
    return 0;
  }
  for (let y = 0; y < capture.height; y+=MOTION_DETECT_STEP) {
    for (let x = 0; x < capture.width; x+=MOTION_DETECT_STEP) {
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
  setupGraphics(); setupButton();
  textPoints = []; activeEffects = []; textAnimation.isAnimating = false;
}
