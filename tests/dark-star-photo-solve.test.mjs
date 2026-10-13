import assert from 'node:assert/strict';
import {test} from 'node:test';
globalThis.Deno={env:{get:key=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-test',SUPABASE_ANON_KEY:'anon-test'}[key])}};
const {photoSolve,keywords}=await import('../supabase/functions/dark-star-photo-solve/index.ts');
const image='data:image/jpeg;base64,'+'A'.repeat(64);
const request=body=>new Request('https://test.supabase.co/functions/v1/dark-star-ebook-ingest?feature=photo-solve',{method:'POST',headers:{authorization:'Bearer anon-test','content-type':'application/json'},body:JSON.stringify(body)});
test('search is read-only and returns real source identifiers',async()=>{
 let calls=0;globalThis.fetch=async(url,options)=>{calls++;if(url.includes('dark_star_ebooks?'))return Response.json([{title:'臺灣比例原則教材'}]);assert.match(url,/rest\/v1\/rpc\/dark_star_search_ebook_pages$/);assert.equal(JSON.parse(options.body).book_id,'12345678-1234-1234-1234-123456789abc');return Response.json([{page_id:'p1',ebook_id:'b1',book_title:'教材',page_number:12,excerpt:'比例原則',score:4}]);};
 const r=await photoSolve(request({action:'search',question:'比例原則',ebook_id:'12345678-1234-1234-1234-123456789abc'}));const d=await r.json();assert.equal(d.sources[0].ref,1);assert.equal(d.sources[0].page_number,12);assert.equal(calls,2);
});
test('no match does not generate an unsupported answer',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json([]);};const d=await (await photoSolve(request({action:'solve',question:'未知概念',image,allow_web:false}))).json();assert.equal(d.status,'NO_MATCH');assert.equal(calls,1);
});
test('photo OCR precedes database lookup and answer includes retrieved passages',async()=>{
 const calls=[];globalThis.fetch=async(url,options)=>{const b=JSON.parse(options.body);calls.push(url);if(url.includes('/rest/'))return Response.json([{page_id:'p1',ebook_id:'b1',book_title:'教材',page_number:12,excerpt:'必要性指最小侵害',score:4}]);assert.equal(b.media,image);assert.equal(b.capability,'vision');assert.equal(b.provider,'gemini');if(calls.length===1)return Response.json({success:true,content:'```json\n{"question":"何謂必要性？","terms":["必要性"]}\n```'});assert.match(b.messages[0].content,/必要性指最小侵害/);assert.match(b.messages[0].content,/不能猜答案/);return Response.json({success:true,content:'採取最小侵害手段。[1]'});};
 const d=await (await photoSolve(request({action:'solve',image}))).json();assert.equal(d.status,'ANSWERED');assert.equal(d.question,'何謂必要性？');assert.equal(calls.length,3);assert.match(calls[1],/rest/);
});
test('invalid image and missing authorization never call the provider',async()=>{
 globalThis.fetch=()=>{throw Error('unexpected fetch');};assert.equal((await photoSolve(request({action:'solve',image:'https://invalid'}))).status,400);assert.equal((await photoSolve(new Request('https://test',{method:'POST',body:'{}'}))).status,401);
});
test('provider failure stops before querying or answering',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({success:false},{status:503});};assert.equal((await photoSolve(request({action:'ocr',image}))).status,502);assert.equal(calls,1);
});
test('keyword extraction deduplicates and limits inputs',()=>{
 assert.deepEqual(keywords('比例原則',['比例原則','比例原則','必要性']),['比例原則','必要性']);assert.ok(keywords('一'.repeat(1000)).length<=24);
 assert.deepEqual(keywords('x',['比例原則 (Principle of Proportionality)']),['比例原則','Principle of Proportionality']);
});

