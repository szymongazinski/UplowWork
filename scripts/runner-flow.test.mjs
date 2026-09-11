import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseHTML} from 'linkedom';
import {File} from 'node:buffer';
import {webcrypto} from 'node:crypto';
import {assertCommit} from '../extension/policy.js';
const helper=readFileSync(new URL('../extension/dom.js',import.meta.url),'utf8');
const pageModule=readFileSync(new URL('../extension/facebook-page.js',import.meta.url),'utf8');
const runner=readFileSync(new URL('../extension/runner.js',import.meta.url),'utf8');
const scheduleModule=readFileSync(new URL('../extension/schedule.js',import.meta.url),'utf8');
const scheduleUI=readFileSync(new URL('../extension/tiktok-schedule-ui.js',import.meta.url),'utf8');

test('all four final controls are left untouched regardless of legacy dryRun flag',async()=>{
 const source=runner.slice(runner.indexOf(' async function authorize('),runner.indexOf(' async function tiktok('));
 for(const platform of ['youtube','facebook','instagram','tiktok'])for(const dryRun of [false,true]){
  const messages=[],pauses=[];let clicks=0,reads=0;
  const context={cancelled:false,committed:false,currentStep:'',enabled:()=>true,visible:()=>true,pause:async ms=>pauses.push(ms),send:async(job,p,type)=>messages.push(type),click:()=>clicks++};
  runInNewContext(source+';this.prepare=authorize;',context);
  await assert.rejects(()=>context.prepare({dryRun},platform,{},()=>{reads++;return {isConnected:true};}),e=>e.code==='DRY_RUN_COMPLETE');
  assert.deepEqual(messages,['PROGRESS','CHECK']);assert.equal(clicks,0);assert.equal(reads,3);assert.deepEqual(pauses,[1500]);
 }
});

