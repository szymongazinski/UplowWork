import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import 'fake-indexeddb/auto';
import '../extension/schedule.js';
import {assertCommit,resetTargetForRetry,TERMINAL} from '../extension/policy.js';
import {saveMedia,getMedia,getJob,mutateJob,createJob} from '../extension/store.js';

const {earliestSchedule,readSchedule,assertScheduleProof}=globalThis.UplowWorkSchedule;
const schedulingJob={tiktokSchedule:'auto15',privacy:'private',caption:'Test'};
const ready={platform:'tiktok',status:'ready'};
const proofFor=slot=>({privacy:'private',privacyConfirmed:true,caption:'Test',scheduleConfirmed:true,scheduleDate:slot.date,scheduleTime:slot.time,scheduledAt:slot.timestamp,scheduleTimezoneOffset:slot.timezoneOffset});

test('TikTok chooses the first local five-minute slot at least 15 minutes away, including midnight',()=>{
 for(const [hour,minute,second,expectedDate,expectedTime] of [[12,0,0,'2026-09-10','12:15'],[12,0,1,'2026-09-10','12:20'],[23,45,0,'2026-09-11','00:00'],[23,51,20,'2026-09-11','00:10']]){
  const now=new Date(2026,8,10,hour,minute,second).getTime(),slot=earliestSchedule(now);
  assert.equal(slot.date,expectedDate);assert.equal(slot.time,expectedTime);
  assert.ok(slot.timestamp-now>=15*60000);assert.ok(slot.timestamp-now<20*60000);
  assert.deepEqual(readSchedule(slot.date,slot.time),slot);
 }
});

test('local schedule parsing rejects malformed dates, rolled-over calendar days and out-of-range times',()=>{
 for(const [date,time] of [['2026-02-30','12:00'],['2026-13-01','12:00'],['2026-00-10','12:00'],['2026-09-10','24:00'],['2026-09-10','12:60'],['09/10/2026','12:00'],['2026-09-10','1:05'],[null,'12:00']])assert.throws(()=>readSchedule(date,time));
 for(const now of [NaN,Infinity,'1000',1.5])assert.throws(()=>earliestSchedule(now));
});