const {identifyLaw,officialUrl,parseResults}=await import('../supabase/functions/dark-star-photo-solve/legal-research.ts');
test('jurisdiction uses explicit law clues before script',()=>{
 assert.equal(identifyLaw('依中華人民共和國民法典第一千一百六十五條').code,'CN');
 assert.equal(identifyLaw('台湾法律规定劳动基准法应如何适用？').code,'TW');
 assert.equal(identifyLaw('根据刑法规定应该如何处罚？').code,'CN');
 assert.equal(identifyLaw('刑法第十條如何適用？').code,'UNKNOWN');
 assert.equal(identifyLaw('司法院釋字第七四八號解釋').code,'TW');
 assert.equal(identifyLaw('臺灣與大陸法律比較').code,'UNKNOWN');
 assert.equal(identifyLaw('刑法第十條','TW').code,'TW');
 assert.equal(identifyLaw('德國民法典侵權責任').code,'UNKNOWN');
});
test('ambiguous traditional legal question stops before retrieval or generation',async()=>{
 globalThis.fetch=()=>{throw Error('unexpected network');};const d=await (await photoSolve(request({action:'solve',question:'民法第184條如何適用？',image}))).json();assert.equal(d.status,'JURISDICTION_REQUIRED');
});
test('web fallback retrieves only same-jurisdiction official full text',async()=>{
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push(url);
  if(url.includes('/rest/'))return Response.json([]);
  if(url.includes('bing.com'))return new Response('<rss><item><title>官方民法</title><link>https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=B0000001</link></item><item><title>錯誤法域</title><link>https://www.npc.gov.cn/wrong</link></item></rss>',{headers:{'content-type':'application/rss+xml'}});
  if(url.includes('law.moj.gov.tw'))return new Response('<html>臺灣民法侵權行為官方法條。'+('測試來源正文。'.repeat(50))+'</html>',{headers:{'content-type':'text/html'}});
  if(url.includes('ai-gateway')){const b=JSON.parse(options.body);assert.match(b.messages[0].content,/臺灣法律/);assert.match(b.messages[0].content,/law.moj.gov.tw/);return Response.json({success:true,content:JSON.stringify({sufficient:true,answer:'依官方法條回答。[1]'})});}
  throw Error('unexpected URL '+url);
 };
 const d=await (await photoSolve(request({action:'solve',question:'臺灣民法侵權行為如何規定？',terms:['民法','侵權行為'],image}))).json();assert.equal(d.status,'ANSWERED');assert.equal(d.sources[0].kind,'web');assert.equal(d.sources.length,1);assert.equal(d.source_mode,'WEB_AND_BOOKS');assert.ok(!calls.some(x=>x.includes('npc.gov.cn')));
});
test('official source allowlist rejects other jurisdictions and unsafe URLs',()=>{
 assert.equal(officialUrl('https://law.moj.gov.tw/a','TW'),true);assert.equal(officialUrl('https://npc.gov.cn/a','TW'),false);assert.equal(officialUrl('https://law.moj.gov.tw.evil.test/a','TW'),false);assert.equal(officialUrl('http://127.0.0.1/a','TW'),false);assert.equal(officialUrl('https://user:pass@law.moj.gov.tw/a','TW'),false);
 assert.equal(parseResults('<rss><item><title>法條</title><link>https://law.moj.gov.tw/a</link></item></rss>')[0].url,'https://law.moj.gov.tw/a');
});
test('unreadable official page is not treated as verified evidence',async()=>{
 globalThis.fetch=async url=>url.includes('/rest/')?Response.json([]):new Response('<rss></rss>',{headers:{'content-type':'application/rss+xml'}});
 const d=await (await photoSolve(request({action:'solve',question:'中華人民共和國民法典如何規定？',image}))).json();assert.equal(d.status,'WEB_UNAVAILABLE');assert.equal(d.sources.length,0);
});

test('typed question needs no image and pins the allowed provider',async()=>{
 globalThis.fetch=async(url,options)=>{if(url.includes('/rest/'))return Response.json([{page_id:'p1',ebook_id:'b1',book_title:'讀書教材',page_number:1,excerpt:'讀書可先做筆記。',score:4}]);const body=JSON.parse(options.body);assert.equal(body.capability,'chat');assert.deepEqual(body.allowed_providers,['gemini']);assert.equal(body.media,undefined);return Response.json({success:true,content:'先做筆記。[1]'});};
 const d=await (await photoSolve(request({action:'solve',question:'讀書如何做筆記？',allow_web:false}))).json();assert.equal(d.status,'ANSWERED');assert.match(d.answer,/筆記/);
});
test('typed ambiguous legal question requests jurisdiction without photo',async()=>{
 globalThis.fetch=()=>{throw Error('unexpected network');};const d=await (await photoSolve(request({action:'solve',question:'民法第184條如何適用？'}))).json();assert.equal(d.status,'JURISDICTION_REQUIRED');
});

