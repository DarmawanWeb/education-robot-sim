import {
  circleHitsBox,
  distanceToPath,
  moverBox,
  pointInBox,
  rayToBox,
  rayToWalls,
} from './geometry';
import { type RobotIO, Runner } from './interpreter';
import { robotModels } from './robots';
import type {
  Box,
  Environment,
  Face,
  Mission,
  Outcome,
  Pose,
  Program,
  RobotModel,
  SensorId,
  Snapshot,
  TelemetryPoint,
  Vec,
} from './types';

/** Fixed physics step (120 Hz); rendering interpolates nothing and simply draws the latest state. */
export const DT = 1 / 120;
const BEEP_HZ = 2700;
const WHITE = 80;
const BLACK = 1000;
const CLAP_SECONDS = 0.3;

export interface BuzzerEvent {
  frequency: number;
  seconds: number;
}

/** One robot in one mission arena: physics, sensors, program, and mission scoring. */
export class Simulation {
  readonly model: RobotModel;
  pose: Pose;
  time = 0;
  motors = { left: 0, right: 0 };
  face: Face = 'normal';
  oled: string[] = ['', '', '', ''];
  servoAngle = 90;
  speed = 0;
  turnRate = 0;
  /** Centimetres each wheel has rolled; the canvas uses it to turn the tyre tread. */
  wheelTravel = { left: 0, right: 0 };
  stationaryFor = 0;
  bumped = false;
  beeps = 0;
  buzzingUntil = 0;
  lineValues: number[] = [];
  linePosition = 0;
  distance = 0;
  env: Environment;
  manualEnv: Partial<Pick<Environment, 'temperature' | 'humidity'>> = {};
  activeBlock: string | undefined;
  trail: Vec[] = [];
  visited = new Set<string>();
  met = new Set<string>();
  outcome: Outcome = { status: 'running' };
  /** Sounds produced since the UI last drained them. */
  buzzerEvents: BuzzerEvent[] = [];
  /** Readings that reached the dashboard, and how many were lost while offline. */
  telemetry: TelemetryPoint[] = [];
  dropped = 0;
  private manualClaps: number[] = [];
  private runner: Runner | null = null;
  private memos = new Map<string, Record<string, unknown>>();

  constructor(readonly mission: Mission) {
    this.model = robotModels[mission.robot];
    this.pose = { ...mission.start };
    this.env = this.environmentAt(0);
    this.reset();
  }

  private readonly io: RobotIO = {
    time: () => this.time,
    setMotors: (left, right) => {
      this.motors = { left, right };
    },
    read: (sensor, index) => this.read(sensor, index),
    setFace: (face) => {
      this.face = face;
    },
    beep: (seconds, frequency = BEEP_HZ) => {
      this.beeps += 1;
      this.buzzingUntil = this.time + seconds;
      this.buzzerEvents.push({ frequency, seconds });
    },
    oled: (line, text) => {
      const index = Math.min(4, Math.max(1, Math.round(line))) - 1;
      this.oled[index] = text.slice(0, 21);
    },
    oledClear: () => {
      this.oled = ['', '', '', ''];
    },
    servo: (angle) => {
      this.servoAngle = angle;
    },
    send: (key, value) => {
      if (!this.online) {
        this.dropped += 1;
        return;
      }
      this.telemetry.push({
        t: this.time,
        key,
        value: typeof value === 'boolean' ? Number(value) : value,
      });
      if (this.telemetry.length > 2000) this.telemetry.shift();
    },
    highlight: (blockId) => {
      this.activeBlock = blockId;
    },
  };

  reset(): void {
    this.pose = { ...this.mission.start };
    this.time = 0;
    this.motors = { left: 0, right: 0 };
    this.face = 'normal';
    this.oled = ['', '', '', ''];
    this.servoAngle = 90;
    this.speed = 0;
    this.turnRate = 0;
    this.wheelTravel = { left: 0, right: 0 };
    this.stationaryFor = 0;
    this.bumped = false;
    this.beeps = 0;
    this.buzzingUntil = 0;
    this.activeBlock = undefined;
    this.trail = [{ x: this.pose.x, y: this.pose.y }];
    this.visited.clear();
    this.met.clear();
    this.memos.clear();
    this.manualClaps = [];
    this.buzzerEvents = [];
    this.telemetry = [];
    this.dropped = 0;
    this.outcome = { status: 'running' };
    this.runner = null;
    this.env = this.environmentAt(0);
    this.sense();
  }

  start(program: Program): void {
    this.reset();
    this.runner = new Runner(program, this.io);
  }

