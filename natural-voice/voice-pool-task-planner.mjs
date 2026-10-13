/** AIVAULT voice clause task planner (pure; no live Coordinator calls).
 * Never send model artifacts, tokens, or text to untrusted browser workers.
 */
export function planVoiceClauses({text,modelId,maxChars=120}={}){
 if(typeof text!=="string"||!text.trim())throw new Error("EMPTY_TEXT");
 if(Array.from(text).length>2000)throw new Error("TEXT_TOO_LONG");
 if(typeof modelId!=="string"||!/^aivault-[a-z0-9-]{1,48}$/.test(modelId))throw new Error("INVALID_FIRST_PARTY_MODEL");
 if(!Number.isSafeInteger(maxChars)||maxChars<8||maxChars>200)throw new Error("INVALID_CLAUSE_LIMIT");
 const units=Array.from(text),tasks=[];
 const stops=new Set(["，","。","！","？","!","?","；",";","\n"]);
 let start=0;
 const add=(end)=>{
  if(end<=start)return;
  const clause=units.slice(start,end).join("");
  if(clause.trim())tasks.push({sequence:tasks.length,modelId,text:clause,charStart:start,charEnd:end});
  start=end;
 };
 for(let i=0;i<units.length;i++){
  if(stops.has(units[i])||i-start+1>=maxChars)add(i+1);
 }
 add(units.length);
 return tasks;
}
export function validateVoiceClauseResult(task,result){
 if(!task||!result||result.sequence!==task.sequence||result.modelId!==task.modelId||
    result.charStart!==task.charStart||result.charEnd!==task.charEnd||
    result.sampleRate!==24000||!(result.pcm instanceof Uint8Array)||
    !result.pcm.length||result.pcm.length%2)return false;
 return true;
}
