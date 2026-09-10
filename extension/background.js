import {getJob,createJob,listJobs,mutateJob,getMedia,removeMedia,retryTarget} from './store.js';
import {URLS,ACTIVE,TERMINAL,validateRequest,assertCommit,interruptedStatus,validSender} from './policy.js';
import {captionPlans,captionFor} from './captions.js';
const now=()=>Date.now();
const probes=new Map();
let connectionRequest=Promise.resolve();
let accountWrite=Promise.resolve();
function setAccount(platform,record){const write=accountWrite.catch(()=>{}).then(async()=>{const {accounts={}}=await chrome.storage.local.get('accounts');accounts[platform]={...accounts[platform],...record};await chrome.storage.local.set({accounts});});accountWrite=write;return write;}
const panelSender=s=>s.id===chrome.runtime.id&&s.url?.startsWith(chrome.runtime.getURL('index.html'));
const respond=(fn,reply)=>{fn().then(result=>reply({ok:true,...result})).catch(e=>reply({ok:false,error:e.message}));return true;};
const touch=(id,platform,fn)=>mutateJob(id,j=>{const t=j.targets.find(t=>t.platform===platform);if(!t)throw new Error('Nie znaleziono platformy.');fn(t,j);t.updatedAt=now();return j;});
chrome.action.onClicked.addListener(()=>chrome.tabs.create({url:chrome.runtime.getURL('index.html')}));
chrome.runtime.onInstalled.addListener(async details=>{await chrome.alarms.create('watchdog',{periodInMinutes:1});if(details.reason==='install')await chrome.tabs.create({url:chrome.runtime.getURL('index.html')});});
chrome.runtime.onStartup.addListener(async()=>{await chrome.alarms.create('watchdog',{periodInMinutes:1});for(const j of await listJobs()){for(const t of j.targets.filter(t=>ACTIVE.includes(t.status))){await touch(j.id,t.platform,t=>{t.status=interruptedStatus(t);t.message=t.committedAt?'Przeglądarka została zamknięta po rozpoczęciu publikacji. Sprawdź platformę przed ponownym wysłaniem.':'Przeglądarka została zamknięta przed publikacją.';});}await next(j.id);}});
chrome.runtime.onMessage.addListener((m,s,reply)=>respond(async()=>{
 if(panelSender(s))return handlePanel(m);
 if(s.id!==chrome.runtime.id||!m.id||!m.platform)throw new Error('Brak uprawnień.');
 const job=await getJob(m.id);const target=job?.targets.find(t=>t.platform===m.platform);
 if(!target||!validSender(target,s)||m.attemptId!==target.attemptId)throw new Error('Niezgodna karta lub nieaktualna próba wysyłki.');
 if(m.type==='HEARTBEAT'){if(TERMINAL.includes(target.status))return {cancelled:true};await touch(job.id,target.platform,t=>{});return {cancelled:job.cancelled};}
 if(m.type==='CHUNK'){
  if(!['preparing','uploading'].includes(target.status)||job.cancelled)throw new Error('Przesyłanie nie jest aktywne.');
  const thumbnail=m.asset==='thumbnail';const size=thumbnail?job.thumbnail?.size:job.size;
  if(!Number.isInteger(m.offset)||m.offset<0||m.offset>=size)throw new Error('Nieprawidłowy fragment pliku.');
  const file=await getMedia(thumbnail?job.thumbnail.mediaId:job.mediaId);if(!file)throw new Error('Brak pliku na urządzeniu.');
  const bytes=new Uint8Array(await file.slice(m.offset,m.offset+256*1024).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {data:btoa(binary),length:bytes.length};
 }
 if(m.type==='PROGRESS'){
  if(!['uploading','ready'].includes(m.status))throw new Error('Niedozwolony stan.');
  await touch(job.id,target.platform,(t,j)=>{if(j.cancelled||t.committedAt||TERMINAL.includes(t.status))throw new Error('Wysyłka została zatrzymana.');t.status=m.status;t.message=String(m.message||'').slice(0,300);});return {};
 }
 if(m.type==='COMMIT'){
  await touch(job.id,target.platform,(t,j)=>{assertCommit(j,t,m.proof);t.status='committing';t.committedAt=now();t.message='Rozpoczęto publikację; oczekiwanie na potwierdzenie.';});return {allowed:true};
 }
 if(m.type==='CHECK'){
  if(!job.dryRun)throw new Error('Sprawdzenie bez publikacji wymaga trybu testowego.');
  await touch(job.id,target.platform,(t,j)=>{assertCommit({...j,dryRun:false},t,m.proof);t.checkedProof={privacy:m.proof.privacy,mediaKind:m.proof.mediaKind,thumbnailConfirmed:m.proof.thumbnailConfirmed};});return {checked:true,published:false};
 }
 if(m.type==='FINISH'){
  await touch(job.id,target.platform,(t,j)=>{if(TERMINAL.includes(t.status))return;const allowed=['published','submitted','blocked','unknown','draft'];let status=allowed.includes(m.status)?m.status:'unknown';if(['published','submitted'].includes(status)&&!t.committedAt)throw new Error('Brak zatwierdzonej publikacji.');if(t.committedAt&&status==='blocked')status='unknown';t.status=status;t.message=String(m.message||'').slice(0,500);if(m.diagnostic)t.diagnostic={version:String(m.diagnostic.version||'').slice(0,20),step:String(m.diagnostic.step||'').slice(0,250),code:String(m.diagnostic.code||'').slice(0,80),fileInputs:Array.isArray(m.diagnostic.fileInputs)?m.diagnostic.fileInputs.slice(0,10).map(v=>String(v).slice(0,250)):[],instagramCreateFound:m.diagnostic.instagramCreateFound===true};if(m.url){try{const u=new URL(m.url);const hosts=t.platform==='youtube'?['studio.youtube.com','www.youtube.com','youtube.com']: [new URL(URLS[t.platform]).hostname];if(u.protocol==='https:'&&hosts.includes(u.hostname))t.url=u.href;}catch{}}});await next(job.id);return {};
 }
 throw new Error('Nieznane polecenie.');
},reply));
async function handlePanel(m){
 if(m.type==='STATE'){const {accounts={}}=await chrome.storage.local.get('accounts');return {accounts,jobs:(await listJobs()).sort((a,b)=>b.createdAt-a.createdAt).slice(0,30)};}
 if(m.type==='CREATE'){
  validateRequest(m);const media=await getMedia(m.mediaId);if(!media||media.size!==m.size)throw new Error('Nie zapisano poprawnie filmu. Wybierz plik ponownie.');
  if(m.thumbnail){const image=await getMedia(m.thumbnail.mediaId);if(!image||image.size!==m.thumbnail.size||image.size>2*1024*1024||!['image/jpeg','image/png'].includes(image.type))throw new Error('Miniatura musi być obrazem JPG/PNG do 2 MB.');}
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await media.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
  const id=crypto.randomUUID();await createJob({id,dryRun:m.dryRun===true,mediaId:m.mediaId,thumbnail:m.thumbnail||null,filename:m.filename,size:m.size,mime:m.mime,meta:m.meta,caption:m.caption,hashtags:m.hashtags||'',captions:Object.fromEntries(Object.entries(captionPlans(m.caption,m.hashtags,m.title)).map(([p,plan])=>[p,plan.text])),title:m.title||'',privacy:m.privacy,kids:m.kids,synthetic:!!m.synthetic,options:m.options||{},digest,createdAt:now(),targets:m.platforms.map(platform=>({platform,attemptId:crypto.randomUUID(),status:platform==='instagram'&&m.privacy==='private'?'blocked':'pending',message:platform==='instagram'&&m.privacy==='private'?'Pominięto: brak potwierdzonej opcji „Tylko ja” dla Instagram Reels.':'',updatedAt:now()}))});return {id};
 }
 if(m.type==='RETRY'){
  const job=await getJob(m.id);if(!job)throw new Error('Nie znaleziono wysyłki.');let replacementId;
  if(!await getMedia(job.mediaId)){
   const replacement=m.mediaId&&await getMedia(m.mediaId);
   if(!replacement)throw new Error('Starsza wersja usunęła plik po błędzie. Wybierz ponownie ten sam film u góry formularza i kliknij Ponów przy tej platformie.');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await replacement.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
   if(digest!==job.digest)throw new Error('Wybierz ten sam film co w tej wysyłce. Wybrany plik ma inną zawartość.');
   replacementId=m.mediaId;
  }else if(m.mediaId&&m.mediaId!==job.mediaId)await removeMedia(m.mediaId);
  await retryTarget(job.id,m.platform,m.confirmedAbsent===true,replacementId,m.withoutThumbnail===true);await next(job.id);return {};
 }
 if(m.type==='OPEN_TARGET'){
  const job=await getJob(m.id),target=job?.targets.find(t=>t.platform===m.platform);if(!target)throw new Error('Nie znaleziono platformy.');
  if(target.tabId){try{await chrome.tabs.update(target.tabId,{active:true});return {};}catch{}}
  const tab=await chrome.tabs.create({url:target.url||URLS[target.platform],active:true});
  if(!ACTIVE.includes(target.status))await touch(job.id,target.platform,t=>{t.tabId=tab.id;});return {};
 }
 if(m.type==='START'){if(!await getJob(m.id))throw new Error('Nie znaleziono wysyłki.');await next(m.id);return {};}
 if(m.type==='CANCEL'){
  await mutateJob(m.id,j=>{j.cancelled=true;for(const t of j.targets){if(!t.committedAt&&!TERMINAL.includes(t.status)){t.status='cancelled';t.message='Zatrzymano przed publikacją.';}}return j;});return {};
 }
 if(m.type==='CANCEL_TARGET'){
  await touch(m.id,m.platform,t=>{if(t.committedAt)throw new Error('Publikacja już się rozpoczęła. Sprawdź jej wynik na platformie.');if(!['pending',...ACTIVE].includes(t.status))return;t.status='cancelled';t.message='Zatrzymano tę platformę przed publikacją. Możesz ponowić ją osobno.';});await next(m.id);return {};
 }
 if(m.type==='CONNECT_ALL')return connectPlatforms(Object.keys(URLS));
 if(m.type==='CONNECT'){
  if(!URLS[m.platform])throw new Error('Nieznana platforma.');
  return connectPlatforms([m.platform]);
 }
 throw new Error('Nieznane polecenie panelu.');
}
function connectPlatforms(platforms){
 const request=connectionRequest.catch(()=>{}).then(async()=>{
  const {connectTabs={}}=await chrome.storage.local.get('connectTabs');const opened=[];
  for(const platform of platforms){try{
   let tab;if(connectTabs[platform])try{const candidate=await chrome.tabs.get(connectTabs[platform]);if(new URL(candidate.url).hostname===new URL(URLS[platform]).hostname)tab=candidate;}catch{}
   if(!tab){const candidates=await chrome.tabs.query({url:new URL(URLS[platform]).origin+'/*'});tab=candidates.find(t=>t.active)||candidates[0];}
   if(!tab)tab=await chrome.tabs.create({url:URLS[platform],active:false});
   connectTabs[platform]=tab.id;opened.push({platform,id:tab.id});
  }catch{await setAccount(platform,{connected:false,checking:false,label:'Nie udało się otworzyć platformy. Spróbuj przyciskiem Sprawdź.',checkedAt:now()});}}
  await chrome.storage.local.set({connectTabs});
  if(opened.length)await chrome.tabs.update(opened[0].id,{active:true});
  await Promise.all(opened.map(async({platform,id})=>{try{const latest=await chrome.tabs.get(id);if(latest.status==='complete')await probe(id,platform);}catch{await setAccount(platform,{connected:false,checking:false,label:'Karta została zamknięta. Kliknij Sprawdź.',checkedAt:now()});}}));
  return {};
 });connectionRequest=request;return request;
}
// Durable claim before opening a tab; concurrent START requests cannot dispatch twice.
async function next(id){
 let claimed;
 const j=await mutateJob(id,j=>{if(j.cancelled||j.targets.some(t=>ACTIVE.includes(t.status)))return j;const t=j.targets.find(t=>t.status==='pending');if(t){t.status='preparing';t.updatedAt=now();t.message='Otwieranie kreatora platformy.';claimed=t.platform;}return j;});
 if(!claimed){if(j.targets.every(t=>t.status==='published')){await removeMedia(j.mediaId);if(j.thumbnail)await removeMedia(j.thumbnail.mediaId);}return;}
 try{const target=j.targets.find(t=>t.platform===claimed);let tab;if(target.previousTabId){try{const previous=await chrome.tabs.get(target.previousTabId);if(previous.url===URLS[claimed]){await chrome.tabs.reload(target.previousTabId);tab=await chrome.tabs.update(target.previousTabId,{active:true});}else tab=await chrome.tabs.update(target.previousTabId,{url:URLS[claimed],active:true});}catch{}}if(!tab)tab=await chrome.tabs.create({url:URLS[claimed],active:true});await touch(id,claimed,t=>{t.tabId=tab.id;});const latest=await chrome.tabs.get(tab.id);if(latest.status==='complete')await dispatch(id,claimed,tab.id);}catch(e){await touch(id,claimed,t=>{t.status='blocked';t.message=e.message;});await next(id);}
}
async function dispatch(id,platform,tabId){
 let claimed=false;const j=await touch(id,platform,(t,j)=>{if(t.status==='preparing'&&!t.dispatched&&!j.cancelled){t.dispatched=true;claimed=true;}});if(!claimed)return;
 try{await chrome.scripting.executeScript({target:{tabId},files:['dom.js','runner.js']});const response=await chrome.tabs.sendMessage(tabId,{type:'RUN',job:{...j,thumbnail:j.targets.find(t=>t.platform===platform).skipThumbnail?null:j.thumbnail,attemptId:j.targets.find(t=>t.platform===platform).attemptId,caption:captionFor(j,platform),targets:undefined},platform});if(!response?.started)throw new Error('Nie uruchomiono obsługi formularza.');}catch(e){await touch(id,platform,t=>{if(!t.committedAt){t.status='blocked';t.message='Nie udało się otworzyć formularza: '+String(e.message).slice(0,200);}});await next(id);}
}
async function probe(tabId,platform){
 const key=platform+':'+tabId;if(probes.has(key))return probes.get(key);
 const work=(async()=>{await setAccount(platform,{checking:true});try{
  const tab=await chrome.tabs.get(tabId);if(new URL(tab.url).hostname!==new URL(URLS[platform]).hostname)throw new Error('Otwarta karta ma inny adres. Kliknij Sprawdź, aby wrócić na platformę.');
  await chrome.scripting.executeScript({target:{tabId},files:['dom.js','runner.js']});
  const result=await chrome.tabs.sendMessage(tabId,{type:'PROBE',platform});
  await setAccount(platform,{connected:!!result?.connected,checking:false,label:result?.label||'Zaloguj się w otwartej karcie i kliknij Sprawdź.',checkedAt:now()});
 }catch(e){await setAccount(platform,{connected:false,checking:false,label:'Nie udało się sprawdzić karty. Odśwież stronę platformy i kliknij Sprawdź.',checkedAt:now()});}})();
 probes.set(key,work);try{return await work;}finally{probes.delete(key);}
}
chrome.tabs.onUpdated.addListener(async(tabId,change)=>{
 if(change.status!=='complete'&&!change.url)return;const {connectTabs={}}=await chrome.storage.local.get('connectTabs');for(const [p,id]of Object.entries(connectTabs))if(id===tabId)await probe(tabId,p);
 if(change.status!=='complete')return;
 for(const j of await listJobs())for(const t of j.targets)if(t.tabId===tabId&&t.status==='preparing'&&!t.dispatched)await dispatch(j.id,t.platform,tabId);
});
chrome.tabs.onRemoved.addListener(async tabId=>{for(const j of await listJobs())for(const t of j.targets)if(t.tabId===tabId&&ACTIVE.includes(t.status)){await touch(j.id,t.platform,t=>{t.status=interruptedStatus(t);t.message='Karta platformy została zamknięta. '+(t.committedAt?'Sprawdź, czy film został zapisany.':'Nie rozpoczęto publikacji.');});await next(j.id);}});
chrome.alarms.onAlarm.addListener(async alarm=>{if(alarm.name!=='watchdog')return;for(const j of await listJobs()){for(const t of j.targets){if(ACTIVE.includes(t.status)&&now()-t.updatedAt>120000){await touch(j.id,t.platform,t=>{t.status=interruptedStatus(t);t.message=t.committedAt?'Brak potwierdzenia. Sprawdź platformę; automatyczne ponowienie jest zablokowane.':'Brak odpowiedzi formularza. Sprawdź logowanie i kartę platformy.';});}}await next(j.id);}});