async function flow(platform,dryRun=true,corrupt=false,scenario={}){
 const {document,window}=parseHTML('<html><body></body></html>');
 window.HTMLElement.prototype.getClientRects=function(){return !this.isConnected||this.hasAttribute('hidden')?[]:[{}];};
 window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};
 Object.defineProperty(window.HTMLElement.prototype,'isContentEditable',{get(){return this.getAttribute('contenteditable')==='true';}});
 let selected;document.createRange=()=>({selectNodeContents(e){selected=e;}});window.getSelection=()=>({removeAllRanges(){},addRange(){}});document.execCommand=(cmd,ui,value)=>{selected.replaceChildren(...String(value).split('\n').flatMap((line,i)=>i?[document.createElement('br'),document.createTextNode(line)]:[document.createTextNode(line)]));return true;};
 const put=html=>{document.body.innerHTML=(platform==='facebook'&&!scenario.personalActor?'<nav aria-label="Facebook"><a id="actor" href="/'+(scenario.wrongPage?'999999999999999':'123456789012345')+'/ad_center/">Centrum reklam</a></nav>':'')+html;};const by=id=>document.getElementById(id);
 let publishClicks=0,detachedPublishClicks=0,publishReplacements=0,composerReplacements=0,clockJumps=0,scheduleActivations=0,changes=0,detachedChanges=0,createClicks=0,originalClicks=0,pointerDown=false,receive,finish;const messages=[],deliveredFiles=[],scheduledTimes=[];
 const finished=new Promise(resolve=>{finish=resolve;});const bytes=Buffer.from('verified video bytes'),coverBytes=Buffer.from('distinct thumbnail bytes');let coverChanges=0,coverSaves=0;const deliveredCovers=[];
 const digest=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
 const job={id:'offline-fixture',attemptId:'attempt',dryRun,filename:'fixture.mp4',mime:'video/mp4',lastModified:1700000000000,size:bytes.length,caption:scenario.caption||'Opis testowy',title:'Film',privacy:'public',kids:false,options:scenario.options||{},meta:scenario.meta||{width:720,height:1280,duration:6},digest};
 if(platform==='facebook'&&!scenario.noPage)job.facebookPage={id:'123456789012345',url:'https://www.facebook.com/profile.php?id=123456789012345'};
 if(scenario.schedule)job.tiktokSchedule='auto15';
 if(scenario.thumbnail)job.thumbnail={size:coverBytes.length,mime:'image/png',platforms:[platform]};
 const wireFile=next=>{const input=by('file');input.addEventListener('input',()=>{changes++;});input.addEventListener('change',()=>{if(!input.isConnected){detachedChanges++;return;}changes++;deliveredFiles.push(...input.files);next();});};
 const wirePublish=()=>{const button=by('publish');button.addEventListener('click',()=>{if(!button.isConnected){detachedPublishClicks++;return;}publishClicks++;put(platform==='facebook'?'Your reel is processing':platform==='tiktok'?'<div role="status">Your video has been scheduled</div>':'Your reel has been shared');});};
 const mutateFinalForm=boundary=>{
  if(scenario.changeActorOn===boundary)by('actor').setAttribute('href','/999999999999999/ad_center/');
  if(scenario.changeCoverOn===boundary)by('saved-cover').setAttribute('src','blob:replaced-cover');
  if(scenario.expireScheduleOn===boundary&&!clockJumps){
   const current=context.UplowWorkSchedule.readSchedule(by('schedule-date').value,by('schedule-time').value);
   clock=current.timestamp-15*60000+1-clockBase;clockJumps++;
  }
  if(scenario.replaceComposerOn===boundary){
   const previous=by('publish').closest('[role="dialog"]'),previousVideo=by('final-video'),replacement=previous.cloneNode(true);
   previous.replaceWith(replacement);assert.equal(previous.isConnected,false);composerReplacements++;
   by('final-video').videoWidth=previousVideo.videoWidth;by('final-video').videoHeight=previousVideo.videoHeight;by('final-video').getBoundingClientRect=previousVideo.getBoundingClientRect;wirePublish();
  }
  if(scenario.replacePublishOn===boundary||scenario.replacePublishOn==='both'){
   const previous=by('publish');assert.ok(previous,'final button exists at '+boundary);previous.replaceWith(previous.cloneNode(true));assert.equal(previous.isConnected,false);publishReplacements++;wirePublish();
  }
  if(scenario.changeCaptionOn===boundary)by('caption').textContent='Inny opis zmieniony podczas zatwierdzania';
  if(scenario.changeDisclosureOn===boundary)by('public-disclosure').textContent='Only your followers can see this reel.';
  if(scenario.changeCropOn===boundary)by('final-video').getBoundingClientRect=()=>({left:0,top:0,right:320,bottom:320,width:320,height:320});
 };
 const caption='<div id="caption" role="textbox" contenteditable="true" aria-label="Dodaj opis..."></div>';
 const wireCoverInput=()=>{
  const input=by('cover-file');if(!input)return;
  input.addEventListener('change',()=>{
   assert.ok(input.isConnected,'cover input must survive transfer');coverChanges++;deliveredCovers.push(...input.files);
   if(scenario.rejectCover){const decoy=document.createElement('img');decoy.src='blob:unrelated';document.body.append(decoy);return;}
   const preview=document.createElement('img');preview.id='uploaded-cover';preview.alt='Podgląd obrazu przesłanej miniatury niestandardowej';preview.src='blob:custom-cover';preview.complete=true;preview.naturalWidth=720;by('cover-editor').append(preview);
  });
 };
 const fbSettings=(saved=false)=>{
  put('<input type="file" accept="image/*"><div role="dialog" aria-label="Ustawienia rolki"><h2>Ustawienia rolki</h2><button id="edit-cover">Edytuj</button>'+(saved?'<img id="saved-cover" src="blob:custom-cover">':'')+caption+'<button id="audience">Publiczne Każdy na Facebooku i poza nim</button><button id="publish">Opublikuj</button><button id="save-draft">Zapisz</button></div>');
  if(saved){by('saved-cover').complete=true;by('saved-cover').naturalWidth=720;}
  by('save-draft').addEventListener('click',()=>assert.fail('must never save a draft instead of the thumbnail'));
  by('edit-cover').addEventListener('click',()=>{
   put('<input type="file" accept="image/*"><div role="dialog" id="cover-editor"><section aria-hidden="true"><h2>Ustawienia rolki</h2><input type="file" accept=".png,.jpg,.jpeg"><button>Zapisz</button></section><h2>Edytuj miniaturę</h2>'+(scenario.noCoverInput?'':'<input id="cover-file" type="file" accept=".png,.jpg,.jpeg">')+'<button id="save-cover">Zapisz</button><button>Anuluj</button></div>');
   wireCoverInput();by('save-cover').addEventListener('click',()=>{coverSaves++;fbSettings(!scenario.loseCoverOnSave);});
  });
  by('audience').addEventListener('click',()=>{
   const modal=document.createElement('div');modal.setAttribute('role','dialog');modal.setAttribute('aria-label','Wybierz grupę odbiorców');
   modal.innerHTML='<label>Publiczne Każdy na Facebooku i poza nim<input id="public" type="radio" aria-checked="false"></label><label>Znajomi Twoi znajomi na Facebooku<input type="radio" aria-checked="true"></label><button id="done">Gotowe</button>';document.body.append(modal);
   by('public').addEventListener('click',()=>{by('public').setAttribute('aria-checked','true');});
   by('done').addEventListener('click',()=>{assert.equal(by('public').getAttribute('aria-checked'),'true');modal.remove();by('audience').textContent='Publiczne Każdy na Facebooku i poza nim';});
  });wirePublish();
 };
 let tiktokCoverSaved=false;
 const tiktokUploaded=()=>{
  if(!scenario.acceptUpload){put('<div role="alert">Something went wrong</div>');return;}
  put('<p>Uploaded</p><div id="caption" role="combobox" contenteditable="true"></div><button id="privacy" role="combobox">Everyone</button><button id="publish">Post</button>');
  if(scenario.thumbnail){
   const row=document.createElement('div');row.className='cover-container';row.innerHTML='<img id="tt-cover" class="cover-image" src="'+(tiktokCoverSaved?'blob:custom-cover':'blob:default-cover')+'"><button id="tt-edit">Edit cover</button>';document.body.append(row);by('tt-cover').complete=true;by('tt-cover').naturalWidth=720;
   by('tt-edit').addEventListener('click',()=>{
    put('<input type="file" accept="image/*"><label role="button" aria-label="Upload cover image"><input id="tt-cover-file" type="file" accept="image/png" aria-hidden="true"></label><button id="tt-save">Save</button>');
    by('tt-cover-file').addEventListener('change',()=>{
     coverChanges++;deliveredCovers.push(...by('tt-cover-file').files);const img=document.createElement('img');img.alt='Uploaded cover image';img.src='blob:custom-cover';img.complete=false;img.naturalWidth=0;img.naturalHeight=0;document.body.append(img);
     if(!scenario.rejectCover)setTimeout(()=>{img.complete=true;img.naturalWidth=720;img.naturalHeight=1280;},30);
    });
    by('tt-save').addEventListener('click',()=>{assert.ok(document.querySelector('img[alt="Uploaded cover image"]').complete,'must wait for decoded cover');coverSaves++;tiktokCoverSaved=!scenario.loseCoverOnSave;tiktokUploaded();});
   });
  }
  by('privacy').addEventListener('click',()=>{const option=document.createElement('div');option.setAttribute('role','option');option.textContent='Everyone';document.body.append(option);option.addEventListener('click',()=>option.remove());});wirePublish();
  if(scenario.schedule){
   const radio=document.createElement('input');radio.type='radio';radio.name='postSchedule';radio.value='schedule';radio.setAttribute('aria-checked','false');document.body.append(radio);
   radio.addEventListener('click',()=>{
    scheduleActivations++;radio.setAttribute('aria-checked','true');by('publish').textContent='Schedule';
    const slot=context.UplowWorkSchedule.earliestSchedule(FastDate.now()),picker=document.createElement('div');picker.className='scheduled-picker';picker.innerHTML='<input id="schedule-time" readonly value="'+slot.time+'"><input id="schedule-date" readonly value="'+slot.date+'">';document.body.append(picker);scheduledTimes.push(slot.timestamp);
    by('schedule-time').addEventListener('click',()=>{
     const menu=document.createElement('div');menu.className='tiktok-timepicker-time-picker-container';
     for(let hour=0;hour<24;hour++){const option=document.createElement('button');option.className='tiktok-timepicker-left';option.textContent=String(hour).padStart(2,'0');option.addEventListener('click',()=>{by('schedule-time').value=option.textContent+':'+by('schedule-time').value.split(':')[1];});menu.append(option);}
     for(let minute=0;minute<60;minute+=5){const option=document.createElement('button');option.className='tiktok-timepicker-right';option.textContent=String(minute).padStart(2,'0');option.addEventListener('click',()=>{by('schedule-time').value=by('schedule-time').value.split(':')[0]+':'+option.textContent;scheduledTimes.push(context.UplowWorkSchedule.readSchedule(by('schedule-date').value,by('schedule-time').value).timestamp);menu.remove();});menu.append(option);}
     document.body.append(menu);
    });
   });
  }
 };
 const tiktokUpload=()=>{put('<input id="file" type="file" accept="video/*"><button>Wybierz filmy</button>');wireFile(tiktokUploaded);};
 if(platform==='tiktok'){
  tiktokUpload();
 }else if(platform==='youtube'){
  put('<button id="upload-icon">Prześlij filmy</button>');
  by('upload-icon').addEventListener('click',()=>{
   put('<input type="file" accept="image/*"><ytcp-uploads-file-picker><input id="file" name="Filedata" type="file" aria-hidden="true"></ytcp-uploads-file-picker>');
   wireFile(()=>{
    put('<div role="dialog"><div id="title" contenteditable="true" aria-label="Dodaj tytuł"></div><div id="caption" contenteditable="true" aria-label="Opowiedz widzom"></div><button id="kids" role="radio" aria-checked="false">Nieprzeznaczony dla dzieci</button><button id="visibility" role="tab">Widoczność</button><div id="final"></div></div>');
    by('kids').addEventListener('click',()=>by('kids').setAttribute('aria-checked','true'));
    by('visibility').addEventListener('click',()=>{
     by('final').innerHTML='<button id="public" role="radio" aria-checked="false">Publiczny</button><a href="https://youtube.com/shorts/test123">Link do filmu</a><button id="publish">Opublikuj</button>';
     by('public').addEventListener('click',()=>by('public').setAttribute('aria-checked','true'));wirePublish();
    });
   });
  });
 }else if(platform==='facebook'){
  if(scenario.switchPage){
   put('<nav aria-label="Nawigacja po stronie"><h1>Zarządzanie stroną</h1><button id="switch-page">Przełącz</button></nav>');
   by('switch-page').addEventListener('click',()=>{const d=document.createElement('div');d.setAttribute('role','dialog');d.innerHTML='<h2>Przełącz profil</h2><button id="confirm-switch">Przełącz</button>';document.body.append(d);by('confirm-switch').addEventListener('click',()=>{finish({status:'handoff'});});});
  }else{
  put('<button id="menu">Menu Facebooka</button>');by('menu').addEventListener('click',()=>{put('<div role="dialog"><button id="reel">Rolka</button></div>');by('reel').addEventListener('click',()=>{
   put('<h2>Utwórz rolkę</h2><input type="file" accept="image/*,video/*"><div role="form" aria-label="Rolki"><input id="file" type="file" accept="video/*"></div><input type="file" accept="video/*"><button id="next" disabled>Dalej</button>');
   wireFile(()=>by('next').removeAttribute('disabled'));by('next').addEventListener('click',()=>{put('<h2>Edytuj rolkę</h2><button id="next">Dalej</button>');by('next').addEventListener('click',()=>fbSettings());});
  });});
  }
 }else{
  const igSettings=()=>{
   const english=!!scenario.english,title=english?'New reel':'Nowa rolka';
   const captionField=english?'<div id="caption" role="textbox" contenteditable="true" '+(scenario.captionAttribute||'aria-label')+'="Add a caption..."></div>':caption;
   const disclosure=scenario.noPublicDisclosure?'Your reel will be shared with your followers.':english?'Your reel will be shared with your followers in their feeds and can be seen on your profile. It may also appear in places such as Reels, where anyone can see it.':'Każdy będzie mógł ją zobaczyć';
   put((scenario.backgroundCaption?'<div role="textbox" contenteditable="true" aria-label="Add a caption...">Background draft</div>':'')+(scenario.noPublicDisclosure?'<p>Anyone can see public reels</p>':'')+'<div role="dialog" aria-label="'+title+'"><h1>'+title+'</h1><video id="final-video"></video>'+captionField+'<button id="advanced">'+(english?'Advanced Settings':'Ustawienia zaawansowane')+'</button><div id="options"></div><p id="public-disclosure">'+disclosure+'</p><button id="publish">'+(english?'Share':'Udostępnij')+'</button></div>');
   by('final-video').videoWidth=job.meta.width;by('final-video').videoHeight=job.meta.height;by('final-video').getBoundingClientRect=()=>{const width=320,height=scenario.finalSquare?320:320*job.meta.height/job.meta.width;return {left:0,top:0,right:width,bottom:height,width,height};};
   by('advanced').addEventListener('click',()=>{
    by('options').innerHTML='<button role="switch" aria-checked="true" id="comments">Turn off commenting</button><button role="switch" aria-checked="true" id="likes">Hide like and view counts on this post</button>';
    for(const id of ['comments','likes'])by(id).addEventListener('click',()=>by(id).setAttribute('aria-checked',String(by(id).getAttribute('aria-checked')!=='true')));
   });wirePublish();
  };
  const openCreator=()=>{
   put('<div role="dialog" aria-label="Utwórz nowy post"><h1>Utwórz nowy post</h1></div>');
   const addFile=()=>{const input=document.createElement('input');input.id='file';input.type='file';input.setAttribute('accept','video/mp4');document.querySelector('[role="dialog"]').append(input);wireFile(()=>{
    put('<div role="dialog" aria-label="Crop"><h1>Crop</h1><video id="crop-video"></video><div role="button"><button id="crop-picker"><svg aria-label="'+(scenario.english?'Select crop':'Wybierz kadrowanie')+'"></svg></button></div><div id="crop-options"></div><button id="next">Dalej</button></div>');
    let cropRatio=1;by('crop-video').videoWidth=job.meta.width;by('crop-video').videoHeight=job.meta.height;by('crop-video').getBoundingClientRect=()=>({left:0,top:0,right:320,bottom:320/cropRatio,width:320,height:320/cropRatio});
    by('crop-picker').addEventListener('click',()=>{by('crop-options').innerHTML='<div role="button" id="original">'+(scenario.english?'Original':'Oryginał')+'</div><div role="button">1:1</div>';by('original').addEventListener('click',()=>{originalClicks++;if(!scenario.rejectOriginal)cropRatio=job.meta.width/job.meta.height;});});
    by('next').addEventListener('click',()=>{
     put('<h1>Edytuj</h1><button id="next">Dalej</button>');by('next').addEventListener('click',igSettings);
    });
   });};
   if(scenario.lateInput)setTimeout(addFile,5);else addFile();
  };
  put('<a id="create" role="link"><svg aria-label="Nowy post"></svg></a>');
  by('create').addEventListener('pointerdown',()=>{pointerDown=true;if(scenario.openOnPointer)openCreator();});
  by('create').addEventListener('click',()=>{
   createClicks++;if(scenario.unresponsive||scenario.hydrationDelay&&createClicks===1)return;
   if(scenario.submenuRole){const post=document.createElement('a');post.setAttribute('role',scenario.submenuRole);post.textContent='Post';document.body.append(post);post.addEventListener('click',openCreator);}else openCreator();
  });
 }
 let clock=0;const clockBase=scenario.clockBase??Date.now();class FastDate extends Date{static now(){return clockBase+(clock+=scenario.schedule?1:1000);}}
 class Transfer{constructor(){this.files=[];this.items={add:f=>this.files.push(f)};}}
 const context={document,window,URL,File,DataTransfer:Transfer,Event:window.Event,MouseEvent:window.Event,PointerEvent:window.Event,HTMLTextAreaElement:window.HTMLTextAreaElement,HTMLInputElement:window.HTMLInputElement,Date:FastDate,getComputedStyle:()=>({visibility:'visible'}),crypto:webcrypto,Uint8Array,atob:s=>Buffer.from(s,'base64').toString('binary'),setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,1)),clearTimeout,setInterval:()=>1,clearInterval(){},location:{pathname:'/',href:'https://www.facebook.com/profile.php?id=123456789012345'},chrome:{runtime:{id:'fixture',onMessage:{addListener(fn){receive=fn;}},sendMessage:async m=>{
  messages.push(m);if(m.type==='CHUNK'){
   if(m.asset==='thumbnail'){
    if(scenario.remountCoverInput){by('cover-file').replaceWith(by('cover-file').cloneNode(true));wireCoverInput();}
    const chunk=scenario.corruptCoverChunk?Buffer.alloc(coverBytes.length+1):coverBytes;
    return {ok:true,data:chunk.toString('base64'),length:chunk.length};
   }
   if(scenario.rerenderUpload)tiktokUpload();return {ok:true,data:(corrupt?Buffer.alloc(bytes.length,1):bytes).toString('base64'),length:bytes.length};}
  if(m.type==='PROGRESS'&&m.status==='ready')mutateFinalForm('ready');
  if(m.type==='CHECK'){assertCommit({...job,dryRun:false},{platform,status:'ready'},m.proof,FastDate.now());mutateFinalForm('check');}
  if(m.type==='COMMIT'){assertCommit(job,{platform,status:'ready'},m.proof,FastDate.now());mutateFinalForm('check');}
  if(m.type==='FINISH')finish(m);return {ok:true};
 }}}};
 runInNewContext(helper,context);runInNewContext(pageModule,context);runInNewContext(scheduleModule,context);runInNewContext(scheduleUI,context);runInNewContext(runner,context);
 receive({type:'RUN',job,platform},{id:'fixture'},()=>{});
 const result=await Promise.race([finished,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Runner did not finish fixture')),5000);timer.unref();})]);
 return {result,messages,publishClicks,detachedPublishClicks,publishReplacements,composerReplacements,clockJumps,scheduleActivations,scheduledTimes,changes,detachedChanges,createClicks,originalClicks,pointerDown,deliveredFiles,coverChanges,coverSaves,deliveredCovers};
}

test('Facebook uploads thumbnail bytes in final settings, saves and verifies the cover, including a replaced input',async()=>{
 for(const remountCoverInput of [false,true]){
  const r=await flow('facebook',true,false,{thumbnail:true,remountCoverInput});
  assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.coverChanges,1);assert.equal(r.coverSaves,1);assert.equal(r.publishClicks,0);
  assert.equal(await r.deliveredCovers[0].text(),'distinct thumbnail bytes');assert.equal(r.deliveredCovers[0].name,'miniatura.png');
  assert.ok(r.messages.some(m=>m.type==='CHECK'&&m.proof.thumbnailConfirmed));
 }
});
test('Facebook rejects unavailable, failed, incomplete or unsaved requested covers before publication',async()=>{
 for(const key of ['noCoverInput','rejectCover','corruptCoverChunk','loseCoverOnSave']){
  const r=await flow('facebook',false,false,{thumbnail:true,[key]:true});
  assert.equal(r.publishClicks,0,key);assert.ok(!r.messages.some(m=>m.type==='COMMIT'),key);assert.notEqual(r.result.status,'submitted',key);
 }
});
test('Facebook rechecks saved cover at ready and commit boundaries',async()=>{
 for(const changeCoverOn of ['ready','check']){
  const r=await flow('facebook',false,false,{thumbnail:true,changeCoverOn});assert.equal(r.publishClicks,0);assert.match(r.result.message,/miniatury/);
 }
 const r=await flow('facebook',false,false,{thumbnail:true});assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.publishClicks,0);assert.equal(r.coverSaves,1);
});

