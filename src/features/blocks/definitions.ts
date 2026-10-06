import * as Blockly from 'blockly/core';
import type { RobotId } from '../engine/types';

const msg = (key: string) => Blockly.Msg[key] ?? key;

const FACES = ['senang', 'bingung', 'waspada', 'berhasil', 'normal'] as const;
const NOTES = ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'] as const;
const statement = { previousStatement: null, nextStatement: null };
const directions = () => [
  [msg('SIM_FORWARD'), 'forward'],
  [msg('SIM_BACKWARD'), 'backward'],
  [msg('SIM_LEFT'), 'left'],
  [msg('SIM_RIGHT'), 'right'],
];
const sensor = (key: string, output: 'Number' | 'Boolean') => () => ({
  message0: msg(key),
  output,
  style: 'sensor_blocks',
});

/**
 * Block JSON is built inside `init`, so labels come from `Blockly.Msg` when each block is
 * created. Re-creating the workspace after a language switch relabels everything.
 */
const definitions: Record<string, () => object> = {
  sim_start: () => ({ message0: msg('SIM_START'), nextStatement: null, style: 'event_blocks' }),
  sim_drive_for: () => ({
    message0: msg('SIM_DRIVE_FOR'),
    args0: [
      { type: 'field_dropdown', name: 'DIR', options: directions() },
      { type: 'field_number', name: 'SPEED', value: 50, min: 0, max: 100, precision: 1 },
      { type: 'field_number', name: 'SECONDS', value: 1, min: 0, max: 60, precision: 0.01 },
    ],
    ...statement,
    style: 'motion_blocks',
  }),
  sim_drive: () => ({
    message0: msg('SIM_DRIVE'),
    args0: [
      { type: 'field_dropdown', name: 'DIR', options: directions() },
      { type: 'field_number', name: 'SPEED', value: 50, min: 0, max: 100, precision: 1 },
    ],
    ...statement,
    style: 'motion_blocks',
  }),
  sim_motors: () => ({
    message0: msg('SIM_MOTORS'),
    args0: [
      { type: 'input_value', name: 'LEFT', check: 'Number' },
      { type: 'input_value', name: 'RIGHT', check: 'Number' },
    ],
    inputsInline: true,
    ...statement,
    style: 'motion_blocks',
  }),
  sim_stop: () => ({ message0: msg('SIM_STOP'), ...statement, style: 'motion_blocks' }),
  sim_wait: () => ({
    message0: msg('SIM_WAIT'),
    args0: [{ type: 'field_number', name: 'SECONDS', value: 1, min: 0, max: 60, precision: 0.01 }],
    ...statement,
    style: 'control_blocks',
  }),
  sim_wait_until: () => ({
    message0: msg('SIM_WAIT_UNTIL'),
    args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
    ...statement,
    style: 'control_blocks',
  }),
  sim_repeat: () => ({
    message0: msg('SIM_REPEAT'),
    args0: [{ type: 'field_number', name: 'TIMES', value: 4, min: 0, max: 100, precision: 1 }],
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    ...statement,
    style: 'control_blocks',
  }),
  sim_forever: () => ({
    message0: msg('SIM_FOREVER'),
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    style: 'control_blocks',
  }),
  sim_line_left: sensor('SIM_LINE_LEFT', 'Boolean'),
  sim_line_right: sensor('SIM_LINE_RIGHT', 'Boolean'),
  sim_distance: sensor('SIM_DISTANCE', 'Number'),
  sim_line_position: sensor('SIM_LINE_POSITION', 'Number'),
  sim_temperature: sensor('SIM_TEMPERATURE', 'Number'),
  sim_humidity: sensor('SIM_HUMIDITY', 'Number'),
  sim_sound: sensor('SIM_SOUND', 'Number'),
  sim_timer: sensor('SIM_TIMER', 'Number'),
  sim_line_value: () => ({
    message0: msg('SIM_LINE_VALUE'),
    args0: [
      {
        type: 'field_dropdown',
        name: 'INDEX',
        options: ['1', '2', '3', '4', '5'].map((index) => [index, index]),
      },
    ],
    output: 'Number',
    style: 'sensor_blocks',
  }),
  sim_face: () => ({
    message0: msg('SIM_FACE'),
    args0: [
      {
        type: 'field_dropdown',
        name: 'FACE',
        options: FACES.map((face) => [msg(`SIM_FACE_${face.toUpperCase()}`), face]),
      },
    ],
    ...statement,
    style: 'output_blocks',
  }),
  sim_beep: () => ({
    message0: msg('SIM_BEEP'),
    args0: [{ type: 'field_number', name: 'SECONDS', value: 0.2, min: 0, max: 5, precision: 0.1 }],
    ...statement,
    style: 'output_blocks',
  }),
  sim_tone: () => ({
    message0: msg('SIM_TONE'),
    args0: [
      { type: 'field_dropdown', name: 'NOTE', options: NOTES.map((note) => [note, note]) },
      { type: 'field_number', name: 'SECONDS', value: 0.2, min: 0, max: 5, precision: 0.1 },
    ],
    ...statement,
    style: 'output_blocks',
  }),
  sim_servo: () => ({
    message0: msg('SIM_SERVO'),
    args0: [{ type: 'input_value', name: 'ANGLE', check: 'Number' }],
    inputsInline: true,
    ...statement,
    style: 'output_blocks',
  }),
  sim_oled: () => ({
    message0: msg('SIM_OLED'),
    args0: [
      {
        type: 'field_dropdown',
        name: 'LINE',
        options: ['1', '2', '3', '4'].map((line) => [line, line]),
      },
      { type: 'input_value', name: 'VALUE' },
    ],
    inputsInline: true,
    ...statement,
    style: 'output_blocks',
  }),
  sim_oled_clear: () => ({ message0: msg('SIM_OLED_CLEAR'), ...statement, style: 'output_blocks' }),
};

