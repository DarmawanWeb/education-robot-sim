import { describe, expect, it } from 'vitest';
import { getMission } from '../engine/missions';
import { identifier, toCpp } from './cpp';

describe('toCpp', () => {
  it('turns the SD obstacle solution into Arduino C++', () => {
    expect(toCpp(getMission('sd-rintangan')!.solution, 'sd')).toBe(
      [
        '#include <RobotKit.h>',
        '',
        'RobotKit robot(RobotKit::SD);',
        '',
        'void setup() {',
        '  robot.begin();',
        '  robot.forward(50);',
        '  while (!(robot.distance() < 15)) {',
        '    delay(5);',
        '  }',
        '  robot.stop();',
        '  robot.face(Face::Alert);',
        '  robot.beep(300);',
        '}',
        '',
        'void loop() {}',
      ].join('\n'),
    );
  });

  it('switches the SD turn signals on and off', () => {
    const cpp = toCpp(
      {
        body: [
          { kind: 'signal', side: 'left', tick: true },
          { kind: 'wait', seconds: { kind: 'num', value: 1 } },
          { kind: 'signal', side: 'hazard', tick: false },
          { kind: 'signal', side: 'off', tick: false },
        ],
      },
      'sd',
    );
    expect(cpp).toContain(
      [
        '  robot.signal(Signal::Left, true);',
        '  delay(1000);',
        '  robot.signal(Signal::Hazard, false);',
        '  robot.signal(Signal::Off);',
      ].join('\n'),
    );
  });

  it('declares variables and keeps else-if chains readable', () => {
    const cpp = toCpp(getMission('smp-radar')!.solution, 'smp');
    expect(cpp).toContain('float kiri = 0;');
    expect(cpp).toContain('kanan = robot.distance();');
    expect(cpp).toContain('if ((kiri > kanan)) {');
    expect(cpp).toContain('} else {');
  });

  it('formats OLED text joins as Arduino Strings', () => {
    expect(toCpp(getMission('smp-lingkungan')!.solution, 'smp')).toContain(
      'robot.print(1, String("Suhu ") + String(robot.temperature()));',
    );
  });

  it('sends telemetry and checks the Wi-Fi link', () => {
    const cpp = toCpp(
      {
        body: [
          {
            kind: 'if',
            branches: [
              {
                cond: { kind: 'sensor', sensor: 'wifi' },
                body: [
                  { kind: 'send', key: 'suhu', value: { kind: 'sensor', sensor: 'temperature' } },
                ],
              },
            ],
            otherwise: [],
          },
        ],
      },
      'smp',
    );
    expect(cpp).toContain('if (robot.wifiConnected()) {');
    expect(cpp).toContain('robot.send("suhu", robot.temperature());');
  });

  it('sanitises variable names', () => {
    expect(identifier('jarak kiri')).toBe('jarak_kiri');
    expect(identifier('2x')).toBe('v_2x');
  });
});
