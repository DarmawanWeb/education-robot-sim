import type { RobotModel, Signal, Vec } from '../engine/types';

/** What the sprite needs from the simulation on each frame. */
export interface RobotFrame {
  model: RobotModel;
  lineValues: readonly number[];
  servoAngle: number;
  wheelTravel: { left: number; right: number };
  /** Which turn-signal lamps are lit at this moment of the blink. */
  lamps: SignalLamps;
}

export interface SignalLamps {
  left: boolean;
  right: boolean;
}

/** The lamps a signal lights while its blink is in the lit half. */
export function signalLamps(signal: Signal, lit: boolean): SignalLamps {
  return {
    left: lit && (signal === 'left' || signal === 'hazard'),
    right: lit && (signal === 'right' || signal === 'hazard'),
  };
}

type Ctx = CanvasRenderingContext2D;

const ON_LINE = 500;

function rect(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, radius = 0) {
  ctx.beginPath();
  ctx.roundRect(x0, y0, x1 - x0, y1 - y0, radius);
}

type Box4 = readonly [number, number, number, number];

function fillRect(
  ctx: Ctx,
  [x0, y0, x1, y1]: Box4,
  fill: string,
  options: { radius?: number; stroke?: string; line?: number } = {},
) {
  rect(ctx, x0, y0, x1, y1, options.radius ?? 0);
  ctx.fillStyle = fill;
  ctx.fill();
  if (options.stroke) {
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = options.line ?? 0.25;
    ctx.stroke();
  }
}

function dot(ctx: Ctx, x: number, y: number, radius: number, fill: string | CanvasGradient) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/**
 * A tyre seen from above. The tread stripes slide with the distance the wheel has rolled,
 * so students can see each wheel's direction and speed. `outer` is the side the rim faces.
 */
function wheel(
  ctx: Ctx,
  centreY: number,
  outer: 1 | -1,
  travel: number,
  { diameter, width, hub }: { diameter: number; width: number; hub: string },
) {
  const half = diameter / 2;
  const inner = centreY - (outer * width) / 2;
  const outerEdge = centreY + (outer * width) / 2;
  const y0 = Math.min(inner, outerEdge);
  const y1 = Math.max(inner, outerEdge);
  ctx.save();
  rect(ctx, -half, y0, half, y1, 0.9);
  ctx.fillStyle = '#1b1b1b';
  ctx.fill();
  ctx.clip();
  const pitch = 0.75;
  const offset = ((travel % pitch) + pitch) % pitch;
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 0.22;
  ctx.beginPath();
  for (let x = -half - pitch + offset; x < half + pitch; x += pitch) {
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
  }
  ctx.stroke();
  ctx.restore();
  // The hub shows at the outer edge of the tyre.
  const rimY = outerEdge - outer * 0.42;
  fillRect(
    ctx,
    [-half * 0.62, Math.min(rimY, outerEdge), half * 0.62, Math.max(rimY, outerEdge)],
    hub,
    { radius: 0.15 },
  );
}

/** Infrared lens over the floor: it lights up red while it sees the black tape. */
function irLens(ctx: Ctx, at: Vec, value: number, radius: number) {
  const on = value > ON_LINE;
  if (on) dot(ctx, at.x, at.y, radius * 2.1, 'rgba(255,59,48,0.35)');
  dot(ctx, at.x, at.y, radius, on ? '#ff3b30' : '#202020');
  dot(ctx, at.x - radius * 0.3, at.y - radius * 0.3, radius * 0.32, on ? '#ffd0cc' : '#5b5b5b');
}

/** HC-SR04 transducers seen from above, pointing along +x. */
function sonarPair(ctx: Ctx, back: number, front: number, spacing: number, radius: number) {
  for (const side of [-1, 1] as const) {
    const y = side * spacing;
    fillRect(ctx, [back, y - radius, front, y + radius], '#c3c9d1', {
      radius: 0.35,
      stroke: '#7d8590',
      line: 0.15,
    });
    // A light band down the middle reads as a metal cylinder.
    fillRect(ctx, [back + 0.2, y - radius * 0.28, front - 0.35, y + radius * 0.12], '#eef1f4', {
      radius: 0.1,
    });
    fillRect(ctx, [front - 0.32, y - radius + 0.12, front, y + radius - 0.12], '#8d949e', {
      radius: 0.1,
    });
  }
}

function perforation(ctx: Ctx, holes: readonly Vec[], colour: string) {
  for (const hole of holes) dot(ctx, hole.x, hole.y, 0.24, colour);
}

