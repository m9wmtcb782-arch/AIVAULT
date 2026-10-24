/* Stage (c) same-origin local dispatch bus (no LLM).
 * Collab-worker tab enqueues nn-infer; compute-node tab claims and returns result.
 * Uses localStorage + storage events. Off: COMPUTE_NN_DISPATCH_OFF=1
 */
(function (global) {
  'use strict';
  const KEY = 'aivault_nn_dispatch_v1';
  const CHAN = 'aivault-nn-dispatch-v1';

  function isOff(search) {
    const q = new URLSearchParams(search || (typeof location !== 'undefined' ? location.search : ''));
    if (q.get('COMPUTE_NN_DISPATCH_OFF') === '1' || q.get('off') === '1') return true;
    try {
      if (localStorage.getItem('COMPUTE_NN_DISPATCH_OFF') === '1') return true;
    } catch (_) {}
    return false;
  }

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{"jobs":[]}');
    } catch {
      return { jobs: [] };
    }
  }
  function write(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(CHAN);
        bc.postMessage({ type: 'bus-updated', at: Date.now() });
        bc.close();
      }
    } catch (_) {}
  }

  function enqueue(job) {
    if (isOff()) throw new Error('COMPUTE_NN_DISPATCH_OFF=1');
    const state = read();
    const row = {
      task_id: job.task_id || 'nn-' + Date.now(),
      type: job.type || 'nn-infer',
      model_id: job.model_id || 'owned-micro-mlp-v1',
      input_ref: job.input_ref || 'packaged-ref-100',
      status: 'WAITING',
      allow_cpu: job.allow_cpu === true,
      created_at: new Date().toISOString(),
      llm_path: false,
      external_api: false,
      source: 'collab-worker-sim',
    };
    state.jobs = (state.jobs || []).filter((j) => j.status === 'WAITING' || j.status === 'RUNNING').concat([row]);
    write(state);
    return row;
  }

  function claim(nodeId) {
    if (isOff()) throw new Error('COMPUTE_NN_DISPATCH_OFF=1');
    const state = read();
    const job = (state.jobs || []).find((j) => j.status === 'WAITING');
    if (!job) return null;
    job.status = 'RUNNING';
    job.node_id = nodeId;
    job.claimed_at = new Date().toISOString();
    write(state);
    return { ...job };
  }

  function complete(taskId, result) {
    const state = read();
    const job = (state.jobs || []).find((j) => j.task_id === taskId);
    if (!job) throw new Error('job missing');
    job.status = result && result.verified ? 'COMPLETED' : 'FAILED';
    job.result = result;
    job.completed_at = new Date().toISOString();
    write(state);
    return job;
  }

  function get(taskId) {
    return (read().jobs || []).find((j) => j.task_id === taskId) || null;
  }

  function clear() {
    write({ jobs: [] });
  }

  function onUpdate(cb) {
    const handler = () => cb(read());
    window.addEventListener('storage', handler);
    let bc = null;
    try {
      bc = new BroadcastChannel(CHAN);
      bc.onmessage = handler;
    } catch (_) {}
    return () => {
      window.removeEventListener('storage', handler);
      try {
        bc && bc.close();
      } catch (_) {}
    };
  }

  global.AivaultNnDispatchBus = { KEY, isOff, enqueue, claim, complete, get, clear, read, onUpdate };
})(typeof globalThis !== 'undefined' ? globalThis : this);
