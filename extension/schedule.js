// Shared by the isolated content script and the service worker. All fields use
// the browser's local time; readback must preserve both the date and UTC offset.
(()=>{
 const MINUTE=60000;
 const pad=value=>String(value).padStart(2,'0');
 function fields(value){
  return {date:`${String(value.getFullYear()).padStart(4,'0')}-${pad(value.getMonth()+1)}-${pad(value.getDate())}`,time:`${pad(value.getHours())}:${pad(value.getMinutes())}`,timestamp:value.getTime(),timezoneOffset:value.getTimezoneOffset()};
 }
 function readSchedule(date,time){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||typeof time!=='string'||!/^\d{2}:\d{2}$/.test(time))throw new Error('Nieprawidłowa data lub godzina harmonogramu TikToka.');
  const value=new Date(`${date}T${time}:00`),result=fields(value);
  // Date can normalize February 30 or a skipped hour at the DST transition.
  if(!Number.isFinite(result.timestamp)||result.date!==date||result.time!==time)throw new Error('Nieprawidłowa lokalna data lub godzina harmonogramu TikToka.');
  return result;
 }
 function earliestSchedule(now=Date.now(),minimumMinutes=15,stepMinutes=5){
  if(!Number.isSafeInteger(now)||!Number.isInteger(minimumMinutes)||minimumMinutes<1||minimumMinutes>1440||!Number.isInteger(stepMinutes)||stepMinutes<1||stepMinutes>60||60%stepMinutes!==0)throw new Error('Nieprawidłowe parametry harmonogramu TikToka.');
  const first=Math.ceil((now+minimumMinutes*MINUTE)/MINUTE)*MINUTE;
  // Walk real minutes so a daylight-saving jump cannot produce a past slot.
  // Ambiguous repeated-hour slots are skipped unless their local date/time has
  // one consistent timestamp when read back from the platform's controls.
  for(let timestamp=first;timestamp<first+180*MINUTE;timestamp+=MINUTE){
   const value=new Date(timestamp);if(value.getMinutes()%stepMinutes!==0)continue;
   const result=fields(value);if(readSchedule(result.date,result.time).timestamp===timestamp)return result;
  }
  throw new Error('Nie udało się wybrać najbliższego terminu TikToka.');
 }
 function assertScheduleProof(job,target,proof,now=Date.now()){
  if(target.platform!=='tiktok'||job.tiktokSchedule!=='auto15')return null;
  if(proof?.scheduleConfirmed!==true)throw new Error('Nie potwierdzono harmonogramu TikToka. Wysyłka zatrzymana.');
  const result=readSchedule(proof.scheduleDate,proof.scheduleTime);
  if(proof.scheduledAt!==result.timestamp||proof.scheduleTimezoneOffset!==result.timezoneOffset)throw new Error('Data, godzina lub strefa czasowa harmonogramu TikToka nie zgadza się z formularzem.');
  if(!Number.isSafeInteger(now)||result.timestamp-now<15*MINUTE)throw new Error('Termin TikToka jest za blisko. Wybierz ponownie najbliższy termin za co najmniej 15 minut.');
  // Up to five seconds permit a small preparation guard; the full 15-minute
  // minimum is never relaxed. A later date or arbitrary future hour is rejected.
  if(result.timestamp-now>20*MINUTE+5000||new Date(result.timestamp).getMinutes()%5!==0)throw new Error('Nie potwierdzono najbliższego terminu TikToka za około 15 minut.');
  return result;
 }
 globalThis.UplowWorkSchedule=Object.freeze({earliestSchedule,readSchedule,assertScheduleProof});
})();
