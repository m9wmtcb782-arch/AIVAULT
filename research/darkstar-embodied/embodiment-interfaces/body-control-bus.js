/**
 * Unified Body Control Bus（虛擬 stub）
 * 控制指令依能力描述符裁剪；不可達則拒絕
 */
export const BODY_CONTROL_BUS_VERSION = '0.1.0-dev';
export const BODY_CONTROL_STATUS = '開發中';

/**
 * @param {object} [partial]
 */
export function createCapabilityDescriptor(partial = {}) {
  return {
    schema: 'aivault.darkstar.capability_descriptor.v0.1',
    embodimentKind: partial.embodimentKind || 'virtual_avatar',
    bodyId: partial.bodyId || 'virtual-default',
    joints: Array.isArray(partial.joints) ? partial.joints.map((j) => ({ ...j })) : [],
    actuators: Array.isArray(partial.actuators) ? [...partial.actuators] : ['skeletal_pose'],
    sensors: Array.isArray(partial.sensors) ? [...partial.sensors] : ['virtual_proprioception'],
    limits: {
      maxJointSpeed: partial.limits?.maxJointSpeed != null ? partial.limits.maxJointSpeed : 2.5,
      maxPayloadKg: partial.limits?.maxPayloadKg != null ? partial.limits.maxPayloadKg : 0,
      ...((partial.limits && typeof partial.limits === 'object') ? partial.limits : {})
    },
    safety: {
      estop: true,
      requireCalibration: partial.safety?.requireCalibration !== false,
      ...(partial.safety || {})
    },
    disclaimer: '能力描述符｜虛擬 stub｜非實機保證'
  };
}

/**
 * @param {object} [opts]
 * @param {object} [opts.capability]
 * @param {Function} [opts.onCommand]
 */
export function createBodyControlBus(opts = {}) {
  let capability = createCapabilityDescriptor(opts.capability || {});
  const history = [];

  function setCapability(next) {
    capability = createCapabilityDescriptor(next);
    return getCapability();
  }

  function getCapability() {
    return JSON.parse(JSON.stringify(capability));
  }

  /**
   * @param {object} intent  e.g. { type:'joint_target', jointId, value } | { type:'gesture', name }
   */
  function submit(intent = {}) {
    const type = intent.type || 'noop';
    const jointIds = new Set((capability.joints || []).map((j) => j.id));

    if (type === 'joint_target') {
      if (!jointIds.has(intent.jointId)) {
        const rej = {
          ok: false,
          reason: 'joint_not_in_capability',
          jointId: intent.jointId,
          bodyId: capability.bodyId
        };
        history.push({ ts: Date.now(), intent, result: rej });
        return rej;
      }
    }

    if (type === 'hardware_torque' && capability.embodimentKind !== 'physical_robot') {
      const rej = {
        ok: false,
        reason: 'hardware_command_on_virtual_body',
        embodimentKind: capability.embodimentKind
      };
      history.push({ ts: Date.now(), intent, result: rej });
      return rej;
    }

    const result = {
      ok: true,
      accepted: true,
      type,
      bodyId: capability.bodyId,
      embodimentKind: capability.embodimentKind,
      echo: intent,
      ts: Date.now()
    };
    history.push({ ts: Date.now(), intent, result });
    if (typeof opts.onCommand === 'function') opts.onCommand(result);
    return result;
  }

  function getHistory() {
    return history.slice();
  }

  return {
    version: BODY_CONTROL_BUS_VERSION,
    status: BODY_CONTROL_STATUS,
    setCapability,
    getCapability,
    submit,
    getHistory,
    createCapabilityDescriptor
  };
}
