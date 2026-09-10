import {validateOptions,expectedOptions} from './options.js';
import {captionPlans,captionFor} from './captions.js';
import './schedule.js';
import './facebook-page.js';
export const normalizeFacebookPage=value=>globalThis.UplowWorkFacebookPage.page(value);
const {assertScheduleProof}=globalThis.UplowWorkSchedule;
export const PLATFORMS=['tiktok','facebook','instagram','youtube'];
export const URLS={tiktok:'https://www.tiktok.com/tiktokstudio/upload',facebook:'https://www.facebook.com/',instagram:'https://www.instagram.com/',youtube:'https://studio.youtube.com/'};
export const HOSTS={tiktok:'www.tiktok.com',facebook:'www.facebook.com',instagram:'www.instagram.com',youtube:'studio.youtube.com'};
export const ACTIVE=['preparing','uploading','ready','committing'];
export const TERMINAL=['published','scheduled','submitted','blocked','unknown','cancelled','draft'];
const VIDEO_MIMES={mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm'};
export function videoFileMetadata(file){
 if(typeof file?.name!=='string'||!file.name.length||file.name.length>255)throw new Error('Nieprawidłowa nazwa filmu. Wybierz plik ponownie.');
 const extension=file.name.match(/\.(mp4|mov|webm)$/i)?.[1].toLowerCase();
 if(!extension)throw new Error('Wybierz film MP4, MOV lub WebM.');
 if(!Number.isInteger(file.size)||file.size<1||file.size>100*1024*1024)throw new Error('Wybierz niepusty film do 100 MB.');
 const mime=file.type||VIDEO_MIMES[extension];
 if(mime!==VIDEO_MIMES[extension])throw new Error('Typ filmu nie pasuje do rozszerzenia MP4, MOV lub WebM. Wybierz plik ponownie.');
 if(file.lastModified!==undefined&&!Number.isSafeInteger(file.lastModified))throw new Error('Nieprawidłowa data modyfikacji filmu. Wybierz plik ponownie.');
 return {filename:file.name,size:file.size,mime,...(file.lastModified===undefined?{}:{lastModified:file.lastModified})};
}
export function validateRequest(m){
 if(m.dryRun!==undefined&&typeof m.dryRun!=='boolean')throw new Error('Nieprawidłowy tryb testowy.');
 validateOptions(m.options);
 if(m.synthetic!==undefined&&typeof m.synthetic!=='boolean')throw new Error('Nieprawidłowe oznaczenie AI.');
 if(!Array.isArray(m.platforms)||!m.platforms.length||new Set(m.platforms).size!==m.platforms.length||m.platforms.some(p=>!PLATFORMS.includes(p)))throw new Error('Wybierz prawidłowe platformy.');
 if(m.platforms.includes('facebook'))normalizeFacebookPage(m.facebookPage);
 if(!['private','public'].includes(m.privacy))throw new Error('Wybierz widoczność filmu.');
 if(typeof m.caption!=='string'||m.caption.length>2200)throw new Error('Opis musi być tekstem do 2200 znaków.');
 const plans=captionPlans(m.caption,m.hashtags,m.title);for(const p of m.platforms)if(plans[p].errors.length)throw new Error(p+': '+plans[p].errors[0]);
 if(m.platforms.includes('youtube')&&(typeof m.title!=='string'||!m.title.trim()||m.title.length>100||typeof m.kids!=='boolean'))throw new Error('Uzupełnij tytuł i odbiorców YouTube.');
 if(!m.meta||!Number.isFinite(m.meta.duration)||m.meta.duration<=0||m.meta.duration>180||!Number.isFinite(m.meta.width)||!Number.isFinite(m.meta.height)||m.meta.width<=0||m.meta.height<m.meta.width)throw new Error('Wybierz pionowy lub kwadratowy film o długości do 3 minut.');
 const media=videoFileMetadata({name:m.filename,size:m.size,type:m.mime,lastModified:m.lastModified});
 if(media.mime!==m.mime||typeof m.mediaId!=='string')throw new Error('Nieprawidłowy plik. Wybierz film ponownie.');
 if(m.thumbnail&&(!['middle','custom'].includes(m.thumbnail.mode)||typeof m.thumbnail.mediaId!=='string'||!Number.isInteger(m.thumbnail.size)||m.thumbnail.size<1||m.thumbnail.size>2*1024*1024||!['image/jpeg','image/png'].includes(m.thumbnail.mime)||!Array.isArray(m.thumbnail.platforms)||m.thumbnail.platforms.some(p=>!m.platforms.includes(p))))throw new Error('Nieprawidłowa miniatura.');
}
export function assertCommit(job,target,proof,now=Date.now()){
 if(job.dryRun)throw new Error('Tryb testowy nie pozwala publikować.');
 if(job.cancelled||target.status!=='ready'||target.committedAt)throw new Error('Wysyłka została zatrzymana albo rozpoczęta wcześniej.');
 if(target.platform==='instagram'&&job.privacy==='private')throw new Error('Instagram nie ma potwierdzonej opcji Tylko ja.');
 if(!proof||proof.privacy!==job.privacy||proof.caption!==captionFor(job,target.platform)||proof.privacyConfirmed!==true)throw new Error('Nie potwierdzono opisu i widoczności. Publikacja zatrzymana.');
 assertScheduleProof(job,target,proof,now);
 if(target.platform==='instagram'&&(!Number.isFinite(job.meta?.width)||!Number.isFinite(job.meta?.height)||job.meta.width<=0||job.meta.height<job.meta.width||proof.aspectRatioConfirmed!==true||proof.sourceWidth!==job.meta.width||proof.sourceHeight!==job.meta.height))throw new Error('Nie potwierdzono zachowania oryginalnych proporcji filmu na Instagramie. Publikacja zatrzymana.');
 if(target.platform==='facebook'){
  if(proof.mediaKind!=='reel')throw new Error('Nie potwierdzono kreatora rolki Facebooka.');
  const page=normalizeFacebookPage(job.facebookPage);
  if(job.privacy!=='public'||proof.facebookPageConfirmed!==true||proof.facebookPageId!==page.id)throw new Error('Nie potwierdzono publikacji na wybranej stronie Facebooka. Profil osobisty jest zablokowany.');
 }
 if(!target.skipThumbnail&&job.thumbnail?.platforms.includes(target.platform)&&proof.thumbnailConfirmed!==true)throw new Error('Nie potwierdzono ustawienia miniatury.');
 if(target.platform==='youtube'&&(proof.title!==job.title||proof.kids!==job.kids))throw new Error('Nie potwierdzono tytułu lub odbiorców YouTube.');
 if(job.synthetic&&proof.syntheticConfirmed!==true)throw new Error('Nie potwierdzono oznaczenia treści AI.');
 for(const [key,value]of Object.entries(expectedOptions(job,target.platform)))if(proof.options?.[key]!==value)throw new Error('Nie potwierdzono ustawienia: '+key+'. Publikacja zatrzymana.');
 return true;
}
export function interruptedStatus(target){return target.committedAt?'unknown':'blocked';}
export function resetTargetForRetry(job,platform,confirmedAbsent=false){
 const target=job.targets.find(t=>t.platform===platform);
 if(!target||!['blocked','cancelled','draft','unknown','submitted'].includes(target.status))throw new Error('Tę platformę już wysłano albo jej wysyłka trwa.');
 if(target.committedAt&&!confirmedAbsent)throw new Error('Najpierw sprawdź na platformie, czy film nie został opublikowany.');
 if(platform==='instagram'&&job.privacy==='private')throw new Error('Instagram nie udostępnia opcji Tylko ja.');
 const tabId=target.tabId;const attempts=[...(target.attempts||[]),{status:target.status,message:target.message,committedAt:target.committedAt,updatedAt:target.updatedAt}].slice(-10);
 if(platform==='facebook'){normalizeFacebookPage(job.facebookPage);if(job.privacy!=='public')throw new Error('Strona Facebooka nie obsługuje publikacji Tylko ja.');}
 if(platform==='tiktok')job.tiktokSchedule='auto15';
 Object.keys(target).forEach(key=>delete target[key]);
 Object.assign(target,{platform,previousTabId:tabId,status:'pending',message:'Ponowienie tej platformy w kolejce.',updatedAt:Date.now(),attemptId:crypto.randomUUID(),attempts});
 job.cancelled=false;
 return job;
}
export function validSender(target,sender){try{return sender.tab?.id===target.tabId&&sender.frameId===0&&new URL(sender.url).hostname===HOSTS[target.platform]&&new URL(sender.url).protocol==='https:';}catch{return false;}}
