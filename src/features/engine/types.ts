import type { Localized } from '@taksu/content';

export interface Vec {
  x: number;
  y: number;
}

/** Arena coordinates are centimetres, x right, y down. Heading 0 faces +x; positive turns clockwise. */
export interface Pose extends Vec {
  heading: number;
}

export type RobotId = 'sd' | 'smp';
export type Face = 'normal' | 'senang' | 'bingung' | 'waspada' | 'berhasil';
export type Note = 'C5' | 'D5' | 'E5' | 'F5' | 'G5' | 'A5' | 'B5' | 'C6';

export interface RobotModel {
  id: RobotId;
  length: number;
  width: number;
  radius: number;
  wheelBase: number;
  /** Wheel speed at 100 % in cm/s. */
  maxSpeed: number;
  /** Real motors are never identical; the SMP robot drifts unless calibrated. */
  motorBias: { left: number; right: number };
  /** Sensor offsets in the robot frame: x forward, y to the right. Left to right order. */
  lineSensors: Vec[];
  sonar: { forward: number; range: number; halfCone: number };
  hasServo: boolean;
}

export interface LinePath {
  points: Vec[];
  closed?: boolean;
  width: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Zone extends Box {
  id: string;
  kind: 'start' | 'finish' | 'checkpoint';
}

export interface Arena {
  width: number;
  height: number;
  lines: LinePath[];
  boxes: Box[];
  zones: Zone[];
}

export interface Environment {
  temperature: number;
  humidity: number;
  sound: number;
}

export type SensorId =
  | 'lineLeft'
  | 'lineRight'
  | 'distance'
  | 'lineValue'
  | 'linePosition'
  | 'temperature'
  | 'humidity'
  | 'sound'
  | 'time';

export type Value = number | boolean | string;

export type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'text'; value: string }
  | { kind: 'sensor'; sensor: SensorId; index?: number }
  | { kind: 'var'; name: string }
  | { kind: 'compare'; op: 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE'; a: Expr; b: Expr }
  | { kind: 'logic'; op: 'AND' | 'OR'; a: Expr; b: Expr }
  | { kind: 'not'; value: Expr }
  | { kind: 'math'; op: 'ADD' | 'MINUS' | 'MULTIPLY' | 'DIVIDE' | 'POWER'; a: Expr; b: Expr }
  | { kind: 'join'; parts: Expr[] };

export type DriveDirection = 'forward' | 'backward' | 'left' | 'right';

export type Statement = { blockId?: string } & (
  | { kind: 'drive'; dir: DriveDirection; speed: Expr; seconds: Expr | null }
  | { kind: 'motors'; left: Expr; right: Expr }
  | { kind: 'stop' }
  | { kind: 'wait'; seconds: Expr }
  | { kind: 'waitUntil'; cond: Expr }
  | { kind: 'repeat'; times: Expr; body: Statement[] }
  | { kind: 'forever'; body: Statement[] }
  | { kind: 'loop'; until: boolean; cond: Expr; body: Statement[] }
  | { kind: 'if'; branches: { cond: Expr; body: Statement[] }[]; otherwise: Statement[] }
  | { kind: 'face'; face: Face }
  | { kind: 'beep'; seconds: Expr }
  | { kind: 'tone'; note: Note; seconds: Expr }
  | { kind: 'oled'; line: number; value: Expr }
  | { kind: 'oledClear' }
  | { kind: 'servo'; angle: Expr }
  | { kind: 'set'; name: string; value: Expr }
  | { kind: 'change'; name: string; delta: Expr }
);

export interface Program {
  body: Statement[];
}

/** What a mission goal can see on every tick. */
export interface Snapshot {
  time: number;
  pose: Pose;
  speed: number;
  stationaryFor: number;
  bumped: boolean;
  face: Face;
  beeps: number;
  oledText: string;
  programDone: boolean;
  distance: number;
  env: Environment;
  visited: ReadonlySet<string>;
  met: ReadonlySet<string>;
  inZone: (id: string) => boolean;
}

export interface Goal {
  id: string;
  label: Localized;
  /** Final goals are judged once the robot settles (program done or still for a second). */
  final?: boolean;
  check: (snapshot: Snapshot, memo: Record<string, unknown>) => boolean;
}

export interface EnvironmentKey {
  t: number;
  temperature?: number;
  humidity?: number;
}

export interface Mission {
  id: string;
  robot: RobotId;
  arena: Arena;
  start: Pose;
  /** Seconds; Infinity for free play. */
  timeLimit: number;
  failOnBump: boolean;
  goals: Goal[];
  envTimeline?: EnvironmentKey[];
  /** Scripted claps (seconds) for the sound mission. */
  claps?: number[];
  /** Free play enables manual sliders and the clap button. */
  free?: boolean;
  hint: Localized;
  /** Blockly serialization loaded when the mission first opens. */
  starter: object;
  /** Reference program: proves the mission is solvable (tests) and powers the example button. */
  solution: Program;
}

export type Outcome =
  | { status: 'running' }
  | { status: 'success' }
  | { status: 'fail'; reason: 'time' | 'bump' | 'incomplete' };
