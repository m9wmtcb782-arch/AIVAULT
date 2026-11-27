(()=>{'use strict';
const LIMITS={steps:10000,repeat:1000,depth:20,output:1000};
function tokenize(source){
  const tokens=[];let i=0;
  const pattern=/\s+|"(?:[^"\\]|\\.)*"|\d+(?:\.\d+)?|[A-Za-z_]\w*|==|!=|<=|>=|[()+*/<>=-]/y;
  while(i<source.length){pattern.lastIndex=i;const m=pattern.exec(source);if(!m)throw Error('無效字元，位置 '+(i+1));i=pattern.lastIndex;if(!/^\s+$/.test(m[0]))tokens.push(m[0]);}
  return tokens;
}
function evaluate(source,env){
  const t=tokenize(source);let i=0;
  function atom(){const x=t[i++];if(x===undefined)throw Error('運算式不完整');
    if(x==='('){const v=compare();if(t[i++]!==')')throw Error('缺少 )');return v;}
    if(x==='-'){const v=atom();if(typeof v!=='number')throw Error('負號只能用於數字');return -v;}
    if(x==='!')throw Error('不支援 !');
    if(x.startsWith('"')){try{return JSON.parse(x);}catch{throw Error('字串格式錯誤');}}
    if(/^\d/.test(x)){const n=Number(x);if(!Number.isFinite(n))throw Error('數字超出範圍');return n;}
    if(x==='true')return true;if(x==='false')return false;
    if(Object.hasOwn(env,x))return env[x];
    throw Error('未知變數：'+x);
  }
  function mul(){let v=atom();while(t[i]==='*'||t[i]==='/'){const op=t[i++],b=atom();if(typeof v!=='number'||typeof b!=='number')throw Error('乘除只接受數字');if(op==='/'&&b===0)throw Error('除數不可為 0');v=op==='*'?v*b:v/b;if(!Number.isFinite(v))throw Error('運算結果不是有限數字');}return v;}
  function add(){let v=mul();while(t[i]==='+'||t[i]==='-'){const op=t[i++],b=mul();if(op==='+'&&(typeof v==='string'||typeof b==='string'))v=String(v)+String(b);else{if(typeof v!=='number'||typeof b!=='number')throw Error('加減只接受數字（字串僅支援 + 串接）');v=op==='+'?v+b:v-b;}if(typeof v==='number'&&!Number.isFinite(v))throw Error('運算結果不是有限數字');}return v;}
  function compare(){let v=add();while(['==','!=','<','>','<=','>='].includes(t[i])){const op=t[i++],b=add();if(op==='==')v=v===b;else if(op==='!=')v=v!==b;else{if(typeof v!==typeof b||!['number','string'].includes(typeof v))throw Error('比較運算型別不相容');v=op==='<'?v<b:op==='>'?v>b:op==='<='?v<=b:v>=b;}}return v;}
  const result=compare();if(i!==t.length)throw Error('無效運算式：'+t.slice(i).join(' '));return result;
}
function parse(text){
  const lines=text.split(/\r?\n/).map((s,i)=>({s:s.trim(),line:i+1})).filter(x=>x.s&&!x.s.startsWith('//'));let i=0;
  function block(nested){const out=[];while(i<lines.length){const {s,line}=lines[i++];if(s==='}'){if(!nested)throw Error('第 '+line+' 行：多餘 }');return out;}let m;
    if((m=s.match(/^(repeat|when)\s+(.+)\s*\{$/)))out.push({type:m[1],value:m[2],body:block(true)});
    else if((m=s.match(/^task\s+([A-Za-z_]\w*)\s*\{$/)))out.push({type:'task',name:m[1],body:block(true)});
    else if((m=s.match(/^let\s+([A-Za-z_]\w*)\s*=\s*(.+)$/)))out.push({type:'let',name:m[1],value:m[2]});
    else if((m=s.match(/^print\s+(.+)$/)))out.push({type:'print',value:m[1]});
    else if((m=s.match(/^run\s+([A-Za-z_]\w*)$/)))out.push({type:'run',name:m[1]});
    else throw Error('第 '+line+' 行：不支援的語法：'+s);
  }if(nested)throw Error('缺少 }');return out;}
  return block(false);
}
function execute(tree){
  const env=Object.create(null),tasks=Object.create(null),output=[];let steps=0,depth=0;
  function run(nodes){if(++depth>LIMITS.depth)throw Error('任務呼叫深度超過 '+LIMITS.depth);try{for(const n of nodes){if(++steps>LIMITS.steps)throw Error('執行步數超過 '+LIMITS.steps);
    if(n.type==='let'){if(Object.hasOwn(env,n.name))throw Error('變數重複宣告：'+n.name);env[n.name]=evaluate(n.value,env);}
    else if(n.type==='print'){if(output.length>=LIMITS.output)throw Error('輸出筆數超過 '+LIMITS.output);output.push(String(evaluate(n.value,env)));}
    else if(n.type==='task'){if(Object.hasOwn(tasks,n.name))throw Error('任務重複宣告：'+n.name);tasks[n.name]=n.body;}
    else if(n.type==='run'){if(!Object.hasOwn(tasks,n.name))throw Error('未知任務：'+n.name);run(tasks[n.name]);}
    else if(n.type==='when'){if(evaluate(n.value,env))run(n.body);}
    else if(n.type==='repeat'){const count=evaluate(n.value,env);if(!Number.isInteger(count)||count<0||count>LIMITS.repeat)throw Error('repeat 必須是 0–'+LIMITS.repeat+' 的整數');for(let k=0;k<count;k++)run(n.body);}
    else throw Error('未知 AST 指令：'+n.type);
  }}finally{depth--;}}
  run(tree);return {output:output.join('\n'),variables:{...env},steps};
}
window.NCLv02={parse,execute,version:'0.3.0',limits:{...LIMITS}};
})();