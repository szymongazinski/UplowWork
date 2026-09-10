import test from 'node:test';
import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {validateRequest,assertCommit,interruptedStatus,validSender,videoFileMetadata} from '../extension/policy.js';
import {expectedOptions} from '../extension/options.js';
import 'fake-indexeddb/auto';
import {createJob,listJobs,mutateJob,getJob,saveJob,saveMedia,getMedia,removeMedia} from '../extension/store.js';
const request={facebookPage:{id:'123456789012345',url:'https://www.facebook.com/profile.php?id=123456789012345'},platforms:['tiktok','facebook','youtube'],privacy:'private',caption:'Test',title:'Test',kids:false,size:1024,mime:'video/mp4',filename:'test.mp4',mediaId:'test',meta:{width:720,height:1280,duration:6}};
test('accepts a complete private request',()=>assert.doesNotThrow(()=>validateRequest(request)));
test('OS files with no MIME keep their container type and modification date through the request',()=>{
 const lastModified=1681234567890;
 for(const [extension,mime] of [['MP4','video/mp4'],['MOV','video/quicktime'],['WebM','video/webm']]){
  const file=new File(['original bytes'],'film.'+extension,{lastModified});
  assert.equal(file.type,'');
  const metadata=JSON.parse(JSON.stringify(videoFileMetadata(file)));
  assert.deepEqual(metadata,{filename:file.name,size:file.size,mime,lastModified});
  assert.doesNotThrow(()=>validateRequest({...request,...metadata}));
  const rebuilt=new File([file],metadata.filename,{type:metadata.mime,lastModified:metadata.lastModified});
  assert.equal(rebuilt.lastModified,file.lastModified);assert.equal(rebuilt.type,mime);
 }
});
test('declared video MIME is preserved and mismatched or malformed metadata is rejected before upload',()=>{
 const file=new File(['video'],'camera.mov',{type:'video/quicktime',lastModified:0});
 assert.deepEqual(videoFileMetadata(file),{filename:'camera.mov',size:5,mime:'video/quicktime',lastModified:0});
 for(const patch of [{filename:'camera.mov',mime:'video/mp4'},{filename:'camera.webm',mime:'video/mp4'},{filename:'camera.mp4',mime:'application/octet-stream'},{mime:''},{lastModified:NaN},{lastModified:'1681234567890'},{lastModified:1.5},{size:0}])assert.throws(()=>validateRequest({...request,...patch}));
 // Older queued requests did not include the timestamp; validation stays compatible.
 assert.doesNotThrow(()=>validateRequest(request));
});
test('shared options are scoped to supported platforms',()=>{const j={...request,options:{comments:'off',likeCounts:'hide',embedding:'off'}};assert.deepEqual(expectedOptions(j,'tiktok'),{comments:'off'});assert.deepEqual(expectedOptions(j,'instagram'),{comments:'off',likeCounts:'hide'});assert.deepEqual(expectedOptions(j,'facebook'),{});assert.deepEqual(expectedOptions(j,'youtube'),{comments:'off',likeCounts:'hide',embedding:'off'});});
test('made-for-kids overrides YouTube comments only',()=>{const j={...request,kids:true,options:{comments:'on'}};assert.deepEqual(expectedOptions(j,'youtube'),{comments:'off'});assert.deepEqual(expectedOptions(j,'tiktok'),{comments:'on'});});
test('rejects unsupported option values and missing platform confirmation',()=>{for(const options of [{comments:'paused'},{audience:'public'},null,[]])assert.throws(()=>validateRequest({...request,options}));const j={...request,options:{comments:'off'}},t={platform:'tiktok',status:'ready'},p={privacy:'private',privacyConfirmed:true,caption:'Test'};assert.throws(()=>assertCommit(j,t,p));assert.throws(()=>assertCommit(j,t,{...p,options:{comments:'on'}}));assert.doesNotThrow(()=>assertCommit(j,t,{...p,options:{comments:'off'}}));});
test('rejects altered audience, unknown platform, invalid file and missing children selection',()=>{for(const patch of [{privacy:'friends'},{platforms:['instagram','instagram']},{platforms:['evil']},{size:1024*1024*101},{meta:{...request.meta,duration:Infinity}},{kids:undefined},{caption:''}])assert.throws(()=>validateRequest({...request,...patch}));});
test('private Instagram cannot be committed even with forged proof',()=>assert.throws(()=>assertCommit(request,{platform:'instagram',status:'ready'},{privacy:'private',caption:'Test',privacyConfirmed:true})));
test('prevents public fallback, missing privacy proof, caption changes and duplicate commits',()=>{const target={platform:'tiktok',status:'ready'};const proof={privacy:'private',caption:'Test',privacyConfirmed:true};assert.equal(assertCommit(request,target,proof),true);for(const patch of [{privacy:'public'},{privacyConfirmed:false},{caption:'changed'}])assert.throws(()=>assertCommit(request,target,{...proof,...patch}));assert.throws(()=>assertCommit(request,{...target,committedAt:123},proof));assert.throws(()=>assertCommit({...request,cancelled:true},target,proof));});
test('YouTube title and children metadata must be confirmed',()=>{const t={platform:'youtube',status:'ready'};const p={privacy:'private',caption:'Test',title:'Test',kids:false,privacyConfirmed:true};assert.doesNotThrow(()=>assertCommit(request,t,p));assert.throws(()=>assertCommit(request,t,{...p,kids:true}));assert.throws(()=>assertCommit(request,t,{...p,title:'other'}));});
test('an interrupted committed job cannot be treated as safe to repeat',()=>{assert.equal(interruptedStatus({committedAt:123}),'unknown');assert.equal(interruptedStatus({}),'blocked');});
test('rejects requests from a different tab, frame, domain or insecure origin',()=>{const t={tabId:7,platform:'tiktok'},s={tab:{id:7},frameId:0,url:'https://www.tiktok.com/tiktokstudio/upload'};assert.equal(validSender(t,s),true);for(const patch of [{tab:{id:8}},{frameId:1},{url:'https://www.tiktok.com.evil.test/'},{url:'http://www.tiktok.com/'},{url:'not-a-url'}])assert.equal(validSender(t,{...s,...patch}),false);});
test('durable queue serializes concurrent starts and preserves platform updates',async()=>{
 const make=id=>({id,digest:'same-video',caption:'Test',privacy:'private',targets:[{platform:'facebook',status:'pending'},{platform:'youtube',status:'pending'}]});
 const results=await Promise.allSettled([createJob(make('first')),createJob(make('second'))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await listJobs()).length,1);
 const id=(await listJobs())[0].id;
 await Promise.all([mutateJob(id,j=>{j.targets[0].status='published';j.targets[0].committedAt=123;return j;}),mutateJob(id,j=>{j.targets[1].status='blocked';return j;})]);
 const stored=await getJob(id);assert.equal(stored.targets[0].status,'published');assert.equal(stored.targets[1].status,'blocked');
 await assert.rejects(()=>createJob(make('duplicate')),/już wysyłany/);
 await createJob({...make('different-audience'),privacy:'public'});
});
test('file persistence preserves bytes and cleanup removes only the selected file',async()=>{await saveMedia('one',new Blob(['first']));await saveMedia('two',new Blob(['second']));assert.equal(await(await getMedia('one')).text(),'first');await removeMedia('one');assert.equal(await getMedia('one'),undefined);assert.equal(await(await getMedia('two')).text(),'second');});