test('Facebook Page runner verifies page identity and Public audience, then stops before publication in test mode',async()=>{
 const r=await flow('facebook');assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.publishClicks,0);assert.equal(r.changes,1);assert.ok(r.messages.some(m=>m.type==='CHECK'&&m.proof.privacy==='public'));assert.ok(!r.messages.some(m=>m.type==='COMMIT'));
});
test('real Facebook runner prepares and never publishes even for legacy normal mode (offline fixture)',async()=>{
 const r=await flow('facebook',false);assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.publishClicks,0);assert.equal(r.messages.filter(m=>m.type==='COMMIT').length,0);
});
test('real Instagram runner opens creator with pointer sequence, uploads once and checks caption without posting',async()=>{
 const r=await flow('instagram');assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.changes,1);assert.equal(r.publishClicks,0);assert.ok(r.messages.some(m=>m.type==='CHECK'));
});

test('Instagram legacy normal mode confirms the form and stops before Share (offline)',async()=>{
 const r=await flow('instagram',false,false,{english:true,options:{comments:'on',likeCounts:'show'}});
 assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.publishClicks,0);assert.equal(r.detachedPublishClicks,0);assert.equal(r.messages.filter(m=>m.type==='COMMIT').length,0);assert.ok(r.messages.some(m=>m.type==='CHECK'));
});

