'use strict';
// Split only explicit question/semicolon boundaries outside quotes and parentheses.
function splitQuestions(text){
 if(typeof text!=='string'||text.length>500)return[];
 const pairs=new Map([['「','」'],['『','』'],['“','”'],['‘','’'],['（','）'],['(',')'],['【','】'],['[',']']]);
 const closers=new Set(pairs.values()),stack=[],parts=[];let ascii=false,start=0;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(c==='"'){ascii=!ascii;continue;}if(ascii)continue;
  if(pairs.has(c)){stack.push(pairs.get(c));continue;}if(closers.has(c)){if(stack.pop()!==c)return[];continue;}
  if(!stack.length&&/[?？；;]/u.test(c)){if(text.slice(start,i+1).trim())parts.push({start,end:i+1,text:text.slice(start,i+1)});start=i+1;}
 }
 if(ascii||stack.length)return[];
 if(text.slice(start).trim())parts.push({start,end:text.length,text:text.slice(start)});
 return parts.length>=2&&parts.length<=4?parts:[];
}
function answerMultiple(input,knowledge,capabilities,solve){
 if(Object.hasOwn(input,'factsText')||capabilities.allowCompoundQuestions===false)return null;
 const parts=splitQuestions(input.question);if(!parts.length)return null;
 const results=parts.map(p=>({...p,result:solve({question:p.text},knowledge,{...capabilities,allowCompoundQuestions:false})}));
 // Private/source validation failures must not be hidden behind a partial success.
 if(results.some(p=>p.result.status==='BLOCKED'))return{route:'book_multiple',status:'BLOCKED',reasons:['SUBQUESTION_BLOCKED'],modelCalls:0};
 const supported=p=>typeof p.result.status==='string'&&p.result.status.startsWith('SUPPORTED_');
 if(!results.some(supported))return null;
 const complete=results.every(supported);
 return{route:'book_multiple',status:complete?'SUPPORTED_MULTIPART_BOOK_ANSWER':'PARTIAL_BOOK_ANSWER',parts:results,
  text:(complete?'依本書逐題回答：':'以下只回答有已核對依據的部分；其餘尚未完成：')+'\n\n'+results.map((p,i)=>(i+1)+'. '+p.text.trim()+'\n'+(supported(p)?p.result.text:'這個子問題尚無足夠的已核對規則，不能視為已解答。')).join('\n\n'),
  unanswered:results.flatMap((p,i)=>supported(p)?[]:[i+1]),modelCalls:0,
  limitation:'各子問題分別依同一授權書籍的既有規則作答；未將分段答案合成新的法律結論，也不跨子題補入假設事實。'};
}
module.exports={splitQuestions,answerMultiple};