  /** Stops the program and motors without judging the mission. */
  halt(): void {
    this.runner = null;
    this.motors = { left: 0, right: 0 };
    this.activeBlock = undefined;
  }

  get active(): boolean {
    return this.runner !== null && this.outcome.status === 'running';
  }

  get programDone(): boolean {
    return this.runner?.done ?? false;
  }

  /** Whether the class Wi-Fi is up right now. */
  get online(): boolean {
    let online = true;
    for (const key of this.mission.wifi ?? []) {
      if (key.t <= this.time) online = key.online;
    }
    return online;
  }

  clap(): void {
    this.manualClaps.push(this.time);
  }

  /** Free-play sliders override the scripted temperature and humidity. */
  setManualEnvironment(patch: Partial<Pick<Environment, 'temperature' | 'humidity'>>): void {
    this.manualEnv = { ...this.manualEnv, ...patch };
    this.env = this.environmentAt(this.time);
  }

  step(dt = DT): void {
    if (!this.runner || this.outcome.status !== 'running') return;
    this.runner.tick();
    this.integrate(dt);
    this.time += dt;
    this.env = this.environmentAt(this.time);
    this.sense();
    this.judge();
  }

  /** Fixed boxes plus anything moving, where it is right now. */
  get obstacles(): Box[] {
    const { boxes, movers = [] } = this.mission.arena;
    return [...boxes, ...movers.map((mover) => moverBox(mover, this.time))];
  }

  private collides(point: Vec): boolean {
    const { radius } = this.model;
    const { width, height } = this.mission.arena;
    if (
      point.x - radius < 0 ||
      point.y - radius < 0 ||
      point.x + radius > width ||
      point.y + radius > height
    )
      return true;
    return this.obstacles.some((box) => circleHitsBox(point, radius, box));
  }

  private integrate(dt: number): void {
    const { maxSpeed, motorBias, wheelBase } = this.model;
    const left = ((maxSpeed * this.motors.left) / 100) * motorBias.left;
    const right = ((maxSpeed * this.motors.right) / 100) * motorBias.right;
    const v = (left + right) / 2;
    const omega = (left - right) / wheelBase;
    // Wheels keep spinning against a wall, as real ones do.
    this.wheelTravel.left += left * dt;
    this.wheelTravel.right += right * dt;
    const middle = this.pose.heading + (omega * dt) / 2;
    const next = {
      x: this.pose.x + v * Math.cos(middle) * dt,
      y: this.pose.y + v * Math.sin(middle) * dt,
    };
    const blocked = Math.abs(v) > 1e-9 && this.collides(next);
    if (blocked) this.bumped = true;
    this.pose = {
      ...(blocked ? { x: this.pose.x, y: this.pose.y } : next),
      heading: this.pose.heading + omega * dt,
    };
    this.speed = blocked ? 0 : Math.abs(v);
    this.turnRate = Math.abs(omega);
    this.stationaryFor = this.speed < 0.5 && this.turnRate < 0.05 ? this.stationaryFor + dt : 0;

    const last = this.trail.at(-1);
    if (!last || Math.hypot(last.x - this.pose.x, last.y - this.pose.y) > 1) {
      this.trail.push({ x: this.pose.x, y: this.pose.y });
      if (this.trail.length > 1500) this.trail.shift();
    }
    for (const zone of this.mission.arena.zones) {
      if (pointInBox(this.pose, zone)) this.visited.add(zone.id);
    }
  }

  /** IR reflectance: tape reads ~1000, the white mat ~80, with a short soft edge. */
  private reflect(point: Vec): number {
    let value = WHITE;
    for (const path of this.mission.arena.lines) {
      const distance = distanceToPath(point, path);
      const inner = path.width / 2 - 0.3;
      const reading =
        distance <= inner
          ? BLACK
          : distance >= inner + 0.6
            ? WHITE
            : BLACK - ((distance - inner) / 0.6) * (BLACK - WHITE);
      value = Math.max(value, reading);
    }
    return value;
  }