/** SD v1's buzzer, under a grille on the roof. */
const BUZZER: Vec = { x: -3.3, y: -2.6 };

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, index) => from + index * step);

/**
 * The SD v1 body seen from above, traced clockwise so it can share a path with other shapes:
 * a narrow tail between the wheels that flares into a wide nose.
 */
function sdBody(ctx: Ctx) {
  ctx.moveTo(-5.7, 0);
  ctx.lineTo(-5.7, -3.5);
  ctx.quadraticCurveTo(-5.7, -4.4, -4.9, -4.4);
  ctx.lineTo(3.2, -4.4);
  ctx.bezierCurveTo(3.9, -4.4, 4.0, -5.7, 4.8, -5.7);
  ctx.lineTo(6.4, -5.7);
  ctx.quadraticCurveTo(7.5, -5.7, 7.5, -4.6);
  ctx.quadraticCurveTo(7.9, -2.4, 7.75, 0);
  ctx.quadraticCurveTo(7.9, 2.4, 7.5, 4.6);
  ctx.quadraticCurveTo(7.5, 5.7, 6.4, 5.7);
  ctx.lineTo(4.8, 5.7);
  ctx.bezierCurveTo(4.0, 5.7, 3.9, 4.4, 3.2, 4.4);
  ctx.lineTo(-4.9, 4.4);
  ctx.quadraticCurveTo(-5.7, 4.4, -5.7, 3.5);
  ctx.closePath();
}

const SD_CHIN: Box4 = [8.0, -2.6, 9.3, 2.6];
const SD_SPOILER: Box4 = [-6.2, -4.5, -5.0, 4.5];
/** Turn-signal LEDs at the front corners, left then right. */
const SD_LAMPS = [
  { x: 6.85, y: -5.0 },
  { x: 6.85, y: 5.0 },
] as const;

/** An orange turn-signal LED; lit, it throws a soft glow on the mat around the corner. */
function signalLamp(ctx: Ctx, at: Vec, lit: boolean) {
  if (lit) {
    const glow = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, 3.4);
    glow.addColorStop(0, 'rgba(255,176,32,0.9)');
    glow.addColorStop(0.35, 'rgba(255,150,20,0.45)');
    glow.addColorStop(1, 'rgba(255,140,0,0)');
    dot(ctx, at.x, at.y, 3.4, glow);
  }
  dot(ctx, at.x, at.y, 0.62, lit ? '#ffb020' : '#8a4a10');
  dot(ctx, at.x, at.y, 0.42, lit ? '#fff1c1' : '#d9822b');
}

/**
 * SD v1: a red car-shaped shell with a white racing stripe, the black visor that holds the
 * OLED eyes, white-hub wheels at the back, the HC-SR04 in a red bumper, two IR sensors on a
 * chin plate under it, and an orange turn-signal LED at each front corner. The buzzer sits
 * under a small grille on the roof.
 */
