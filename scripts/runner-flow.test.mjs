import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseHTML} from 'linkedom';
import {File} from 'node:buffer';
import {webcrypto} from 'node:crypto';
import {assertCommit} from '../extension/policy.js';
const helper=readFileSync(new URL('../extension/dom.js',import.meta.url),'utf8');
const runner=readFileSync(new URL('../extension/runner.js',import.meta.url),'utf8');
const scheduleModule=readFileSync(new URL('../extension/schedule.js',import.meta.url),'utf8');
const scheduleUI=readFileSync(new URL('../extension/tiktok-schedule-ui.js',import.meta.url),'utf8');

async function flow(platform,dryRun=true,corrupt=false,scenario={}){
 const {document,window}=parseHTML('<html><body></body></html>');
 window.HTMLElement.prototype.getClientRects=function(){return this.hasAttribute('hidden')?[]:[{}];};
 window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};
 Object.defineProperty(window.HTMLElement.prototype,'isContentEditable',{get(){return this.getAttribute('contenteditable')==='true';}});
 let selected;document.createRange=()=>({selectNodeContents(e){selected=e;}});window.getSelection=()=>({removeAllRanges(){},addRange(){}});document.execCommand=(cmd,ui,value)=>{selected.replaceChildren(...String(value).split('\n').flatMap((line,i)=>i?[document.createElement('br'),document.createTextNode(line)]:[document.createTextNode(line)]));return true;};
 const put=html=>{document.body.innerHTML=html;};const by=id=>document.getElementById(id);
 let publishClicks=0,changes=0,detachedChanges=0,createClicks=0,originalClicks=0,pointerDown=false,receive,finish;const messages=[],deliveredFiles=[];
 const finished=new Promise(resolve=>{finish=resolve;});const bytes=Buffer.from('verified video bytes');
 const digest=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
 const job={id:'offline-fixture',attemptId:'attempt',dryRun,filename:'fixture.mp4',mime:'video/mp4',lastModified:1700000000000,size:bytes.length,caption:scenario.caption||'Opis testowy',title:'Film',privacy:'public',kids:false,options:scenario.options||{},meta:scenario.meta||{width:720,height:1280,duration:6},digest};
 if(scenario.schedule)job.tiktokSchedule='auto15';
 const wireFile=next=>{const input=by('file');input.addEventListener('input',()=>{changes++;});input.addEventListener('change',()=>{if(!input.isConnected){detachedChanges++;return;}changes++;deliveredFiles.push(...input.files);next();});};
 const wirePublish=()=>by('publish').addEventListener('click',()=>{publishClicks++;put(platform==='facebook'?'Your reel is processing':platform==='tiktok'?'<div role="status">Your video has been scheduled</div>':'Your reel has been shared');});
 const caption='<div id="caption" role="textbox" contenteditable="true" aria-label="Dodaj opis..."></div>';
 const fbSettings=()=>{
  put('<div role="dialog" aria-label="Ustawienia rolki"><h2>Ustawienia rolki</h2>'+caption+'<button id="audience">Znajomi Twoi znajomi na Facebooku</button><button id="publish">Opublikuj</button></div>');
  by('audience').addEventListener('click',()=>{
   const modal=document.createElement('div');modal.setAttribute('role','dialog');modal.setAttribute('aria-label','Wybierz grupę odbiorców');
   modal.innerHTML='<label>Publiczne Każdy na Facebooku i poza nim<input id="public" type="radio" aria-checked="false"></label><label>Znajomi Twoi znajomi na Facebooku<input type="radio" aria-checked="true"></label><button id="done">Gotowe</button>';document.body.append(modal);
   by('public').addEventListener('click',()=>{by('public').setAttribute('aria-checked','true');});
   by('done').addEventListener('click',()=>{assert.equal(by('public').getAttribute('aria-checked'),'true');modal.remove();by('audience').textContent='Publiczne Każdy na Facebooku i poza nim';});
  });wirePublish();
 };
 const tiktokUploaded=()=>{
  if(!scenario.acceptUpload){put('<div role="alert">Something went wrong</div>');return;}
  put('<p>Uploaded</p><div id="caption" role="combobox" contenteditable="true"></div><button id="privacy" role="combobox">Everyone</button><button id="publish">Post</button>');
  by('privacy').addEventListener('click',()=>{const option=document.createElement('div');option.setAttribute('role','option');option.textContent='Everyone';document.body.append(option);option.addEventListener('click',()=>option.remove());});wirePublish();
  if(scenario.schedule){
   const radio=document.createElement('input');radio.type='radio';radio.name='postSchedule';radio.value='schedule';radio.setAttribute('aria-checked','false');document.body.append(radio);
   radio.addEventListener('click',()=>{
    radio.setAttribute('aria-checked','true');by('publish').textContent='Schedule';
    const slot=context.UplowWorkSchedule.earliestSchedule(FastDate.now()+2000),picker=document.createElement('div');picker.className='scheduled-picker';picker.innerHTML='<input readonly value="'+slot.time+'"><input readonly value="'+slot.date+'">';document.body.append(picker);
   });
  }
 };
 const tiktokUpload=()=>{put('<input id="file" type="file" accept="video/*"><button>Wybierz filmy</button>');wireFile(tiktokUploaded);};
 if(platform==='tiktok'){
  tiktokUpload();
 }else if(platform==='facebook'){
  put('<button id="menu">Menu Facebooka</button>');by('menu').addEventListener('click',()=>{put('<button id="reel">Rolka</button>');by('reel').addEventListener('click',()=>{
   put('<h2>Utwórz rolkę</h2><input type="file" accept="image/*,video/*"><div role="form" aria-label="Rolki"><input id="file" type="file" accept="video/*"></div><input type="file" accept="video/*"><button id="next" disabled>Dalej</button>');
   wireFile(()=>by('next').removeAttribute('disabled'));by('next').addEventListener('click',()=>{put('<h2>Edytuj rolkę</h2><button id="next">Dalej</button>');by('next').addEventListener('click',fbSettings);});
  });});
 }else{
  const igSettings=()=>{
   const english=!!scenario.english,title=english?'New reel':'Nowa rolka';
   const captionField=english?'<div id="caption" role="textbox" contenteditable="true" '+(scenario.captionAttribute||'aria-label')+'="Add a caption..."></div>':caption;
   const disclosure=scenario.noPublicDisclosure?'Your reel will be shared with your followers.':english?'Your reel will be shared with your followers in their feeds and can be seen on your profile. It may also appear in places such as Reels, where anyone can see it.':'Każdy będzie mógł ją zobaczyć';
   put((scenario.backgroundCaption?'<div role="textbox" contenteditable="true" aria-label="Add a caption...">Background draft</div>':'')+(scenario.noPublicDisclosure?'<p>Anyone can see public reels</p>':'')+'<div role="dialog" aria-label="'+title+'"><h1>'+title+'</h1><video id="final-video"></video>'+captionField+'<button id="advanced">'+(english?'Advanced Settings':'Ustawienia zaawansowane')+'</button><div id="options"></div><p>'+disclosure+'</p><button id="publish">'+(english?'Share':'Udostępnij')+'</button></div>');
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
 let clock=0;const clockBase=Date.now();class FastDate extends Date{static now(){return clockBase+(clock+=scenario.schedule?1:1000);}}
 class Transfer{constructor(){this.files=[];this.items={add:f=>this.files.push(f)};}}
 const context={document,window,File,DataTransfer:Transfer,Event:window.Event,MouseEvent:window.Event,PointerEvent:window.Event,HTMLTextAreaElement:window.HTMLTextAreaElement,HTMLInputElement:window.HTMLInputElement,Date:FastDate,getComputedStyle:()=>({visibility:'visible'}),crypto:webcrypto,Uint8Array,atob:s=>Buffer.from(s,'base64').toString('binary'),setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,1)),clearTimeout,setInterval:()=>1,clearInterval(){},location:{pathname:'/'},chrome:{runtime:{id:'fixture',onMessage:{addListener(fn){receive=fn;}},sendMessage:async m=>{
  messages.push(m);if(m.type==='CHUNK'){if(scenario.rerenderUpload)tiktokUpload();return {ok:true,data:(corrupt?Buffer.alloc(bytes.length,1):bytes).toString('base64'),length:bytes.length};}
  if(m.type==='CHECK')assertCommit({...job,dryRun:false},{platform,status:'ready'},m.proof,FastDate.now());
  if(m.type==='COMMIT')assertCommit(job,{platform,status:'ready'},m.proof,FastDate.now());
  if(m.type==='FINISH')finish(m);return {ok:true};
 }}}};
 runInNewContext(helper,context);runInNewContext(scheduleModule,context);runInNewContext(scheduleUI,context);runInNewContext(runner,context);
 receive({type:'RUN',job,platform},{id:'fixture'},()=>{});
 const result=await Promise.race([finished,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Runner did not finish fixture')),2000);timer.unref();})]);
 return {result,messages,publishClicks,changes,detachedChanges,createClicks,originalClicks,pointerDown,deliveredFiles};
}

test('real Facebook runner selects native Public radio, validates it and stops before publication in test mode',async()=>{
 const r=await flow('facebook');assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.publishClicks,0);assert.equal(r.changes,1);assert.ok(r.messages.some(m=>m.type==='CHECK'&&m.proof.privacy==='public'));assert.ok(!r.messages.some(m=>m.type==='COMMIT'));
});
test('real Facebook runner automatically publishes after confirming Public in normal mode (offline fixture)',async()=>{
 const r=await flow('facebook',false);assert.equal(r.result.status,'submitted',r.result.message);assert.equal(r.publishClicks,1);assert.equal(r.messages.filter(m=>m.type==='COMMIT').length,1);
});
test('real Instagram runner opens creator with pointer sequence, uploads once and checks caption without posting',async()=>{
 const r=await flow('instagram');assert.equal(r.result.status,'draft',r.result.message);assert.equal(r.changes,1);assert.equal(r.publishClicks,0);assert.ok(r.messages.some(m=>m.type==='CHECK'));
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

test('TikTok auto15 commits Schedule once and records explicit scheduled confirmation (offline)',async()=>{
 const r=await flow('tiktok',false,false,{acceptUpload:true,schedule:true});assert.equal(r.result.status,'scheduled',r.result.message);assert.equal(r.publishClicks,1);
 const commits=r.messages.filter(m=>m.type==='COMMIT');assert.equal(commits.length,1);assert.equal(r.result.scheduledAt,commits[0].proof.scheduledAt);
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