test('Instagram checks the current Share after React replaces it during ready or handoff responses',async()=>{
 for(const replacePublishOn of ['ready','check','both']){
  const r=await flow('instagram',false,false,{english:true,options:{comments:'on',likeCounts:'show'},replacePublishOn});
  assert.equal(r.result.status,'draft',replacePublishOn+': '+r.result.message);assert.equal(r.publishReplacements,replacePublishOn==='both'?2:1);assert.equal(r.publishClicks,0);assert.equal(r.detachedPublishClicks,0);assert.equal(r.messages.filter(m=>m.type==='COMMIT').length,0);
 }
});

test('Instagram validates and hands off a replaced whole composer with the same caption, audience and crop',async()=>{
 const r=await flow('instagram',false,false,{english:true,options:{comments:'on',likeCounts:'show'},replaceComposerOn:'check'});
 assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.composerReplacements,1);assert.equal(r.publishClicks,0);assert.equal(r.detachedPublishClicks,0);assert.equal(r.messages.filter(m=>m.type==='COMMIT').length,0);
});

test('Instagram never shares a replaced composer whose public disclosure or crop changed during handoff',async()=>{
 for(const mutation of ['changeDisclosureOn','changeCropOn']){
  const r=await flow('instagram',false,false,{english:true,replaceComposerOn:'check',[mutation]:'check'});
  assert.equal(r.result.status,'blocked',r.result.message);assert.equal(r.composerReplacements,1);assert.equal(r.publishClicks,0);assert.equal(r.detachedPublishClicks,0);assert.equal(r.messages.filter(m=>m.type==='COMMIT').length,0);
 }
});

