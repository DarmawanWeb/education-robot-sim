import type {
  DriveDirection,
  Expr,
  Face,
  Note,
  Program,
  SensorId,
  Statement,
  Value,
} from './types';

/** What a running program can touch. Implemented by the simulation (and later the real robot). */
export interface RobotIO {
  time: () => number;
  setMotors: (left: number, right: number) => void;
  read: (sensor: SensorId, index?: number) => number | boolean;
  setFace: (face: Face) => void;
  beep: (seconds: number, frequency?: number) => void;
  oled: (line: number, text: string) => void;
  oledClear: () => void;
  servo: (angle: number) => void;
  highlight: (blockId: string | undefined) => void;
}

export const NOTE_HZ: Record<Note, number> = {
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880,
  B5: 987.77,
  C6: 1046.5,
};

/** Spin turns turn in place: one wheel forward, the other backward. */
const DRIVE: Record<DriveDirection, (speed: number) => [number, number]> = {
  forward: (speed) => [speed, speed],
  backward: (speed) => [-speed, -speed],
  left: (speed) => [-speed, speed],
  right: (speed) => [speed, -speed],
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function toNumber(value: Value): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return Number.parseFloat(value) || 0;
}

export function truthy(value: Value): boolean {
  return typeof value === 'string' ? value.length > 0 : Boolean(value);
}

/** Text shown on the OLED: whole numbers stay whole, others keep one decimal. */
export function formatValue(value: Value): string {
  if (typeof value === 'number')
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  if (typeof value === 'boolean') return value ? 'ya' : 'tidak';
  return value;
}

/** Instructions allowed before a tick is forced, so `repeat 1e9` cannot freeze the page. */
const STEP_BUDGET = 2000;

/**
 * Runs a program as a generator: it advances until it has to wait for simulated time,
 * then yields. Loops yield once per pass, like a microcontroller's loop().
 */
export class Runner {
  private readonly vars = new Map<string, Value>();
  private readonly program: Generator<void, void, void>;
  private budget = STEP_BUDGET;
  done = false;

  constructor(
    source: Program,
    private readonly io: RobotIO,
  ) {
    this.program = this.block(source.body);
  }

  tick(): void {
    if (this.done) return;
    this.budget = STEP_BUDGET;
    if (this.program.next().done) {
      this.done = true;
      this.io.setMotors(0, 0);
      this.io.highlight(undefined);
    }
  }

  private *block(statements: readonly Statement[]): Generator<void, void, void> {
    for (const statement of statements) yield* this.run(statement);
  }

  private *waitSeconds(seconds: number): Generator<void, void, void> {
    const end = this.io.time() + Math.max(0, seconds);
    while (this.io.time() < end - 1e-9) yield;
  }

  private num(expr: Expr): number {
    return toNumber(this.evaluate(expr));
  }

  private *run(statement: Statement): Generator<void, void, void> {
    this.budget -= 1;
    if (this.budget <= 0) {
      this.budget = STEP_BUDGET;
      yield;
    }
    this.io.highlight(statement.blockId);

    switch (statement.kind) {
      case 'drive': {
        const [left, right] = DRIVE[statement.dir](clamp(this.num(statement.speed), 0, 100));
        this.io.setMotors(left, right);
        if (statement.seconds) {
          yield* this.waitSeconds(this.num(statement.seconds));
          this.io.setMotors(0, 0);
        }
        return;
      }
      case 'motors':
        this.io.setMotors(
          clamp(this.num(statement.left), -100, 100),
          clamp(this.num(statement.right), -100, 100),
        );
        return;
      case 'stop':
        this.io.setMotors(0, 0);
        return;
      case 'wait':
        yield* this.waitSeconds(this.num(statement.seconds));
        return;
      case 'waitUntil':
        while (!truthy(this.evaluate(statement.cond))) yield;
        return;
      case 'repeat': {
        const times = Math.max(0, Math.floor(this.num(statement.times)));
        for (let index = 0; index < times; index += 1) yield* this.block(statement.body);
        return;
      }
      case 'forever':
        for (;;) {
          yield* this.block(statement.body);
          yield;
        }
      case 'loop':
        while (truthy(this.evaluate(statement.cond)) !== statement.until) {
          yield* this.block(statement.body);
          yield;
        }
        return;
      case 'if':
        for (const branch of statement.branches) {
          if (truthy(this.evaluate(branch.cond))) {
            yield* this.block(branch.body);
            return;
          }
        }
        yield* this.block(statement.otherwise);
        return;
      case 'face':
        this.io.setFace(statement.face);
        return;
      case 'beep': {
        const seconds = this.num(statement.seconds);
        this.io.beep(seconds);
        yield* this.waitSeconds(seconds);
        return;
      }
      case 'tone': {
        const seconds = this.num(statement.seconds);
        this.io.beep(seconds, NOTE_HZ[statement.note]);
        yield* this.waitSeconds(seconds);
        return;
      }
      case 'oled':
        this.io.oled(statement.line, formatValue(this.evaluate(statement.value)));
        return;
      case 'oledClear':
        this.io.oledClear();
        return;
      case 'servo':
        this.io.servo(clamp(this.num(statement.angle), 0, 180));
        return;
      case 'set':
        this.vars.set(statement.name, this.evaluate(statement.value));
        return;
      case 'change':
        this.vars.set(
          statement.name,
          toNumber(this.vars.get(statement.name) ?? 0) + this.num(statement.delta),
        );
        return;
    }
  }

  evaluate(expr: Expr): Value {
    switch (expr.kind) {
      case 'num':
      case 'bool':
      case 'text':
        return expr.value;
      case 'sensor':
        return this.io.read(expr.sensor, expr.index);
      case 'var':
        return this.vars.get(expr.name) ?? 0;
      case 'compare': {
        const a = this.evaluate(expr.a);
        const b = this.evaluate(expr.b);
        if (typeof a === 'string' || typeof b === 'string') {
          const left = formatValue(a);
          const right = formatValue(b);
          if (expr.op === 'EQ') return left === right;
          if (expr.op === 'NEQ') return left !== right;
        }
        const x = toNumber(a);
        const y = toNumber(b);
        switch (expr.op) {
          case 'EQ':
            return Math.abs(x - y) < 1e-9;
          case 'NEQ':
            return Math.abs(x - y) >= 1e-9;
          case 'LT':
            return x < y;
          case 'LTE':
            return x <= y;
          case 'GT':
            return x > y;
          case 'GTE':
            return x >= y;
        }
        return false;
      }
      case 'logic':
        return expr.op === 'AND'
          ? truthy(this.evaluate(expr.a)) && truthy(this.evaluate(expr.b))
          : truthy(this.evaluate(expr.a)) || truthy(this.evaluate(expr.b));
      case 'not':
        return !truthy(this.evaluate(expr.value));
      case 'math': {
        const x = this.num(expr.a);
        const y = this.num(expr.b);
        switch (expr.op) {
          case 'ADD':
            return x + y;
          case 'MINUS':
            return x - y;
          case 'MULTIPLY':
            return x * y;
          case 'DIVIDE':
            return y === 0 ? 0 : x / y;
          case 'POWER':
            return x ** y;
        }
        return 0;
      }
      case 'join':
        return expr.parts.map((part) => formatValue(this.evaluate(part))).join('');
    }
  }
}
