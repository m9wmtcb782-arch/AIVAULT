/** AIVAULT knowledge-growth policy: books are seeds, not authority. */
export type Evidence={url:string;publisher:string;publishedAt?:string;retrievedAt:string;excerpt:string;kind:"official"|"paper"|"source_code"|"standard"|"experiment"|"other"};
export type Finding={bookId:string;chapterNo:number;claim:string;priorKnowledge:string;newEvidence:Evidence[];relationship:"SUPPORTS"|"EXTENDS"|"CORRECTS"|"CONTRADICTS"|"UNRESOLVED";application:string;testResult:"PASS"|"FAIL"|"NOT_TESTED";reviewed:boolean};
export type Decision={status:"VERIFIED"|"REVIEW_REQUIRED"|"REJECTED";reasons:string[]};
const validUrl=(s:string)=>{try{const u=new URL(s);return u.protocol==="https:"&&!!u.hostname}catch{return false}};
export function assessFinding(f:Finding):Decision{
 const reasons:string[]=[];
 if(!f.bookId||!Number.isInteger(f.chapterNo)||f.chapterNo<1)reasons.push("MISSING_BOOK_REFERENCE");
 if(!f.claim.trim()||!f.priorKnowledge.trim())reasons.push("MISSING_COMPARISON");
 if(!f.application.trim())reasons.push("NO_PRACTICAL_APPLICATION");
 if(!f.newEvidence.length)reasons.push("NO_EXTERNAL_EVIDENCE");
 if(f.newEvidence.some(e=>!validUrl(e.url)||!e.publisher.trim()||!e.retrievedAt||!e.excerpt.trim()))reasons.push("INVALID_PROVENANCE");
 if(f.relationship==="UNRESOLVED")reasons.push("UNRESOLVED_CONFLICT");
 if(f.testResult==="FAIL")reasons.push("FAILED_TEST");
 if(reasons.length)return {status:"REJECTED",reasons};
 if(!f.reviewed||f.testResult!=="PASS")return {status:"REVIEW_REQUIRED",reasons:["AWAITING_INDEPENDENT_REVIEW_OR_TEST"]};
 return {status:"VERIFIED",reasons:[]};
}
export function canPromote(f:Finding):boolean{return assessFinding(f).status==="VERIFIED"}
export function studyQuery(bookTitle:string,chapterTitle:string):string{return [bookTitle,chapterTitle,"official documentation research paper implementation benchmark"].filter(Boolean).join(" ")}