test('Facebook leaves the current final Publish untouched after replacement during handoff (offline)',async()=>{
 const r=await flow('facebook',false,false,{replacePublishOn:'check'});
 assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.publishReplacements,1);assert.equal(r.publishClicks,0);assert.equal(r.detachedPublishClicks,0);assert.equal(r.messages.filter(m=>m.type==='COMMIT').length,0);
});

test('Instagram rejects a changed caption across the ready or handoff boundary without pressing Share',async()=>{
 for(const changeCaptionOn of ['ready','check']){
  for(const replacePublishOn of [undefined,changeCaptionOn]){
   const r=await flow('instagram',false,false,{english:true,changeCaptionOn,replacePublishOn});
   assert.equal(r.result.status,'blocked',r.result.message);assert.equal(r.publishReplacements,replacePublishOn?1:0);assert.equal(r.publishClicks,0);assert.equal(r.detachedPublishClicks,0);assert.equal(r.messages.filter(m=>m.type==='COMMIT').length,0);
  }
 }
});

test('Instagram dry-run still never clicks final Share when the ready response replaces it',async()=>{
 const r=await flow('instagram',true,false,{english:true,replacePublishOn:'both'});
 assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.publishReplacements,2);assert.equal(r.publishClicks,0);assert.equal(r.detachedPublishClicks,0);assert.equal(r.messages.filter(m=>m.type==='CHECK').length,1);assert.ok(!r.messages.some(m=>m.type==='COMMIT'));
});

