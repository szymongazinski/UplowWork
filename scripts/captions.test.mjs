import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHashtags,captionPlans} from '../extension/captions.js';
import {assertCommit,validateRequest} from '../extension/policy.js';
import 'fake-indexeddb/auto';
import {createJob} from '../extension/store.js';

test('normalizes prefixes, Polish text and duplicates without accepting punctuation as part of tags',()=>{
 assert.deepEqual(parseHashtags('podróże, #Podróże #żółć\n#2026 #moja_pasja').tags,['#podróże','#żółć','#2026','#moja_pasja']);
 assert.deepEqual(parseHashtags('#zły-tag ##tag #🙂').invalid,['#zły-tag','##tag','#🙂']);
 assert.ok(parseHashtags(null).invalid.length);assert.ok(parseHashtags('a'.repeat(5001)).invalid.length);
});
test('adds a single empty line before the hashtag block and keeps paragraph breaks',()=>{
 const plan=captionPlans('Pierwszy akapit.\n\nDrugi akapit.  \n\n','#podróże #weekend');
 assert.equal(plan.instagram.text,'Pierwszy akapit.\n\nDrugi akapit.\n\n#podróże #weekend');
 assert.equal(captionPlans('Sam opis','').youtube.text,'Sam opis');assert.equal(captionPlans('','#podróże').youtube.text,'#podróże');
});
test('caps per platform transparently and counts tags already in description or YouTube title',()=>{
 const raw=Array.from({length:65},(_,i)=>'#tag'+i).join(' '),plans=captionPlans('Opis',raw);
 assert.equal(plans.instagram.tags.length,5);assert.equal(plans.tiktok.tags.length,5);assert.equal(plans.youtube.tags.length,60);assert.equal(plans.facebook.tags.length,65);
 assert.equal(plans.instagram.omitted,60);assert.equal(plans.youtube.omitted,5);
 const existing=captionPlans('Opis #tag0',raw,'Tytuł #tag1');assert.equal(existing.youtube.count,60);assert.equal(existing.youtube.tags.length,58);assert.ok(!existing.youtube.tags.includes('#tag1'));
 assert.ok(captionPlans('#a #b #c #d #e #f','').instagram.errors.length);
});
test('enforces total caption length including separator and hashtags',()=>{
 assert.equal(captionPlans('a'.repeat(2196),'#a').instagram.text.length,2200);
 assert.equal(captionPlans('a'.repeat(2196),'#a').instagram.errors.length,0);
 assert.ok(captionPlans('a'.repeat(2197),'#a').instagram.errors.length);
 const request={platforms:['instagram'],privacy:'public',caption:'a'.repeat(2197),hashtags:'#a',size:1,mime:'video/mp4',filename:'test.mp4',mediaId:'x',meta:{width:720,height:1280,duration:6}};
 assert.throws(()=>validateRequest(request),/2200/);
});
test('commit checks the exact compiled caption for its platform, including empty line',()=>{
 const plans=captionPlans('Opis','#a #b #c #d #e #f');const job={caption:'Opis',privacy:'public',captions:Object.fromEntries(Object.entries(plans).map(([p,v])=>[p,v.text]))};
 const target={platform:'instagram',status:'ready'},proof={privacy:'public',privacyConfirmed:true,caption:job.captions.instagram};
 assert.doesNotThrow(()=>assertCommit(job,target,proof));assert.throws(()=>assertCommit(job,target,{...proof,caption:job.captions.facebook}));assert.throws(()=>assertCommit(job,target,{...proof,caption:proof.caption.replace('\n\n',' ')}));
});
test('deduplication compares the caption actually sent, including compatibility with old jobs',async()=>{
 const make=(id,caption,captions)=>({id,digest:'clip',privacy:'private',caption,captions,targets:[{platform:'youtube',status:'published',committedAt:100}]});
 await createJob(make('legacy','Opis\n\n#a'));
 await assert.rejects(()=>createJob(make('same','Opis',{youtube:'Opis\n\n#a'})),/już wysyłany/);
 await createJob(make('different','Opis',{youtube:'Opis\n\n#b'}));
});