export function registerBlocks(): void {
  for (const [type, json] of Object.entries(definitions)) {
    Blockly.Blocks[type] = {
      init(this: Blockly.Block) {
        this.jsonInit(json());
      },
    };
  }
}

const block = (type: string, extra: object = {}) => ({ kind: 'block', type, ...extra });
const shadowNumber = (value: number) => ({
  shadow: { type: 'math_number', fields: { NUM: value } },
});
const shadowText = (value: string) => ({ shadow: { type: 'text', fields: { TEXT: value } } });

/** Per-robot toolbox: SD keeps to the blocks in the primary curriculum; SMP adds motors, servo, OLED, data. */
export function buildToolbox(robot: RobotId): Blockly.utils.toolbox.ToolboxDefinition {
  const control = [
    block('sim_wait'),
    block('sim_wait_until'),
    block('sim_repeat'),
    block('sim_forever'),
    block('controls_if'),
    block('controls_if', { extraState: { hasElse: true } }),
    block('controls_whileUntil'),
  ];
  const logic = [
    block('logic_compare'),
    block('logic_operation'),
    block('logic_negate'),
    block('logic_boolean'),
    block('math_number'),
    ...(robot === 'smp' ? [block('math_arithmetic'), block('text'), block('text_join')] : []),
  ];
  const motion =
    robot === 'smp'
      ? [
          block('sim_motors', { inputs: { LEFT: shadowNumber(50), RIGHT: shadowNumber(50) } }),
          block('sim_drive_for'),
          block('sim_drive'),
          block('sim_stop'),
        ]
      : [block('sim_drive_for'), block('sim_drive'), block('sim_stop')];
  const sensors =
    robot === 'smp'
      ? [
          block('sim_line_position'),
          block('sim_line_value'),
          block('sim_distance'),
          block('sim_temperature'),
          block('sim_humidity'),
          block('sim_sound'),
          block('sim_timer'),
        ]
      : [block('sim_line_left'), block('sim_line_right'), block('sim_distance')];
  const output =
    robot === 'smp'
      ? [
          block('sim_servo', { inputs: { ANGLE: shadowNumber(90) } }),
          block('sim_oled', { inputs: { VALUE: shadowText('Halo') } }),
          block('sim_oled_clear'),
          block('sim_tone'),
          block('sim_face'),
        ]
      : [block('sim_face'), block('sim_beep')];

  return {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category',
        name: msg('SIM_CAT_START'),
        categorystyle: 'event_category',
        contents: [block('sim_start')],
      },
      {
        kind: 'category',
        name: msg('SIM_CAT_MOTION'),
        categorystyle: 'motion_category',
        contents: motion,
      },
      {
        kind: 'category',
        name: msg('SIM_CAT_CONTROL'),
        categorystyle: 'control_category',
        contents: control,
      },
      {
        kind: 'category',
        name: msg('SIM_CAT_SENSORS'),
        categorystyle: 'sensor_category',
        contents: sensors,
      },
      {
        kind: 'category',
        name: msg('SIM_CAT_LOGIC'),
        categorystyle: 'logic_category',
        contents: logic,
      },
      {
        kind: 'category',
        name: msg(robot === 'smp' ? 'SIM_CAT_OUTPUT_SMP' : 'SIM_CAT_OUTPUT'),
        categorystyle: 'output_category',
        contents: output,
      },
      ...(robot === 'smp'
        ? [
            {
              kind: 'category',
              name: msg('SIM_CAT_VARIABLES'),
              categorystyle: 'variable_category',
              custom: 'VARIABLE',
            },
          ]
        : []),
    ],
  };
}