test('Instagram fills the English Add a caption field and handles Advanced Settings defaults without publishing',async()=>{
 const caption='Opis filmu\n\n#film #edukacja';
 for(const captionAttribute of ['aria-label','placeholder','data-placeholder','aria-placeholder']){
  const r=await flow('instagram',true,false,{english:true,captionAttribute,backgroundCaption:true,caption,options:{comments:'on',likeCounts:'show'}});
  assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.publishClicks,0);
  const check=r.messages.find(m=>m.type==='CHECK');assert.equal(check.proof.caption,caption);assert.equal(check.proof.options.comments,'on');assert.equal(check.proof.options.likeCounts,'show');
  assert.ok(!r.messages.some(m=>m.type==='COMMIT'));
 }
});

test('Instagram requires the public disclosure in the current composer, not background page text',async()=>{
 const r=await flow('instagram',true,false,{english:true,noPublicDisclosure:true});
 assert.equal(r.result.status,'blocked');assert.match(r.result.message,/Nie potwierdzono publicznej widoczności/);assert.equal(r.publishClicks,0);assert.ok(!r.messages.some(m=>m.type==='CHECK'||m.type==='COMMIT'));
});

test('Instagram changes the default square crop to Original for portrait and square sources',async()=>{
 for(const meta of [{width:720,height:1280,duration:6},{width:1080,height:1350,duration:6},{width:1080,height:1080,duration:6}]){
  const r=await flow('instagram',true,false,{english:true,meta});
  assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.originalClicks,1);assert.equal(r.publishClicks,0);
  const proof=r.messages.find(m=>m.type==='CHECK').proof;assert.equal(proof.aspectRatioConfirmed,true);assert.equal(proof.sourceWidth,meta.width);assert.equal(proof.sourceHeight,meta.height);
 }
});

