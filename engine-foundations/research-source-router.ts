/** AIVAULT perpetual research source routing.
 * Prefer usable authorized books. If none exist, search public web.
 * Search is discovery, not proof of learning. No paid provider fallback.
 */
export type Book={id:string;title:string;authorized:boolean;chapters:{title:string;content:string}[]};
export type SearchResult={url:string;title:string;excerpt:string;retrievedAt:string};
export type FreeSearch=(query:string)=>Promise<SearchResult[]>;
export type RouteResult={mode:"BOOK"|"PUBLIC_WEB"|"BLOCKED";sources:SearchResult[];bookIds:string[];reason:string};
const https=(s:string)=>{try{return new URL(s).protocol==="https:"}catch{return false}};
export async function chooseResearchSources(topic:string,books:readonly Book[],search:FreeSearch):Promise<RouteResult>{
 if(!topic.trim())return {mode:"BLOCKED",sources:[],bookIds:[],reason:"EMPTY_TOPIC"};
 const usable=books.filter(b=>b.authorized&&b.chapters.some(c=>c.content.trim().length>0));
 if(usable.length)return {mode:"BOOK",sources:[],bookIds:usable.map(b=>b.id),reason:"AUTHORIZED_BOOKS_AVAILABLE"};
 try{
  const found=(await search(topic)).filter(x=>https(x.url)&&x.title.trim()&&x.excerpt.trim()&&x.retrievedAt.trim());
  const unique=[...new Map(found.map(x=>[x.url,x])).values()];
  if(!unique.length)return {mode:"BLOCKED",sources:[],bookIds:[],reason:"NO_VERIFIABLE_FREE_PUBLIC_SOURCES"};
  return {mode:"PUBLIC_WEB",sources:unique,bookIds:[],reason:"NO_USABLE_BOOK_FALLBACK_TO_PUBLIC_WEB"};
 }catch{return {mode:"BLOCKED",sources:[],bookIds:[],reason:"FREE_SEARCH_UNAVAILABLE_NO_PAID_FALLBACK"}}
}
