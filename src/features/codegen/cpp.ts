import type { Expr, Face, Program, RobotId, SensorId, Signal, Statement } from '../engine/types';

const FACE: Record<Face, string> = {
  normal: 'Normal',
  senang: 'Happy',
  bingung: 'Confused',
  waspada: 'Alert',
  berhasil: 'Success',
};

const SIGNAL: Record<Signal, string> = {
  off: 'Off',
  left: 'Left',
  right: 'Right',
  hazard: 'Hazard',
};

const SENSOR: Record<SensorId, (index?: number) => string> = {
  lineLeft: () => 'robot.lineLeft()',
  lineRight: () => 'robot.lineRight()',
  distance: () => 'robot.distance()',
  lineValue: (index) => `robot.lineValue(${index ?? 1})`,
  linePosition: () => 'robot.linePosition()',
  temperature: () => 'robot.temperature()',
  humidity: () => 'robot.humidity()',
  sound: () => 'robot.soundLevel()',
  light: () => 'robot.lightLevel()',
  wifi: () => 'robot.wifiConnected()',
  time: () => '(millis() / 1000.0)',
};

const DRIVE = {
  forward: 'forward',
  backward: 'backward',
  left: 'turnLeft',
  right: 'turnRight',
} as const;
const COMPARE = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' } as const;
const ARITHMETIC = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' } as const;
const LOOP_VARS = ['i', 'j', 'k', 'm'];

type VarType = 'String' | 'bool' | 'long' | 'float';
/** What the generator knows while it writes: each variable's C++ type. */
type Context = { types: ReadonlyMap<string, VarType> };

/** C++ identifier for a block variable name. */
export function identifier(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `v_${cleaned}`;
}

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);

/** Whether an expression always gives a whole number, given which variables are whole. */
function whole(e: Expr, types: ReadonlyMap<string, VarType>): boolean {
  switch (e.kind) {
    case 'num':
      return Number.isInteger(e.value);
    case 'var':
      return types.get(e.name) === 'long';
    case 'math':
      return (
        (e.op === 'ADD' || e.op === 'MINUS' || e.op === 'MULTIPLY' || e.op === 'MODULO') &&
        whole(e.a, types) &&
        whole(e.b, types)
      );
    default:
      return false;
  }
}

function expr(e: Expr, ctx: Context): string {
  switch (e.kind) {
    case 'num':
      return formatNumber(e.value);
    case 'bool':
      return e.value ? 'true' : 'false';
    case 'text':
      return JSON.stringify(e.value);
    case 'sensor':
      return SENSOR[e.sensor](e.index);
    case 'var':
      return identifier(e.name);
    case 'compare':
      return `(${expr(e.a, ctx)} ${COMPARE[e.op]} ${expr(e.b, ctx)})`;
    case 'logic':
      return `(${expr(e.a, ctx)} ${e.op === 'AND' ? '&&' : '||'} ${expr(e.b, ctx)})`;
    case 'not':
      return `!${expr(e.value, ctx)}`;
    case 'math':
      if (e.op === 'POWER') return `pow(${expr(e.a, ctx)}, ${expr(e.b, ctx)})`;
      if (e.op === 'MODULO')
        return whole(e.a, ctx.types) && whole(e.b, ctx.types)
          ? `(${expr(e.a, ctx)} % ${expr(e.b, ctx)})`
          : `fmod(${expr(e.a, ctx)}, ${expr(e.b, ctx)})`;
      return `(${expr(e.a, ctx)} ${ARITHMETIC[e.op]} ${expr(e.b, ctx)})`;
    case 'join':
      return e.parts.length === 0
        ? 'String("")'
        : e.parts.map((part) => `String(${expr(part, ctx)})`).join(' + ');
  }
}

function milliseconds(e: Expr, ctx: Context): string {
  return e.kind === 'num' ? formatNumber(Math.round(e.value * 1000)) : `(${expr(e, ctx)}) * 1000`;
}