test('Instagram stops before Next or publication when Original selection leaves a portrait cropped to square',async()=>{
 const r=await flow('instagram',true,false,{english:true,rejectOriginal:true});
 assert.equal(r.result.status,'blocked');assert.equal(r.originalClicks,1);assert.match(r.result.message,/bez przycięcia do kwadratu/);assert.equal(r.publishClicks,0);assert.ok(!r.messages.some(m=>m.type==='CHECK'||m.type==='COMMIT'));
});

test('Instagram rechecks the final reel geometry and blocks a later return to square crop',async()=>{
 const r=await flow('instagram',true,false,{english:true,finalSquare:true});
 assert.equal(r.result.status,'blocked');assert.equal(r.originalClicks,1);assert.match(r.result.message,/oryginalny kadr w gotowej rolce/);assert.equal(r.publishClicks,0);assert.ok(!r.messages.some(m=>m.type==='CHECK'||m.type==='COMMIT'));
});

test('TikTok reports Something went wrong immediately, uploads once and never authorizes publication',async()=>{
 const r=await flow('tiktok');assert.equal(r.result.status,'blocked');assert.match(r.result.message,/Something went wrong/);assert.equal(r.result.diagnostic.code,'TIKTOK_UPLOAD_REJECTED');assert.equal(r.changes,1);assert.ok(!r.messages.some(m=>m.type==='COMMIT'||m.type==='CHECK'));
});
test('corrupt video transfer is detected before attaching a file to TikTok',async()=>{
 const r=await flow('tiktok',true,true);assert.equal(r.result.status,'blocked');assert.match(r.result.message,/Plik zmienił się/);assert.equal(r.changes,0);
});
test('publication is rejected by policy even when a test runner incorrectly sends COMMIT',()=>{
 assert.throws(()=>assertCommit({dryRun:true,privacy:'public',caption:'test'},{platform:'tiktok',status:'ready'},{privacy:'public',privacyConfirmed:true,caption:'test'}),/Tryb testowy/);
});

test('TikTok receives the intact file in the current input after the form rerenders during transfer (offline)',async()=>{
 const r=await flow('tiktok',true,false,{acceptUpload:true,rerenderUpload:true});
 assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.changes,1);assert.equal(r.detachedChanges,0);assert.equal(r.publishClicks,0);
 const [file]=r.deliveredFiles;assert.equal(file.name,'fixture.mp4');assert.equal(file.type,'video/mp4');assert.equal(file.lastModified,1700000000000);assert.equal(await file.text(),'verified video bytes');
});

test('TikTok auto15 prepares the real schedule adapter but dry-run never clicks Schedule',async()=>{
 const r=await flow('tiktok',true,false,{acceptUpload:true,schedule:true});assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.publishClicks,0);
 const proof=r.messages.find(m=>m.type==='CHECK')?.proof;assert.equal(proof?.scheduleConfirmed,true);assert.ok(proof.scheduledAt>Date.now()+14*60000);assert.ok(!r.messages.some(m=>m.type==='COMMIT'));
});

test('TikTok auto15 prepares Schedule without confirming it (offline)',async()=>{
 const r=await flow('tiktok',false,false,{acceptUpload:true,schedule:true});assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.publishClicks,0);
 const checks=r.messages.filter(m=>m.type==='CHECK');assert.equal(checks.length,1);assert.ok(checks[0].proof.scheduledAt);assert.equal(r.result.scheduledAt,undefined);
});

test('TikTok selects the next nearest slot after expiry during ready and leaves scheduling to the user',async()=>{
 const clockBase=new Date(2026,0,15,12,0,0).getTime();
 const r=await flow('tiktok',false,false,{acceptUpload:true,schedule:true,clockBase,expireScheduleOn:'ready'});
 assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.clockJumps,1);assert.equal(r.scheduleActivations,1);assert.equal(r.changes,1);assert.equal(r.scheduledTimes.length,2);
 assert.equal(r.scheduledTimes[1]-r.scheduledTimes[0],5*60000);assert.equal(r.messages.filter(m=>m.type==='PROGRESS'&&m.status==='ready').length,2);
 const checks=r.messages.filter(m=>m.type==='CHECK');assert.equal(checks.length,1);assert.equal(checks[0].proof.scheduledAt,r.scheduledTimes[1]);assert.equal(r.result.scheduledAt,undefined);assert.equal(r.publishClicks,0);assert.equal(r.detachedPublishClicks,0);
});

