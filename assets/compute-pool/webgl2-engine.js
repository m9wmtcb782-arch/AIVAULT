/* AIVAULT fixed integer GPU benchmark. No downloaded shader, model, or CPU execution substitute. */
(function(global){
  'use strict';
  function checksum(elements,iterations){let sum=0;for(let i=0;i<Math.min(1024,elements);i++){let x=(i+1)>>>0;for(let j=0;j<iterations;j++){x=(Math.imul(x,1664525)+1013904223)>>>0;x=(x^(x>>>13))>>>0;x=Math.imul(x,2246822519)>>>0;x=(x^(x>>>16))>>>0;}sum=(sum+x)>>>0;}return sum;}
  function createRunner(){
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,failIfMajorPerformanceCaveat:true});
    if(!gl)throw Error('此瀏覽器也無法啟用 WebGL2，裝置將保留登記但不計入可用 GPU。');
    let lost=false;canvas.addEventListener('webglcontextlost',()=>{lost=true;});
    function shader(type,code){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error('WebGL2 shader 編譯失敗：'+msg);}return s;}
    const vs=shader(gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}');
    const fs=shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float; precision highp int; uniform uint u_elements; uniform uint u_iterations; uniform uint u_width; layout(location=0) out uvec4 result; void main(){uint index=uint(gl_FragCoord.y)*u_width+uint(gl_FragCoord.x);if(index>=u_elements){result=uvec4(0u);return;}uint x=index+1u;for(uint i=0u;i<u_iterations;i++){x=x*1664525u+1013904223u;x=x^(x>>13u);x=x*2246822519u;x=x^(x>>16u);}result=uvec4(x,0u,0u,1u);}');
    const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('WebGL2 program 連結失敗：'+gl.getProgramInfoLog(program));
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const renderer=gl.getParameter(gl.RENDERER)||'WebGL2';
    async function run(elements,iterations,progress){
      if(lost||gl.isContextLost())throw Error('WebGL2 GPU context 已中斷');
      if(!Number.isInteger(elements)||elements<1||elements>4096||!Number.isInteger(iterations)||iterations<1||iterations>16)throw Error('WebGL2 驗證僅接受 1–4096 個元素、1–16 次迭代');
      const side=Math.ceil(Math.sqrt(elements)),texture=gl.createTexture(),framebuffer=gl.createFramebuffer();
      try{
        gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32UI,side,side,0,gl.RGBA_INTEGER,gl.UNSIGNED_INT,null);
        gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('此 GPU 不支援本次整數運算目標');
        gl.useProgram(program);gl.bindVertexArray(vao);gl.uniform1ui(gl.getUniformLocation(program,'u_elements'),elements);gl.uniform1ui(gl.getUniformLocation(program,'u_iterations'),iterations);gl.uniform1ui(gl.getUniformLocation(program,'u_width'),side);gl.viewport(0,0,side,side);gl.disable(gl.BLEND);gl.disable(gl.DITHER);
        const start=performance.now();gl.drawArrays(gl.TRIANGLES,0,3);
        const pixels=new Uint32Array(side*side*4);gl.readPixels(0,0,side,side,gl.RGBA_INTEGER,gl.UNSIGNED_INT,pixels);const elapsed=performance.now()-start;
        if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL2 GPU 運算或讀回失敗');
        let sum=0;for(let i=0;i<Math.min(1024,elements);i++)sum=(sum+pixels[i*4])>>>0;
        // CPU is an oracle only: GPU data came from the integer framebuffer above.
        if(sum!==checksum(elements,iterations))throw Error('WebGL2 GPU 輸出與參考值不符');
        if(progress)await progress(100);
        return {elements,iterations_per_element:iterations,sample_count:Math.min(1024,elements),checksum:sum,executed_on:'WebGL2',gpu:true,verified:true,gpu_time_ms:Number(elapsed.toFixed(2)),raster_pixels:side*side,workgroups:null,timing_method:'CPU wall time bracketing WebGL2 drawArrays and synchronous readPixels; GPU timestamp-query not used'};
      }finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(framebuffer);gl.deleteTexture(texture);}
    }
    return {run,renderer,dispose(){gl.deleteProgram(program);gl.deleteVertexArray(vao);}};
  }
  global.AivaultWebGL2={createRunner,checksum};
})(globalThis);
