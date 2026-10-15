import type { RobotId, RobotModel } from './types';

/**
 * Ciko: two IR line sensors straddling the tape under the front bumper, the ultrasonic
 * sensor in the bumper, turn signals at the front corners, matched motors.
 */
const ciko: RobotModel = {
  id: 'ciko',
  length: 16,
  width: 13,
  radius: 8.5,
  wheelBase: 12,
  maxSpeed: 30,
  motorBias: { left: 1, right: 1 },
  lineSensors: [
    { x: 8.6, y: -1.6 },
    { x: 8.6, y: 1.6 },
  ],
  sonar: { forward: 8, range: 200, halfCone: 0.13 },
  hasServo: false,
  hasSignals: true,
};

/** Momo, the ESP32 modular robot: 5-in-1 line array, sonar on a servo, slightly unmatched motors. */
const momo: RobotModel = {
  id: 'momo',
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
  hasSignals: false,
};

export const robotModels: Record<RobotId, RobotModel> = { ciko, momo };