/** A Blockly "count with" loop: up when from ≤ to, down otherwise, by the step's size. */
function countLoop(s: Extract<Statement, { kind: 'for' }>, ctx: Context): string {
  const name = identifier(s.name);
  const from = expr(s.from, ctx);
  const to = expr(s.to, ctx);
  const step =
    s.by.kind === 'num' ? formatNumber(Math.abs(s.by.value) || 1) : `abs(${expr(s.by, ctx)})`;
  if (s.from.kind === 'num' && s.to.kind === 'num') {
    const up = s.from.value <= s.to.value;
    const next =
      step === '1' ? (up ? `${name}++` : `${name}--`) : `${name} ${up ? '+' : '-'}= ${step}`;
    return `for (${name} = ${from}; ${name} ${up ? '<=' : '>='} ${to}; ${next}) {`;
  }
  return `for (${name} = ${from}; (${from} <= ${to}) ? ${name} <= ${to} : ${name} >= ${to}; ${name} += (${from} <= ${to}) ? ${step} : -${step}) {`;
}

function lines(statements: readonly Statement[], depth: number, ctx: Context): string[] {
  const pad = '  '.repeat(depth);
  const e = (value: Expr) => expr(value, ctx);
  const ms = (value: Expr) => milliseconds(value, ctx);
  if (statements.length === 0) return [`${pad}// (kosong)`];
  return statements.flatMap((s): string[] => {
    switch (s.kind) {
      case 'drive': {
        const call = DRIVE[s.dir];
        return [
          s.seconds
            ? `${pad}robot.${call}(${e(s.speed)}, ${ms(s.seconds)});`
            : `${pad}robot.${call}(${e(s.speed)});`,
        ];
      }
      case 'motors':
        return [`${pad}robot.motors(${e(s.left)}, ${e(s.right)});`];
      case 'stop':
        return [`${pad}robot.stop();`];
      case 'wait':
        return [`${pad}delay(${ms(s.seconds)});`];
      case 'waitUntil':
        return [`${pad}while (!${e(s.cond)}) {`, `${pad}  delay(5);`, `${pad}}`];
      case 'repeat': {
        const counter = LOOP_VARS[Math.min(depth - 1, LOOP_VARS.length - 1)] ?? 'i';
        return [
          `${pad}for (int ${counter} = 0; ${counter} < ${e(s.times)}; ${counter}++) {`,
          ...lines(s.body, depth + 1, ctx),
          `${pad}}`,
        ];
      }
      case 'forever':
        return [`${pad}while (true) {`, ...lines(s.body, depth + 1, ctx), `${pad}}`];
      case 'loop':
        return [
          `${pad}while (${s.until ? `!${e(s.cond)}` : e(s.cond)}) {`,
          ...lines(s.body, depth + 1, ctx),
          `${pad}}`,
        ];
      case 'for':
        return [`${pad}${countLoop(s, ctx)}`, ...lines(s.body, depth + 1, ctx), `${pad}}`];
      case 'if':
        return [
          ...s.branches.flatMap((branch, index) => [
            `${pad}${index === 0 ? 'if' : '} else if'} (${e(branch.cond)}) {`,
            ...lines(branch.body, depth + 1, ctx),
          ]),
          ...(s.otherwise.length > 0
            ? [`${pad}} else {`, ...lines(s.otherwise, depth + 1, ctx)]
            : []),
          `${pad}}`,
        ];
      case 'face':
        return [`${pad}robot.face(Face::${FACE[s.face]});`];
      case 'beep':
        return [`${pad}robot.beep(${ms(s.seconds)});`];
      case 'tone':
        return [`${pad}robot.tone(NOTE_${s.note}, ${ms(s.seconds)});`];
      case 'oled':
        return [`${pad}robot.print(${s.line}, ${e(s.value)});`];
      case 'oledClear':
        return [`${pad}robot.clearDisplay();`];
      case 'signal':
        return [
          s.side === 'off'
            ? `${pad}robot.signal(Signal::Off);`
            : `${pad}robot.signal(Signal::${SIGNAL[s.side]}, ${s.tick ? 'true' : 'false'});`,
        ];
      case 'servo':
        return [`${pad}robot.servo(${e(s.angle)});`];
      case 'send':
        return [`${pad}robot.send(${JSON.stringify(s.key)}, ${e(s.value)});`];
      case 'print':
        return [`${pad}Serial.println(${e(s.value)});`];
      case 'set':
        return [`${pad}${identifier(s.name)} = ${e(s.value)};`];
      case 'change':
        return [`${pad}${identifier(s.name)} += ${e(s.delta)};`];
    }
    return [];
  });
}

