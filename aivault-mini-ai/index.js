/* AIVAULT Mini AI v0.1
 * Phone-side AI runtime adapter.
 * Additive: does not require Supabase, API keys, or a specific model runtime.
 * Real model execution is provided by an adapter (LiteRT / ONNX Runtime / future runtimes).
 */
(function(root){
  'use strict';

  const VERSION = '0.1.0';

  const TASKS = Object.freeze([
    'classify', 'embed', 'summarize', 'vision', 'text', 'custom'
  ]);

  const RUNTIMES = Object.freeze({
    LITERT: 'litert',
    ONNX: 'onnxruntime',
    NONE: 'none'
  });

  function now(){ return new Date().toISOString(); }

  function safeNumber(v, fallback){
    return Number.isFinite(Number(v)) ? Number(v) : fallback;
  }

  function detectWebGPU(){
    return !!(root.navigator && root.navigator.gpu);
  }

  function detectWebNN(){
    return !!(root.navigator && root.navigator.ml);
  }

  function detectRuntime(){
    // Do not import or download a model automatically. The phone owner controls
    // model/runtime installation. These names are deliberately adapter-level.
    if(root.litert || root.LiteRT || root.AIVAULT_LITERT) return RUNTIMES.LITERT;
    if(root.ort || root.ORT || root.AIVAULT_ONNX) return RUNTIMES.ONNX;
    return RUNTIMES.NONE;
  }

  class NullAdapter{
    constructor(){ this.name = RUNTIMES.NONE; }
    async init(){
      return {ready:false, reason:'NO_LOCAL_MODEL_RUNTIME'};
    }
    async run(){
      throw new Error('NO_LOCAL_MODEL_RUNTIME');
    }
  }

  class FunctionAdapter{
    constructor(name, runner){
      this.name = name;
      this.runner = runner;
      this.ready = false;
    }
    async init(options){
      if(typeof this.runner.init === 'function') await this.runner.init(options || {});
      this.ready = true;
      return {ready:true, runtime:this.name};
    }
    async run(task){
      if(typeof this.runner.run !== 'function') throw new Error('ADAPTER_RUN_NOT_IMPLEMENTED');
      return this.runner.run(task);
    }
  }

  class AIVAULTMiniAI{
    constructor(options){
      options = options || {};
      this.version = VERSION;
      this.nodeId = options.nodeId || this.getOrCreateNodeId();
      this.adapter = options.adapter || new NullAdapter();
      this.model = options.model || null;
      this.initialized = false;
      this.ready = false;
      this.startedAt = now();
      this.stats = {runs:0,localRuns:0,failures:0,lastRunAt:null};
    }

    getOrCreateNodeId(){
      const key='AIVAULT_MINI_AI_NODE_ID';
      try{
        let id=root.localStorage && root.localStorage.getItem(key);
        if(!id){
          id='mini-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
          root.localStorage && root.localStorage.setItem(key,id);
        }
        return id;
      }catch(e){
        return 'mini-'+Date.now().toString(36);
      }
    }

    capabilities(){
      return {
        module:'aivault-mini-ai',
        version:this.version,
        node_id:this.nodeId,
        runtime:this.adapter.name || RUNTIMES.NONE,
        model:this.model,
        local_inference:this.ready,
        webgpu:detectWebGPU(),
        webnn:detectWebNN(),
        cpu:true,
        tasks:TASKS.slice(),
        generated_at:now()
      };
    }

    async init(options){
      const result=await this.adapter.init(options || {});
      this.initialized=true;
      this.ready=!!result.ready;
      return Object.assign(this.capabilities(), result);
    }

    async run(task){
      if(!task || typeof task !== 'object') throw new Error('TASK_REQUIRED');
      const normalized=Object.assign({
        task_id:'local-'+Date.now().toString(36),
        type:'custom',
        input:null,
        options:{}
      },task);
      if(!TASKS.includes(normalized.type)) throw new Error('UNSUPPORTED_TASK_TYPE');
      if(!this.ready) throw new Error('LOCAL_AI_NOT_READY');
      this.stats.runs++;
      this.stats.localRuns++;
      this.stats.lastRunAt=now();
      try{
        return await this.adapter.run(normalized);
      }catch(error){
        this.stats.failures++;
        throw error;
      }
    }

    nodeReport(){
      return {
        node_id:this.nodeId,
        role:'mini-ai-provider',
        consent_required:true,
        background_compute:false,
        capabilities:this.capabilities(),
        stats:Object.assign({},this.stats),
        generated_at:now()
      };
    }
  }

  function createAdapter(runtime, runner){
    if(typeof runner === 'function') runner={run:runner};
    if(!runner || typeof runner.run !== 'function') return new NullAdapter();
    return new FunctionAdapter(runtime || detectRuntime(), runner);
  }

  root.AIVAULTMiniAI={
    VERSION,
    TASKS,
    RUNTIMES,
    AIVAULTMiniAI,
    NullAdapter,
    FunctionAdapter,
    createAdapter,
    detectRuntime
  };
})(typeof window !== 'undefined' ? window : globalThis);
