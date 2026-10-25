/**
 * Sit controller — Phase2 delegates to ENGINE-03 continuous motor.
 * Kept as thin adapter for classroom page imports.
 */
import { createMotorController } from '../../engines/ENGINE-03-motor-control/motor-controller.js';

export const SIT_CONTROLLER_VERSION = '0.2.0-dev';

/**
 * @param {object} opts avatar, bones, bonesByHint, sitY, sync
 */
export function createSitController(opts = {}) {
  const motor = createMotorController(opts);

  async function sit(chair, runOpts) {
    return motor.sitOnChair(chair, { sitY: opts.sitY, ...runOpts });
  }

  async function stand(runOpts) {
    return motor.standUp(runOpts);
  }

  return {
    version: SIT_CONTROLLER_VERSION,
    motorVersion: motor.version,
    sit,
    stand,
    isSitting: () => motor.isSitting(),
    walkToward: (t, o) => motor.walkToward(t, o),
    eraseVirtualBlackboard: (api, o) => motor.eraseVirtualBlackboard(api, o),
    getMotor: () => motor
  };
}