/** Every statement in a program, nested ones included. */
function* walk(statements: readonly Statement[]): Generator<Statement> {
  for (const s of statements) {
    yield s;
    if ('body' in s) yield* walk(s.body);
    if (s.kind === 'if') {
      for (const branch of s.branches) yield* walk(branch.body);
      yield* walk(s.otherwise);
    }
  }
}

/**
 * Each variable's type: String if it ever holds text, bool if it only holds true or false, long
 * if every value it gets is a whole number (so the Serial Monitor prints 5050, not 5050.00), and
 * float otherwise.
 */
function variableTypes(program: Program): Map<string, VarType> {
  const assigned = new Map<string, Expr[]>();
  const add = (name: string, value: Expr) =>
    assigned.set(name, [...(assigned.get(name) ?? []), value]);
  for (const s of walk(program.body)) {
    if (s.kind === 'set') add(s.name, s.value);
    if (s.kind === 'change')
      add(s.name, { kind: 'math', op: 'ADD', a: { kind: 'var', name: s.name }, b: s.delta });
    if (s.kind === 'for') {
      add(s.name, s.from);
      add(s.name, s.by);
    }
  }
  const types = new Map<string, VarType>();
  for (const [name, values] of assigned) {
    const textual = values.some((value) => value.kind === 'text' || value.kind === 'join');
    const logical = values.every((value) =>
      ['bool', 'compare', 'logic', 'not'].includes(value.kind),
    );
    types.set(name, textual ? 'String' : logical ? 'bool' : 'long');
  }
  // Narrow until nothing changes: a variable fed by a fraction, a sensor, or a float is a float.
  for (let changed = true; changed; ) {
    changed = false;
    for (const [name, values] of assigned) {
      if (types.get(name) !== 'long') continue;
      if (!values.every((value) => whole(value, types))) {
        types.set(name, 'float');
        changed = true;
      }
    }
  }
  return types;
}

/** Arduino C++ for the RobotKit library: the same program students built with blocks. */
export function toCpp(program: Program, robot: RobotId): string {
  const types = variableTypes(program);
  const ctx: Context = { types };
  const declared = [...types].map(
    ([name, type]) =>
      `${type} ${identifier(name)}${{ String: '', bool: ' = false', long: ' = 0', float: ' = 0' }[type]};`,
  );
  const prints = [...walk(program.body)].some((s) => s.kind === 'print');
  if (robot === 'board')
    // Algorithm practice runs on any Arduino-compatible board, with no robot library.
    return [
      ...(declared.length ? [...declared, ''] : []),
      'void setup() {',
      '  Serial.begin(115200);',
      ...lines(program.body, 1, ctx),
      '}',
      '',
      'void loop() {}',
    ].join('\n');
  return [
    '#include <RobotKit.h>',
    '',
    `RobotKit robot(RobotKit::${robot.toUpperCase()});`,
    ...declared,
    '',
    'void setup() {',
    ...(prints ? ['  Serial.begin(115200);'] : []),
    '  robot.begin();',
    ...lines(program.body, 1, ctx),
    '}',
    '',
    'void loop() {}',
  ].join('\n');
}
