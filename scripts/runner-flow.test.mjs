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

async function flow(platform,dryRun=true,corrupt=false){
 const {document,window}=parseHTML('<html><body></body></html>');
 window.HTMLElement.prototype.getClientRects=function(){return this.hasAttribute('hidden')?[]:[{}];};
 window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};
 Object.defineProperty(window.HTMLElement.prototype,'isContentEditable',{get(){return this.getAttribute('contenteditable')==='true';}});
 let selected;document.createRange=()=>({selectNodeContents(e){selected=e;}});window.getSelection=()=>({removeAllRanges(){},addRange(){}});document.execCommand=(cmd,ui,value)=>{selected.textContent=value;return true;};
 const put=html=>{document.body.innerHTML=html;};const by=id=>document.getElementById(id);
 let publishClicks=0,changes=0,pointerDown=false,receive,finish;const messages=[];
 const finished=new Promise(resolve=>{finish=resolve;});const bytes=Buffer.from('verified video bytes');
 const digest=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
 const job={id:'offline-fixture',attemptId:'attempt',dryRun,filename:'fixture.mp4',mime:'video/mp4',size:bytes.length,caption:'Opis testowy',title:'Film',privacy:'public',kids:false,options:{},digest};
 const wireFile=next=>{by('file').addEventListener('input',()=>{changes++;});by('file').addEventListener('change',()=>{changes++;next();});};
 const wirePublish=()=>by('publish').addEventListener('click',()=>{publishClicks++;put(platform==='facebook'?'Your reel is processing':'Your reel has been shared');});
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
 if(platform==='tiktok'){
  put('<input id="file" type="file" accept="video/*"><button>Wybierz filmy</button>');wireFile(()=>put('<div role="alert">Something went wrong</div>'));
 }else if(platform==='facebook'){
  put('<button id="menu">Menu Facebooka</button>');by('menu').addEventListener('click',()=>{put('<button id="reel">Rolka</button>');by('reel').addEventListener('click',()=>{
   put('<h2>Utwórz rolkę</h2><input type="file" accept="image/*,video/*"><div role="form" aria-label="Rolki"><input id="file" type="file" accept="video/*"></div><input type="file" accept="video/*"><button id="next" disabled>Dalej</button>');
   wireFile(()=>by('next').removeAttribute('disabled'));by('next').addEventListener('click',()=>{put('<h2>Edytuj rolkę</h2><button id="next">Dalej</button>');by('next').addEventListener('click',fbSettings);});
  });});
 }else{
  put('<a id="create" role="link"><svg aria-label="Nowy post"></svg></a>');by('create').addEventListener('pointerdown',()=>{pointerDown=true;});by('create').addEventListener('click',()=>{
   assert.equal(pointerDown,true);put('<h1>Utwórz nowy post</h1><input id="file" type="file" accept="video/mp4">');wireFile(()=>{
    put('<h1>Przytnij</h1><button id="next">Dalej</button>');by('next').addEventListener('click',()=>{
     put('<h1>Edytuj</h1><button id="next">Dalej</button>');by('next').addEventListener('click',()=>{put('<h1>Nowa rolka</h1>'+caption+'<p>Każdy będzie mógł ją zobaczyć</p><button id="publish">Udostępnij</button>');wirePublish();});
    });
   });
  });
 }
 let clock=0;class FastDate extends Date{static now(){return clock+=1000;}}
 class Transfer{constructor(){this.files=[];this.items={add:f=>this.files.push(f)};}}
 const context={document,window,File,DataTransfer:Transfer,Event:window.Event,MouseEvent:window.Event,PointerEvent:window.Event,HTMLTextAreaElement:window.HTMLTextAreaElement,HTMLInputElement:window.HTMLInputElement,Date:FastDate,getComputedStyle:()=>({visibility:'visible'}),crypto:webcrypto,Uint8Array,atob:s=>Buffer.from(s,'base64').toString('binary'),setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,1)),clearTimeout,setInterval:()=>1,clearInterval(){},location:{pathname:'/'},chrome:{runtime:{id:'fixture',onMessage:{addListener(fn){receive=fn;}},sendMessage:async m=>{
  messages.push(m);if(m.type==='CHUNK')return {ok:true,data:(corrupt?Buffer.alloc(bytes.length,1):bytes).toString('base64'),length:bytes.length};
  if(m.type==='CHECK')assertCommit({...job,dryRun:false},{platform,status:'ready'},m.proof);
  if(m.type==='COMMIT')assertCommit(job,{platform,status:'ready'},m.proof);
  if(m.type==='FINISH')finish(m);return {ok:true};
 }}}};
 runInNewContext(helper,context);runInNewContext(runner,context);
 receive({type:'RUN',job,platform},{id:'fixture'},()=>{});
 const result=await Promise.race([finished,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Runner did not finish fixture')),2000);timer.unref();})]);
 return {result,messages,publishClicks,changes,pointerDown};
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

test('TikTok reports Something went wrong immediately, uploads once and never authorizes publication',async()=>{
 const r=await flow('tiktok');assert.equal(r.result.status,'blocked');assert.match(r.result.message,/Something went wrong/);assert.equal(r.result.diagnostic.code,'TIKTOK_UPLOAD_REJECTED');assert.equal(r.changes,1);assert.ok(!r.messages.some(m=>m.type==='COMMIT'||m.type==='CHECK'));
});
test('corrupt video transfer is detected before attaching a file to TikTok',async()=>{
 const r=await flow('tiktok',true,true);assert.equal(r.result.status,'blocked');assert.match(r.result.message,/Plik zmienił się/);assert.equal(r.changes,0);
});
test('publication is rejected by policy even when a test runner incorrectly sends COMMIT',()=>{
 assert.throws(()=>assertCommit({dryRun:true,privacy:'public',caption:'test'},{platform:'tiktok',status:'ready'},{privacy:'public',privacyConfirmed:true,caption:'test'}),/Tryb testowy/);
});
