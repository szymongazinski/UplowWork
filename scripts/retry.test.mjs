import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {saveJob,getJob,saveMedia,getMedia,retryTarget} from '../extension/store.js';
import {resetTargetForRetry,assertCommit} from '../extension/policy.js';

test('retry changes only failed target and requires checking an uncertain publication',()=>{
 const job={privacy:'public',targets:[{platform:'tiktok',status:'blocked',tabId:4,dispatched:true},{platform:'youtube',status:'published',committedAt:123}]};
 const youtube=structuredClone(job.targets[1]);resetTargetForRetry(job,'tiktok');
 assert.deepEqual(job.targets[1],youtube);assert.equal(job.targets[0].status,'pending');assert.equal(job.targets[0].previousTabId,4);assert.ok(job.targets[0].attemptId);assert.equal(job.targets[0].dispatched,undefined);
 assert.throws(()=>resetTargetForRetry(job,'tiktok'));assert.throws(()=>resetTargetForRetry(job,'youtube',true));
 const uncertain={facebookPage:{id:'123456789012345',url:'https://www.facebook.com/profile.php?id=123456789012345'},privacy:'public',targets:[{platform:'facebook',status:'unknown',committedAt:1}]};
 assert.throws(()=>resetTargetForRetry(uncertain,'facebook'));resetTargetForRetry(uncertain,'facebook',true);assert.equal(uncertain.targets[0].committedAt,undefined);
});

test('Facebook post composer and unconfirmed thumbnails cannot authorize publication',()=>{
 const job={facebookPage:{id:'123456789012345',url:'https://www.facebook.com/profile.php?id=123456789012345'},privacy:'public',caption:'Test',thumbnail:{platforms:['facebook']}};const target={platform:'facebook',status:'ready'};
 const proof={facebookPageId:'123456789012345',facebookPageConfirmed:true,privacy:'public',privacyConfirmed:true,caption:'Test'};
 assert.throws(()=>assertCommit(job,target,proof),/rolki/);assert.throws(()=>assertCommit(job,target,{...proof,mediaKind:'reel'}),/miniatury/);
 assert.doesNotThrow(()=>assertCommit(job,target,{...proof,mediaKind:'reel',thumbnailConfirmed:true}));
});

test('worker retains failed media, waits for a fresh retry document, reuses its tab and rejects stale attempts',async()=>{
 let handler,updated;const sent=[],tabs=[];let tabId=10,reloads=0;const event=()=>({addListener(){}});
 globalThis.chrome={action:{onClicked:event()},alarms:{create:async()=>{},onAlarm:event()},scripting:{executeScript:async()=>{}},storage:{local:{get:async()=>({}),set:async()=>{}}},runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onInstalled:event(),onStartup:event(),onMessage:{addListener(fn){handler=fn;}}},tabs:{onUpdated:{addListener(fn){updated=fn;}},onRemoved:event(),reload:async()=>{reloads++;},get:async id=>{const t=tabs.find(t=>t.id===id);if(!t)throw Error('closed');return t;},create:async({url})=>{const t={id:tabId++,url,status:'complete'};tabs.push(t);return t;},update:async(id,changes)=>{const t=tabs.find(t=>t.id===id);if(!t)throw Error('closed');Object.assign(t,changes);return t;},sendMessage:async(id,m)=>{sent.push({id,...m});return {started:true};}}};
 try{
  await import('../extension/background.js');
  await saveMedia('retry-file',new Blob(['video']));await saveJob({id:'retry-job',mediaId:'retry-file',size:5,caption:'Test',privacy:'public',createdAt:1,targets:[{platform:'tiktok',status:'blocked'},{platform:'youtube',status:'published',committedAt:1}]});
  const panel=m=>new Promise(resolve=>handler(m,{id:'test',url:'chrome-extension://test/index.html'},resolve));
  const results=await Promise.all([panel({type:'RETRY',id:'retry-job',platform:'tiktok'}),panel({type:'RETRY',id:'retry-job',platform:'tiktok'})]);
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal(tabs.length,1);assert.equal(sent.length,1);assert.equal(sent[0].platform,'tiktok');
  const first=sent[0].job.attemptId;const sender={id:'test',tab:{id:10},frameId:0,url:'https://www.tiktok.com/tiktokstudio/upload'};
  const content=m=>new Promise(resolve=>handler({id:'retry-job',platform:'tiktok',...m},sender,resolve));
  assert.equal((await content({type:'FINISH',attemptId:first,status:'blocked',message:'Upload rejected'})).ok,true);
  assert.ok(await getMedia('retry-file'));
  assert.equal((await panel({type:'RETRY',id:'retry-job',platform:'tiktok'})).ok,true);assert.equal(tabs.length,1);assert.equal(reloads,1);
  // Reload has returned, but Chrome can still report the old document as complete.
  assert.equal((await chrome.tabs.get(10)).status,'complete');assert.equal(sent.length,1);
  assert.equal((await getJob('retry-job')).targets[0].navigationPhase,'requested');
  await updated(10,{status:'complete'});assert.equal(sent.length,1,'an old complete event must not dispatch the retry');
  // Fire both events without waiting, as Chrome does: the complete handler must
  // wait for the loading state to be written to IndexedDB.
  await Promise.all([updated(10,{status:'loading'}),updated(10,{status:'complete'}),updated(10,{status:'complete'})]);
  assert.equal(sent.length,2);assert.equal((await getJob('retry-job')).targets[0].navigationPhase,undefined);
  assert.equal((await content({type:'FINISH',attemptId:first,status:'blocked'})).ok,false);
  const second=sent[1].job.attemptId;assert.notEqual(first,second);
  assert.equal((await content({type:'PROGRESS',attemptId:second,status:'ready'})).ok,true);
  const slot=globalThis.UplowWorkSchedule.earliestSchedule(Date.now()+2000);
  assert.equal((await content({type:'COMMIT',attemptId:second,proof:{privacy:'public',privacyConfirmed:true,caption:'Test',scheduleConfirmed:true,scheduleDate:slot.date,scheduleTime:slot.time,scheduledAt:slot.timestamp,scheduleTimezoneOffset:slot.timezoneOffset}})).ok,true);
  assert.equal((await content({type:'FINISH',attemptId:second,status:'scheduled',scheduledAt:slot.timestamp})).ok,true);
  assert.equal(await getMedia('retry-file'),undefined);assert.equal((await panel({type:'RETRY',id:'retry-job',platform:'youtube'})).ok,false);
  assert.equal((await getJob('retry-job')).targets[1].committedAt,1);
 }finally{delete globalThis.chrome;}
});