test('DST-skipped times are rejected and the nearest valid spring-forward slot is preserved',()=>{
 const script=`import './extension/schedule.js';
 const {readSchedule,earliestSchedule}=globalThis.UplowWorkSchedule;
 let rejected=false;try{readSchedule('2026-03-29','02:30');}catch{rejected=true;}
 const now=new Date('2026-03-29T01:50:00').getTime();
 process.stdout.write(JSON.stringify({rejected,slot:earliestSchedule(now),now}));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),env:{...process.env,TZ:'Europe/Warsaw'},encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);const result=JSON.parse(child.stdout);
 assert.equal(result.rejected,true);assert.equal(result.slot.time,'03:05');assert.equal(result.slot.timestamp-result.now,15*60000);
});

test('TikTok requires matching date, time, UTC offset and a fresh near-term schedule proof',()=>{
 const now=new Date(2026,8,10,12,1,10).getTime(),slot=earliestSchedule(now),proof=proofFor(slot);
 assert.deepEqual(assertScheduleProof(schedulingJob,ready,proof,now),slot);
 for(const patch of [{scheduleConfirmed:false},{scheduleDate:'2026-09-11'},{scheduleTime:'12:25'},{scheduledAt:slot.timestamp+1},{scheduleTimezoneOffset:slot.timezoneOffset+60}])assert.throws(()=>assertScheduleProof(schedulingJob,ready,{...proof,...patch},now));
 assert.throws(()=>assertScheduleProof(schedulingJob,ready,proof,slot.timestamp-15*60000+1),/za blisko/);
 assert.throws(()=>assertScheduleProof(schedulingJob,ready,proof,slot.timestamp-21*60000),/najbliższego/);
 const unaligned=readSchedule('2026-09-10','12:19');assert.throws(()=>assertScheduleProof(schedulingJob,ready,proofFor(unaligned),now),/najbliższego/);
 assert.equal(assertScheduleProof({},ready,undefined,now),null);
});

test('schedule proof preserves requested privacy and test mode independently rejects COMMIT',()=>{
 const now=Date.now(),proof=proofFor(earliestSchedule(now));
 assert.doesNotThrow(()=>assertCommit(schedulingJob,ready,proof,now));
 assert.throws(()=>assertCommit(schedulingJob,ready,{...proof,privacy:'public'},now),/widoczności/);
 assert.throws(()=>assertCommit(schedulingJob,ready,{...proof,scheduleConfirmed:false},now),/harmonogramu/);
 assert.throws(()=>assertCommit({...schedulingJob,dryRun:true},ready,proof,now),/testowy/);
});

test('retry upgrades old TikTok failures to scheduling and cannot retry a confirmed scheduled result',()=>{
 const job={privacy:'private',targets:[{platform:'tiktok',status:'blocked',tabId:3},{platform:'youtube',status:'published',committedAt:1}]};
 resetTargetForRetry(job,'tiktok');assert.equal(job.tiktokSchedule,'auto15');assert.equal(job.targets[0].status,'pending');assert.equal(job.targets[1].status,'published');
 assert.ok(TERMINAL.includes('scheduled'));
 assert.throws(()=>resetTargetForRetry({targets:[{platform:'tiktok',status:'scheduled',committedAt:1}]},'tiktok',true));
});

test('worker saves scheduling intent, rejects forged completion, protects duplicates and never schedules in dry-run',async()=>{
 let handler;const event=()=>({addListener(){}});
 globalThis.chrome={action:{onClicked:event()},alarms:{create:async()=>{},onAlarm:event()},scripting:{executeScript:async()=>{}},storage:{local:{get:async()=>({}),set:async()=>{}}},runtime:{id:'schedule-test',getURL:p=>'chrome-extension://schedule-test/'+p,onInstalled:event(),onStartup:event(),onMessage:{addListener(fn){handler=fn;}}},tabs:{onUpdated:event(),onRemoved:event()}};
 try{
  await import('../extension/background.js?schedule-test');
  const panel=m=>new Promise(resolve=>handler(m,{id:'schedule-test',url:'chrome-extension://schedule-test/index.html'},resolve));
  const source=new Blob(['original video'],{type:'video/mp4'});
  const request={type:'CREATE',platforms:['tiktok'],privacy:'private',caption:'Test',title:'Test',kids:false,size:source.size,mime:source.type,filename:'test.mp4',mediaId:'scheduled-source',meta:{width:720,height:1280,duration:6}};
  await saveMedia(request.mediaId,source);
  const created=await panel({...request,tiktokSchedule:'disabled'});assert.equal(created.ok,true,created.error);
  assert.equal((await getJob(created.id)).tiktokSchedule,'auto15');
  await mutateJob(created.id,j=>{Object.assign(j.targets[0],{status:'ready',tabId:42});return j;});
  const first=await getJob(created.id),attemptId=first.targets[0].attemptId;
  const sender={id:'schedule-test',tab:{id:42},frameId:0,url:'https://www.tiktok.com/tiktokstudio/upload'};
  const content=(id,attempt,m)=>new Promise(resolve=>handler({id,attemptId:attempt,platform:'tiktok',...m},sender,resolve));
  const proof=proofFor(earliestSchedule(Date.now()+2000));
  assert.equal((await content(created.id,attemptId,{type:'COMMIT',proof:{...proof,scheduleConfirmed:false}})).ok,false);
  assert.equal((await content(created.id,attemptId,{type:'COMMIT',proof})).ok,false);
  await mutateJob(created.id,j=>{j.dryRun=false;return j;}); // Legacy jobs also stop before publishing.
  assert.equal((await content(created.id,attemptId,{type:'COMMIT',proof})).ok,false);
  assert.equal((await content(created.id,attemptId,{type:'CHECK',proof})).ok,true);
  assert.equal((await getJob(created.id)).targets[0].committedAt,undefined);
  assert.equal((await content(created.id,attemptId,{type:'FINISH',status:'scheduled',scheduledAt:proof.scheduledAt})).ok,false);
  assert.equal((await content(created.id,attemptId,{type:'FINISH',status:'draft'})).ok,true);
  assert.ok(await getMedia(request.mediaId));

  await saveMedia('dry-scheduled-source',source);
  const dry=await panel({...request,mediaId:'dry-scheduled-source',dryRun:true});assert.equal(dry.ok,true,dry.error);
  await mutateJob(dry.id,j=>{Object.assign(j.targets[0],{status:'ready',tabId:42});return j;});
  const dryAttempt=(await getJob(dry.id)).targets[0].attemptId;
  assert.equal((await content(dry.id,dryAttempt,{type:'CHECK',proof})).ok,true);
  assert.equal((await content(dry.id,dryAttempt,{type:'COMMIT',proof})).ok,false);
  assert.equal((await content(dry.id,dryAttempt,{type:'FINISH',status:'scheduled',scheduledAt:proof.scheduledAt})).ok,false);
  const checked=(await getJob(dry.id)).targets[0];assert.equal(checked.committedAt,undefined);assert.equal(checked.scheduledAt,undefined);assert.equal(checked.checkedProof.scheduledAt,proof.scheduledAt);
  assert.equal((await content(dry.id,dryAttempt,{type:'FINISH',status:'draft'})).ok,true);assert.ok(await getMedia('dry-scheduled-source'));
 }finally{delete globalThis.chrome;}
});
