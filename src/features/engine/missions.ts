import type { Localized } from '@taksu/content';
import { arc, roundedTrack } from './geometry';
import type {
  DriveDirection,
  Expr,
  Goal,
  LinePath,
  Mission,
  SensorId,
  Statement,
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

const lineLeft = sensor('lineLeft');
const lineRight = sensor('lineRight');
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
    id: 'sd-kenalan',
    robot: 'sd',
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
      'Ambil blok wajah dan bip dari kategori Wajah dan suara, lalu blok maju.',
      'Take the face and beep blocks from Face and sound, then a forward block.',
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
    id: 'sd-finish',
    robot: 'sd',
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
    id: 'sd-belok',
    robot: 'sd',
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
    id: 'sd-kotak',
    robot: 'sd',
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
    id: 'sd-rintangan',
    robot: 'sd',
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
    id: 'sd-hindar',
    robot: 'sd',
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
    id: 'sd-garis',
    robot: 'sd',
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
    id: 'sd-persimpangan',
    robot: 'sd',
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
    id: 'sd-misi-akhir',
    robot: 'sd',
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
    id: 'smp-sistem',
    robot: 'smp',
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
    id: 'smp-pwm',
    robot: 'smp',
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
    id: 'smp-garis',
    robot: 'smp',
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
    id: 'smp-radar',
    robot: 'smp',
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
    id: 'smp-lingkungan',
    robot: 'smp',
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
    id: 'smp-suara',
    robot: 'smp',
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
    id: 'smp-telemetri',
    robot: 'smp',
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
    id: 'smp-bebas',
    robot: 'smp',
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
];

export function getMission(id: string): Mission | undefined {
  return missions.find((mission) => mission.id === id);
}
