import {validateOptions,expectedOptions} from './options.js';
export const PLATFORMS=['tiktok','facebook','instagram','youtube'];
export const URLS={tiktok:'https://www.tiktok.com/tiktokstudio/upload',facebook:'https://www.facebook.com/',instagram:'https://www.instagram.com/',youtube:'https://studio.youtube.com/'};
export const HOSTS={tiktok:'www.tiktok.com',facebook:'www.facebook.com',instagram:'www.instagram.com',youtube:'studio.youtube.com'};
export const ACTIVE=['preparing','uploading','ready','committing'];
export const TERMINAL=['published','submitted','blocked','unknown','cancelled','draft'];
export function validateRequest(m){
 validateOptions(m.options);
 if(m.synthetic!==undefined&&typeof m.synthetic!=='boolean')throw new Error('Nieprawidłowe oznaczenie AI.');
 if(!Array.isArray(m.platforms)||!m.platforms.length||new Set(m.platforms).size!==m.platforms.length||m.platforms.some(p=>!PLATFORMS.includes(p)))throw new Error('Wybierz prawidłowe platformy.');
 if(!['private','public'].includes(m.privacy))throw new Error('Wybierz widoczność filmu.');
 if(typeof m.caption!=='string'||!m.caption.trim()||m.caption.length>2200)throw new Error('Opis musi mieć od 1 do 2200 znaków.');
 if(m.platforms.includes('youtube')&&(typeof m.title!=='string'||!m.title.trim()||m.title.length>100||typeof m.kids!=='boolean'))throw new Error('Uzupełnij tytuł i odbiorców YouTube.');
 if(!m.meta||!Number.isFinite(m.meta.duration)||m.meta.duration<=0||m.meta.duration>180||!Number.isFinite(m.meta.width)||!Number.isFinite(m.meta.height)||m.meta.width<=0||m.meta.height<m.meta.width)throw new Error('Wybierz pionowy lub kwadratowy film o długości do 3 minut.');
 if(!Number.isInteger(m.size)||m.size<1||m.size>100*1024*1024||!['video/mp4','video/quicktime','video/webm'].includes(m.mime))throw new Error('Obsługiwane są MP4, MOV i WebM do 100 MB.');
 if(typeof m.filename!=='string'||m.filename.length>255||typeof m.mediaId!=='string')throw new Error('Nieprawidłowy plik.');
}
export function assertCommit(job,target,proof){
 if(job.cancelled||target.status!=='ready'||target.committedAt)throw new Error('Wysyłka została zatrzymana albo rozpoczęta wcześniej.');
 if(target.platform==='instagram'&&job.privacy==='private')throw new Error('Instagram nie ma potwierdzonej opcji Tylko ja.');
 if(!proof||proof.privacy!==job.privacy||proof.caption!==job.caption||proof.privacyConfirmed!==true)throw new Error('Nie potwierdzono opisu i widoczności. Publikacja zatrzymana.');
 if(target.platform==='youtube'&&(proof.title!==job.title||proof.kids!==job.kids))throw new Error('Nie potwierdzono tytułu lub odbiorców YouTube.');
 if(job.synthetic&&proof.syntheticConfirmed!==true)throw new Error('Nie potwierdzono oznaczenia treści AI.');
 for(const [key,value]of Object.entries(expectedOptions(job,target.platform)))if(proof.options?.[key]!==value)throw new Error('Nie potwierdzono ustawienia: '+key+'. Publikacja zatrzymana.');
 return true;
}
export function interruptedStatus(target){return target.committedAt?'unknown':'blocked';}
export function validSender(target,sender){try{return sender.tab?.id===target.tabId&&sender.frameId===0&&new URL(sender.url).hostname===HOSTS[target.platform]&&new URL(sender.url).protocol==='https:';}catch{return false;}}