test('TikTok refreshes a slot that expires during handoff without scheduling',async()=>{
 const r=await flow('tiktok',false,false,{acceptUpload:true,schedule:true,expireScheduleOn:'check'});
 assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.clockJumps,1);assert.equal(r.publishClicks,0);assert.equal(r.changes,1);
 assert.ok(!r.messages.some(m=>m.type==='COMMIT'));assert.equal(r.scheduledTimes.length,2);
});

test('TikTok leaves the fresh Schedule button untouched after its replacement during handoff',async()=>{
 const clockBase=new Date(2026,0,15,12,0,0).getTime();
 const r=await flow('tiktok',false,false,{acceptUpload:true,schedule:true,clockBase,replacePublishOn:'check'});
 assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.publishReplacements,1);assert.equal(r.publishClicks,0);assert.equal(r.detachedPublishClicks,0);assert.equal(r.messages.filter(m=>m.type==='COMMIT').length,0);
});

test('Instagram handles a link or menuitem submenu before selecting a video',async()=>{
 for(const submenuRole of ['link','menuitem']){const r=await flow('instagram',true,false,{submenuRole});assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.createClicks,1);assert.equal(r.changes,1);assert.equal(r.publishClicks,0);}
});

test('Instagram retries an inert Create once the page becomes responsive, without opening another creator',async()=>{
 const r=await flow('instagram',true,false,{hydrationDelay:true,lateInput:true});assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.createClicks,2);assert.equal(r.changes,1);assert.equal(r.publishClicks,0);
});

test('Instagram waits for a modal file input and never clicks a control removed by pointerdown',async()=>{
 const r=await flow('instagram',true,false,{openOnPointer:true,lateInput:true});assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.createClicks,0);assert.equal(r.changes,1);assert.equal(r.publishClicks,0);
});

test('Instagram stops after three ineffective Create attempts without uploading or publishing',async()=>{
 const r=await flow('instagram',true,false,{unresponsive:true});assert.equal(r.result.status,'blocked');assert.equal(r.result.diagnostic.code,'INSTAGRAM_CREATE_UNRESPONSIVE');assert.equal(r.createClicks,3);assert.equal(r.changes,0);assert.equal(r.publishClicks,0);
});


test('Facebook never uploads as a personal profile, another Page, or a legacy job without a Page',async()=>{
 for(const scenario of [{personalActor:true},{wrongPage:true},{noPage:true}]){
  const r=await flow('facebook',false,false,scenario);assert.equal(r.result.status,'blocked',r.result.message);assert.equal(r.changes,0);assert.equal(r.publishClicks,0);assert.ok(!r.messages.some(m=>m.type==='COMMIT'));
 }
});
test('Facebook rechecks numeric Page ID across ready and handoff even when display names match',async()=>{
 for(const changeActorOn of ['ready','check']){
  const r=await flow('facebook',false,false,{changeActorOn});assert.equal(r.result.status,'blocked');assert.equal(r.publishClicks,0);
 }
});

test('Facebook switches using the target Page management panel before any upload and hands off for reload',async()=>{
 const r=await flow('facebook',true,false,{personalActor:true,switchPage:true});assert.equal(r.result.status,'handoff');assert.equal(r.changes,0);assert.equal(r.publishClicks,0);assert.equal(r.messages.filter(m=>m.type==='FACEBOOK_SWITCH').length,1);assert.equal(r.messages.find(m=>m.type==='FACEBOOK_SWITCH').pageId,'123456789012345');assert.ok(!r.messages.some(m=>m.type==='COMMIT'||m.type==='CHECK'));
});

test('YouTube receives the complete video in Filedata without accept and stops before Publish',async()=>{
 const r=await flow('youtube',false);assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.changes,1);assert.equal(await r.deliveredFiles[0].text(),'verified video bytes');assert.equal(r.publishClicks,0);assert.ok(r.messages.some(m=>m.type==='CHECK'));
});

test('TikTok waits for the decoded custom image and saved main cover before handing off',async()=>{
 const r=await flow('tiktok',false,false,{acceptUpload:true,thumbnail:true});assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.coverChanges,1);assert.equal(r.coverSaves,1);assert.equal(await r.deliveredCovers[0].text(),'distinct thumbnail bytes');assert.equal(r.publishClicks,0);
});
test('TikTok never saves an undecoded custom cover or accepts the unchanged default cover',async()=>{
 for(const key of ['rejectCover','loseCoverOnSave']){
  const r=await flow('tiktok',false,false,{acceptUpload:true,thumbnail:true,[key]:true});assert.equal(r.result.status,'blocked',r.result.message);assert.equal(r.publishClicks,0);assert.ok(!r.messages.some(m=>m.type==='CHECK'));if(key==='rejectCover')assert.equal(r.coverSaves,0);
 }
});
