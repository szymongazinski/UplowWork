import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseHTML} from 'linkedom';

process.env.TZ='Europe/Warsaw';
const shared=readFileSync(new URL('../extension/schedule.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../extension/tiktok-schedule-ui.js',import.meta.url),'utf8');
const polish=['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const english=['January','February','March','April','May','June','July','August','September','October','November','December'];
const pad=value=>String(value).padStart(2,'0');
const dateText=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
async function fixture(options={}){
 const {document,window}=parseHTML('<html><body><label>Zaplanuj<input type="radio" name="postSchedule" value="schedule"></label><label>Teraz<input type="radio" name="postSchedule" value="now"></label><section id="fields"></section><section id="popup"></section><button id="publish">Post</button></body></html>');
 const by=id=>document.getElementById(id);
 const state={now:new Date(options.now||'2026-09-10T18:03:00').getTime(),date:options.date||'2026-09-10',time:options.time||'18:20',publishClicks:0,dateClicks:0,timeClicks:0,dayClicks:[],hourClicks:[],minuteClicks:[],arrowClicks:0,radioClicks:0,detachedClicks:0,readonlyWrites:0,advanced:false};
 const radio=document.querySelector('[value="schedule"]');radio.checked=false;
 window.HTMLElement.prototype.scrollIntoView=function(){};
 const visible=e=>!!e&&e.isConnected&&!e.closest('[hidden]');
 const enabled=e=>!!e&&!e.disabled&&e.getAttribute('aria-disabled')!=='true';
 const checked=e=>!!e?.checked;
 const all=(selector,root=document)=>[...root.querySelectorAll(selector)].filter(visible);
 const control=pattern=>{const hits=all('button').filter(e=>pattern.test(e.textContent));return hits.length===1?hits[0]:null;};
 const click=e=>{assert.ok(visible(e)&&enabled(e),'must click a connected enabled control');e.click();};
 const later=fn=>options.remount?setImmediate(fn):fn();
 const wait=async(fn,description)=>{for(let i=0;i<100;i++){if(options.cancelAfterMinute&&state.minuteClicks.length)throw new Error('Wysyłka zatrzymana.');const value=fn();if(value)return value;await new Promise(resolve=>setImmediate(resolve));}throw new Error('Nie potwierdzono: '+description);};
 function mountFields(){
  by('fields').innerHTML='<div class="scheduled-picker"><input readonly value="'+state.time+'"><input readonly value="'+state.date+'"></div>';
  const [time,date]=by('fields').querySelectorAll('input');
  if(options.invalidTime)time.setAttribute('aria-invalid','true');
  // The adapter must use the widget. A direct value assignment to a readonly
  // field would otherwise make an unrealistically permissive fixture pass.
  for(const input of [time,date])Object.defineProperty(input,'value',{get(){return input.getAttribute('value');},set(){state.readonlyWrites++;throw new Error('Cannot fill a readonly scheduling field');}});
  time.addEventListener('click',()=>{state.timeClicks++;mountTimepicker();});
  date.addEventListener('click',()=>{state.dateClicks++;const selected=new Date(state.date+'T12:00:00');mountCalendar(selected.getFullYear(),selected.getMonth());});
 }
 function mutateFields(next,after){
  Object.assign(state,next);by('fields').innerHTML='';by('popup').innerHTML='';
  later(()=>{mountFields();after?.();});
 }
 function mountTimepicker(){
  const [selectedHour,selectedMinute]=state.time.split(':');
  by('popup').innerHTML='<div class="tiktok-timepicker-time-picker-container"><div id="hours"></div><div id="minutes"></div></div>';
  for(let value=0;value<24;value++){
   const span=document.createElement('span');span.className='tiktok-timepicker-left'+(pad(value)===selectedHour?' tiktok-timepicker-is-active':'');span.textContent=pad(value);by('hours').append(span);
   if(span.textContent===options.disabledHour)span.setAttribute('aria-disabled','true');
   span.addEventListener('click',()=>{if(!span.isConnected)state.detachedClicks++;state.hourClicks.push(span.textContent);mutateFields({time:span.textContent+':'+state.time.split(':')[1]},mountTimepicker);});
  }
  for(let value=0;value<60;value+=5){
   const span=document.createElement('span');span.className='tiktok-timepicker-right'+(pad(value)===selectedMinute?' tiktok-timepicker-is-active':'');span.textContent=pad(value);by('minutes').append(span);
   if(span.textContent===options.disabledMinute)span.setAttribute('aria-disabled','true');
   span.addEventListener('click',()=>{
    if(!span.isConnected)state.detachedClicks++;state.minuteClicks.push(span.textContent);
    if(options.advanceEveryMinute||(options.advanceAfterMinute||options.advanceAfterMinuteMs)&&!state.advanced){state.now+=(options.advanceEveryMinute||options.advanceAfterMinute||0)*60000+(options.advanceAfterMinuteMs||0);state.advanced=true;}
    if(options.switchToNow)radio.checked=false;
    mutateFields({time:state.time.split(':')[0]+':'+span.textContent});
   });
  }
 }
 function mountCalendar(year,month){
  const names=options.english?english:polish;
  by('popup').innerHTML='<div class="calendar-wrapper"><div class="month-header-wrapper"><button class="arrow">Previous</button><span class="month-title">'+names[month]+'</span><span class="year-title">'+year+'</span><button class="arrow">Next</button></div><div class="days-wrapper"></div></div>';
  const arrows=all('.arrow');
  for(const [index,arrow] of arrows.entries())arrow.addEventListener('click',()=>{state.arrowClicks++;const next=new Date(year,month+(index===0?-1:1),1);by('popup').innerHTML='';later(()=>mountCalendar(next.getFullYear(),next.getMonth()));});
  const weekday=new Date(year,month,1).getDay(),offset=weekday===0&&options.leadingSunday?7:weekday;
  for(let index=0;index<42;index++){
   const date=new Date(year,month,1-offset+index),value=dateText(date),day=document.createElement('span');
   const allowed=(!options.disableAdjacent||date.getMonth()===month)&&value!==options.unavailableDate;
   day.className='day'+(allowed?' valid':'')+(value===state.date?' selected':'');day.textContent=String(date.getDate());all('.days-wrapper')[0].append(day);
   day.addEventListener('click',()=>{assert.ok(allowed,'invalid calendar days cannot be selected');state.dayClicks.push(value);mutateFields({date:value});});
  }
 }
 const activate=()=>{radio.checked=true;by('publish').textContent=options.english?'Schedule':'Zaplanuj';mountFields();};
 radio.addEventListener('click',()=>{state.radioClicks++;activate();});
 by('publish').addEventListener('click',()=>{state.publishClicks++;});
 if(options.checked)activate();
 if(options.missingFeature)radio.remove();
 class LocalClock extends Date{static now(){return state.now;}}
 const context={document,Date:LocalClock};runInNewContext(shared,context);runInNewContext(source,context);
 const task=context.UplowWorkTikTokSchedule.prepare({wait,click,control,all,visible,enabled,checked});
 if(options.reject){await assert.rejects(task,options.reject);assert.equal(state.publishClicks,0);return state;}
 const result=await task;
 assert.equal(result.button,by('publish'));assert.equal(state.publishClicks,0);assert.equal(state.readonlyWrites,0);assert.equal(state.detachedClicks,0);
 context.UplowWorkSchedule.assertScheduleProof({tiktokSchedule:'auto15'},{platform:'tiktok'},result.proof,state.now);
 assert.equal(result.resolveButton(),by('publish'));
 if(options.afterPrepare)await options.afterPrepare({result,state,document,by,radio,mountFields});
 assert.equal(state.publishClicks,0);assert.equal(state.readonlyWrites,0);assert.equal(state.detachedClicks,0);
 return {...state,proof:JSON.parse(JSON.stringify(result.proof))};
}

test('keeps the already earliest slot and never clicks the final Schedule button',async()=>{
 const state=await fixture({checked:true});
 assert.equal(state.proof.scheduleDate,'2026-09-10');assert.equal(state.proof.scheduleTime,'18:20');
 assert.equal(state.radioClicks,0);assert.equal(state.dateClicks,0);assert.equal(state.timeClicks,0);
});
test('keeps 10:20 at 10:04:59 instead of skipping a valid slot because of an artificial buffer',async()=>{
 const existing=await fixture({now:'2026-09-10T10:04:59',time:'10:20',checked:true});
 assert.equal(existing.proof.scheduleTime,'10:20');assert.equal(existing.timeClicks,0);
 const selected=await fixture({now:'2026-09-10T10:04:59',time:'10:00',advanceAfterMinuteMs:500,remount:true});
 assert.equal(selected.proof.scheduleTime,'10:20');assert.deepEqual(selected.minuteClicks,['20']);
 assert.equal(selected.proof.scheduledAt-selected.now,15*60000+500);
});
test('keeps an exact 15-minute slot and recalculates only if actual selection time crosses its minimum',async()=>{
 const exact=await fixture({now:'2026-09-10T10:05:00',time:'10:20',checked:true});
 assert.equal(exact.proof.scheduleTime,'10:20');assert.equal(exact.proof.scheduledAt-exact.now,15*60000);assert.equal(exact.timeClicks,0);
 const elapsed=await fixture({now:'2026-09-10T10:05:00',time:'10:00',advanceAfterMinuteMs:1,remount:true});
 assert.equal(elapsed.proof.scheduleTime,'10:25');assert.deepEqual(elapsed.minuteClicks,['20','25']);
 assert.equal(elapsed.proof.scheduledAt-elapsed.now,20*60000-1);
});
test('selects midnight across a month boundary using the valid adjacent calendar day',async()=>{
 const state=await fixture({now:'2026-09-30T23:50:00',date:'2026-09-30',time:'23:55',remount:true});
 assert.equal(state.proof.scheduleDate,'2026-10-01');assert.equal(state.proof.scheduleTime,'00:05');
 assert.deepEqual(state.dayClicks,['2026-10-01']);assert.deepEqual(state.hourClicks,['00']);assert.deepEqual(state.minuteClicks,['05']);assert.equal(state.arrowClicks,0);
});
test('navigates December to January and reacquires all asynchronously replaced inputs and options',async()=>{
 const state=await fixture({now:'2026-12-31T23:50:00',date:'2026-12-31',time:'23:55',english:true,disableAdjacent:true,remount:true});
 assert.equal(state.proof.scheduleDate,'2027-01-01');assert.equal(state.proof.scheduleTime,'00:05');
 assert.deepEqual(state.dayClicks,['2027-01-01']);assert.equal(state.arrowClicks,1);
});
test('maps a Sunday-start month with a complete preceding week without selecting the wrong day',async()=>{
 const state=await fixture({now:'2026-10-31T23:50:00',date:'2026-10-31',time:'23:55',disableAdjacent:true,leadingSunday:true});
 assert.equal(state.proof.scheduleDate,'2026-11-01');assert.deepEqual(state.dayClicks,['2026-11-01']);assert.equal(state.arrowClicks,1);
});
test('recalculates when widget latency makes the first chosen slot less than 15 minutes away',async()=>{
 const state=await fixture({now:'2026-09-10T10:03:00',time:'10:00',advanceAfterMinute:7,remount:true});
 assert.equal(state.proof.scheduleTime,'10:25');assert.deepEqual(state.minuteClicks,['20','25']);
});
test('stops after bounded recalculations instead of accepting a slot that is too close',async()=>{
 const state=await fixture({now:'2026-09-10T10:03:00',time:'10:00',advanceEveryMinute:20,reject:/Nie potwierdzono terminu/});
 assert.equal(state.minuteClicks.length,3);
});
test('does not confirm a time rejected by the platform even if the final button is enabled',async()=>{
 await fixture({checked:true,invalidTime:true,reject:/końcowe potwierdzenie harmonogramu/});
});
test('unavailable earliest hour, minute or date stops instead of choosing an arbitrary later slot',async()=>{
 const hour=await fixture({now:'2026-09-10T10:04:59',time:'09:00',disabledHour:'10',reject:/godzina 10 jest niedostępna/});
 assert.equal(hour.hourClicks.length,0);assert.equal(hour.minuteClicks.length,0);
 const minute=await fixture({now:'2026-09-10T10:04:59',time:'10:00',disabledMinute:'20',reject:/minuta 20 jest niedostępna/});
 assert.equal(minute.minuteClicks.length,0);
 const date=await fixture({date:'2026-09-11',unavailableDate:'2026-09-10',reject:/Najbliższa data jest niedostępna/});
 assert.equal(date.dayClicks.length,0);assert.equal(date.timeClicks,0);
});
test('final resolver reacquires the remounted Schedule button and never returns a disabled or missing one',async()=>{
 await fixture({checked:true,afterPrepare:async({result,state,document,by})=>{
  const original=result.button,replacement=document.createElement('button');replacement.id='publish';replacement.textContent='Zaplanuj';
  replacement.addEventListener('click',()=>{state.publishClicks++;});
  await new Promise(resolve=>setImmediate(resolve));
  by('publish').replaceWith(replacement);
  assert.equal(original.isConnected,false);assert.equal(result.resolveButton(),replacement);
  replacement.disabled=true;assert.equal(result.resolveButton(),null);
  replacement.disabled=false;replacement.remove();assert.equal(result.resolveButton(),null);
 }});
});
test('final resolver rejects switching to Now or changing the date or time after preparation',async()=>{
 await fixture({checked:true,afterPrepare:({result,document,radio})=>{
  radio.checked=false;document.querySelector('[value="now"]').checked=true;
  assert.throws(()=>result.resolveButton(),/Harmonogram TikToka zmienił się/);
 }});
 for(const change of [{date:'2026-09-11'},{time:'18:25'}])await fixture({checked:true,afterPrepare:({result,state,mountFields})=>{
  Object.assign(state,change);mountFields();
  assert.throws(()=>result.resolveButton(),/Harmonogram TikToka zmienił się/);
 }});
});
test('final resolver checks both field validation states and requires a real 15-minute minimum',async()=>{
 for(const index of [0,1])await fixture({checked:true,afterPrepare:({result,document})=>{
  document.querySelectorAll('.scheduled-picker input')[index].setAttribute('aria-invalid','true');
  assert.throws(()=>result.resolveButton(),/Harmonogram TikToka zmienił się/);
 }});
 await fixture({checked:true,afterPrepare:({result,state,by})=>{
  state.now=result.proof.scheduledAt-15*60000;
  assert.equal(result.resolveButton(),by('publish'));
  state.now++;
  assert.throws(()=>result.resolveButton(),/termin TikToka jest już zbyt bliski/);
 }});
});
test('missing scheduling feature, cancellation and changing to Now never fall back to immediate posting',async()=>{
 await fixture({missingFeature:true,reject:/opcja Zaplanuj TikToka/});
 await fixture({time:'18:00',cancelAfterMinute:true,reject:/Wysyłka zatrzymana/});
 await fixture({time:'18:00',switchToNow:true,reject:/wyłączył harmonogram/});
});
