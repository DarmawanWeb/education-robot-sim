import type { Expr, Face, Program, RobotId, SensorId, Statement } from '../engine/types';

const FACE: Record<Face, string> = {
  normal: 'Normal',
  senang: 'Happy',
  bingung: 'Confused',
  waspada: 'Alert',
  berhasil: 'Success',
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
  time: () => '(millis() / 1000.0)',
};

const DRIVE = {
  forward: 'forward',
  backward: 'backward',
  left: 'turnLeft',
  right: 'turnRight',
} as const;
const COMPARE = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' } as const;
const LOOP_VARS = ['i', 'j', 'k', 'm'];

/** C++ identifier for a block variable name. */
export function identifier(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `v_${cleaned}`;
}

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);

function expr(e: Expr): string {
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
      return `(${expr(e.a)} ${COMPARE[e.op]} ${expr(e.b)})`;
    case 'logic':
      return `(${expr(e.a)} ${e.op === 'AND' ? '&&' : '||'} ${expr(e.b)})`;
    case 'not':
      return `!${expr(e.value)}`;
    case 'math':
      return e.op === 'POWER'
        ? `pow(${expr(e.a)}, ${expr(e.b)})`
        : `(${expr(e.a)} ${{ ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' }[e.op]} ${expr(e.b)})`;
    case 'join':
      return e.parts.length === 0
        ? 'String("")'
        : e.parts.map((part) => `String(${expr(part)})`).join(' + ');
  }
}

function milliseconds(e: Expr): string {
  return e.kind === 'num' ? formatNumber(Math.round(e.value * 1000)) : `(${expr(e)}) * 1000`;
}

function lines(statements: readonly Statement[], depth: number): string[] {
  const pad = '  '.repeat(depth);
  if (statements.length === 0) return [`${pad}// (kosong)`];
  return statements.flatMap((s): string[] => {
    switch (s.kind) {
      case 'drive': {
        const call = DRIVE[s.dir];
        return [
          s.seconds
            ? `${pad}robot.${call}(${expr(s.speed)}, ${milliseconds(s.seconds)});`
            : `${pad}robot.${call}(${expr(s.speed)});`,
        ];
      }
      case 'motors':
        return [`${pad}robot.motors(${expr(s.left)}, ${expr(s.right)});`];
      case 'stop':
        return [`${pad}robot.stop();`];
      case 'wait':
        return [`${pad}delay(${milliseconds(s.seconds)});`];
      case 'waitUntil':
        return [`${pad}while (!${expr(s.cond)}) {`, `${pad}  delay(5);`, `${pad}}`];
      case 'repeat': {
        const counter = LOOP_VARS[Math.min(depth - 1, LOOP_VARS.length - 1)] ?? 'i';
        return [
          `${pad}for (int ${counter} = 0; ${counter} < ${expr(s.times)}; ${counter}++) {`,
          ...lines(s.body, depth + 1),
          `${pad}}`,
        ];
      }
      case 'forever':
        return [`${pad}while (true) {`, ...lines(s.body, depth + 1), `${pad}}`];
      case 'loop':
        return [
          `${pad}while (${s.until ? `!${expr(s.cond)}` : expr(s.cond)}) {`,
          ...lines(s.body, depth + 1),
          `${pad}}`,
        ];
      case 'if':
        return [
          ...s.branches.flatMap((branch, index) => [
            `${pad}${index === 0 ? 'if' : '} else if'} (${expr(branch.cond)}) {`,
            ...lines(branch.body, depth + 1),
          ]),
          ...(s.otherwise.length > 0 ? [`${pad}} else {`, ...lines(s.otherwise, depth + 1)] : []),
          `${pad}}`,
        ];
      case 'face':
        return [`${pad}robot.face(Face::${FACE[s.face]});`];
      case 'beep':
        return [`${pad}robot.beep(${milliseconds(s.seconds)});`];
      case 'tone':
        return [`${pad}robot.tone(NOTE_${s.note}, ${milliseconds(s.seconds)});`];
      case 'oled':
        return [`${pad}robot.print(${s.line}, ${expr(s.value)});`];
      case 'oledClear':
        return [`${pad}robot.clearDisplay();`];
      case 'servo':
        return [`${pad}robot.servo(${expr(s.angle)});`];
      case 'set':
        return [`${pad}${identifier(s.name)} = ${expr(s.value)};`];
      case 'change':
        return [`${pad}${identifier(s.name)} += ${expr(s.delta)};`];
    }
    return [];
  });
}

/** Variables and whether each ever holds text (String) or a number (float). */
function variables(
  statements: readonly Statement[],
  found = new Map<string, 'String' | 'float'>(),
) {
  for (const s of statements) {
    if (s.kind === 'set') {
      const textual = s.value.kind === 'text' || s.value.kind === 'join';
      if (!found.has(s.name) || textual) found.set(s.name, textual ? 'String' : 'float');
    }
    if (s.kind === 'change' && !found.has(s.name)) found.set(s.name, 'float');
    if ('body' in s) variables(s.body, found);
    if (s.kind === 'if') {
      for (const branch of s.branches) variables(branch.body, found);
      variables(s.otherwise, found);
    }
  }
  return found;
}

/** Arduino C++ for the Taksu robot library: the same program students built with blocks. */
export function toCpp(program: Program, robot: RobotId): string {
  const declared = [...variables(program.body)].map(
    ([name, type]) => `${type} ${identifier(name)}${type === 'float' ? ' = 0' : ''};`,
  );
  return [
    '#include <TaksuRobot.h>',
    '',
    `TaksuRobot robot(TaksuRobot::${robot.toUpperCase()});`,
    ...declared,
    '',
    'void setup() {',
    '  robot.begin();',
    ...lines(program.body, 1),
    '}',
    '',
    'void loop() {}',
  ].join('\n');
}