const palette = {
  event: '#b5871a',
  motion: '#2f5fd0',
  control: '#1d7466',
  sensor: '#c96a12',
  output: '#7c5cc4',
};

const blockStyles = {
  event_blocks: {
    colourPrimary: palette.event,
    colourSecondary: '#d6a93a',
    colourTertiary: '#8a6512',
    hat: 'cap',
  },
  motion_blocks: {
    colourPrimary: palette.motion,
    colourSecondary: '#5c82e0',
    colourTertiary: '#1f43a0',
  },
  control_blocks: {
    colourPrimary: palette.control,
    colourSecondary: '#2f9a88',
    colourTertiary: '#13544a',
  },
  sensor_blocks: {
    colourPrimary: palette.sensor,
    colourSecondary: '#e08a3a',
    colourTertiary: '#94500c',
  },
  output_blocks: {
    colourPrimary: palette.output,
    colourSecondary: '#9a80d8',
    colourTertiary: '#5b3fa0',
  },
};

const categoryStyles = {
  event_category: { colour: palette.event },
  motion_category: { colour: palette.motion },
  control_category: { colour: palette.control },
  sensor_category: { colour: palette.sensor },
  output_category: { colour: palette.output },
};

const fontStyle = {
  family: "'Plus Jakarta Sans Variable', system-ui, sans-serif",
  weight: '700',
  size: 13,
};

export const lightTheme = Blockly.Theme.defineTheme('taksu-sim-light', {
  name: 'taksu-sim-light',
  base: Blockly.Themes.Classic,
  blockStyles,
  categoryStyles,
  fontStyle,
  startHats: true,
  componentStyles: {
    workspaceBackgroundColour: '#f5f7fb',
    toolboxBackgroundColour: '#ffffff',
    toolboxForegroundColour: '#0f1b3d',
    flyoutBackgroundColour: '#e8edf6',
    flyoutForegroundColour: '#0f1b3d',
    flyoutOpacity: 1,
    scrollbarColour: '#d3dbea',
    insertionMarkerColour: '#1f4fd1',
    insertionMarkerOpacity: 0.3,
    cursorColour: '#1f4fd1',
  },
});

export const darkTheme = Blockly.Theme.defineTheme('taksu-sim-dark', {
  name: 'taksu-sim-dark',
  base: Blockly.Themes.Classic,
  blockStyles,
  categoryStyles,
  fontStyle,
  startHats: true,
  componentStyles: {
    workspaceBackgroundColour: '#0b1226',
    toolboxBackgroundColour: '#111b36',
    toolboxForegroundColour: '#e6ebf8',
    flyoutBackgroundColour: '#18244a',
    flyoutForegroundColour: '#e6ebf8',
    flyoutOpacity: 1,
    scrollbarColour: '#253260',
    insertionMarkerColour: '#8cb0ff',
    insertionMarkerOpacity: 0.4,
    cursorColour: '#8cb0ff',
  },
});
