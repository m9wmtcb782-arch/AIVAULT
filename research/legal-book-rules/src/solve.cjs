'use strict';
const{answerBookCase}=require('./book-case.cjs');
const{parseReasonQuestion,answerReasonQuestion}=require('./reason-question.cjs');
const{parseQuestion,answerConceptQuestion}=require('./concept-question.cjs');
const{answerReadingCard}=require('./reading-card.cjs');
// Single CPU-only entry point. No provider fallback and no hidden model requests.
function solve(input,knowledge,capabilities={}){
  if(!knowledge?.snapshot||!capabilities.allowedBookIds?.includes(knowledge.snapshot.meta?.bookId))return{status:'BLOCKED',reasons:['BOOK_NOT_AUTHORIZED']};
  if(!input||typeof input.question!=='string'||input.question.length>500)return{status:'UNSUPPORTED',reasons:['QUESTION_REQUIRED']};
  try{
    if(Object.hasOwn(input,'factsText')){
      if(!knowledge.caseCard)return{status:'UNSUPPORTED',reasons:['CASE_RULE_REQUIRED']};
      return{route:'book_case',...answerBookCase(input,knowledge.caseCard,knowledge.snapshot,capabilities)};
    }
    if(knowledge.reasonCard&&parseReasonQuestion(input.question,knowledge.reasonCard))return{route:'book_reasons',...answerReasonQuestion(input.question,knowledge.reasonCard,knowledge.snapshot,capabilities)};
    if(knowledge.graph){const parsed=parseQuestion(input.question,knowledge.graph.concepts);if(parsed.status==='AMBIGUOUS')return{status:'AMBIGUOUS',reasons:['CONCEPT_ALIASES_CONFLICT']};if(parsed.status==='PARSED')return{route:'book_concepts',...answerConceptQuestion(input.question,knowledge.graph,knowledge.snapshot,capabilities)};}
    if(knowledge.card)return{route:'book_reading',...answerReadingCard(input.question,knowledge.card,knowledge.snapshot,capabilities)};
    return{status:'UNSUPPORTED',text:'目前沒有足夠且已核對的書中規則處理這個問題。',modelCalls:0};
  }catch{return{status:'BLOCKED',reasons:['INVALID_KNOWLEDGE_PACKAGE']};}
}
module.exports={solve};
