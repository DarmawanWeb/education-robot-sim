import type { RobotId, RobotModel } from './types';

/** SD v1: two IR line sensors straddling the tape, front ultrasonic, matched motors. */
const sd: RobotModel = {
  id: 'sd',
  length: 16,
  width: 13,
  radius: 8.5,
  wheelBase: 12,
  maxSpeed: 30,
  motorBias: { left: 1, right: 1 },
  lineSensors: [
    { x: 7, y: -1.6 },
    { x: 7, y: 1.6 },
  ],
  sonar: { forward: 8, range: 200, halfCone: 0.13 },
  hasServo: false,
};

/** ESP32 modular robot (SMP): 5-in-1 line array, sonar on a servo, slightly unmatched motors. */
const smp: RobotModel = {
  id: 'smp',
  length: 18,
  width: 14,
  radius: 9.5,
  wheelBase: 13,
  maxSpeed: 40,
  motorBias: { left: 1, right: 0.94 },
  lineSensors: [
    { x: 8, y: -3.2 },
    { x: 8, y: -1.6 },
    { x: 8, y: 0 },
    { x: 8, y: 1.6 },
    { x: 8, y: 3.2 },
  ],
  sonar: { forward: 6, range: 300, halfCone: 0.13 },
  hasServo: true,
};

export const robotModels: Record<RobotId, RobotModel> = { sd, smp };