test('a failed retry reload stays blocked in its existing tab without opening replacement windows',async()=>{
 let handler;const sent=[],tabs=[{id:41,url:'https://www.instagram.com/',status:'complete'}];let reloads=0;const event=()=>({addListener(){}});
 globalThis.chrome={action:{onClicked:event()},alarms:{create:async()=>{},onAlarm:event()},scripting:{executeScript:async()=>{}},storage:{local:{get:async()=>({}),set:async()=>{}}},runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onInstalled:event(),onStartup:event(),onMessage:{addListener(fn){handler=fn;}}},tabs:{onUpdated:event(),onRemoved:event(),reload:async()=>{reloads++;throw new Error('Navigation failed');},get:async id=>tabs.find(t=>t.id===id),create:async({url})=>{const t={id:42,url,status:'complete'};tabs.push(t);return t;},update:async(id,changes)=>Object.assign(tabs.find(t=>t.id===id),changes),sendMessage:async(id,m)=>{sent.push({id,...m});return {started:true};}}};
 try{
  await import('../extension/background.js?reload-failure');
  await saveMedia('failed-reload-file',new Blob(['video']));await saveJob({id:'failed-reload-job',mediaId:'failed-reload-file',size:5,caption:'Test',privacy:'public',targets:[{platform:'instagram',status:'blocked',tabId:41}]});
  const panel=m=>new Promise(resolve=>handler(m,{id:'test',url:'chrome-extension://test/index.html'},resolve));
  assert.equal((await panel({type:'RETRY',id:'failed-reload-job',platform:'instagram'})).ok,true);
  assert.equal(reloads,1);assert.equal(tabs.length,1);assert.equal(sent.length,0);
  const target=(await getJob('failed-reload-job')).targets[0];assert.equal(target.status,'blocked');assert.equal(target.tabId,41);assert.match(target.message,/Navigation failed/);assert.ok(await getMedia('failed-reload-file'));
 }finally{delete globalThis.chrome;}
});

test('retry cannot race with a different job already queued',async()=>{
 await saveJob({id:'blocked-job',privacy:'public',targets:[{platform:'instagram',status:'blocked'}]});
 await saveJob({id:'other-job',privacy:'public',targets:[{platform:'tiktok',status:'pending'}]});
 await assert.rejects(()=>retryTarget('blocked-job','instagram',false),/bieżącą/);
 assert.equal((await getJob('blocked-job')).targets[0].status,'blocked');
});