test('Instagram requires confirmed original dimensions and rejects cropped, stale or missing aspect proof',()=>{
 const job={...request,platforms:['instagram'],privacy:'public'},target={platform:'instagram',status:'ready'};
 const proof={privacy:'public',privacyConfirmed:true,caption:'Test',aspectRatioConfirmed:true,sourceWidth:720,sourceHeight:1280};
 assert.doesNotThrow(()=>assertCommit(job,target,proof));
 for(const patch of [{aspectRatioConfirmed:undefined},{aspectRatioConfirmed:false},{sourceHeight:720},{sourceWidth:1080,sourceHeight:1920},{sourceWidth:1280,sourceHeight:720},{sourceWidth:'720'},{sourceHeight:undefined}])assert.throws(()=>assertCommit(job,target,{...proof,...patch}),/proporcji/);
 for(const meta of [undefined,{}, {width:0,height:1280},{width:720,height:Infinity},{width:NaN,height:1280},{width:1280,height:720}])assert.throws(()=>assertCommit({...job,meta},target,proof),/proporcji/);
 // Square source video is valid, but a portrait source cropped to square is not.
 assert.doesNotThrow(()=>assertCommit({...job,meta:{...job.meta,width:720,height:720}},target,{...proof,sourceHeight:720}));
});

test('worker CHECK and COMMIT both reject missing or changed Instagram aspect evidence',async()=>{
 let handler;const event=()=>({addListener(){}});
 globalThis.chrome={action:{onClicked:event()},alarms:{create:async()=>{},onAlarm:event()},storage:{local:{get:async()=>({}),set:async()=>{}}},runtime:{id:'aspect-test',getURL:p=>'chrome-extension://aspect-test/'+p,onInstalled:event(),onStartup:event(),onMessage:{addListener(fn){handler=fn;}}},tabs:{onUpdated:event(),onRemoved:event()}};
 try{
  await import('../extension/background.js?aspect-test');
  const id='instagram-aspect-job',attemptId='aspect-attempt';
  await saveJob({...request,id,dryRun:true,privacy:'public',targets:[{platform:'instagram',status:'ready',tabId:71,attemptId}]});
  const sender={id:'aspect-test',tab:{id:71},frameId:0,url:'https://www.instagram.com/'};
  const content=m=>new Promise(resolve=>handler({id,attemptId,platform:'instagram',...m},sender,resolve));
  const proof={privacy:'public',privacyConfirmed:true,caption:'Test',aspectRatioConfirmed:true,sourceWidth:720,sourceHeight:1280};
  for(const patch of [{aspectRatioConfirmed:undefined},{sourceHeight:720}])assert.equal((await content({type:'CHECK',proof:{...proof,...patch}})).ok,false);
  assert.equal((await content({type:'CHECK',proof})).ok,true);
  assert.equal((await content({type:'COMMIT',proof})).ok,false,'dry-run must not commit even with valid dimensions');
  assert.equal((await getJob(id)).targets[0].committedAt,undefined);
  await mutateJob(id,j=>{j.dryRun=false;return j;});
  assert.equal((await content({type:'COMMIT',proof:{...proof,sourceHeight:720}})).ok,false);
  assert.equal((await getJob(id)).targets[0].status,'ready');
  assert.equal((await content({type:'COMMIT',proof})).ok,true);assert.ok((await getJob(id)).targets[0].committedAt);
 }finally{delete globalThis.chrome;}
});
