import { describe, expect, it } from 'vitest';
import { getMission } from '../engine/missions';
import { identifier, toCpp } from './cpp';

describe('toCpp', () => {
  it('turns Ciko’s obstacle solution into Arduino C++', () => {
    expect(toCpp(getMission('ciko-rintangan')!.solution, 'ciko')).toBe(
      [
        '#include <RobotKit.h>',
        '',
        'RobotKit robot(RobotKit::CIKO);',
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

  it('switches Ciko’s turn signals on and off', () => {
    const cpp = toCpp(
      {
        body: [
          { kind: 'signal', side: 'left', tick: true },
          { kind: 'wait', seconds: { kind: 'num', value: 1 } },
          { kind: 'signal', side: 'hazard', tick: false },
          { kind: 'signal', side: 'off', tick: false },
        ],
      },
      'ciko',
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
    const cpp = toCpp(getMission('momo-radar')!.solution, 'momo');
    expect(cpp).toContain('float kiri = 0;');
    expect(cpp).toContain('kanan = robot.distance();');
    expect(cpp).toContain('if ((kiri > kanan)) {');
    expect(cpp).toContain('} else {');
  });

  it('formats OLED text joins as Arduino Strings', () => {
    expect(toCpp(getMission('momo-lingkungan')!.solution, 'momo')).toContain(
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
      'momo',
    );
    expect(cpp).toContain('if (robot.wifiConnected()) {');
    expect(cpp).toContain('robot.send("suhu", robot.temperature());');
  });

  it('sanitises variable names', () => {
    expect(identifier('jarak kiri')).toBe('jarak_kiri');
    expect(identifier('2x')).toBe('v_2x');
  });

  it('writes algorithm practice for the Serial Monitor with whole-number variables', () => {
    const fizz = toCpp(getMission('algo-fizzbuzz')!.solution, 'momo');
    expect(fizz).toContain('long i = 0;');
    expect(fizz).toContain('  Serial.begin(115200);');
    expect(fizz).toContain('  for (i = 1; i <= 15; i++) {');
    expect(fizz).toContain('    if (((i % 15) == 0)) {');
    expect(fizz).toContain('      Serial.println("FizzBuzz");');

    const countdown = toCpp(getMission('algo-mundur')!.solution, 'momo');
    expect(countdown).toContain('  for (i = 10; i >= 1; i--) {');

    const sum = toCpp(getMission('algo-jumlah')!.solution, 'momo');
    expect(sum).toContain('long jumlah = 0;');
    expect(sum).toContain('    jumlah += i;');

    expect(toCpp(getMission('algo-prima')!.solution, 'momo')).toContain('bool prima = false;');
    const average = toCpp(getMission('momo-rata')!.solution, 'momo');
    expect(average).toContain('float total = 0;');
    expect(average).toContain('  Serial.println(String("Rata-rata ") + String((total / 5)));');
  });

  it('leaves Serial out of programs that never print', () => {
    expect(toCpp(getMission('ciko-rintangan')!.solution, 'ciko')).not.toContain('Serial');
  });

  it('writes algorithm practice as a plain Arduino sketch, without the robot library', () => {
    const cpp = toCpp(getMission('algo-fpb')!.solution, 'board');
    expect(cpp).not.toContain('RobotKit');
    expect(cpp.split('\n').slice(0, 5)).toEqual([
      'long a = 0;',
      'long b = 0;',
      'long t = 0;',
      '',
      'void setup() {',
    ]);
    expect(cpp).toContain('  Serial.begin(115200);');
    expect(cpp).toContain('  while ((b != 0)) {');
    expect(cpp).toContain('    t = (a % b);');
  });
});
