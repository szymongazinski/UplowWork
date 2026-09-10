// The five-tag TikTok cap is an app compatibility choice, not a claimed global API limit.
export const HASHTAG_LIMITS={tiktok:5,instagram:5,youtube:60,facebook:Infinity};
export const PLATFORM_NAMES={tiktok:'TikTok',instagram:'Instagram',youtube:'YouTube',facebook:'Facebook'};
export const CAPTION_LIMIT=2200;
const tagPattern=/^[\p{L}\p{N}_][\p{L}\p{M}\p{N}_]*$/u;
const identity=tag=>tag.normalize('NFC').toLowerCase();
export function parseHashtags(raw=''){
 if(typeof raw!=='string'||raw.length>5000)return {tags:[],invalid:['Pole hashtagów musi być tekstem do 5000 znaków.']};
 const tags=[],invalid=[],seen=new Set();
 for(const word of raw.trim().split(/[\s,;]+/u).filter(Boolean)){
  const tag=word.replace(/^#/,'').normalize('NFC');
  if(!tagPattern.test(tag)){invalid.push(word);continue;}
  if(!seen.has(identity(tag))){tags.push('#'+tag);seen.add(identity(tag));}
 }
 return {tags,invalid};
}
export function inlineHashtags(caption){return Array.from(caption.matchAll(/(?:^|[^\p{L}\p{M}\p{N}_])#([\p{L}\p{M}\p{N}_]+)/gu),m=>'#'+m[1]);}
export function captionPlans(caption='',raw='',title=''){
 const parsed=parseHashtags(raw),body=String(caption).trim(),inline=inlineHashtags(body);
 return Object.fromEntries(Object.entries(HASHTAG_LIMITS).map(([platform,limit])=>{
  const included=platform==='youtube'?[...inline,...inlineHashtags(String(title||''))]:inline;
  const existing=new Set(included.map(identity)),unique=parsed.tags.filter(t=>!existing.has(identity(t)));
  const tags=unique.slice(0,Math.max(0,limit-included.length));
  const text=[body,tags.join(' ')].filter(Boolean).join('\n\n');
  const errors=[];
  if(parsed.invalid.length)errors.push('Popraw hashtagi: '+parsed.invalid.slice(0,3).join(', ')+'. Użyj liter, cyfr i podkreśleń, bez spacji wewnątrz tagu.');
  if(included.length>limit)errors.push('Zbyt wiele hashtagów w opisie lub tytule. Przenieś je do pola Hashtagi.');
  if(text.length>CAPTION_LIMIT)errors.push('Opis z hashtagami przekracza limit aplikacji: '+CAPTION_LIMIT+' znaków.');
  if(!text)errors.push('Dodaj opis lub hashtagi.');
  return [platform,{text,tags,count:tags.length+included.length,omitted:unique.length-tags.length,errors}];
 }));
}
export function captionFor(job,platform){return job.captions?.[platform]??job.caption;}
