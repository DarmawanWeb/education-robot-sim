import type { Localized } from '@dctedu/catalog';
import { arc, cornerTrack, roundedTrack } from './geometry';
import type {
  DriveDirection,
  Expr,
  Goal,
  LinePath,
  Mission,
  SensorId,
  Signal,
  Snapshot,
  Statement,
  Vec,
  Zone,
} from './types';

const l = (id: string, en: string): Localized => ({ id, en });
const zone = (
  id: string,
  kind: Zone['kind'],
  cx: number,
  cy: number,
  w: number,
  h: number,
): Zone => ({
  id,
  kind,
  x: cx - w / 2,
  y: cy - h / 2,
  w,
  h,
});

// ---- expression and statement helpers (used for reference solutions) ----
const n = (value: number): Expr => ({ kind: 'num', value });
const text = (value: string): Expr => ({ kind: 'text', value });
const sensor = (name: SensorId, index?: number): Expr => ({ kind: 'sensor', sensor: name, index });
const v = (name: string): Expr => ({ kind: 'var', name });
const lt = (a: Expr, b: Expr): Expr => ({ kind: 'compare', op: 'LT', a, b });
const gt = (a: Expr, b: Expr): Expr => ({ kind: 'compare', op: 'GT', a, b });
const and = (a: Expr, b: Expr): Expr => ({ kind: 'logic', op: 'AND', a, b });
const add = (a: Expr, b: Expr): Expr => ({ kind: 'math', op: 'ADD', a, b });
const minus = (a: Expr, b: Expr): Expr => ({ kind: 'math', op: 'MINUS', a, b });
const times = (a: Expr, b: Expr): Expr => ({ kind: 'math', op: 'MULTIPLY', a, b });
const drive = (dir: DriveDirection, speed: number, seconds?: number): Statement => ({
  kind: 'drive',
  dir,
  speed: n(speed),
  seconds: seconds === undefined ? null : n(seconds),
});
const motors = (left: Expr, right: Expr): Statement => ({ kind: 'motors', left, right });
const wait = (seconds: number): Statement => ({ kind: 'wait', seconds: n(seconds) });
const stop: Statement = { kind: 'stop' };
const signal = (side: Signal, tick = true): Statement => ({ kind: 'signal', side, tick });

// ---- Blockly starter helpers ----
type StarterBlock = {
  type: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  extraState?: object;
  next?: { block: StarterBlock };
};
const shadowNum = (value: number) => ({ shadow: { type: 'math_number', fields: { NUM: value } } });
/** A block plugged into another block's input. */
const plug = (block: StarterBlock) => ({ block });
const distanceBelow = (cm: number): StarterBlock => ({
  type: 'logic_compare',
  fields: { OP: 'LT' },
  inputs: {
    A: plug({ type: 'sim_distance' }),
    B: plug({ type: 'math_number', fields: { NUM: cm } }),
  },
});
function starter(...blocks: StarterBlock[]): object {
  const chain = blocks.reduceRight<object | undefined>(
    (next, block) => ({ ...block, ...(next ? { next: { block: next } } : {}) }),
    undefined,
  );
  return {
    blocks: {
      languageVersion: 0,
      blocks: [{ type: 'sim_start', x: 32, y: 32, ...(chain ? { next: { block: chain } } : {}) }],
    },
  };
}

// ---- goals ----
/** Numbers written on the OLED, read the way a student would read them. */
const numbersIn = (shown: string) =>
  [...shown.matchAll(/-?\d+(?:[.,]\d+)?/g)].map((match) =>
    Number.parseFloat(match[0].replace(',', '.')),
  );
const showsNear = (shown: string, value: number, tolerance: number) =>
  numbersIn(shown).some((number) => Math.abs(number - value) <= tolerance);
/** True on the tick a new beep or tone starts. */
const beepStarted = (s: { beeps: number }, memo: Record<string, unknown>) => {
  const before = typeof memo.beeps === 'number' ? memo.beeps : 0;
  memo.beeps = s.beeps;
  return s.beeps > before;
};
const stoppedIn = (zoneId: string, label: Localized): Goal => ({
  id: `stop-${zoneId}`,
  label,
  final: true,
  check: (s) => s.inZone(zoneId) && s.speed < 0.5,
});
const visit = (zoneId: string, label: Localized, after?: string): Goal => ({
  id: zoneId,
  label,
  check: (s) => (!after || s.met.has(after)) && s.inZone(zoneId),
});
const stoppedBeforeObstacle: Goal = {
  id: 'gap',
  label: l(
    'Berhenti 3–20 cm di depan rintangan tanpa menabrak',
    'Stop 3–20 cm before the obstacle without touching it',
  ),
  final: true,
  check: (s) => !s.bumped && s.speed < 0.5 && s.distance >= 3 && s.distance <= 20,
};

// ---- arenas ----
const tape = 1.8;
const stadium: LinePath = {
  closed: true,
  width: tape,
  points: [
    ...arc({ x: 140, y: 70 }, 40, -Math.PI / 2, Math.PI / 2, 18),
    ...arc({ x: 60, y: 70 }, 40, Math.PI / 2, (3 * Math.PI) / 2, 18),
  ],
};

/**
 * The arena challenges, printed as the arena banners the store sells. Ciko's is a figure eight
 * with a square crossing, a tight pocket at the bottom left, and a chicane on the right.
 */
const cikoArena = cornerTrack(
  [
    { x: 20, y: 35, r: 12 },
    { x: 20, y: 105, r: 8 },
    { x: 38, y: 105, r: 9 },
    { x: 38, y: 125, r: 9 },
    { x: 66, y: 125, r: 9 },
    { x: 66, y: 104, r: 10 },
    { x: 135, y: 35, r: 15 },
    { x: 180, y: 35, r: 12 },
    { x: 180, y: 55, r: 8 },
    { x: 162, y: 70, r: 8 },
    { x: 180, y: 85, r: 8 },
    { x: 180, y: 105, r: 12 },
    { x: 135, y: 105, r: 15 },
    { x: 65, y: 35, r: 15 },
  ],
  tape,
);

/** Momo's: a hairpin, two zigzags, steps, near-sharp corners, and a square crossing. */
const momoArena = cornerTrack(
  [
    { x: 20, y: 35, r: 2 },
    { x: 20, y: 48, r: 5 },
    { x: 48, y: 60, r: 5 },
    { x: 20, y: 72, r: 5 },
    { x: 20, y: 120, r: 2 },
    { x: 50, y: 120, r: 6 },
    { x: 50, y: 100, r: 6 },
    { x: 70, y: 100, r: 5 },
    { x: 135, y: 35, r: 8 },
    { x: 145, y: 35, r: 5 },
    { x: 145, y: 14, r: 7 },
    { x: 162, y: 14, r: 7 },
    { x: 162, y: 40, r: 7 },
    { x: 182, y: 40, r: 2 },
    { x: 182, y: 52, r: 5 },
    { x: 154, y: 64, r: 5 },
    { x: 182, y: 76, r: 5 },
    { x: 182, y: 120, r: 2 },
    { x: 150, y: 120, r: 2 },
    { x: 150, y: 105, r: 6 },
    { x: 135, y: 105, r: 8 },
    { x: 65, y: 35, r: 8 },
  ],
  tape,
);

const lineLeft = sensor('lineLeft');
const lineRight = sensor('lineRight');
/** Moving backward on this tick: the step since the last one points against the heading. */
const reversing = (s: Snapshot, memo: Record<string, unknown>) => {
  const before = memo.pose as Vec | undefined;
  memo.pose = { x: s.pose.x, y: s.pose.y };
  if (!before) return false;
  const along =
    (s.pose.x - before.x) * Math.cos(s.pose.heading) +
    (s.pose.y - before.y) * Math.sin(s.pose.heading);
  return along < -0.02;
};
/** A hand that reaches in front of the robot, waits, and pulls back. Keys are seconds and left edges. */
const hand = (y: number, keys: [number, number][]) => ({
  id: 'hand',
  kind: 'hand' as const,
  w: 7,
  h: 13,
  keys: keys.map(([t, x]) => ({ t, x, y: y - 6.5 })),
});
// ---- algorithm practice: only the Serial Monitor matters ----
/** Compare lines the way a teacher would: ignore case and extra spaces. */
const tidy = (line: string) => line.trim().toLowerCase().replace(/\s+/g, ' ');
/** Times-table lines match with or without spaces, and with x, × or *. */
const tidyProduct = (line: string) => tidy(line).replace(/[×*]/g, 'x').replace(/\s/g, '');
const linesStart = (
  lines: readonly string[],
  expected: readonly (string | number)[],
  norm = tidy,
) =>
  lines.length >= expected.length &&
  expected.every((value, index) => norm(lines[index] ?? '') === norm(String(value)));
/** The opening lines are right (judged while the program runs). */
const opensWith = (
  id: string,
  expected: readonly (string | number)[],
  label: Localized,
  norm = tidy,
): Goal => ({
  id,
  label,
  check: (s) => linesStart(s.serial, expected, norm),
});
/** Exactly these lines and nothing else, judged once the program has finished. */
const printsExactly = (
  expected: readonly (string | number)[],
  label: Localized,
  norm = tidy,
): Goal => ({
  id: 'output',
  label,
  final: true,
  check: (s) =>
    s.programDone && s.serial.length === expected.length && linesStart(s.serial, expected, norm),
});
const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, index) => from + index * step);
/** A desk: Momo sits still and only its Serial Monitor is shown. */
const desk: Mission['arena'] = { width: 120, height: 80, lines: [], boxes: [], zones: [] };
const algo: Pick<Mission, 'robot' | 'arena' | 'start' | 'failOnBump' | 'view'> = {
  robot: 'board',
  arena: desk,
  start: { x: 60, y: 40, heading: 0 },
  failOnBump: false,
  view: 'serial',
};
const print = (value: Expr): Statement => ({ kind: 'print', value });
const set = (name: string, value: Expr): Statement => ({ kind: 'set', name, value });
const countWith = (name: string, from: Expr, to: Expr, body: Statement[], by = 1): Statement => ({
  kind: 'for',
  name,
  from,
  to,
  by: n(by),
  body,
});
const mod = (a: Expr, b: Expr): Expr => ({ kind: 'math', op: 'MODULO', a, b });
const div = (a: Expr, b: Expr): Expr => ({ kind: 'math', op: 'DIVIDE', a, b });
/** Lines compared without spaces, so "3! = 6" and "3!=6" both count. */
const compact = (line: string) => tidy(line).replace(/\s/g, '');
/** A line holds exactly these numbers, in this order (units and words around them are free). */
const sameNumbers = (line: string | undefined, expected: number[]) => {
  const found = numbersIn(line ?? '');
  return found.length === expected.length && expected.every((value, i) => found[i] === value);
};
/** The night light's words, in Indonesian or English. */
const lampOn = (shown: string) => /nyala|light on|\bon\b/i.test(shown) && !/mati|off/i.test(shown);
const lampOff = (shown: string) => /mati|off/i.test(shown) && !/nyala|light on/i.test(shown);
/** How far the robot has turned one way since the run began, in radians (left is negative). */
const spun = (s: Snapshot, memo: Record<string, unknown>, way: 'left' | 'right' = 'left') => {
  const before = memo.heading as number | undefined;
  memo.heading = s.pose.heading;
  const step = before === undefined ? 0 : s.pose.heading - before;
  const total = Number(memo.total ?? 0) + (way === 'left' ? Math.min(0, step) : Math.max(0, step));
  memo.total = total;
  return total;
};
const eq = (a: Expr, b: Expr): Expr => ({ kind: 'compare', op: 'EQ', a, b });
const join = (...parts: Expr[]): Expr => ({ kind: 'join', parts });
// Starter blocks for the algorithm practice.
const getVar = (name: string): StarterBlock => ({
  type: 'variables_get',
  fields: { VAR: { name } },
});
const setVar = (name: string, value: number): StarterBlock => ({
  type: 'variables_set',
  fields: { VAR: { name } },
  inputs: { VALUE: plug({ type: 'math_number', fields: { NUM: value } }) },
});
const printBlock = (value: StarterBlock): StarterBlock => ({
  type: 'sim_print',
  inputs: { VALUE: plug(value) },
});
const textBlock = (text: string): StarterBlock => ({ type: 'text', fields: { TEXT: text } });
const countBlock = (
  name: string,
  from: number,
  to: number,
  body?: StarterBlock,
  by = 1,
): StarterBlock => ({
  type: 'controls_for',
  fields: { VAR: { name } },
  inputs: {
    FROM: shadowNum(from),
    TO: shadowNum(to),
    BY: shadowNum(by),
    ...(body ? { DO: plug(body) } : {}),
  },
});