const {citationTarget,exactArticleText,statuteMatches,chineseNumber}=await import('../supabase/functions/dark-star-photo-solve/legal-citation.ts');
test('country plus article without statute never retrieves unrelated answers',async()=>{
 globalThis.fetch=()=>{throw Error('unexpected network');};const d=await (await photoSolve(request({action:'solve',question:'中華人民共和國第143條'}))).json();assert.equal(d.status,'LAW_REQUIRED');assert.equal(d.sources.length,0);assert.match(d.answer,/法律名稱/);
});
test('Arabic and Chinese article headings match the same exact number',()=>{
 assert.equal(chineseNumber('一百四十三'),143);assert.equal(chineseNumber('一千一百四十三'),1143);assert.deepEqual(citationTarget('中华人民共和国刑法第143条').articles,['143']);
 const x=exactArticleText('第一百四十二条\n無關內容甲。\n第一百四十三条\n指定條文正文。\n第一百四十四条\n無關內容乙。\n第一千一百四十三条\n別的條文。',['143']);assert.deepEqual(x.matched,['143']);assert.match(x.excerpt,/指定條文正文/);assert.doesNotMatch(x.excerpt,/無關內容|別的條文/);
 assert.equal(exactArticleText('第一千一百四十三条\n同尾數錯誤條文。',['143']).matched.length,0);
});
test('official title must be the specified statute',()=>{
 const t=citationTarget('中華人民共和國刑法第143條');assert.equal(t.law_key,'刑法');assert.equal(statuteMatches('中华人民共和国刑法（修订文本）','',t),true);assert.equal(statuteMatches('中华人民共和国民法典','本文引用刑法第143条',t),false);
 const civil=citationTarget('臺灣民法第143條');assert.equal(statuteMatches('中华人民共和国民法典','',civil),false);
});
test('missing exact article returns no answer instead of nearby passages',async()=>{
 globalThis.fetch=async url=>url.includes('/rest/')?Response.json([{page_id:'wrong',book_title:'中華人民共和國刑法',excerpt:'第一百四十二条\n不是143條的正文。',page_number:1}]):new Response('<rss></rss>',{headers:{'content-type':'application/rss+xml'}});
 const d=await (await photoSolve(request({action:'solve',question:'中華人民共和國刑法第143條',allow_web:false}))).json();assert.equal(d.status,'ARTICLE_NOT_VERIFIED');assert.equal(d.sources.length,0);
});
test('precise article web lookup excludes wrong statutes and supplies only target text',async()=>{
 globalThis.fetch=async(url,options)=>{
 if(url.includes('/rest/'))return Response.json([]);
 if(url.includes('bing.com'))return new Response('<rss><item><title>中华人民共和国刑法</title><link>https://www.gov.cn/criminal</link></item><item><title>中华人民共和国民法典</title><link>https://www.gov.cn/civil</link></item></rss>',{headers:{'content-type':'application/rss+xml'}});
 if(url.includes('/criminal'))return new Response('<h1>中华人民共和国刑法</h1><p>第一百四十二条</p><p>'+('無關規定。'.repeat(35))+'</p><p>第一百四十三条</p><p>符合本題的指定法律條文。</p><p>第一百四十四条</p><p>'+('其他規定。'.repeat(35))+'</p>',{headers:{'content-type':'text/html'}});
 if(url.includes('/civil'))return new Response('<h1>中华人民共和国民法典</h1><p>第一百四十三条</p><p>'+('错误法律正文。'.repeat(40))+'</p>',{headers:{'content-type':'text/html'}});
 if(url.includes('ai-gateway')){const b=JSON.parse(options.body);assert.match(b.messages[0].content,/符合本題的指定法律條文/);assert.doesNotMatch(b.messages[0].content,/無關規定|错误法律正文|其他規定/);return Response.json({success:true,content:JSON.stringify({sufficient:true,answer:'指定條文解析。[1]'})});}
 throw Error('unexpected URL');};
 const d=await (await photoSolve(request({action:'solve',question:'中華人民共和國刑法第143條'}))).json();assert.equal(d.status,'ANSWERED');assert.equal(d.sources.length,1);assert.deepEqual(d.sources[0].matched_articles,['143']);
});

test('split title and Chinese article metadata retrieve the uploaded constitution article',async()=>{
 globalThis.fetch=async(url,options)=>{
 if(url.includes('dark_star_ebooks?'))return Response.json([{id:'b1',title:'中華人民共和國憲法｜2018年修正本｜繁體電子書'}]);
 if(url.includes('dark_star_ebook_pages?')){assert.match(decodeURIComponent(url),/一百四十三/);return Response.json([{id:'p143',ebook_id:'b1',title:'第一百四十三条',article_number:'一百四十三',page_number:143,content:'中华人民共和国首都是北京。'}]);}
 if(url.includes('ai-gateway')){const b=JSON.parse(options.body);assert.match(b.messages[0].content,/中华人民共和国首都是北京/);return Response.json({success:true,content:JSON.stringify({sufficient:true,answer:'條文：中華人民共和國首都是北京。[1]'})});}
 throw Error('unexpected URL '+url);};
 const d=await (await photoSolve(request({action:'solve',question:'中華人民共和國憲法第143條',allow_web:false}))).json();assert.equal(d.status,'ANSWERED');assert.equal(d.sources[0].page_number,143);assert.equal(d.sources[0].matched_articles[0],'143');
});
