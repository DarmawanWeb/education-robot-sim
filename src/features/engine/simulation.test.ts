import { simMissions } from '@taksu/content';
import { describe, expect, it } from 'vitest';
import { moverBox } from './geometry';
import { Runner } from './interpreter';
import { getMission, missions } from './missions';
import { Simulation, simulate } from './simulation';
import type { Program, Statement } from './types';

const num = (value: number) => ({ kind: 'num' as const, value });
const wait = (seconds: number): Statement => ({ kind: 'wait', seconds: num(seconds) });
const signal = (side: 'left' | 'off', tick = true): Statement => ({ kind: 'signal', side, tick });

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

describe('Wi-Fi telemetry', () => {
  it('keeps readings sent while online and loses the rest', () => {
    const mission = { ...getMission('smp-bebas')!, wifi: [{ t: 0.5, online: false }] };
    const result = simulate(
      mission,
      {
        body: [
          {
            kind: 'repeat',
            times: { kind: 'num', value: 10 },
            body: [
              { kind: 'send', key: 'suhu', value: { kind: 'sensor', sensor: 'temperature' } },
              { kind: 'wait', seconds: { kind: 'num', value: 0.1 } },
            ],
          },
        ],
      },
      2,
    );
    expect(result.telemetry.length).toBe(5);
    expect(result.dropped).toBe(5);
    expect(result.telemetry.every((point) => point.key === 'suhu')).toBe(true);
  });
});

describe('turn signals', () => {
  // The first SD mission without its goals, so nothing ends the run early.
  const bench = { ...getMission('sd-kenalan')!, goals: [] };

  it('blinks and clicks the buzzer once per flash, apart from beeps', () => {
    const result = simulate(bench, { body: [signal('left'), wait(5)] }, 2);
    expect(result.signal).toBe('left');
    expect(result.ticks).toBe(3);
    expect(result.beeps).toBe(0);
    expect(result.buzzerEvents).toHaveLength(3);
  });

  it('keeps its rhythm when a loop keeps switching it on', () => {
    const result = simulate(
      bench,
      { body: [{ kind: 'forever', body: [signal('left'), wait(0.1)] }] },
      2,
    );
    expect(result.ticks).toBe(3);
  });

  it('blinks silently without the tick', () => {
    const result = simulate(bench, { body: [signal('left', false), wait(5)] }, 2);
    expect(result.ticks).toBe(0);
    expect(result.buzzerEvents).toHaveLength(0);
  });

  it('is lit for the first half of each flash', () => {
    const simulation = new Simulation(bench);
    simulation.start({ body: [signal('left'), wait(5)] });
    const litAt = (seconds: number) => {
      while (simulation.time < seconds) simulation.step();
      return simulation.signalLit;
    };
    expect(litAt(0.2)).toBe(true);
    expect(litAt(0.5)).toBe(false);
    expect(litAt(0.8)).toBe(true);
    simulation.halt();
    expect(simulation.signal).toBe('off');
  });

  it('does nothing on SMP v1, which has no turn signals', () => {
    const result = simulate(getMission('smp-bebas')!, { body: [signal('left'), wait(5)] }, 1);
    expect(result.signal).toBe('off');
    expect(result.ticks).toBe(0);
  });
});

describe('moving obstacles', () => {
  it('slides between keyframes and holds at both ends', () => {
    const mover = {
      id: 'hand',
      kind: 'hand' as const,
      w: 6,
      h: 12,
      keys: [
        { t: 1, x: 100, y: 40 },
        { t: 3, x: 60, y: 40 },
      ],
    };
    expect(moverBox(mover, 0).x).toBe(100);
    expect(moverBox(mover, 2).x).toBeCloseTo(80);
    expect(moverBox(mover, 9).x).toBe(60);
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
        setSignal: () => {},
        servo: () => {},
        send: () => {},
        highlight: () => {},
      },
    );
    runner.tick();
    expect(runner.done).toBe(false);
    expect(motors).toBe(0);
  });
});
