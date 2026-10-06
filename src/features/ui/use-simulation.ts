'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DT, Simulation, type BuzzerEvent } from '../engine/simulation';
import type { Environment, Face, Mission, Outcome, Program } from '../engine/types';

export interface PanelState {
  time: number;
  face: Face;
  oled: string[];
  lineValues: number[];
  linePosition: number;
  distance: number;
  servoAngle: number;
  env: Environment;
  motors: { left: number; right: number };
  buzzing: boolean;
  met: string[];
  outcome: Outcome;
  programDone: boolean;
}

function panelOf(simulation: Simulation): PanelState {
  return {
    time: simulation.time,
    face: simulation.face,
    oled: [...simulation.oled],
    lineValues: [...simulation.lineValues],
    linePosition: simulation.linePosition,
    distance: simulation.distance,
    servoAngle: simulation.servoAngle,
    env: simulation.env,
    motors: { ...simulation.motors },
    buzzing: simulation.time < simulation.buzzingUntil,
    met: [...simulation.met],
    outcome: simulation.outcome,
    programDone: simulation.programDone,
  };
}

let audio: AudioContext | null = null;
function playBuzzer(events: BuzzerEvent[]) {
  try {
    audio ??= new AudioContext();
    for (const event of events) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = event.frequency;
      gain.gain.value = 0.05;
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + Math.min(event.seconds, 2));
    }
  } catch {
    // Audio is a nicety; the panel still shows the buzzer.
  }
}

/**
 * Owns one Simulation and its animation loop. Physics runs at a fixed 120 Hz; the canvas
 * redraws every frame and the React panel refreshes ten times a second.
 */
export function useSimulation(
  mission: Mission,
  options: {
    onFinish: (outcome: Outcome) => void;
    onActiveBlock: (blockId: string | null) => void;
  },
) {
  const [simulation] = useState(() => new Simulation(mission));
  const [panel, setPanel] = useState<PanelState>(() => panelOf(simulation));
  const [running, setRunning] = useState(false);
  const frame = useRef(0);
  const speed = useRef(1);
  const draw = useRef<() => void>(() => {});
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  const start = useCallback(
    (program: Program) => {
      stopLoop();
      simulation.start(program);
      setRunning(true);
      let last = performance.now();
      let carry = 0;
      let lastPanel = 0;
      let lastBlock: string | undefined;
      const tick = (now: number) => {
        carry += Math.min(0.1, (now - last) / 1000) * speed.current;
        last = now;
        while (carry >= DT && simulation.outcome.status === 'running') {
          simulation.step(DT);
          carry -= DT;
        }
        if (simulation.buzzerEvents.length > 0) playBuzzer(simulation.buzzerEvents.splice(0));
        if (simulation.activeBlock !== lastBlock) {
          lastBlock = simulation.activeBlock;
          callbacks.current.onActiveBlock(lastBlock ?? null);
        }
        draw.current();
        const finished = simulation.outcome.status !== 'running';
        if (finished || now - lastPanel > 100) {
          setPanel(panelOf(simulation));
          lastPanel = now;
        }
        if (finished) {
          frame.current = 0;
          setRunning(false);
          callbacks.current.onActiveBlock(null);
          callbacks.current.onFinish(simulation.outcome);
          return;
        }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [simulation, stopLoop],
  );

  const stop = useCallback(() => {
    stopLoop();
    simulation.halt();
    setRunning(false);
    callbacks.current.onActiveBlock(null);
    setPanel(panelOf(simulation));
    draw.current();
  }, [simulation, stopLoop]);

  const reset = useCallback(() => {
    stopLoop();
    simulation.reset();
    setRunning(false);
    callbacks.current.onActiveBlock(null);
    setPanel(panelOf(simulation));
    draw.current();
  }, [simulation, stopLoop]);

  const setEnvironment = useCallback(
    (patch: Partial<Pick<Environment, 'temperature' | 'humidity'>>) => {
      simulation.setManualEnvironment(patch);
      setPanel(panelOf(simulation));
    },
    [simulation],
  );

  useEffect(() => stopLoop, [stopLoop]);

  return {
    simulation,
    panel,
    running,
    draw,
    start,
    stop,
    reset,
    setEnvironment,
    clap: () => simulation.clap(),
    setSpeed: (value: number) => {
      speed.current = value;
    },
  };
}
