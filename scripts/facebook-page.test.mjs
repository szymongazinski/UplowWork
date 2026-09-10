import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseHTML} from 'linkedom';
import 'fake-indexeddb/auto';
import {normalizeFacebookPage,assertCommit,resetTargetForRetry} from '../extension/policy.js';
import {getJob,saveMedia,createJob,mutateJob} from '../extension/store.js';
const page={id:'123456789012345',url:'https://www.facebook.com/profile.php?id=123456789012345'};
const other={id:'999999999999999',url:'https://www.facebook.com/profile.php?id=999999999999999'};
const proof={mediaKind:'reel',facebookPageConfirmed:true,facebookPageId:page.id,privacy:'public',privacyConfirmed:true,caption:'Test'};

test('Page URL validation rejects lookalike hosts, credentials, other routes and mismatched IDs',()=>{
 assert.deepEqual(normalizeFacebookPage(page.url+'&sk=reels'),page);
 for(const value of [null,'https://facebook.com.evil.test/profile.php?id=123456789012345','http://www.facebook.com/profile.php?id=123456789012345','https://user@www.facebook.com/profile.php?id=123456789012345','https://www.facebook.com/same.name',{...page,id:other.id}])assert.throws(()=>normalizeFacebookPage(value));
});
test('Page identity comes from active Facebook navigation, not the page being viewed or identical names',()=>{
 const source=readFileSync(new URL('../extension/facebook-page.js',import.meta.url),'utf8');
 function actor(html){const {document,window}=parseHTML('<html><body>'+html+'</body></html>');window.HTMLElement.prototype.getClientRects=function(){return this.isConnected?[{}]:[];};const c={document,URL,getComputedStyle:()=>({visibility:'visible'})};runInNewContext(source,c);return c.UplowWorkFacebookPage.actor();}
 const link=id=>'<a href="/'+id+'/ad_center/">Centrum reklam</a>';
 assert.equal(actor('<h1>Zarządzanie stroną</h1><h2>Ta sama nazwa</h2>'+link(page.id)),null);
 assert.equal(actor('<nav aria-label="Facebook">'+link(page.id)+'</nav>'),page.id);
 assert.equal(actor('<nav aria-label="Facebook">'+link(other.id)+'</nav><main>'+link(page.id)+'</main>'),other.id);
 assert.equal(actor('<nav aria-label="Facebook" aria-hidden="true">'+link(page.id)+'</nav>'),null);
 assert.equal(actor('<nav aria-label="Facebook">'+link(page.id)+link(other.id)+'</nav>'),null);
});
test('Facebook policy refuses legacy, mismatched Page, private audience and missing identity evidence',()=>{
 const job={facebookPage:page,privacy:'public',caption:'Test'},target={platform:'facebook',status:'ready'};
 assert.equal(assertCommit(job,target,proof),true);
 for(const p of [{facebookPageConfirmed:false},{facebookPageId:other.id},{facebookPageId:undefined}])assert.throws(()=>assertCommit(job,target,{...proof,...p}));
 assert.throws(()=>assertCommit({...job,facebookPage:null},target,proof));
 assert.throws(()=>assertCommit({...job,privacy:'private'},target,{...proof,privacy:'private'}));
 assert.throws(()=>resetTargetForRetry({privacy:'public',targets:[{platform:'facebook',status:'blocked'}]},'facebook'));
});
test('Worker pins the selected Page, resumes a switch only after a fresh load, and rejects stale runners',async()=>{
 let handler,updated,nextId=90;const state={facebookPage:page},tabs=[],runs=[];const event=()=>({addListener(){}});
 globalThis.chrome={action:{onClicked:event()},alarms:{create:async()=>{},onAlarm:event()},scripting:{executeScript:async()=>{}},storage:{local:{get:async()=>structuredClone(state),set:async value=>Object.assign(state,value)}},runtime:{id:'page-test',getURL:p=>'chrome-extension://page-test/'+p,onInstalled:event(),onStartup:event(),onMessage:{addListener(fn){handler=fn;}}},tabs:{onUpdated:{addListener(fn){updated=fn;}},onRemoved:event(),create:async({url})=>{const t={id:nextId++,url,status:'complete'};tabs.push(t);return t;},get:async id=>tabs.find(t=>t.id===id),sendMessage:async(id,m)=>{runs.push(m);return {started:true};}}};
 try{
  await import('../extension/background.js?page-test');
  const panel=m=>new Promise(resolve=>handler(m,{id:'page-test',url:'chrome-extension://page-test/index.html'},resolve));
  const source=new Blob(['page-only-video'],{type:'video/mp4'});await saveMedia('page-source',source);
  const request={type:'CREATE',dryRun:true,facebookPage:other,platforms:['facebook'],privacy:'public',caption:'Test',mediaId:'page-source',filename:'test.mp4',mime:source.type,size:source.size,meta:{width:720,height:1280,duration:6}};
  const created=await panel(request);assert.equal(created.ok,true,created.error);
  assert.deepEqual((await getJob(created.id)).facebookPage,page,'client cannot replace stored destination');
  await panel({type:'START',id:created.id});assert.equal(tabs[0].url,page.url);assert.equal(runs.length,1);
  const first=(await getJob(created.id)).targets[0];
  const sender={id:'page-test',tab:{id:tabs[0].id},frameId:0,url:page.url};
  const content=(attemptId,m)=>new Promise(resolve=>handler({id:created.id,attemptId,platform:'facebook',...m},sender,resolve));
  assert.equal((await content(first.attemptId,{type:'FACEBOOK_SWITCH',pageId:other.id})).ok,false);
  assert.equal((await content(first.attemptId,{type:'FACEBOOK_SWITCH',pageId:page.id})).ok,true);
  const switching=(await getJob(created.id)).targets[0];assert.notEqual(switching.attemptId,first.attemptId);assert.equal(switching.navigationPhase,'requested');
  assert.equal((await content(first.attemptId,{type:'FINISH',status:'blocked'})).ok,false);
  await updated(tabs[0].id,{status:'complete'});assert.equal(runs.length,1,'old document cannot resume');
  await updated(tabs[0].id,{status:'loading'});await updated(tabs[0].id,{status:'complete'});await updated(tabs[0].id,{status:'complete'});
  assert.equal(runs.length,2);assert.equal(runs[1].job.attemptId,switching.attemptId);assert.deepEqual(runs[1].job.facebookPage,page);
  assert.equal((await content(switching.attemptId,{type:'FACEBOOK_SWITCH',pageId:page.id})).ok,false,'no switch loop');
  assert.equal((await panel({type:'SET_FACEBOOK_PAGE',url:other.url})).ok,false,'active job keeps destination');
  await content(switching.attemptId,{type:'PROGRESS',status:'ready'});
  assert.equal((await content(switching.attemptId,{type:'CHECK',proof:{...proof,facebookPageId:other.id}})).ok,false);
  assert.equal((await content(switching.attemptId,{type:'CHECK',proof})).ok,true);
  assert.equal((await content(switching.attemptId,{type:'COMMIT',proof})).ok,false,'test mode never submits');
  await content(switching.attemptId,{type:'FINISH',status:'draft'});
  assert.equal((await panel({type:'SET_FACEBOOK_PAGE',url:other.url})).ok,true);
  assert.deepEqual((await getJob(created.id)).facebookPage,page,'saved job destination remains unchanged');
  const normal=await panel({...request,dryRun:false});assert.equal(normal.ok,true,normal.error);
  await mutateJob(normal.id,j=>{Object.assign(j.targets[0],{status:'ready',tabId:91});return j;});
  const normalJob=await getJob(normal.id);
  const normalContent=m=>new Promise(resolve=>handler({id:normal.id,attemptId:normalJob.targets[0].attemptId,platform:'facebook',...m},{...sender,tab:{id:91},url:other.url},resolve));
  assert.equal((await normalContent({type:'COMMIT',proof})).ok,false,'worker rejects evidence for another Page');
  assert.equal((await normalContent({type:'COMMIT',proof:{...proof,facebookPageId:other.id}})).ok,true);
  await normalContent({type:'FINISH',status:'submitted'});
 }finally{delete globalThis.chrome;}
});
test('Duplicate detection distinguishes personal legacy jobs and different Pages but blocks the same Page',async()=>{
 const base={digest:'unique-page-dedupe-video',caption:'Dedupe',privacy:'public',targets:[{platform:'facebook',status:'published',committedAt:1}]};
 await createJob({...base,id:'legacy-profile'});
 await createJob({...base,id:'page-one',facebookPage:page});
 await createJob({...base,id:'page-two',facebookPage:other});
 await assert.rejects(createJob({...base,id:'page-again',facebookPage:page}),/już wysyłany/);
});
