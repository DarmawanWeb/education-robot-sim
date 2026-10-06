import type * as Blockly from 'blockly/core';
import type {
  DriveDirection,
  Expr,
  Face,
  Note,
  Program,
  SensorId,
  Statement,
} from '../engine/types';

export type CompileResult = { ok: true; program: Program } | { ok: false; error: 'noStart' };

const SENSOR_BLOCKS: Record<string, SensorId> = {
  sim_line_left: 'lineLeft',
  sim_line_right: 'lineRight',
  sim_distance: 'distance',
  sim_line_position: 'linePosition',
  sim_temperature: 'temperature',
  sim_humidity: 'humidity',
  sim_sound: 'sound',
  sim_timer: 'time',
};

const num = (value: unknown, fallback = 0): Expr => ({
  kind: 'num',
  value: Number.isFinite(Number(value)) ? Number(value) : fallback,
});

function expression(block: Blockly.Block | null, fallback: Expr = { kind: 'num', value: 0 }): Expr {
  if (!block || !block.isEnabled()) return fallback;
  const input = (name: string, missing?: Expr) =>
    expression(block.getInputTargetBlock(name), missing);
  const sensor = SENSOR_BLOCKS[block.type];
  if (sensor) return { kind: 'sensor', sensor };

  switch (block.type) {
    case 'sim_line_value':
      return {
        kind: 'sensor',
        sensor: 'lineValue',
        index: Number(block.getFieldValue('INDEX')) || 1,
      };
    case 'math_number':
      return num(block.getFieldValue('NUM'));
    case 'logic_boolean':
      return { kind: 'bool', value: block.getFieldValue('BOOL') === 'TRUE' };
    case 'text':
      return { kind: 'text', value: String(block.getFieldValue('TEXT') ?? '') };
    case 'variables_get':
      return { kind: 'var', name: block.getField('VAR')?.getText() ?? 'x' };
    case 'logic_compare':
      return { kind: 'compare', op: block.getFieldValue('OP'), a: input('A'), b: input('B') };
    case 'logic_operation':
      return {
        kind: 'logic',
        op: block.getFieldValue('OP') === 'OR' ? 'OR' : 'AND',
        a: input('A', { kind: 'bool', value: false }),
        b: input('B', { kind: 'bool', value: false }),
      };
    case 'logic_negate':
      return { kind: 'not', value: input('BOOL', { kind: 'bool', value: false }) };
    case 'math_arithmetic':
      return { kind: 'math', op: block.getFieldValue('OP'), a: input('A'), b: input('B') };
    case 'text_join': {
      const parts: Expr[] = [];
      for (let index = 0; block.getInput(`ADD${index}`); index += 1) {
        parts.push(input(`ADD${index}`, { kind: 'text', value: '' }));
      }
      return { kind: 'join', parts };
    }
    default:
      return fallback;
  }
}

function statement(block: Blockly.Block): Statement | null {
  const blockId = block.id;
  const input = (name: string, missing?: Expr) =>
    expression(block.getInputTargetBlock(name), missing);
  const field = (name: string) => block.getFieldValue(name);

  switch (block.type) {
    case 'sim_drive_for':
      return {
        kind: 'drive',
        dir: field('DIR') as DriveDirection,
        speed: num(field('SPEED'), 50),
        seconds: num(field('SECONDS'), 1),
        blockId,
      };
    case 'sim_drive':
      return {
        kind: 'drive',
        dir: field('DIR') as DriveDirection,
        speed: num(field('SPEED'), 50),
        seconds: null,
        blockId,
      };
    case 'sim_motors':
      return { kind: 'motors', left: input('LEFT'), right: input('RIGHT'), blockId };
    case 'sim_stop':
      return { kind: 'stop', blockId };
    case 'sim_wait':
      return { kind: 'wait', seconds: num(field('SECONDS'), 1), blockId };
    case 'sim_wait_until':
      return { kind: 'waitUntil', cond: input('COND', { kind: 'bool', value: true }), blockId };
    case 'sim_repeat':
      return {
        kind: 'repeat',
        times: num(field('TIMES'), 1),
        body: chain(block.getInputTargetBlock('DO')),
        blockId,
      };
    case 'sim_forever':
      return { kind: 'forever', body: chain(block.getInputTargetBlock('DO')), blockId };
    case 'controls_whileUntil':
      return {
        kind: 'loop',
        until: field('MODE') === 'UNTIL',
        cond: input('BOOL', { kind: 'bool', value: false }),
        body: chain(block.getInputTargetBlock('DO')),
        blockId,
      };
    case 'controls_if': {
      const branches: { cond: Expr; body: Statement[] }[] = [];
      for (let index = 0; block.getInput(`IF${index}`); index += 1) {
        branches.push({
          cond: input(`IF${index}`, { kind: 'bool', value: false }),
          body: chain(block.getInputTargetBlock(`DO${index}`)),
        });
      }
      return {
        kind: 'if',
        branches,
        otherwise: block.getInput('ELSE') ? chain(block.getInputTargetBlock('ELSE')) : [],
        blockId,
      };
    }
    case 'sim_face':
      return { kind: 'face', face: field('FACE') as Face, blockId };
    case 'sim_beep':
      return { kind: 'beep', seconds: num(field('SECONDS'), 0.2), blockId };
    case 'sim_tone':
      return {
        kind: 'tone',
        note: field('NOTE') as Note,
        seconds: num(field('SECONDS'), 0.2),
        blockId,
      };
    case 'sim_oled':
      return {
        kind: 'oled',
        line: Number(field('LINE')) || 1,
        value: input('VALUE', { kind: 'text', value: '' }),
        blockId,
      };
    case 'sim_oled_clear':
      return { kind: 'oledClear', blockId };
    case 'sim_servo':
      return { kind: 'servo', angle: input('ANGLE', { kind: 'num', value: 90 }), blockId };
    case 'variables_set':
      return {
        kind: 'set',
        name: block.getField('VAR')?.getText() ?? 'x',
        value: input('VALUE'),
        blockId,
      };
    case 'math_change':
      return {
        kind: 'change',
        name: block.getField('VAR')?.getText() ?? 'x',
        delta: input('DELTA', { kind: 'num', value: 1 }),
        blockId,
      };
    default:
      return null;
  }
}

function chain(first: Blockly.Block | null): Statement[] {
  const statements: Statement[] = [];
  for (let block = first; block; block = block.getNextBlock()) {
    if (!block.isEnabled()) continue;
    const compiled = statement(block);
    if (compiled) statements.push(compiled);
  }
  return statements;
}

/** Turns the blocks under the first "when started" hat into the simulator's program. */
export function compileWorkspace(workspace: Blockly.Workspace): CompileResult {
  const start = workspace
    .getTopBlocks(true)
    .find((block) => block.type === 'sim_start' && block.isEnabled());
  if (!start) return { ok: false, error: 'noStart' };
  return { ok: true, program: { body: chain(start.getNextBlock()) } };
}
