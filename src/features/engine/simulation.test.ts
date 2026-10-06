import { simMissions } from '@taksu/content';
import { describe, expect, it } from 'vitest';
import { Runner } from './interpreter';
import { getMission, missions } from './missions';
import { simulate } from './simulation';
import type { Program } from './types';

describe('mission catalogue', () => {
  it('implements every mission listed on the website', () => {
    expect(missions.map((mission) => mission.id).sort()).toEqual(
      simMissions.map((mission) => mission.id).sort(),
    );
    for (const info of simMissions) expect(getMission(info.id)?.robot).toBe(info.robot);
  });
});

describe.each(
  missions.filter((mission) => !mission.free).map((mission) => [mission.id, mission] as const),
)('reference solution for %s', (_id, mission) => {
  it('completes the mission', () => {
    const result = simulate(mission, mission.solution);
    expect({ outcome: result.outcome, met: [...result.met] }).toEqual({
      outcome: { status: 'success' },
      met: expect.arrayContaining(mission.goals.map((goal) => goal.id)),
    });
  });
});

describe('failure cases', () => {
  const run = (id: string, program: Program) => simulate(getMission(id)!, program);

  it('reports an incomplete run when the robot stops short', () => {
    const result = run('sd-finish', {
      body: [
        {
          kind: 'drive',
          dir: 'forward',
          speed: { kind: 'num', value: 60 },
          seconds: { kind: 'num', value: 2 },
        },
      ],
    });
    expect(result.outcome).toEqual({ status: 'fail', reason: 'incomplete' });
  });

  it('detects bumping into the obstacle', () => {
    // A program that ends stops the motors, so keep driving for longer than the arena.
    const result = run('sd-rintangan', {
      body: [
        {
          kind: 'drive',
          dir: 'forward',
          speed: { kind: 'num', value: 60 },
          seconds: { kind: 'num', value: 10 },
        },
      ],
    });
    expect(result.outcome).toEqual({ status: 'fail', reason: 'bump' });
  });

  it('shows the uncalibrated SMP robot drifting out of the zone', () => {
    const result = run('smp-pwm', {
      body: [
        { kind: 'motors', left: { kind: 'num', value: 60 }, right: { kind: 'num', value: 60 } },
        { kind: 'wait', seconds: { kind: 'num', value: 4.17 } },
        { kind: 'stop' },
      ],
    });
    expect(result.outcome.status).toBe('fail');
  });

  it('times out an endless loop that never reaches the goal', () => {
    const result = run('sd-garis', { body: [{ kind: 'forever', body: [] }] });
    expect(result.outcome).toEqual({ status: 'fail', reason: 'time' });
  });
});

describe('interpreter', () => {
  it('keeps going through a huge loop without hanging', () => {
    let motors = 0;
    const runner = new Runner(
      {
        body: [
          {
            kind: 'repeat',
            times: { kind: 'num', value: 1e7 },
            body: [{ kind: 'set', name: 'x', value: { kind: 'num', value: 1 } }],
          },
        ],
      },
      {
        time: () => 0,
        setMotors: () => {
          motors += 1;
        },
        read: () => 0,
        setFace: () => {},
        beep: () => {},
        oled: () => {},
        oledClear: () => {},
        servo: () => {},
        highlight: () => {},
      },
    );
    runner.tick();
    expect(runner.done).toBe(false);
    expect(motors).toBe(0);
  });
});