function drawSd(ctx: Ctx, frame: RobotFrame) {
  const { model, lineValues, wheelTravel, lamps } = frame;
  const halfBase = model.wheelBase / 2;
  const tyre = { diameter: 6.5, width: 2.6, hub: '#eceff1' };

  // Chin plate with the IR sensors: the lowest part, so it goes down first.
  fillRect(ctx, SD_CHIN, '#1c1d1f', { radius: 0.35, stroke: '#000000', line: 0.12 });

  wheel(ctx, -halfBase, -1, wheelTravel.left, tyre);
  wheel(ctx, halfBase, 1, wheelTravel.right, tyre);

  // Silver base plate, showing as a thin edge beside the wheels.
  fillRect(ctx, [-5.2, -4.65, 4.4, 4.65], '#c4c9cf', { radius: 0.5 });

  // The shell, lighter along the roof line, with its outline.
  const shade = ctx.createLinearGradient(0, -5.7, 0, 5.7);
  shade.addColorStop(0, '#b81c22');
  shade.addColorStop(0.5, '#e2363c');
  shade.addColorStop(1, '#b81c22');
  ctx.beginPath();
  sdBody(ctx);
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Racing stripe from the tail to the nose, and the raised roof behind the visor.
  fillRect(ctx, [-6, -1.45, 8, 1.45], '#f5f5f0');
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 0.16;
  rect(ctx, -4.9, -3.65, 2.4, 3.65, 1.1);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  sdBody(ctx);
  ctx.strokeStyle = '#8c1218';
  ctx.lineWidth = 0.25;
  ctx.stroke();

  // Rear spoiler, striped like the shell.
  fillRect(ctx, SD_SPOILER, '#b51a21', { radius: 0.5, stroke: '#7d0f14' });
  fillRect(ctx, [SD_SPOILER[0] + 0.1, -1.45, SD_SPOILER[2] - 0.1, 1.45], '#ecece6');

  // Buzzer grille on the roof.
  dot(ctx, BUZZER.x, BUZZER.y, 0.8, '#7d0f14');
  for (const hole of [
    { x: 0, y: 0 },
    { x: 0.32, y: 0 },
    { x: -0.32, y: 0 },
    { x: 0, y: 0.32 },
    { x: 0, y: -0.32 },
  ])
    dot(ctx, BUZZER.x + hole.x, BUZZER.y + hole.y, 0.1, '#2a0507');

  // Visor with the two OLED eyes.
  fillRect(ctx, [2.0, -3.6, 3.7, 3.6], '#0d0f14', { radius: 0.55 });
  fillRect(ctx, [2.15, -3.35, 2.4, 3.35], 'rgba(255,255,255,0.18)', { radius: 0.1 });
  for (const side of [-1, 1]) {
    fillRect(ctx, [2.4, side * 1.05 - 0.48, 3.3, side * 1.05 + 0.48], 'rgba(95,240,255,0.3)', {
      radius: 0.3,
    });
    fillRect(ctx, [2.55, side * 1.05 - 0.33, 3.15, side * 1.05 + 0.33], '#5ff0ff', {
      radius: 0.15,
    });
  }

  // Red bumper holding the HC-SR04; the transducers face forward from the sonar's origin.
  fillRect(ctx, [7.15, -2.75, 8.25, 2.75], '#b0191f', { radius: 0.3, stroke: '#7d0f14' });
  sonarPair(ctx, 7.3, model.sonar.forward + 0.15, 1.3, 0.78);

  // IR sensors at their real positions, each in a pale housing; the lens glows over the tape.
  for (const [index, sensor] of model.lineSensors.entries()) {
    dot(ctx, sensor.x, sensor.y, 0.6, '#b9c0c8');
    irLens(ctx, sensor, lineValues[index] ?? 0, 0.42);
  }

  // Turn signals last, so their glow lies over everything else.
  signalLamp(ctx, SD_LAMPS[0], lamps.left);
  signalLamp(ctx, SD_LAMPS[1], lamps.right);
}

/**
 * SMP v1 with every module fitted: red aluminium frame on brass standoffs, yellow-hub wheels,
 * the 5-in-1 IR bar at the front, the HC-SR04 riding on the servo, the OLED board,
 * the ESP32 on the custom PCB, the TB6612FNG driver, the AHT10 and the microphone.
 */