/** Scripted claps for the clap counter; the goal checks the count against them. */
const counterClaps = [1.5, 3.5, 5.5];

const followSd = (speed: number): Statement => ({
  kind: 'if',
  branches: [
    { cond: and(lineLeft, lineRight), body: [drive('forward', speed)] },
    { cond: lineLeft, body: [drive('left', speed)] },
    { cond: lineRight, body: [drive('right', speed)] },
  ],
  otherwise: [drive('forward', speed)],
});

export const missions: readonly Mission[] = [
  {
    id: 'ciko-kenalan',
    robot: 'ciko',
    arena: { width: 160, height: 100, lines: [], boxes: [], zones: [] },
    start: { x: 40, y: 50, heading: 0 },
    timeLimit: 20,
    failOnBump: false,
    goals: [
      {
        id: 'face',
        label: l('Tampilkan wajah senang', 'Show a happy face'),
        check: (s) => s.face === 'senang',
      },
      { id: 'beep', label: l('Bunyikan bip', 'Play a beep'), check: (s) => s.beeps > 0 },
      {
        id: 'move',
        label: l('Maju minimal 10 cm', 'Move forward at least 10 cm'),
        check: (s) => s.pose.x - 40 >= 10,
      },
    ],
    hint: l(
      'Ambil blok wajah dan bip dari kategori "Wajah, lampu, bunyi", lalu blok maju.',
      'Take the face and beep blocks from "Face, lights, sound", then a forward block.',
    ),
    starter: starter({ type: 'sim_face', fields: { FACE: 'senang' } }),
    solution: {
      body: [
        { kind: 'face', face: 'senang' },
        { kind: 'beep', seconds: n(0.3) },
        drive('forward', 60, 1),
      ],
    },
  },
  {
    id: 'ciko-finish',
    robot: 'ciko',
    arena: {
      width: 200,
      height: 100,
      lines: [
        {
          points: [
            { x: 150, y: 30 },
            { x: 150, y: 70 },
          ],
          width: 1.2,
        },
      ],
      boxes: [],
      zones: [zone('start', 'start', 30, 50, 30, 30), zone('finish', 'finish', 162.5, 50, 25, 40)],
    },
    start: { x: 30, y: 50, heading: 0 },
    timeLimit: 20,
    failOnBump: true,
    goals: [stoppedIn('finish', l('Berhenti di dalam zona finis', 'Stop inside the finish zone'))],
    hint: l(
      'Pada kecepatan 60%, robot menempuh sekitar 18 cm per detik. Jaraknya sekitar 130 cm.',
      'At 60% the robot covers about 18 cm per second. The distance is about 130 cm.',
    ),
    starter: starter({ type: 'sim_drive_for', fields: { DIR: 'forward', SPEED: 60, SECONDS: 2 } }),
    solution: { body: [drive('forward', 60, 7.3)] },
  },
  {
    id: 'ciko-belok',
    robot: 'ciko',
    arena: {
      width: 180,
      height: 140,
      lines: [],
      boxes: [{ x: 50, y: 40, w: 45, h: 55 }],
      zones: [
        zone('start', 'start', 30, 110, 28, 28),
        zone('corner', 'checkpoint', 110, 110, 26, 26),
        zone('finish', 'finish', 110, 30, 26, 26),
      ],
    },
    start: { x: 30, y: 110, heading: 0 },
    timeLimit: 30,
    failOnBump: true,
    goals: [
      visit('corner', l('Sampai di tikungan', 'Reach the corner')),
      stoppedIn(
        'finish',
        l('Belok kiri lalu berhenti di zona finis', 'Turn left, then stop in the finish zone'),
      ),
    ],
    hint: l(
      'Di kecepatan 50%, robot berputar sekitar 143° setiap detik. Seperempat putaran itu 90°. Berapa detik yang dibutuhkan?',
      'At 50% speed the robot spins about 143° every second. A quarter turn is 90°. How many seconds is that?',
    ),
    starter: starter(
      { type: 'sim_drive_for', fields: { DIR: 'forward', SPEED: 50, SECONDS: 5.3 } },
      { type: 'sim_drive_for', fields: { DIR: 'left', SPEED: 50, SECONDS: 1 } },
      { type: 'sim_drive_for', fields: { DIR: 'forward', SPEED: 50, SECONDS: 5.3 } },
    ),
    solution: {
      body: [drive('forward', 50, 5.33), drive('left', 50, 0.63), drive('forward', 50, 5.33)],
    },
  },
  {
    id: 'ciko-sein',
    robot: 'ciko',
    arena: {
      width: 180,
      height: 140,
      lines: [],
      boxes: [{ x: 50, y: 40, w: 45, h: 55 }],
      zones: [
        zone('start', 'start', 30, 110, 28, 28),
        zone('corner', 'checkpoint', 110, 110, 26, 26),
        zone('finish', 'finish', 110, 30, 26, 26),
      ],
    },
    start: { x: 30, y: 110, heading: 0 },
    timeLimit: 30,
    failOnBump: true,
    goals: [
      {
        id: 'sein-kiri',
        label: l(
          'Sein kiri menyala paling sedikit 0,5 detik sebelum belok',
          'Left signal on for at least 0.5 seconds before the turn',
        ),
        // Judged once, at the moment the robot starts turning left.
        check: (s, memo) => {
          if (s.turning !== 'left' || memo.judged) return false;
          memo.judged = true;
          return s.signal === 'left' && s.signalFor >= 0.5;
        },
      },
      {
        id: 'sein-mati',
        label: l('Sein mati lagi sebelum maju ke finis', 'Signal off again before driving on'),
        check: (s) =>
          s.met.has('sein-kiri') && s.turning === null && s.speed > 1 && s.signal === 'off',
      },
      stoppedIn('finish', l('Berhenti di zona finis', 'Stop in the finish zone')),
    ],
    hint: l(
      'Pengemudi menyalakan sein dulu, menunggu sebentar, baru berbelok. Blok lampu sein ada di kategori "Wajah, lampu, bunyi".',
      'Drivers switch the signal on first, wait a moment, and only then turn. The signal blocks are in "Face, lights, sound".',
    ),
    starter: starter(
      { type: 'sim_drive_for', fields: { DIR: 'forward', SPEED: 50, SECONDS: 5.33 } },
      { type: 'sim_drive_for', fields: { DIR: 'left', SPEED: 50, SECONDS: 0.63 } },
      { type: 'sim_drive_for', fields: { DIR: 'forward', SPEED: 50, SECONDS: 5.33 } },
    ),
    solution: {
      body: [
        drive('forward', 50, 5.33),
        signal('left'),
        wait(1),
        drive('left', 50, 0.63),
        signal('off'),
        drive('forward', 50, 5.33),
      ],
    },
  },
  {
    id: 'ciko-kotak',
    robot: 'ciko',
    arena: {
      width: 180,
      height: 140,
      lines: [],
      boxes: [],
      zones: [
        zone('start', 'start', 50, 110, 36, 36),
        zone('c1', 'checkpoint', 50, 30, 30, 30),
        zone('c2', 'checkpoint', 130, 30, 30, 30),
        zone('c3', 'checkpoint', 130, 110, 30, 30),
      ],
    },
    start: { x: 50, y: 110, heading: -Math.PI / 2 },
    timeLimit: 40,
    failOnBump: true,
    goals: [
      visit('c1', l('Sudut 1', 'Corner 1')),
      visit('c2', l('Sudut 2', 'Corner 2'), 'c1'),
      visit('c3', l('Sudut 3', 'Corner 3'), 'c2'),
      {
        id: 'home',
        label: l('Kembali dan berhenti di titik awal', 'Return and stop at the start'),
        final: true,
        check: (s) => s.met.has('c3') && s.inZone('start') && s.speed < 0.5,
      },
    ],
    hint: l(
      'Sisi kotak 80 cm. Pada kecepatan 50%, belok 90° butuh sekitar 0,63 detik.',
      'Each side is 80 cm. At 50% speed a 90° turn takes about 0.63 seconds.',
    ),
    starter: starter(
      { type: 'sim_drive_for', fields: { DIR: 'forward', SPEED: 50, SECONDS: 5.3 } },
      { type: 'sim_drive_for', fields: { DIR: 'right', SPEED: 50, SECONDS: 0.6 } },
    ),
    solution: {
      body: [
        {
          kind: 'repeat',
          times: n(4),
          body: [drive('forward', 50, 5.33), drive('right', 50, 0.63)],
        },
      ],
    },
  },
  {
    id: 'ciko-rintangan',
    robot: 'ciko',
    arena: {
      width: 200,
      height: 100,
      lines: [],
      boxes: [{ x: 150, y: 35, w: 20, h: 30 }],
      zones: [zone('start', 'start', 30, 50, 30, 30)],
    },
    start: { x: 30, y: 50, heading: 0 },
    timeLimit: 25,
    failOnBump: true,
    goals: [
      {
        id: 'alert',
        label: l('Tampilkan wajah waspada', 'Show the alert face'),
        check: (s) => s.face === 'waspada',
      },
      stoppedBeforeObstacle,
    ],
    hint: l(
      'Maju terus, lalu tunggu sampai jarak depan kurang dari 15 cm sebelum berhenti.',
      'Keep driving, then wait until the front distance is under 15 cm before stopping.',
    ),
    starter: starter({ type: 'sim_drive', fields: { DIR: 'forward', SPEED: 50 } }),
    solution: {
      body: [
        drive('forward', 50),
        { kind: 'waitUntil', cond: lt(sensor('distance'), n(15)) },
        stop,
        { kind: 'face', face: 'waspada' },
        { kind: 'beep', seconds: n(0.3) },
      ],
    },
  },
  {
    id: 'ciko-hindar',
    robot: 'ciko',
    arena: {
      width: 200,
      height: 100,
      lines: [],
      boxes: [
        { x: 80, y: 18, w: 112, h: 10 },
        { x: 80, y: 72, w: 112, h: 10 },
        { x: 182, y: 28, w: 10, h: 44 },
      ],
      zones: [zone('start', 'start', 115, 50, 26, 26), zone('exit', 'finish', 35, 50, 30, 30)],
    },
    start: { x: 115, y: 50, heading: 0 },
    timeLimit: 30,
    failOnBump: true,
    goals: [
      {
        id: 'turn',
        label: l(
          'Putar balik di ujung lorong tanpa menabrak',
          'Turn around at the dead end without bumping',
        ),
        check: (s) => Math.cos(s.pose.heading) < -0.95,
      },
      visit(
        'exit',
        l('Keluar dari lorong ke zona finis', 'Leave the corridor for the finish zone'),
        'turn',
      ),
    ],
    hint: l(
      'Ulangi selamanya. Jika jarak kurang dari 15 cm: mundur sebentar, lalu belok 50% sekitar 1,26 detik untuk putar balik. Jika tidak: maju.',
      'Repeat forever. If the distance is under 15 cm: back up a little, then turn at 50% for about 1.26 seconds to face the other way. Otherwise: go forward.',
    ),
    starter: starter({
      type: 'sim_forever',
      inputs: {
        DO: plug({
          type: 'controls_if',
          extraState: { hasElse: true },
          inputs: {
            IF0: plug(distanceBelow(15)),
            ELSE: plug({ type: 'sim_drive', fields: { DIR: 'forward', SPEED: 50 } }),
          },
        }),
      },
    }),
    solution: {
      body: [
        {
          kind: 'forever',
          body: [
            {
              kind: 'if',
              branches: [
                {
                  cond: lt(sensor('distance'), n(15)),
                  body: [drive('backward', 50, 0.5), drive('right', 50, 1.26)],
                },
              ],
              otherwise: [drive('forward', 50)],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'ciko-garis',
    robot: 'ciko',
    arena: {
      width: 200,
      height: 140,
      lines: [stadium],
      boxes: [],
      zones: [
        zone('c1', 'checkpoint', 180, 70, 28, 28),
        zone('c2', 'checkpoint', 100, 110, 28, 28),
        zone('c3', 'checkpoint', 20, 70, 28, 28),
        zone('lap', 'finish', 120, 30, 24, 24),
      ],
    },
    start: { x: 90, y: 30, heading: 0 },
    timeLimit: 120,
    failOnBump: false,
    goals: [
      visit('c1', l('Tikungan kanan', 'Right bend')),
      visit('c2', l('Lintasan bawah', 'Bottom straight'), 'c1'),
      visit('c3', l('Tikungan kiri', 'Left bend'), 'c2'),
      visit('lap', l('Selesaikan satu putaran', 'Complete one lap'), 'c3'),
    ],
    hint: l(
      'Ulangi selamanya: jika garis kiri, belok kiri; jika garis kanan, belok kanan; jika tidak, maju.',
      'Repeat forever: line on the left, turn left; on the right, turn right; otherwise go forward.',
    ),
    starter: starter({ type: 'sim_forever' }),
    solution: { body: [{ kind: 'forever', body: [followSd(40)] }] },
  },
  {
    id: 'ciko-persimpangan',
    robot: 'ciko',
    arena: {
      width: 200,
      height: 120,
      lines: [
        {
          width: tape,
          points: [
            { x: 12, y: 85 },
            { x: 60, y: 85 },
            { x: 100, y: 55 },
            { x: 172, y: 55 },
          ],
        },
        {
          width: 5,
          points: [
            { x: 176, y: 38 },
            { x: 176, y: 72 },
          ],
        },
      ],
      boxes: [],
      zones: [
        zone('bend', 'checkpoint', 120, 55, 24, 24),
        zone('stopline', 'finish', 164, 55, 22, 26),
      ],
    },
    start: { x: 22, y: 85, heading: 0 },
    timeLimit: 45,
    failOnBump: false,
    goals: [
      visit(
        'bend',
        l('Lewati belokan tanpa keluar garis', 'Get past the bend without leaving the line'),
      ),
      stoppedIn('stopline', l('Berhenti tepat di garis lebar', 'Stop right at the wide line')),
    ],
    hint: l(
      'Di dalam ulangi, pakai aturan belok dari misi Ikuti garis. Pengulangan berhenti sendiri saat sensor kiri dan kanan sama-sama melihat hitam.',
      'Inside the repeat, use the steering rules from the Follow the line mission. The repeat ends on its own when both sensors see black.',
    ),
    starter: starter(
      {
        type: 'controls_whileUntil',
        fields: { MODE: 'UNTIL' },
        inputs: {
          BOOL: plug({
            type: 'logic_operation',
            fields: { OP: 'AND' },
            inputs: { A: plug({ type: 'sim_line_left' }), B: plug({ type: 'sim_line_right' }) },
          }),
        },
      },
      { type: 'sim_stop' },
    ),
    solution: {
      body: [
        {
          kind: 'loop',
          until: true,
          cond: and(lineLeft, lineRight),
          body: [
            {
              kind: 'if',
              branches: [
                { cond: lineLeft, body: [drive('left', 40)] },
                { cond: lineRight, body: [drive('right', 40)] },
              ],
              otherwise: [drive('forward', 40)],
            },
          ],
        },
        stop,
        { kind: 'face', face: 'berhasil' },
      ],
    },
  },
  {
    id: 'ciko-misi-akhir',
    robot: 'ciko',
    arena: {
      width: 200,
      height: 120,
      lines: [
        {
          width: tape,
          points: [
            { x: 15, y: 70 },
            { x: 60, y: 70 },
            { x: 90, y: 50 },
            { x: 125, y: 50 },
            { x: 150, y: 70 },
            { x: 195, y: 70 },
          ],
        },
      ],
      boxes: [{ x: 172, y: 58, w: 18, h: 24 }],
      zones: [zone('mid', 'checkpoint', 108, 50, 24, 24)],
    },
    start: { x: 22, y: 70, heading: 0 },
    timeLimit: 60,
    failOnBump: true,
    goals: [
      visit('mid', l('Ikuti garis sampai bagian tengah', 'Follow the line past the middle')),
      stoppedBeforeObstacle,
      {
        id: 'face',
        label: l('Tampilkan ekspresi', 'Show an expression'),
        check: (s) => s.face !== 'normal',
      },
      { id: 'beep', label: l('Bunyikan bip', 'Play a beep'), check: (s) => s.beeps > 0 },
    ],
    hint: l(
      'Ulangi sampai jarak kurang dari 15 cm: aturan ikuti garis. Setelah itu berhenti, tampilkan wajah, dan bip.',
      'Repeat until the distance is under 15 cm: the line rules. Then stop, show a face, and beep.',
    ),
    starter: starter({ type: 'controls_whileUntil', fields: { MODE: 'UNTIL' } }),
    solution: {
      body: [
        { kind: 'loop', until: true, cond: lt(sensor('distance'), n(15)), body: [followSd(40)] },
        stop,
        { kind: 'face', face: 'berhasil' },
        { kind: 'beep', seconds: n(0.3) },
      ],
    },
  },
  {
    id: 'ciko-arena',
    robot: 'ciko',
    arena: {
      width: 200,
      height: 140,
      lines: [cikoArena],
      boxes: [],
      zones: [
        zone('c1', 'checkpoint', 52, 120, 28, 28),
        zone('c2', 'checkpoint', 168, 70, 28, 28),
        zone('c3', 'checkpoint', 150, 105, 28, 28),
        zone('lap', 'finish', 32, 35, 28, 28),
      ],
    },
    start: { x: 50, y: 35, heading: Math.PI },
    timeLimit: 70,
    failOnBump: false,
    goals: [
      visit('c1', l('Kantong kiri bawah', 'Bottom-left pocket')),
      visit('c2', l('Chicane kanan', 'Right chicane'), 'c1'),
      visit('c3', l('Sudut kanan bawah', 'Bottom-right corner'), 'c2'),
      visit(
        'lap',
        l('Kembali ke start dalam 70 detik', 'Back to the start within 70 seconds'),
        'c3',
      ),
    ],
    hint: l(
      'Program Ikuti garis sudah cukup, asal kecepatannya pas. Di persimpangan kedua sensor melihat hitam: jalan lurus. Terlalu cepat, Ciko lepas di kantong; terlalu pelan, waktunya habis.',
      'The Follow the line program is enough if the speed is right. At the crossing both sensors see black: go straight. Too fast and Ciko slips out of the pocket; too slow and time runs out.',
    ),
    starter: starter({ type: 'sim_forever' }),
    solution: { body: [{ kind: 'forever', body: [followSd(35)] }] },
  },
  {
    id: 'ciko-sapa',
    robot: 'ciko',
    arena: {
      width: 160,
      height: 100,
      lines: [],
      boxes: [],
      zones: [zone('start', 'start', 40, 50, 26, 26)],
      movers: [
        hand(50, [
          [0, 150],
          [1.5, 150],
          [2.8, 60],
          [5, 60],
          [6.2, 150],
          [8.5, 150],
          [9.8, 62],
          [12, 62],
          [13.2, 150],
        ]),
      ],
    },
    start: { x: 40, y: 50, heading: 0 },
    timeLimit: 16,
    failOnBump: true,
    goals: [
      {
        id: 'hello',
        label: l('Wajah senang saat tangan mendekat', 'Happy face when the hand comes close'),
        check: (s) => s.distance < 20 && s.face === 'senang',
      },
      {
        id: 'beep',
        label: l('Bip untuk menyapa', 'Beep to say hello'),
        check: (s, memo) => beepStarted(s, memo) && s.distance < 25,
      },
      {
        id: 'rest',
        label: l(
          'Kembali ke wajah biasa saat tangan pergi',
          'Back to the normal face once the hand leaves',
        ),
        check: (s) => s.met.has('hello') && s.distance > 50 && s.face === 'normal',
      },
      {
        id: 'again',
        label: l('Menyapa lagi saat tangan datang kembali', 'Greet again when the hand comes back'),
        check: (s) => s.met.has('rest') && s.distance < 20 && s.face === 'senang',
      },
    ],
    hint: l(
      'Ulangi selamanya. Jika jarak kurang dari 20 cm: wajah senang lalu bip. Jika tidak: wajah biasa.',
      'Repeat forever. If the distance is under 20 cm: happy face, then beep. Otherwise: normal face.',
    ),
    starter: starter({
      type: 'sim_forever',
      inputs: {
        DO: plug({
          type: 'controls_if',
          extraState: { hasElse: true },
          inputs: {
            IF0: plug(distanceBelow(20)),
            DO0: plug({ type: 'sim_face', fields: { FACE: 'senang' } }),
          },
        }),
      },
    }),
    solution: {
      body: [
        {
          kind: 'forever',
          body: [
            {
              kind: 'if',
              branches: [
                {
                  cond: lt(sensor('distance'), n(20)),
                  body: [
                    { kind: 'face', face: 'senang' },
                    { kind: 'beep', seconds: n(0.3) },
                    { kind: 'waitUntil', cond: gt(sensor('distance'), n(30)) },
                  ],
                },
              ],
              otherwise: [{ kind: 'face', face: 'normal' }],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'ciko-parkir',
    robot: 'ciko',
    arena: {
      width: 200,
      height: 120,
      lines: [],
      // Two boxes with one free parking space between them.
      boxes: [
        { x: 85, y: 70, w: 32, h: 42 },
        { x: 153, y: 70, w: 32, h: 42 },
      ],
      zones: [
        zone('start', 'start', 25, 38, 26, 26),
        zone('pass', 'checkpoint', 135, 38, 26, 26),
        zone('bay', 'finish', 135, 92, 30, 30),
      ],
    },
    start: { x: 25, y: 38, heading: 0 },
    timeLimit: 30,
    failOnBump: true,
    goals: [
      visit('pass', l('Maju sampai sejajar tempat parkir', 'Drive level with the space')),
      {
        id: 'hazard',
        label: l('Lampu hazard menyala saat mundur', 'Hazard lights on while reversing'),
        check: (s, memo) => reversing(s, memo) && s.signal === 'hazard',
      },
      {
        id: 'park',
        label: l(
          'Berhenti di tempat parkir, moncong menghadap jalan',
          'Stop in the space, nose facing the road',
        ),
        final: true,
        check: (s) =>
          s.met.has('pass') && s.inZone('bay') && s.speed < 0.5 && Math.sin(s.pose.heading) < -0.95,
      },
    ],
    hint: l(
      'Di 50%, Ciko menempuh 15 cm per detik dan belok 90° dalam sekitar 0,63 detik. Tempat parkir ada sekitar 110 cm di depan, lalu 54 cm ke bawah.',
      'At 50% Ciko covers 15 cm a second and turns 90° in about 0.63 seconds. The space is about 110 cm ahead, then 54 cm down.',
    ),
    starter: starter(
      { type: 'sim_drive_for', fields: { DIR: 'forward', SPEED: 50, SECONDS: 5 } },
      { type: 'sim_drive_for', fields: { DIR: 'left', SPEED: 50, SECONDS: 0.63 } },
    ),
    solution: {
      body: [
        drive('forward', 50, 7.33),
        drive('left', 50, 0.63),
        signal('hazard'),
        drive('backward', 50, 3.6),
        signal('off'),
      ],
    },
  },
  {
    id: 'ciko-patroli',
    robot: 'ciko',
    arena: {
      width: 200,
      height: 80,
      lines: [],
      boxes: [],
      zones: [
        zone('start', 'start', 100, 40, 26, 26),
        zone('east', 'checkpoint', 178, 40, 24, 40),
        zone('west', 'checkpoint', 22, 40, 24, 40),
      ],
    },
    start: { x: 100, y: 40, heading: 0 },
    timeLimit: 45,
    failOnBump: true,
    goals: [
      visit('east', l('Sampai di ujung kanan', 'Reach the right end')),
      visit('west', l('Lalu ujung kiri', 'Then the left end'), 'east'),
      {
        id: 'east-again',
        label: l('Kembali ke ujung kanan', 'Back to the right end'),
        check: (s) => s.met.has('west') && s.inZone('east'),
      },
      {
        id: 'beeps',
        label: l('Bip di setiap ujung', 'Beep at every end'),
        check: (s, memo) => {
          if (beepStarted(s, memo) && s.distance < 20) memo.count = Number(memo.count ?? 0) + 1;
          return Number(memo.count ?? 0) >= 3;
        },
      },
    ],
    hint: l(
      'Ulangi 3 kali: maju, tunggu sampai jarak kurang dari 15 cm, berhenti, bip, lalu belok 50% sekitar 1,26 detik untuk putar balik.',
      'Repeat 3 times: drive forward, wait until the distance is under 15 cm, stop, beep, then turn at 50% for about 1.26 seconds to face the other way.',
    ),
    starter: starter({
      type: 'sim_repeat',
      fields: { TIMES: 3 },
      inputs: { DO: plug({ type: 'sim_drive', fields: { DIR: 'forward', SPEED: 50 } }) },
    }),
    solution: {
      body: [
        {
          kind: 'repeat',
          times: n(3),
          body: [
            drive('forward', 50),
            { kind: 'waitUntil', cond: lt(sensor('distance'), n(15)) },
            stop,
            { kind: 'beep', seconds: n(0.3) },
            drive('right', 50, 1.26),
          ],
        },
      ],
    },
  },
  {
    id: 'ciko-ambulans',
    robot: 'ciko',
    arena: {
      width: 200,
      height: 100,
      lines: [],
      boxes: [],
      zones: [zone('start', 'start', 25, 50, 26, 26), zone('hospital', 'finish', 165, 50, 30, 40)],
    },
    start: { x: 25, y: 50, heading: 0 },
    timeLimit: 25,
    failOnBump: true,
    goals: [
      {
        id: 'hazard',
        label: l('Lampu hazard menyala selama jalan', 'Hazard lights on while driving'),
        check: (s) => s.signal === 'hazard' && s.speed > 1,
      },
      {
        id: 'beeps',
        label: l('Bip tiga kali', 'Beep three times'),
        check: (s) => s.beeps >= 3,
      },
      stoppedIn('hospital', l('Berhenti di zona rumah sakit', 'Stop in the hospital zone')),
    ],
    hint: l(
      'Urutannya: lampu hazard, bip tiga kali (pakai ulangi), lalu maju sekitar 140 cm. Di 50%, Ciko menempuh 15 cm per detik.',
      'In order: hazard lights, three beeps (use repeat), then drive about 140 cm. At 50% Ciko covers 15 cm a second.',
    ),
    starter: starter({ type: 'sim_drive_for', fields: { DIR: 'forward', SPEED: 50, SECONDS: 2 } }),
    solution: {
      body: [
        signal('hazard'),
        {
          kind: 'repeat',
          times: n(3),
          body: [{ kind: 'beep', seconds: n(0.2) }, wait(0.2)],
        },
        drive('forward', 50, 9.33),
      ],
    },
  },
  {
    id: 'ciko-tarian',
    robot: 'ciko',
    arena: { width: 160, height: 120, lines: [], boxes: [], zones: [] },
    start: { x: 80, y: 60, heading: 0 },
    timeLimit: 20,
    failOnBump: false,
    goals: [
      {
        id: 'spin-left',
        label: l('Satu putaran penuh ke kiri', 'One full turn to the left'),
        check: (s, memo) => spun(s, memo) <= -Math.PI * 1.9,
      },
      {
        id: 'spin-right',
        label: l('Satu putaran penuh ke kanan', 'One full turn to the right'),
        check: (s, memo) => spun(s, memo, 'right') >= Math.PI * 1.9,
      },
      {
        id: 'faces',
        label: l('Dua ekspresi wajah yang berbeda', 'Two different faces'),
        check: (s, memo) => {
          const seen = (memo.faces as Set<string> | undefined) ?? new Set<string>();
          memo.faces = seen;
          if (s.face !== 'normal') seen.add(s.face);
          return seen.size >= 2;
        },
      },
      {
        id: 'bow',
        label: l('Tutup dengan bip', 'Finish with a beep'),
        check: (s, memo) =>
          beepStarted(s, memo) && s.met.has('spin-left') && s.met.has('spin-right'),
      },
    ],
    hint: l(
      'Di 50%, satu putaran penuh butuh sekitar 2,5 detik. Ganti wajah di antara putaran supaya tariannya hidup.',
      'At 50% a full turn takes about 2.5 seconds. Change the face between the spins to bring the dance to life.',
    ),
    starter: starter(
      { type: 'sim_face', fields: { FACE: 'senang' } },
      { type: 'sim_drive_for', fields: { DIR: 'left', SPEED: 50, SECONDS: 1 } },
    ),
    solution: {
      body: [
        { kind: 'face', face: 'senang' },
        drive('left', 50, 2.52),
        { kind: 'face', face: 'berhasil' },
        drive('right', 50, 2.52),
        { kind: 'beep', seconds: n(0.4) },
      ],
    },
  },
  {
    id: 'ciko-labirin',
    robot: 'ciko',
    arena: {
      width: 200,
      height: 140,
      lines: [],
      // One block in the middle turns the floor into a corridor around it.
      boxes: [{ x: 40, y: 40, w: 120, h: 55 }],
      zones: [
        zone('start', 'start', 25, 115, 26, 26),
        zone('c1', 'checkpoint', 178, 115, 30, 30),
        zone('c2', 'checkpoint', 178, 23, 30, 30),
        zone('exit', 'finish', 25, 23, 30, 30),
      ],
    },
    start: { x: 25, y: 115, heading: 0 },
    timeLimit: 50,
    failOnBump: true,
    goals: [
      visit('c1', l('Sudut kanan bawah', 'Bottom-right corner')),
      visit('c2', l('Sudut kanan atas', 'Top-right corner'), 'c1'),
      visit('exit', l('Sampai di pintu keluar', 'Reach the exit'), 'c2'),
    ],
    hint: l(
      'Ulangi selamanya. Jika jarak kurang dari 15 cm: belok kiri 50% selama 0,63 detik, seperempat putaran. Jika tidak: maju.',
      'Repeat forever. If the distance is under 15 cm: turn left at 50% for 0.63 seconds, a quarter turn. Otherwise: drive forward.',
    ),
    starter: starter({
      type: 'sim_forever',
      inputs: {
        DO: plug({
          type: 'controls_if',
          extraState: { hasElse: true },
          inputs: {
            IF0: plug(distanceBelow(15)),
            ELSE: plug({ type: 'sim_drive', fields: { DIR: 'forward', SPEED: 50 } }),
          },
        }),
      },
    }),
    solution: {
      body: [
        {
          kind: 'forever',
          body: [
            {
              kind: 'if',
              branches: [{ cond: lt(sensor('distance'), n(15)), body: [drive('left', 50, 0.63)] }],
              otherwise: [drive('forward', 50)],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'momo-sistem',
    robot: 'momo',
    arena: {
      width: 160,
      height: 100,
      lines: [],
      boxes: [],
      zones: [zone('start', 'start', 40, 50, 26, 26)],
      movers: [
        {
          id: 'hand',
          kind: 'hand',
          w: 7,
          h: 13,
          keys: [
            { t: 0, x: 150, y: 43.5 },
            { t: 2, x: 150, y: 43.5 },
            { t: 3.5, x: 62, y: 43.5 },
            { t: 5.5, x: 62, y: 43.5 },
            { t: 7, x: 150, y: 43.5 },
          ],
        },
      ],
    },
    start: { x: 40, y: 50, heading: 0 },
    timeLimit: 12,
    failOnBump: true,
    goals: [
      {
        id: 'oled',
        label: l('Tulis jarak tangan di OLED', 'Write the hand distance on the OLED'),
        check: (s) => s.distance < 60 && showsNear(s.oledText, s.distance, 3),
      },
      {
        id: 'near',
        label: l(
          'Bunyikan nada saat tangan lebih dekat dari 20 cm',
          'Play a tone when the hand is closer than 20 cm',
        ),
        check: (s, memo) => beepStarted(s, memo) && s.distance < 20,
      },
      {
        id: 'quiet',
        label: l('Tetap diam saat tangan masih jauh', 'Stay quiet while the hand is far away'),
        check: (s, memo) => {
          if (beepStarted(s, memo) && s.distance > 30) memo.alarm = true;
          return !memo.alarm && s.time >= 8;
        },
      },
    ],
    hint: l(
      'Ulangi selamanya: tulis jarak di OLED baris 1. Setelah itu, jika jarak kurang dari 20, mainkan nada pendek.',
      'Repeat forever: write the distance on OLED line 1. After that, if the distance is under 20, play a short tone.',
    ),
    starter: starter({
      type: 'sim_forever',
      inputs: {
        DO: plug({
          type: 'sim_oled',
          fields: { LINE: '1' },
          inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: 'Jarak' } } } },
        }),
      },
    }),
    solution: {
      body: [
        {
          kind: 'forever',
          body: [
            {
              kind: 'oled',
              line: 1,
              value: { kind: 'join', parts: [text('Jarak '), sensor('distance')] },
            },
            {
              kind: 'if',
              branches: [
                {
                  cond: lt(sensor('distance'), n(20)),
                  body: [{ kind: 'tone', note: 'C6', seconds: n(0.15) }],
                },
              ],
              otherwise: [],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'momo-pwm',
    robot: 'momo',
    arena: {
      width: 200,
      height: 100,
      lines: [
        {
          points: [
            { x: 30, y: 50 },
            { x: 130, y: 50 },
          ],
          width: 0.6,
        },
      ],
      boxes: [],
      zones: [zone('start', 'start', 30, 50, 30, 30), zone('finish', 'finish', 130, 50, 24, 40)],
    },
    start: { x: 30, y: 50, heading: 0 },
    timeLimit: 15,
    failOnBump: true,
    goals: [stoppedIn('finish', l('Berhenti di zona 1 meter', 'Stop in the 1-metre zone'))],
    hint: l(
      'Motor kanan sedikit lebih lemah. Naikkan PWM kanan beberapa persen agar jalan lurus. Pada 60% robot menempuh sekitar 24 cm per detik.',
      'The right motor is slightly weaker. Raise the right PWM a few percent to drive straight. At 60% the robot covers about 24 cm per second.',
    ),
    starter: starter(
      { type: 'sim_motors', inputs: { LEFT: shadowNum(60), RIGHT: shadowNum(60) } },
      { type: 'sim_wait', fields: { SECONDS: 4 } },
      { type: 'sim_stop' },
    ),
    solution: { body: [motors(n(60), n(64)), wait(4.17), stop] },
  },
  {
    id: 'momo-garis',
    robot: 'momo',
    arena: {
      width: 200,
      height: 140,
      lines: [roundedTrack(30, 25, 140, 90, 22, tape)],
      boxes: [],
      zones: [
        zone('c1', 'checkpoint', 170, 70, 28, 28),
        zone('c2', 'checkpoint', 100, 115, 28, 28),
        zone('c3', 'checkpoint', 30, 70, 28, 28),
        zone('lap', 'finish', 120, 25, 24, 24),
      ],
    },
    start: { x: 80, y: 25, heading: 0 },
    timeLimit: 60,
    failOnBump: false,
    goals: [
      visit('c1', l('Sisi kanan', 'Right side')),
      visit('c2', l('Sisi bawah', 'Bottom side'), 'c1'),
      visit('c3', l('Sisi kiri', 'Left side'), 'c2'),
      visit('lap', l('Selesaikan satu putaran', 'Complete one lap'), 'c3'),
    ],
    hint: l(
      'Posisi garis bernilai -100 (kiri) sampai 100 (kanan). Tambahkan posisi × 0,35 ke motor kiri dan kurangi dari motor kanan.',
      'Line position runs from -100 (left) to 100 (right). Add position × 0.35 to the left motor and subtract it from the right.',
    ),
    starter: starter({ type: 'sim_forever' }),
    solution: {
      body: [
        {
          kind: 'forever',
          body: [
            motors(
              add(n(45), times(n(0.35), sensor('linePosition'))),
              minus(n(48), times(n(0.35), sensor('linePosition'))),
            ),
          ],
        },
      ],
    },
  },
  {
    id: 'momo-arena',
    robot: 'momo',
    arena: {
      width: 200,
      height: 140,
      lines: [momoArena],
      boxes: [],
      zones: [
        zone('c1', 'checkpoint', 35, 110, 28, 28),
        zone('c2', 'checkpoint', 153, 20, 28, 28),
        zone('c3', 'checkpoint', 168, 95, 28, 28),
        zone('lap', 'finish', 30, 35, 28, 28),
      ],
    },
    start: { x: 45, y: 35, heading: Math.PI },
    timeLimit: 32,
    failOnBump: false,
    goals: [
      visit('c1', l('Tangga kiri bawah', 'Bottom-left steps')),
      visit('c2', l('Hairpin', 'Hairpin'), 'c1'),
      visit('c3', l('Zigzag kanan', 'Right zigzag'), 'c2'),
      visit(
        'lap',
        l('Kembali ke start dalam 32 detik', 'Back to the start within 32 seconds'),
        'c3',
      ),
    ],
    hint: l(
      'Dengan kecepatan 45 dan gain 0,35 dari misi Ikuti garis, Momo terlalu lambat. Naikkan kecepatan, lalu naikkan juga gain-nya supaya tidak lepas di hairpin.',
      'At the speed of 45 and gain of 0.35 from the line mission, Momo is too slow. Raise the speed, then raise the gain too so it holds the hairpin.',
    ),
    starter: starter({ type: 'sim_forever' }),
    solution: {
      body: [
        {
          kind: 'forever',
          body: [
            motors(
              add(n(60), times(n(0.5), sensor('linePosition'))),
              minus(n(63), times(n(0.5), sensor('linePosition'))),
            ),
          ],
        },
      ],
    },
  },
  {
    id: 'momo-radar',
    robot: 'momo',
    arena: {
      width: 160,
      height: 140,
      lines: [],
      boxes: [
        { x: 40, y: 35, w: 80, h: 15 },
        { x: 100, y: 58, w: 50, h: 70 },
      ],
      zones: [zone('start', 'start', 80, 120, 26, 26), zone('goal', 'finish', 20, 85, 30, 40)],
    },
    start: { x: 80, y: 120, heading: -Math.PI / 2 },
    timeLimit: 30,
    failOnBump: true,
    goals: [
      stoppedIn(
        'goal',
        l('Sampai di zona tujuan tanpa menabrak', 'Reach the goal zone without touching anything'),
      ),
    ],
    hint: l(
      'Servo 180° menghadap kiri dan 0° menghadap kanan. Simpan jarak tiap arah ke variabel, lalu belok ke yang lebih jauh.',
      'Servo 180° faces left and 0° faces right. Store each distance in a variable, then turn toward the larger one.',
    ),
    starter: starter(
      { type: 'sim_motors', inputs: { LEFT: shadowNum(50), RIGHT: shadowNum(53) } },
      { type: 'sim_wait_until' },
      { type: 'sim_stop' },
    ),
    solution: {
      body: [
        motors(n(50), n(53)),
        { kind: 'waitUntil', cond: lt(sensor('distance'), n(25)) },
        stop,
        { kind: 'servo', angle: n(180) },
        wait(0.4),
        { kind: 'set', name: 'kiri', value: sensor('distance') },
        { kind: 'servo', angle: n(0) },
        wait(0.4),
        { kind: 'set', name: 'kanan', value: sensor('distance') },
        { kind: 'servo', angle: n(90) },
        {
          kind: 'if',
          branches: [
            { cond: gt(v('kiri'), v('kanan')), body: [motors(n(-50), n(50)), wait(0.526)] },
          ],
          otherwise: [motors(n(50), n(-50)), wait(0.526)],
        },
        motors(n(50), n(53)),
        wait(3),
        stop,
      ],
    },
  },
  {
    id: 'momo-lingkungan',
    robot: 'momo',
    arena: { width: 120, height: 80, lines: [], boxes: [], zones: [] },
    start: { x: 60, y: 40, heading: 0 },
    timeLimit: 12,
    failOnBump: false,
    envTimeline: [
      { t: 0, temperature: 27, humidity: 70 },
      { t: 6, temperature: 30.5, humidity: 62 },
    ],
    goals: [
      {
        id: 'first',
        label: l(
          'Tampilkan suhu dan kelembapan awal',
          'Show the starting temperature and humidity',
        ),
        check: (s) => s.time < 6 && s.oledText.includes('27') && s.oledText.includes('70'),
      },
      {
        id: 'update',
        label: l('Perbarui saat ruangan menghangat', 'Update it when the room warms up'),
        check: (s) => s.time >= 6 && s.oledText.includes('30') && s.oledText.includes('62'),
      },
    ],
    hint: l(
      'Ulangi selamanya: tulis suhu di baris 1, kelembapan di baris 2, lalu tunggu sebentar.',
      'Repeat forever: write temperature on line 1, humidity on line 2, then wait a moment.',
    ),
    starter: starter({ type: 'sim_forever' }),
    solution: {
      body: [
        {
          kind: 'forever',
          body: [
            {
              kind: 'oled',
              line: 1,
              value: { kind: 'join', parts: [text('Suhu '), sensor('temperature')] },
            },
            {
              kind: 'oled',
              line: 2,
              value: { kind: 'join', parts: [text('Lembap '), sensor('humidity')] },
            },
            wait(0.5),
          ],
        },
      ],
    },
  },
  {
    id: 'momo-suara',
    robot: 'momo',
    arena: {
      width: 200,
      height: 80,
      lines: [],
      boxes: [],
      zones: [zone('start', 'start', 30, 40, 26, 26)],
    },
    start: { x: 30, y: 40, heading: 0 },
    timeLimit: 12,
    failOnBump: true,
    claps: [2, 6],
    goals: [
      {
        id: 'go',
        label: l(
          'Diam, lalu jalan setelah tepukan pertama',
          'Stay still, then go after the first clap',
        ),
        check: (s, memo) => {
          if (s.time < 1.95 && s.speed > 3) memo.early = true;
          return !memo.early && s.time >= 2.2 && s.time <= 5.8 && s.speed > 3;
        },
      },
      {
        id: 'stop',
        label: l('Berhenti setelah tepukan kedua', 'Stop after the second clap'),
        final: true,
        check: (s) => s.met.has('go') && s.time > 6.3 && s.speed < 0.5,
      },
    ],
    hint: l(
      'Tepukan membuat tingkat suara naik di atas 70 dB. Beri jeda sebentar setelah tepukan pertama.',
      'A clap pushes the sound level above 70 dB. Pause briefly after the first clap.',
    ),
    starter: starter({ type: 'sim_wait_until' }),
    solution: {
      body: [
        { kind: 'waitUntil', cond: gt(sensor('sound'), n(70)) },
        motors(n(50), n(53)),
        wait(1),
        { kind: 'waitUntil', cond: gt(sensor('sound'), n(70)) },
        stop,
      ],
    },
  },
  {
    id: 'momo-telemetri',
    robot: 'momo',
    arena: { width: 120, height: 80, lines: [], boxes: [], zones: [] },
    start: { x: 60, y: 40, heading: 0 },
    timeLimit: 14,
    failOnBump: false,
    envTimeline: [
      { t: 0, temperature: 27, humidity: 68 },
      { t: 3, temperature: 27.5 },
      { t: 6, temperature: 28.5 },
      { t: 9, temperature: 29 },
    ],
    wifi: [
      { t: 4, online: false },
      { t: 8, online: true },
    ],
    goals: [
      {
        id: 'send',
        label: l(
          'Kirim suhu ke dasbor minimal tiga kali',
          'Send the temperature to the dashboard at least three times',
        ),
        check: (s) =>
          s.telemetry.filter(
            (point) => typeof point.value === 'number' && point.value >= 26 && point.value <= 30,
          ).length >= 3,
      },
      {
        id: 'offline',
        label: l(
          'Saat Wi-Fi putus, OLED menulis LURING dan suhu tetap tampil',
          'While the Wi-Fi is down, the OLED says OFFLINE and still shows the temperature',
        ),
        check: (s) =>
          !s.online &&
          /luring|offline/i.test(s.oledText) &&
          showsNear(s.oledText, s.env.temperature, 0.05),
      },
      {
        id: 'back',
        label: l(
          'Data masuk lagi setelah Wi-Fi kembali',
          'Data arrives again once the Wi-Fi is back',
        ),
        check: (s) => s.met.has('offline') && s.telemetry.some((point) => point.t >= 8),
      },
    ],
    hint: l(
      'Ulangi tiap 1 detik. Tulis suhu di OLED baris 1. Jika Wi-Fi tersambung, kirim suhu ke dasbor. Jika tidak, tulis LURING di baris 2.',
      'Repeat every second. Write the temperature on OLED line 1. If the Wi-Fi is connected, send the temperature to the dashboard. If not, write OFFLINE on line 2.',
    ),
    starter: starter({
      type: 'sim_forever',
      inputs: {
        DO: plug({
          type: 'sim_send',
          fields: { NAME: 'suhu' },
          inputs: { VALUE: plug({ type: 'sim_temperature' }) },
          next: plug({ type: 'sim_wait', fields: { SECONDS: 1 } }),
        }),
      },
    }),
    solution: {
      body: [
        {
          kind: 'forever',
          body: [
            {
              kind: 'oled',
              line: 1,
              value: { kind: 'join', parts: [text('Suhu '), sensor('temperature')] },
            },
            {
              kind: 'if',
              branches: [
                {
                  cond: sensor('wifi'),
                  body: [
                    { kind: 'send', key: 'suhu', value: sensor('temperature') },
                    { kind: 'oled', line: 2, value: text('Wi-Fi OK') },
                  ],
                },
              ],
              otherwise: [{ kind: 'oled', line: 2, value: text('LURING') }],
            },
            wait(1),
          ],
        },
      ],
    },
  },
  {
    id: 'momo-bebas',
    robot: 'momo',
    arena: {
      width: 220,
      height: 150,
      lines: [roundedTrack(25, 25, 120, 100, 25, tape)],
      boxes: [
        { x: 170, y: 30, w: 25, h: 25 },
        { x: 175, y: 95, w: 20, h: 35 },
      ],
      zones: [],
    },
    start: { x: 70, y: 25, heading: 0 },
    timeLimit: Infinity,
    failOnBump: false,
    free: true,
    goals: [],
    hint: l(
      'Arena bebas: atur suhu, kelembapan, dan tepuk tangan dari panel sensor.',
      'Free arena: set temperature, humidity, and claps from the sensor panel.',
    ),
    starter: starter(),
    solution: { body: [motors(n(40), n(42)), wait(1), stop] },
  },
  {
    id: 'momo-alarm',
    robot: 'momo',
    arena: { width: 120, height: 80, lines: [], boxes: [], zones: [] },
    start: { x: 60, y: 40, heading: 0 },
    timeLimit: 13,
    failOnBump: false,
    envTimeline: [
      { t: 0, temperature: 27, humidity: 60 },
      { t: 4, temperature: 31.5 },
      { t: 9, temperature: 28 },
    ],
    goals: [
      {
        id: 'normal',
        label: l('Tulis NORMAL saat suhu di bawah 30 °C', 'Write NORMAL while it is under 30 °C'),
        check: (s) => s.time < 4 && /normal/i.test(s.oledText) && !/panas|hot/i.test(s.oledText),
      },
      {
        id: 'alarm',
        label: l(
          'Lewat 30 °C: tulis PANAS dan bunyikan nada',
          'Over 30 °C: write HOT and play a tone',
        ),
        check: (s, memo) =>
          beepStarted(s, memo) && s.env.temperature > 30 && /panas|hot/i.test(s.oledText),
      },
      {
        id: 'calm',
        label: l('Kembali NORMAL setelah dingin', 'Back to NORMAL once it cools down'),
        check: (s) =>
          s.met.has('alarm') &&
          s.time >= 9 &&
          /normal/i.test(s.oledText) &&
          !/panas|hot/i.test(s.oledText),
      },
      {
        id: 'quiet',
        label: l('Diam selama suhu normal', 'Stay quiet while the temperature is normal'),
        check: (s, memo) => {
          if (beepStarted(s, memo) && s.env.temperature <= 30) memo.noisy = true;
          return !memo.noisy && s.time >= 11;
        },
      },
    ],
    hint: l(
      'Ulangi selamanya: tulis suhu di baris 1. Jika suhu lebih dari 30, tulis PANAS di baris 2 lalu mainkan nada. Jika tidak, tulis NORMAL. Tunggu 0,5 detik.',
      'Repeat forever: write the temperature on line 1. If it is over 30, write HOT on line 2 and play a tone. If not, write NORMAL. Wait 0.5 seconds.',
    ),
    starter: starter({
      type: 'sim_forever',
      inputs: {
        DO: plug({
          type: 'controls_if',
          extraState: { hasElse: true },
          inputs: {
            IF0: plug({
              type: 'logic_compare',
              fields: { OP: 'GT' },
              inputs: {
                A: plug({ type: 'sim_temperature' }),
                B: plug({ type: 'math_number', fields: { NUM: 30 } }),
              },
            }),
          },
        }),
      },
    }),
    solution: {
      body: [
        {
          kind: 'forever',
          body: [
            {
              kind: 'oled',
              line: 1,
              value: { kind: 'join', parts: [text('Suhu '), sensor('temperature')] },
            },
            {
              kind: 'if',
              branches: [
                {
                  cond: gt(sensor('temperature'), n(30)),
                  body: [
                    { kind: 'oled', line: 2, value: text('PANAS') },
                    { kind: 'tone', note: 'A5', seconds: n(0.2) },
                  ],
                },
              ],
              otherwise: [{ kind: 'oled', line: 2, value: text('NORMAL') }],
            },
            wait(0.5),
          ],
        },
      ],
    },
  },
  {
    id: 'momo-tepuk',
    robot: 'momo',
    arena: { width: 120, height: 80, lines: [], boxes: [], zones: [] },
    start: { x: 60, y: 40, heading: 0 },
    timeLimit: 10,
    failOnBump: false,
    claps: counterClaps,
    goals: [
      {
        id: 'count',
        label: l(
          'Tampilkan jumlah tepukan: 1, 2, lalu 3',
          'Show the number of claps: 1, 2, then 3',
        ),
        // The count may never run ahead of the claps heard so far, so one clap must add one.
        check: (s, memo) => {
          const heard = counterClaps.filter((clap) => clap <= s.time).length;
          const shown = numbersIn(s.oledText);
          if (shown.some((value) => value > heard)) memo.ahead = true;
          const next = Number(memo.next ?? 1);
          if (shown.includes(next)) memo.next = next + 1;
          return !memo.ahead && Number(memo.next ?? 1) > 3;
        },
      },
      {
        id: 'tone',
        label: l('Bunyikan nada setelah tepukan ketiga', 'Play a tone after the third clap'),
        check: (s, memo) => {
          const started = beepStarted(s, memo);
          if (started && s.time < counterClaps[2]!) memo.early = true;
          return started && !memo.early;
        },
      },
    ],
    hint: l(
      'Buat variabel tepuk = 0. Ulangi 3 kali: tunggu sampai suara lebih dari 70, tambah tepuk 1, tulis di OLED, lalu tunggu sampai suara kurang dari 50 agar satu tepukan tidak terhitung dua kali.',
      'Make a variable claps = 0. Repeat 3 times: wait until the sound is over 70, add 1 to claps, write it on the OLED, then wait until the sound is under 50 so one clap is not counted twice.',
    ),
    starter: starter({ type: 'sim_repeat', fields: { TIMES: 3 } }),
    solution: {
      body: [
        { kind: 'set', name: 'tepuk', value: n(0) },
        { kind: 'oled', line: 1, value: { kind: 'join', parts: [text('Tepuk '), v('tepuk')] } },
        {
          kind: 'repeat',
          times: n(3),
          body: [
            { kind: 'waitUntil', cond: gt(sensor('sound'), n(70)) },
            { kind: 'change', name: 'tepuk', delta: n(1) },
            { kind: 'oled', line: 1, value: { kind: 'join', parts: [text('Tepuk '), v('tepuk')] } },
            { kind: 'waitUntil', cond: lt(sensor('sound'), n(50)) },
          ],
        },
        { kind: 'tone', note: 'C6', seconds: n(0.5) },
      ],
    },
  },
  {
    id: 'momo-ikuti',
    robot: 'momo',
    arena: {
      width: 220,
      height: 80,
      lines: [],
      boxes: [],
      zones: [zone('start', 'start', 25, 40, 26, 26), zone('end', 'finish', 165, 40, 30, 36)],
      movers: [
        hand(40, [
          [0, 60],
          [2, 60],
          [5, 120],
          [7, 120],
          [10, 190],
        ]),
      ],
    },
    start: { x: 25, y: 40, heading: 0 },
    timeLimit: 20,
    failOnBump: true,
    goals: [
      {
        id: 'keep',
        label: l(
          'Jaga jarak 8 sampai 45 cm selama tangan bergerak',
          'Keep 8 to 45 cm away while the hand moves',
        ),
        check: (s, memo) => {
          if (s.time > 1 && (s.distance > 45 || s.distance < 8)) memo.lost = true;
          return !memo.lost && s.time >= 10.5;
        },
      },
      stoppedIn(
        'end',
        l('Berhenti di belakang tangan di ujung arena', 'Stop behind the hand at the far end'),
      ),
    ],
    hint: l(
      'Ulangi selamanya: selisih = jarak − 20. Motor kiri = selisih × 4, motor kanan sedikit lebih besar karena motornya lebih lemah. Tangan jauh, Momo cepat; tangan dekat, Momo pelan lalu berhenti.',
      'Repeat forever: gap = distance − 20. Left motor = gap × 4, right motor a little more because that motor is weaker. Hand far away, Momo is fast; hand close, Momo slows down and stops.',
    ),
    starter: starter({
      type: 'sim_forever',
      inputs: {
        DO: plug({ type: 'sim_motors', inputs: { LEFT: shadowNum(50), RIGHT: shadowNum(53) } }),
      },
    }),
    solution: {
      body: [
        {
          kind: 'forever',
          body: [
            motors(
              times(n(4), minus(sensor('distance'), n(20))),
              times(n(4.25), minus(sensor('distance'), n(20))),
            ),
          ],
        },
      ],
    },
  },
  {
    ...algo,
    id: 'algo-halo',
    timeLimit: 10,
    goals: [
      {
        id: 'hello',
        label: l('Baris pertama menyapa: Halo, dunia!', 'The first line says hello: Hello, world!'),
        check: (s) => /halo|hello/i.test(s.serial[0] ?? ''),
      },
      {
        id: 'name',
        label: l('Baris kedua: namamu', 'The second line: your name'),
        final: true,
        check: (s) => s.programDone && s.serial.length >= 2 && tidy(s.serial[1] ?? '').length > 0,
      },
    ],
    hint: l(
      'Blok cetak ada di kategori "Serial Monitor". Setiap blok cetak menulis satu baris baru.',
      'The print block is in the "Serial Monitor" category. Each print block writes a new line.',
    ),
    starter: starter(printBlock(textBlock('Halo, dunia!'))),
    solution: { body: [print(text('Halo, dunia!')), print(text('Budi'))] },
  },
  {
    ...algo,
    id: 'algo-hitung',
    timeLimit: 10,
    goals: [
      opensWith('first', [1], l('Baris pertama: 1', 'The first line: 1')),
      printsExactly(
        range(1, 10),
        l('Cetak 1 sampai 10, satu angka per baris', 'Print 1 to 10, one number per line'),
      ),
    ],
    hint: l(
      'Blok "hitung dengan i" mengisi variabel i dengan 1, 2, 3, … sampai 10. Masukkan blok cetak berisi variabel i ke dalamnya.',
      'The "count with i" block sets the variable i to 1, 2, 3, … up to 10. Put a print block with the variable i inside it.',
    ),
    starter: starter(countBlock('i', 1, 10)),
    solution: { body: [countWith('i', n(1), n(10), [print(v('i'))])] },
  },
  {
    ...algo,
    id: 'algo-mundur',
    timeLimit: 10,
    goals: [
      opensWith(
        'down',
        range(1, 10).reverse(),
        l('Hitung dari 10 turun ke 1', 'Count from 10 down to 1'),
      ),
      {
        id: 'launch',
        label: l('Lalu cetak "Meluncur!"', 'Then print "Lift off!"'),
        final: true,
        check: (s) =>
          s.programDone && s.serial.length === 11 && /meluncur|lift ?off/i.test(s.serial[10] ?? ''),
      },
    ],
    hint: l(
      'Hitungan juga bisa turun: hitung dengan i dari 10 sampai 1. Blok cetak "Meluncur!" ditaruh setelah perulangan, bukan di dalamnya.',
      'Counting can go down too: count with i from 10 to 1. The "Lift off!" print goes after the loop, not inside it.',
    ),
    starter: starter(countBlock('i', 1, 10, printBlock(getVar('i')))),
    solution: { body: [countWith('i', n(10), n(1), [print(v('i'))]), print(text('Meluncur!'))] },
  },
  {
    ...algo,
    id: 'algo-genap',
    timeLimit: 10,
    goals: [
      opensWith('start', [2, 4], l('Mulai dari 2, lalu 4', 'Start at 2, then 4')),
      printsExactly(
        range(2, 20, 2),
        l('Cetak semua bilangan genap sampai 20', 'Print every even number up to 20'),
      ),
    ],
    hint: l(
      'Ada dua cara. Hitung dari 2 sampai 20 setiap 2, atau hitung 1 sampai 20 dan cetak hanya jika sisa bagi 2 sama dengan 0.',
      'There are two ways. Count from 2 to 20 by 2, or count 1 to 20 and print only when the remainder of dividing by 2 is 0.',
    ),
    starter: starter(countBlock('i', 1, 20)),
    solution: { body: [countWith('i', n(2), n(20), [print(v('i'))], 2)] },
  },
  {
    ...algo,
    id: 'algo-jumlah',
    timeLimit: 10,
    goals: [
      {
        id: 'sum',
        label: l('Cetak jumlah yang benar', 'Print the right total'),
        final: true,
        check: (s) => s.programDone && numbersIn(s.serial.at(-1) ?? '').includes(5050),
      },
      {
        id: 'once',
        label: l('Hanya hasil akhirnya, dalam satu baris', 'Only the final result, on one line'),
        final: true,
        check: (s) => s.programDone && s.serial.length === 1,
      },
    ],
    hint: l(
      'Buat variabel jumlah = 0. Hitung dengan i dari 1 sampai 100: ubah jumlah sebesar i. Cetak jumlah setelah perulangan selesai.',
      'Make a variable total = 0. Count with i from 1 to 100: change total by i. Print total once the loop is over.',
    ),
    starter: starter(setVar('jumlah', 0), countBlock('i', 1, 100)),
    solution: {
      body: [
        set('jumlah', n(0)),
        countWith('i', n(1), n(100), [{ kind: 'change', name: 'jumlah', delta: v('i') }]),
        print(v('jumlah')),
      ],
    },
  },
  {
    ...algo,
    id: 'algo-perkalian',
    timeLimit: 10,
    goals: [
      opensWith(
        'first',
        ['7 x 1 = 7'],
        l('Baris pertama: 7 x 1 = 7', 'The first line: 7 x 1 = 7'),
        tidyProduct,
      ),
      printsExactly(
        range(1, 10).map((i) => `7 x ${i} = ${7 * i}`),
        l('Sampai 7 x 10 = 70', 'Through 7 x 10 = 70'),
        tidyProduct,
      ),
    ],
    hint: l(
      'Gabungkan teks dengan blok "buat teks dengan": 7, " x ", i, " = ", lalu hasil 7 × i dari blok hitung.',
      'Join text with the "create text with" block: 7, " x ", i, " = ", then 7 × i from the arithmetic block.',
    ),
    starter: starter(
      countBlock(
        'i',
        1,
        10,
        printBlock({
          type: 'text_join',
          extraState: { itemCount: 2 },
          inputs: { ADD0: plug(textBlock('7 x ')), ADD1: plug(getVar('i')) },
        }),
      ),
    ),
    solution: {
      body: [
        countWith('i', n(1), n(10), [
          print(join(text('7 x '), v('i'), text(' = '), times(n(7), v('i')))),
        ]),
      ],
    },
  },
  {
    ...algo,
    id: 'algo-fizzbuzz',
    timeLimit: 10,
    goals: [
      {
        id: 'fizz',
        label: l('Angka 3 jadi Fizz', '3 becomes Fizz'),
        check: (s) => tidy(s.serial[2] ?? '') === 'fizz',
      },
      {
        id: 'buzz',
        label: l('Angka 5 jadi Buzz', '5 becomes Buzz'),
        check: (s) => tidy(s.serial[4] ?? '') === 'buzz',
      },
      printsExactly(
        [
          '1',
          '2',
          'Fizz',
          '4',
          'Buzz',
          'Fizz',
          '7',
          '8',
          'Fizz',
          'Buzz',
          '11',
          'Fizz',
          '13',
          '14',
          'FizzBuzz',
        ],
        l(
          'Angka 15 jadi FizzBuzz, dan semua baris benar',
          '15 becomes FizzBuzz, and every line is right',
        ),
      ),
    ],
    hint: l(
      'Pakai blok sisa bagi. Cek kelipatan 15 lebih dulu, baru 3 lalu 5, karena 15 juga kelipatan 3 dan 5. Tambahkan cabang lewat ikon roda gigi pada blok jika.',
      'Use the remainder block. Check multiples of 15 first, then 3, then 5, because 15 is also a multiple of 3 and 5. Add branches with the gear icon on the if block.',
    ),
    starter: starter(
      countBlock('i', 1, 15, {
        type: 'controls_if',
        extraState: { hasElse: true },
        inputs: {
          IF0: plug({
            type: 'logic_compare',
            fields: { OP: 'EQ' },
            inputs: {
              A: plug({
                type: 'math_modulo',
                inputs: { DIVIDEND: plug(getVar('i')), DIVISOR: shadowNum(3) },
              }),
              B: plug({ type: 'math_number', fields: { NUM: 0 } }),
            },
          }),
          DO0: plug(printBlock(textBlock('Fizz'))),
          ELSE: plug(printBlock(getVar('i'))),
        },
      }),
    ),
    solution: {
      body: [
        countWith('i', n(1), n(15), [
          {
            kind: 'if',
            branches: [
              { cond: eq(mod(v('i'), n(15)), n(0)), body: [print(text('FizzBuzz'))] },
              { cond: eq(mod(v('i'), n(3)), n(0)), body: [print(text('Fizz'))] },
              { cond: eq(mod(v('i'), n(5)), n(0)), body: [print(text('Buzz'))] },
            ],
            otherwise: [print(v('i'))],
          },
        ]),
      ],
    },
  },
  {
    ...algo,
    id: 'algo-fibonacci',
    timeLimit: 10,
    goals: [
      opensWith('start', [0, 1, 1], l('Mulai dari 0, 1, 1', 'Start with 0, 1, 1')),
      printsExactly(
        [0, 1, 1, 2, 3, 5, 8, 13, 21, 34],
        l('Sepuluh angka pertama, semuanya benar', 'The first ten numbers, all right'),
      ),
    ],
    hint: l(
      'Simpan dua angka terakhir di variabel a dan b. Ulangi 10 kali: cetak a, lalu c = a + b, a = b, b = c.',
      'Keep the last two numbers in variables a and b. Repeat 10 times: print a, then c = a + b, a = b, b = c.',
    ),
    starter: starter(setVar('a', 0), setVar('b', 1), {
      type: 'sim_repeat',
      fields: { TIMES: 10 },
      inputs: { DO: plug(printBlock(getVar('a'))) },
    }),
    solution: {
      body: [
        set('a', n(0)),
        set('b', n(1)),
        {
          kind: 'repeat',
          times: n(10),
          body: [print(v('a')), set('c', add(v('a'), v('b'))), set('a', v('b')), set('b', v('c'))],
        },
      ],
    },
  },
  {
    ...algo,
    id: 'algo-prima',
    timeLimit: 15,
    goals: [
      opensWith('start', [2, 3, 5], l('Mulai dari 2, 3, 5', 'Start with 2, 3, 5')),
      printsExactly(
        [2, 3, 5, 7, 11, 13, 17, 19, 23, 29],
        l(
          'Semua bilangan prima sampai 30, tanpa yang bukan',
          'Every prime up to 30, and nothing else',
        ),
      ),
    ],
    hint: l(
      'Dua perulangan bertumpuk. Untuk setiap n dari 2 sampai 30: prima = benar dan d = 2. Ulangi selama d < n: jika sisa bagi n oleh d sama dengan 0, prima = salah; ubah d sebesar 1. Setelah itu, cetak n jika prima.',
      'Two nested loops. For each n from 2 to 30: prime = true and d = 2. Repeat while d < n: if the remainder of n divided by d is 0, prime = false; change d by 1. Then print n if it is still prime.',
    ),
    starter: starter(countBlock('n', 2, 30, printBlock(getVar('n')))),
    solution: {
      body: [
        countWith('n', n(2), n(30), [
          set('prima', { kind: 'bool', value: true }),
          set('d', n(2)),
          {
            kind: 'loop',
            until: false,
            cond: lt(v('d'), v('n')),
            body: [
              {
                kind: 'if',
                branches: [
                  {
                    cond: eq(mod(v('n'), v('d')), n(0)),
                    body: [set('prima', { kind: 'bool', value: false })],
                  },
                ],
                otherwise: [],
              },
              { kind: 'change', name: 'd', delta: n(1) },
            ],
          },
          { kind: 'if', branches: [{ cond: v('prima'), body: [print(v('n'))] }], otherwise: [] },
        ]),
      ],
    },
  },
  {
    ...algo,
    // A sensor project on Momo, shown on the Serial Monitor like the algorithm practice.
    robot: 'momo',
    id: 'momo-rata',
    timeLimit: 12,
    // Readings change between the one-second reads, never on them.
    envTimeline: [
      { t: 0, temperature: 27, humidity: 60 },
      { t: 0.5, temperature: 28 },
      { t: 1.5, temperature: 30 },
      { t: 2.5, temperature: 29 },
      { t: 3.5, temperature: 31 },
    ],
    goals: [
      opensWith(
        'each',
        [27, 28, 30, 29, 31],
        l('Cetak lima bacaan suhu, satu per detik', 'Print five readings, one a second'),
      ),
      {
        id: 'average',
        label: l('Lalu cetak rata-ratanya', 'Then print the average'),
        final: true,
        check: (s) =>
          s.programDone && s.serial.length === 6 && numbersIn(s.serial[5] ?? '').includes(29),
      },
    ],
    hint: l(
      'Buat variabel total = 0. Ulangi 5 kali: cetak suhu, tambahkan ke total, tunggu 1 detik. Rata-rata adalah total dibagi 5.',
      'Make a variable total = 0. Repeat 5 times: print the temperature, add it to total, wait 1 second. The average is total divided by 5.',
    ),
    starter: starter(setVar('total', 0), {
      type: 'sim_repeat',
      fields: { TIMES: 5 },
      inputs: {
        DO: plug({
          ...printBlock({ type: 'sim_temperature' }),
          next: plug({ type: 'sim_wait', fields: { SECONDS: 1 } }),
        }),
      },
    }),
    solution: {
      body: [
        set('total', n(0)),
        {
          kind: 'repeat',
          times: n(5),
          body: [
            set('t', sensor('temperature')),
            print(v('t')),
            { kind: 'change', name: 'total', delta: v('t') },
            wait(1),
          ],
        },
        print(join(text('Rata-rata '), { kind: 'math', op: 'DIVIDE', a: v('total'), b: n(5) })),
      ],
    },
  },
  {
    ...algo,
    id: 'algo-ulang',
    timeLimit: 10,
    goals: [
      {
        id: 'five',
        label: l('Lima baris "Aku bisa coding!"', 'Five lines of "I can code!"'),
        final: true,
        check: (s) =>
          s.programDone &&
          s.serial.length === 5 &&
          s.serial.every((line) => /aku bisa coding|i can code/i.test(line)),
      },
    ],
    hint: l(
      'Ambil blok "ulangi 5 kali" dari kategori Kontrol, lalu masukkan blok cetak ke dalamnya.',
      'Take the "repeat 5 times" block from Control, then put the print block inside it.',
    ),
    starter: starter(printBlock(textBlock('Aku bisa coding!'))),
    solution: {
      body: [{ kind: 'repeat', times: n(5), body: [print(text('Aku bisa coding!'))] }],
    },
  },
  {
    ...algo,
    id: 'algo-besar',
    timeLimit: 10,
    goals: [
      opensWith('first', [6], l('Baris pertama: 6', 'The first line: 6')),
      printsExactly(range(6, 10), l('Cetak 6 sampai 10 saja', 'Print only 6 to 10')),
    ],
    hint: l(
      'Bungkus blok cetak dengan blok "jika": jika i lebih dari 5, cetak i.',
      'Wrap the print block in an "if" block: if i is more than 5, print i.',
    ),
    starter: starter(countBlock('i', 1, 10, printBlock(getVar('i')))),
    solution: {
      body: [
        countWith('i', n(1), n(10), [
          {
            kind: 'if',
            branches: [{ cond: gt(v('i'), n(5)), body: [print(v('i'))] }],
            otherwise: [],
          },
        ]),
      ],
    },
  },
  {
    ...algo,
    id: 'algo-faktorial',
    timeLimit: 10,
    goals: [
      opensWith('first', ['1! = 1'], l('Baris pertama: 1! = 1', 'The first line: 1! = 1'), compact),
      printsExactly(
        [1, 2, 6, 24, 120, 720].map((value, index) => `${index + 1}! = ${value}`),
        l('Sampai 6! = 720', 'Through 6! = 720'),
        compact,
      ),
    ],
    hint: l(
      'Mulai dengan hasil = 1. Untuk setiap i dari 1 sampai 6: hasil = hasil × i, lalu cetak i, "! = ", dan hasil.',
      'Start with result = 1. For each i from 1 to 6: result = result × i, then print i, "! = ", and result.',
    ),
    starter: starter(setVar('hasil', 1), countBlock('i', 1, 6)),
    solution: {
      body: [
        set('hasil', n(1)),
        countWith('i', n(1), n(6), [
          set('hasil', times(v('hasil'), v('i'))),
          print(join(v('i'), text('! = '), v('hasil'))),
        ]),
      ],
    },
  },
  {
    ...algo,
    id: 'algo-celsius',
    timeLimit: 10,
    goals: [
      {
        id: 'first',
        label: l('Baris pertama: 0 °C = 32 °F', 'The first line: 0 °C = 32 °F'),
        check: (s) => sameNumbers(s.serial[0], [0, 32]),
      },
      {
        id: 'output',
        label: l(
          'Sampai 100 °C = 212 °F, setiap 10 derajat',
          'Through 100 °C = 212 °F, every 10 degrees',
        ),
        final: true,
        check: (s) =>
          s.programDone &&
          s.serial.length === 11 &&
          range(0, 100, 10).every((c, index) =>
            sameNumbers(s.serial[index], [c, (c * 9) / 5 + 32]),
          ),
      },
    ],
    hint: l(
      'Hitung dengan c dari 0 sampai 100 setiap 10. Hitung f = c × 9 ÷ 5 + 32, lalu cetak c, " °C = ", f, dan " °F".',
      'Count with c from 0 to 100 by 10. Work out f = c × 9 ÷ 5 + 32, then print c, " °C = ", f and " °F".',
    ),
    starter: starter(countBlock('c', 0, 100, undefined, 10)),
    solution: {
      body: [
        countWith(
          'c',
          n(0),
          n(100),
          [
            set('f', add(div(times(v('c'), n(9)), n(5)), n(32))),
            print(join(v('c'), text(' °C = '), v('f'), text(' °F'))),
          ],
          10,
        ),
      ],
    },
  },
  {
    ...algo,
    id: 'algo-fpb',
    timeLimit: 10,
    goals: [
      {
        id: 'start',
        label: l('Langkah pertama: 84 dan 36', 'The first step: 84 and 36'),
        check: (s) => sameNumbers(s.serial[0], [84, 36]),
      },
      {
        id: 'result',
        label: l('Setiap langkah, lalu FPB-nya', 'Every step, then the GCD'),
        final: true,
        check: (s) =>
          s.programDone && s.serial.length >= 3 && numbersIn(s.serial.at(-1) ?? '').includes(12),
      },
    ],
    hint: l(
      'Selama b tidak sama dengan 0: cetak a dan b, simpan sisa a ÷ b di t, lalu a = b dan b = t. Setelah perulangan, a adalah FPB-nya.',
      'While b is not 0: print a and b, keep the remainder of a ÷ b in t, then a = b and b = t. After the loop, a is the GCD.',
    ),
    starter: starter(setVar('a', 84), setVar('b', 36), {
      type: 'controls_whileUntil',
      fields: { MODE: 'WHILE' },
      inputs: {
        BOOL: plug({
          type: 'logic_compare',
          fields: { OP: 'NEQ' },
          inputs: { A: plug(getVar('b')), B: plug({ type: 'math_number', fields: { NUM: 0 } }) },
        }),
      },
    }),
    solution: {
      body: [
        set('a', n(84)),
        set('b', n(36)),
        {
          kind: 'loop',
          until: false,
          cond: { kind: 'compare', op: 'NEQ', a: v('b'), b: n(0) },
          body: [
            print(join(v('a'), text(' '), v('b'))),
            set('t', mod(v('a'), v('b'))),
            set('a', v('b')),
            set('b', v('t')),
          ],
        },
        print(join(text('FPB = '), v('a'))),
      ],
    },
  },
  {
    ...algo,
    id: 'algo-segitiga',
    timeLimit: 10,
    goals: [
      opensWith('first', ['*', '**'], l('Mulai dengan * lalu **', 'Start with * then **')),
      printsExactly(
        range(1, 5).map((row) => '*'.repeat(row)),
        l('Lima baris, sampai *****', 'Five rows, up to *****'),
      ),
    ],
    hint: l(
      'Untuk setiap baris dari 1 sampai 5: mulai dengan teks kosong, hitung j dari 1 sampai baris sambil menambah satu bintang, lalu cetak teksnya.',
      'For each row from 1 to 5: start with empty text, count j from 1 to row adding one star each time, then print the text.',
    ),
    starter: starter(countBlock('baris', 1, 5, printBlock(textBlock('*')))),
    solution: {
      body: [
        countWith('baris', n(1), n(5), [
          set('t', text('')),
          countWith('j', n(1), v('baris'), [set('t', join(v('t'), text('*')))]),
          print(v('t')),
        ]),
      ],
    },
  },
  {
    id: 'momo-parkir',
    robot: 'momo',
    arena: {
      width: 200,
      height: 80,
      lines: [],
      // The garage wall.
      boxes: [{ x: 180, y: 8, w: 12, h: 64 }],
      zones: [zone('start', 'start', 30, 40, 26, 26)],
    },
    start: { x: 30, y: 40, heading: 0 },
    timeLimit: 25,
    failOnBump: true,
    goals: [
      {
        id: 'faster',
        label: l('Bip makin cepat saat makin dekat', 'Beeps get faster as the wall gets closer'),
        check: (s, memo) => {
          if (beepStarted(s, memo)) {
            const last = memo.last as number | undefined;
            memo.last = s.time;
            if (last !== undefined) {
              const gap = s.time - last;
              if (s.distance > 60 && gap > 0.45) memo.slow = true;
              if (s.distance < 30 && gap < 0.25 && memo.slow) memo.fast = true;
            }
          }
          return Boolean(memo.fast);
        },
      },
      {
        id: 'stop',
        label: l('Berhenti 5 sampai 15 cm dari dinding', 'Stop 5 to 15 cm from the wall'),
        final: true,
        check: (s) => !s.bumped && s.speed < 0.5 && s.distance >= 5 && s.distance <= 15,
      },
    ],
    hint: l(
      'Jalan pelan, lalu pakai jika-lainnya-jika. Kurang dari 12 cm: berhenti. Kurang dari 30 cm: bip lalu tunggu 0,1 detik. Kurang dari 60 cm: tunggu 0,3 detik. Selebihnya: tunggu 0,6 detik.',
      'Drive slowly, then use if-else-if. Under 12 cm: stop. Under 30 cm: beep, then wait 0.1 seconds. Under 60 cm: wait 0.3 seconds. Otherwise: wait 0.6 seconds.',
    ),
    starter: starter(
      { type: 'sim_motors', inputs: { LEFT: shadowNum(30), RIGHT: shadowNum(32) } },
      {
        type: 'sim_forever',
        inputs: {
          DO: plug({
            type: 'controls_if',
            inputs: { IF0: plug(distanceBelow(12)), DO0: plug({ type: 'sim_stop' }) },
          }),
        },
      },
    ),
    solution: {
      body: [
        motors(n(30), n(32)),
        {
          kind: 'forever',
          body: [
            {
              kind: 'if',
              branches: [
                {
                  cond: lt(sensor('distance'), n(12)),
                  body: [stop, { kind: 'tone', note: 'C6', seconds: n(0.4) }, wait(0.4)],
                },
                {
                  cond: lt(sensor('distance'), n(30)),
                  body: [{ kind: 'tone', note: 'A5', seconds: n(0.05) }, wait(0.1)],
                },
                {
                  cond: lt(sensor('distance'), n(60)),
                  body: [{ kind: 'tone', note: 'A5', seconds: n(0.05) }, wait(0.3)],
                },
              ],
              otherwise: [{ kind: 'tone', note: 'A5', seconds: n(0.05) }, wait(0.6)],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'momo-lampu',
    robot: 'momo',
    arena: { width: 120, height: 80, lines: [], boxes: [], zones: [] },
    start: { x: 60, y: 40, heading: 0 },
    timeLimit: 11,
    failOnBump: false,
    // Day, then the room goes dark, then morning.
    envTimeline: [
      { t: 0, light: 80 },
      { t: 3, light: 12 },
      { t: 7, light: 75 },
    ],
    goals: [
      {
        id: 'off',
        label: l('Terang: tulis LAMPU MATI', 'Bright: write LIGHT OFF'),
        check: (s) => s.env.light > 50 && lampOff(s.oledText),
      },
      {
        id: 'on',
        label: l('Gelap: tulis LAMPU NYALA', 'Dark: write LIGHT ON'),
        check: (s) => s.env.light < 30 && lampOn(s.oledText),
      },
      {
        id: 'morning',
        label: l('Pagi lagi: kembali LAMPU MATI', 'Morning again: back to LIGHT OFF'),
        check: (s) => s.met.has('on') && s.time >= 7 && s.env.light > 50 && lampOff(s.oledText),
      },
    ],
    hint: l(
      'Ulangi selamanya: jika tingkat cahaya kurang dari 30%, tulis LAMPU NYALA di OLED. Jika tidak, tulis LAMPU MATI. Blok tingkat cahaya ada di kategori Sensor.',
      'Repeat forever: if the light level is under 30%, write LIGHT ON on the OLED. If not, write LIGHT OFF. The light level block is in Sensors.',
    ),
    starter: starter({
      type: 'sim_forever',
      inputs: {
        DO: plug({
          type: 'controls_if',
          extraState: { hasElse: true },
          inputs: {
            IF0: plug({
              type: 'logic_compare',
              fields: { OP: 'LT' },
              inputs: {
                A: plug({ type: 'sim_light' }),
                B: plug({ type: 'math_number', fields: { NUM: 30 } }),
              },
            }),
            DO0: plug({
              type: 'sim_oled',
              fields: { LINE: '1' },
              inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: 'LAMPU NYALA' } } } },
            }),
          },
        }),
      },
    }),
    solution: {
      body: [
        {
          kind: 'forever',
          body: [
            {
              kind: 'if',
              branches: [
                {
                  cond: lt(sensor('light'), n(30)),
                  body: [{ kind: 'oled', line: 1, value: text('LAMPU NYALA') }],
                },
              ],
              otherwise: [{ kind: 'oled', line: 1, value: text('LAMPU MATI') }],
            },
            wait(0.2),
          ],
        },
      ],
    },
  },
];

export function getMission(id: string): Mission | undefined {
  return missions.find((mission) => mission.id === id);
}