  private sense(): void {
    const { x, y, heading } = this.pose;
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    this.lineValues = this.model.lineSensors.map((sensor) =>
      this.reflect({
        x: x + sensor.x * cos - sensor.y * sin,
        y: y + sensor.x * sin + sensor.y * cos,
      }),
    );

    const count = this.lineValues.length;
    let weighted = 0;
    let total = 0;
    this.lineValues.forEach((value, index) => {
      const strength = Math.max(0, Math.min(1, (value - WHITE) / (BLACK - WHITE)));
      weighted += strength * (count > 1 ? -100 + (200 * index) / (count - 1) : 0);
      total += strength;
    });
    if (total > 0.15) this.linePosition = weighted / total;

    const { forward, range, halfCone } = this.model.sonar;
    const origin = { x: x + forward * cos, y: y + forward * sin };
    const base = heading - ((this.servoAngle - 90) * Math.PI) / 180;
    const { width, height } = this.mission.arena;
    const obstacles = this.obstacles;
    let nearest = range;
    for (const angle of [base - halfCone, base, base + halfCone]) {
      nearest = Math.min(nearest, rayToWalls(origin, angle, width, height));
      for (const box of obstacles) nearest = Math.min(nearest, rayToBox(origin, angle, box));
    }
    this.distance = Math.round(nearest * 10) / 10;
  }

  private read(sensor: SensorId, index?: number): number | boolean {
    switch (sensor) {
      case 'lineLeft':
        return (this.lineValues[0] ?? 0) > 500;
      case 'lineRight':
        return (this.lineValues.at(-1) ?? 0) > 500;
      case 'lineValue':
        return Math.round(this.lineValues[Math.max(0, (index ?? 1) - 1)] ?? 0);
      case 'linePosition':
        return Math.round(this.linePosition);
      case 'distance':
        return this.distance;
      case 'temperature':
        return this.env.temperature;
      case 'humidity':
        return this.env.humidity;
      case 'sound':
        return this.env.sound;
      case 'wifi':
        return this.online;
      case 'time':
        return Math.round(this.time * 10) / 10;
    }
  }

  environmentAt(time: number): Environment {
    let temperature = 28;
    let humidity = 65;
    for (const key of this.mission.envTimeline ?? []) {
      if (key.t > time) continue;
      if (key.temperature !== undefined) temperature = key.temperature;
      if (key.humidity !== undefined) humidity = key.humidity;
    }
    const claps = [...(this.mission.claps ?? []), ...this.manualClaps];
    const loud = claps.some((clap) => time >= clap && time - clap < CLAP_SECONDS);
    return {
      temperature: this.manualEnv.temperature ?? temperature,
      humidity: this.manualEnv.humidity ?? humidity,
      sound: loud ? 85 : 38,
    };
  }

  snapshot(): Snapshot {
    return {
      time: this.time,
      pose: this.pose,
      speed: this.speed,
      stationaryFor: this.stationaryFor,
      bumped: this.bumped,
      face: this.face,
      beeps: this.beeps,
      oledText: this.oled.join(' '),
      programDone: this.programDone,
      distance: this.distance,
      env: this.env,
      online: this.online,
      telemetry: this.telemetry,
      visited: this.visited,
      met: this.met,
      inZone: (id) => {
        const zone = this.mission.arena.zones.find((entry) => entry.id === id);
        return zone ? pointInBox(this.pose, zone) : false;
      },
    };
  }

  private judge(): void {
    const { goals, failOnBump, timeLimit } = this.mission;
    if (failOnBump && this.bumped) {
      this.finish({ status: 'fail', reason: 'bump' });
      return;
    }
    const snapshot = this.snapshot();
    const settled = this.programDone || this.stationaryFor >= 1;
    for (const goal of goals) {
      if (this.met.has(goal.id) || (goal.final && !settled)) continue;
      const memo = this.memos.get(goal.id) ?? {};
      this.memos.set(goal.id, memo);
      if (goal.check(snapshot, memo)) this.met.add(goal.id);
    }
    if (goals.length > 0 && this.met.size === goals.length) {
      this.finish({ status: 'success' });
    } else if (this.time > timeLimit) {
      this.finish({ status: 'fail', reason: 'time' });
    } else if (goals.length > 0 && this.programDone && this.stationaryFor >= 1.5) {
      this.finish({ status: 'fail', reason: 'incomplete' });
    }
  }

  private finish(outcome: Outcome): void {
    this.outcome = outcome;
    this.motors = { left: 0, right: 0 };
    this.activeBlock = undefined;
  }
}

/** Runs a mission headlessly; used by tests and to validate reference solutions. */
export function simulate(mission: Mission, program: Program, maxSeconds = 600): Simulation {
  const simulation = new Simulation(mission);
  simulation.start(program);
  const steps = Math.ceil(
    Math.min(maxSeconds, Number.isFinite(mission.timeLimit) ? mission.timeLimit + 2 : maxSeconds) /
      DT,
  );
  for (let index = 0; index < steps && simulation.outcome.status === 'running'; index += 1)
    simulation.step();
  return simulation;
}
