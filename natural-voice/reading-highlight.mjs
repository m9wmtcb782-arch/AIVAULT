/** Python Unicode code-point offsets -> browser UTF-16 offsets.
 * Never split an emoji/supplementary character in the reading highlight.
 */
export function codePointRangeToUtf16(text,start,end){
 if(typeof text!=="string"||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start)return null;
 const points=Array.from(text);
 if(end>points.length)return null;
 const before=points.slice(0,start).join("").length;
 const through=points.slice(0,end).join("").length;
 return {start:before,end:through};
}
