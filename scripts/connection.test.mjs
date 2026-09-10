import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parseHTML} from 'linkedom';

const helpers=readFileSync(new URL('../extension/dom.js',import.meta.url),'utf8');
const runner=readFileSync(new URL('../extension/runner.js',import.meta.url),'utf8');
function page(html){
 const {document}=parseHTML('<html><body>'+html+'</body></html>');
 for(const e of document.querySelectorAll('*'))e.getClientRects=()=>e.hasAttribute('hidden')?[]:[{}];
 let receive;
 const context={document,getComputedStyle:e=>({visibility:'visible',objectFit:e.style.objectFit,objectPosition:e.style.objectPosition,overflow:e.style.overflow,overflowX:e.style.overflowX,overflowY:e.style.overflowY}),setTimeout,clearTimeout,setInterval,clearInterval,
 chrome:{runtime:{id:'test-extension',onMessage:{addListener(fn){receive=fn;}}}}};
 runInNewContext(helpers,context);runInNewContext(runner,context);
 return {dom:context.UplowWorkDOM,find:()=>context.UplowWorkDOM.instagramCreate(),probe:()=>new Promise(resolve=>receive({type:'PROBE',platform:'instagram'},{id:'test-extension'},resolve))};
}
test('Instagram icon without visible text or SVG title is recognized',async()=>{
 const p=page('<a href="#" role="link"><svg aria-label="Nowy post" role="img"></svg></a>');
 assert.ok(p.find());const result=await p.probe();assert.equal(result.connected,true);assert.equal(result.label,'Zalogowano · Instagram');
});
test('Instagram desktop Create button and Polish Utwórz both work',async()=>{
 for(const html of ['<button>Utwórz</button>','<div role="button" aria-label="Create"><svg></svg></div>','<a role="link"><span>Utwórz</span><svg aria-label="Nowy post"><title>Nowy post</title></svg></a>']){const p=page(html);assert.ok(p.find());assert.equal((await p.probe()).connected,true);}
});
test('login screen, anonymous navigation, hidden or ambiguous controls cannot confirm a session',()=>{
 for(const html of ['<a href="/explore/">Explore</a><a href="/accounts/login/">Log in</a>','<input type="password"><button>Create</button>','<button hidden>Create</button>','<button>Create</button><a role="link">New post</a>'])assert.equal(page(html).find(),null);
});
test('nested clickable wrappers resolve to one actual control',()=>{
 const p=page('<div role="button"><a role="link" id="create"><svg aria-label="Nowy post"></svg></a></div>');assert.equal(p.find().id,'create');
});
test('connect all reuses tabs, retains all four account results and only sends read-only probes',async()=>{
 const state={connectTabs:{instagram:999}},tabs=[{id:10,url:'https://www.instagram.com/',status:'complete',active:false}];
 const sent=[],injected=[];let handler;let nextId=20;
 const event=()=>({addListener(){}});
 globalThis.chrome={action:{onClicked:event()},alarms:{create:async()=>{},onAlarm:event()},scripting:{executeScript:async args=>injected.push(args)},
  storage:{local:{get:async()=>structuredClone(state),set:async value=>Object.assign(state,structuredClone(value))}},
  runtime:{id:'test-extension',getURL:p=>'chrome-extension://test-extension/'+p,onInstalled:event(),onStartup:event(),onMessage:{addListener(fn){handler=fn;}}},
  tabs:{onUpdated:event(),onRemoved:event(),get:async id=>{const t=tabs.find(t=>t.id===id);if(!t)throw Error('closed');return t;},
   query:async({url})=>tabs.filter(t=>t.url.startsWith(url.replace('*',''))),
   create:async({url})=>{const t={id:nextId++,url,status:'complete',active:false};tabs.push(t);return t;},
   update:async(id,changes)=>Object.assign(tabs.find(t=>t.id===id),changes),
   sendMessage:async(id,message)=>{sent.push(message);await new Promise(r=>setTimeout(r,message.platform==='instagram'?5:1));return {connected:true,label:'Zalogowano · '+message.platform};}}};
 try{await import('../extension/background.js');
  const request=()=>new Promise(resolve=>handler({type:'CONNECT_ALL'},{id:'test-extension',url:'chrome-extension://test-extension/index.html'},resolve));
  const results=await Promise.all([request(),request()]);assert.ok(results.every(r=>r.ok));
  assert.equal(tabs.length,4);assert.equal(state.connectTabs.instagram,10);
  assert.deepEqual(Object.keys(state.accounts).sort(),['facebook','instagram','tiktok','youtube']);
  assert.ok(Object.values(state.accounts).every(a=>a.connected&&!a.checking));
  assert.ok(sent.every(m=>m.type==='PROBE'));assert.equal(sent.length,8);
  assert.ok(injected.every(i=>i.files.join(',')==='dom.js,schedule.js,tiktok-schedule-ui.js,runner.js'));
 }finally{delete globalThis.chrome;}
});