function drawSmp(ctx: Ctx, frame: RobotFrame) {
  const { model, lineValues, wheelTravel, servoAngle } = frame;
  const halfBase = model.wheelBase / 2;
  const tyre = { diameter: 6.5, width: 2.6, hub: '#f4c20d' };

  // The IR bar is the lowest part, so it goes down first.
  const sensorX = model.lineSensors[0]?.x ?? 8;
  fillRect(ctx, [sensorX - 1.5, -4.7, sensorX + 1.2, 4.7], '#151515', {
    radius: 0.35,
    stroke: '#000000',
    line: 0.12,
  });
  for (const [index, sensor] of model.lineSensors.entries()) {
    fillRect(ctx, [sensor.x - 0.55, sensor.y - 0.6, sensor.x + 0.55, sensor.y + 0.6], '#d9dde2', {
      radius: 0.12,
    });
    irLens(ctx, sensor, lineValues[index] ?? 0, 0.36);
  }

  wheel(ctx, -halfBase, -1, wheelTravel.left, tyre);
  wheel(ctx, halfBase, 1, wheelTravel.right, tyre);

  // Frame and the custom PCB on top of it.
  fillRect(ctx, [-8.0, -5.0, 6.6, 5.0], '#d32b2b', { radius: 0.8, stroke: '#861414' });
  perforation(
    ctx,
    range(-6.6, 5.4, 1.5).flatMap((x) => [
      { x, y: -4.45 },
      { x, y: 4.45 },
    ]),
    '#861414',
  );
  fillRect(ctx, [-7.2, -3.8, 4.3, 3.8], '#124a3c', { radius: 0.45, stroke: '#082a22', line: 0.18 });
  for (const corner of [
    { x: -7.25, y: -4.35 },
    { x: -7.25, y: 4.35 },
    { x: 5.85, y: -4.35 },
    { x: 5.85, y: 4.35 },
  ]) {
    dot(ctx, corner.x, corner.y, 0.42, '#c99a2e');
    dot(ctx, corner.x, corner.y, 0.18, '#8a6514');
  }

  // ESP32 dev module with its metal shield and two rows of header pins.
  fillRect(ctx, [-4.4, -1.45, 0.9, 1.45], '#1c1c1c', { radius: 0.15 });
  fillRect(ctx, [-1.2, -1.05, 0.6, 1.05], '#b9c0c8', { radius: 0.1, stroke: '#7c848e', line: 0.1 });
  ctx.strokeStyle = '#d8b04a';
  ctx.lineWidth = 0.14;
  ctx.setLineDash([0.12, 0.2]);
  ctx.beginPath();
  ctx.moveTo(-4.1, -1.25);
  ctx.lineTo(0.6, -1.25);
  ctx.moveTo(-4.1, 1.25);
  ctx.lineTo(0.6, 1.25);
  ctx.stroke();
  ctx.setLineDash([]);

  // TB6612FNG driver (red board), passive buzzer, and AHT10 (blue board, white sensor).
  fillRect(ctx, [-6.9, -3.5, -5.0, -1.6], '#c8102e', { radius: 0.15 });
  fillRect(ctx, [-6.3, -2.85, -5.6, -2.25], '#141414', { radius: 0.05 });
  dot(ctx, -5.9, 0, 0.75, '#161616');
  dot(ctx, -5.9, 0, 0.16, '#000000');
  fillRect(ctx, [-6.9, 1.6, -5.2, 3.3], '#1f5fbf', { radius: 0.15 });
  fillRect(ctx, [-6.45, 2.05, -5.65, 2.85], '#f2f2f2', { radius: 0.08 });

  // Microphone: a black foam ball on a stalk.
  dot(ctx, -2.2, 2.75, 1.2, '#161616');
  for (const speck of [
    { x: -2.6, y: 2.4 },
    { x: -1.8, y: 2.9 },
    { x: -2.3, y: 3.3 },
    { x: -1.9, y: 2.3 },
  ])
    dot(ctx, speck.x, speck.y, 0.13, '#3a3a3a');

  // OLED board standing at the front, screen facing forward.
  fillRect(ctx, [5.95, -3.0, 6.45, 3.0], '#1d4fb8', { radius: 0.1 });
  fillRect(ctx, [6.45, -2.5, 6.7, 2.5], '#050505', { radius: 0.05 });

  // Servo, then the HC-SR04 that it turns. 90 degrees faces forward, 180 faces left.
  const pivot = { x: model.sonar.forward - 1.25, y: 0 };
  fillRect(ctx, [pivot.x - 2.1, -1.15, pivot.x + 0.25, 1.15], '#2856c9', {
    radius: 0.2,
    stroke: '#183a8c',
    line: 0.15,
  });
  ctx.save();
  ctx.translate(pivot.x, pivot.y);
  ctx.rotate((-(servoAngle - 90) * Math.PI) / 180);
  fillRect(ctx, [-0.55, -2.3, 0.05, 2.3], '#1d4fb8', { radius: 0.1 });
  dot(ctx, -0.25, 0, 0.35, '#f2f2f2');
  sonarPair(ctx, 0.0, 1.3, 1.3, 0.8);
  ctx.restore();
}

/** Adds the robot's outline (body and tyres) to the current path, for the drop shadow. */
export function silhouette(ctx: Ctx, model: RobotModel): void {
  const halfBase = model.wheelBase / 2;
  const shapes: Box4[] =
    model.id === 'sd'
      ? [SD_CHIN, SD_SPOILER, [7.15, -2.75, 8.25, 2.75]]
      : [
          [-8.0, -5.0, 6.6, 5.0],
          [6.5, -4.7, 9.2, 4.7],
        ];
  ctx.beginPath();
  if (model.id === 'sd') sdBody(ctx);
  for (const [x0, y0, x1, y1] of shapes) ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 0.6);
  for (const side of [-1, 1]) ctx.roundRect(-3.25, side * halfBase - 1.3, 6.5, 2.6, 0.9);
}

/** Draws the robot in its own frame: origin between the wheels, +x forward, +y to the right. */
export function drawRobot(ctx: Ctx, frame: RobotFrame): void {
  if (frame.model.id === 'sd') drawSd(ctx, frame);
  else drawSmp(ctx, frame);
}

/** Where the buzzer sits, so the canvas can draw sound rings around it. */
export function buzzerPosition(model: RobotModel): Vec {
  return model.id === 'sd' ? BUZZER : { x: -5.9, y: 0 };
}