test('Facebook selects the reel form input when unrelated post and duplicate upload inputs exist',()=>{
 const p=page('<h2>Utwórz rolkę</h2><input id="post" type="file" accept="image/*,video/*"><div role="form" aria-label="Rolki"><input id="reel" type="file" accept="video/*"></div><input id="duplicate" type="file" accept="video/*">');
 assert.equal(p.dom.videoInput('facebook').id,'reel');assert.equal(p.dom.facebookReelStage(/^Utwórz rolkę$/),true);
 const wrong=page('<h2>Utwórz post</h2><input type="file" accept="video/*">');assert.equal(wrong.dom.videoInput('facebook'),null);assert.equal(wrong.dom.facebookReelStage(/^Utwórz rolkę$/),false);
});
test('hidden background controls cannot make Instagram create ambiguous or confirm a reel',()=>{
 const p=page('<div aria-hidden="true"><a>Nowy post</a><h2>Utwórz rolkę</h2></div><button id="visible">Utwórz</button>');assert.equal(p.find().id,'visible');assert.equal(p.dom.facebookReelStage(/^Utwórz rolkę$/),false);
});

test('Instagram attaches only to the active creator, never a message or dormant composer',()=>{
 const p=page('<input id="message" type="file" accept="image/*,video/*"><div role="dialog" aria-label="Utwórz nowy post" aria-hidden="true"><input id="stale" type="file" accept="video/*"></div><div role="dialog" aria-label="Utwórz nowy post"><input id="active" hidden type="file" accept="video/mp4,video/quicktime"></div>');
 assert.equal(p.dom.videoInput('instagram').id,'active');
 assert.equal(page('<input type="file" accept="video/*">').dom.videoInput('instagram'),null);
 const ambiguous=page('<div role="dialog" aria-label="Utwórz nowy post"><input type="file" accept="video/*"><input type="file" accept="video/*"></div>');assert.equal(ambiguous.dom.videoInput('instagram'),null);
});

test('Instagram caption lookup supports both English hints and scopes editable fields to the active composer',()=>{
 for(const hint of ['Add a caption...','Write a caption…','Dodaj opis...']){
  const p=page('<textarea aria-label="Add a caption...">Background</textarea><div role="dialog" aria-label="New reel"><h1>New reel</h1><textarea id="caption" aria-label="Caption editor" placeholder="'+hint+'"></textarea></div>');
  assert.equal(p.dom.instagramCaption().id,'caption');
 }
 assert.equal(page('<div contenteditable="true" aria-label="Add a caption..."></div>').dom.instagramCaption(),null);
 const ambiguous=page('<div role="dialog" aria-label="New reel"><h1>New reel</h1><textarea placeholder="Add a caption..."></textarea><div contenteditable="true" data-placeholder="Add a caption..."></div></div>');
 assert.equal(ambiguous.dom.instagramCaption(),null);
});

test('Instagram crop verification rejects the live square clipping layout and accepts Original pixel rounding',()=>{
 const p=page('<div role="dialog" aria-label="Crop"><h1>Crop</h1><div id="outer" style="overflow:visible"><div id="clip" style="overflow:hidden"><div id="frame"><video style="object-fit:cover"></video></div></div></div></div>');
 const composer=p.dom.instagramComposer(),video=composer.querySelector('video'),clip=composer.querySelector('#clip'),frame=composer.querySelector('#frame');
 const rect=(width,height)=>({left:100,top:100,right:100+width,bottom:100+height,width,height});
 video.videoWidth=720;video.videoHeight=1280;
 video.getBoundingClientRect=()=>rect(501,893.242);frame.getBoundingClientRect=video.getBoundingClientRect;clip.getBoundingClientRect=()=>rect(501,501);
 assert.equal(p.dom.instagramUncroppedPreview({width:720,height:1280}),false,'natural video dimensions must not hide its clipped bottom');
 video.getBoundingClientRect=()=>rect(281,501);frame.getBoundingClientRect=video.getBoundingClientRect;clip.getBoundingClientRect=video.getBoundingClientRect;
 assert.equal(p.dom.instagramUncroppedPreview({width:720,height:1280}),true,'Original layout preserves the full source within normal pixel rounding');
 clip.getBoundingClientRect=()=>rect(240,501);
 assert.equal(p.dom.instagramUncroppedPreview({width:720,height:1280}),false,'horizontal clipping must also fail');
});
