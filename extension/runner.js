// Isolated-world content script. Reads and operates the visible publishing UI;
// it does not read cookies, passwords, internal APIs or page application stores.
(()=>{
 if(globalThis.__wrzutkaInstalled==='0.1.1')return;globalThis.__wrzutkaInstalled='0.1.1';
 const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
 const visible=e=>e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
 const enabled=e=>e&&!e.disabled&&e.getAttribute('aria-disabled')!=='true';
 const label=e=>norm(e.getAttribute('aria-label')||e.innerText||e.textContent);
 const all=(selector,root=document)=>[...root.querySelectorAll(selector)].filter(visible);
 const matches=(value,test)=>test instanceof RegExp?test.test(value):value===test;
 function unique(elements,description){if(elements.length!==1)throw new Error(elements.length?'Niejednoznaczny element: '+description:'Nie znaleziono: '+description);return elements[0];}
 function controls(test,role='button',root=document){const hits=all(role==='button'?'button,[role="button"]':`[role="${role}"]`,root).filter(e=>matches(label(e),test));return hits.filter(e=>!hits.some(other=>other!==e&&e.contains(other)));}
 function control(test,role='button',root=document){const hits=controls(test,role,root);return hits.length===1?hits[0]:null;}
 function exactText(test,root=document){const hits=all('button,[role="button"],span,div,label',root).filter(e=>matches(norm(e.innerText),test));return hits.filter(e=>!hits.some(other=>other!==e&&e.contains(other)))[0]||null;}
 const text=()=>norm(document.body.innerText);
 const click=e=>{if(!e||!visible(e)||!enabled(e))throw new Error('Element formularza nie jest gotowy.');e.click();};
 const checked=e=>e?.getAttribute('aria-checked')==='true'||e?.checked===true||e?.getAttribute('data-state')==='checked';
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 let cancelled=false,running=false,committed=false;
 async function wait(fn,description,timeout=60000){const start=Date.now();while(Date.now()-start<timeout){if(cancelled&&!committed)throw new Error('Wysyłka zatrzymana.');const value=fn();if(value)return value;if(all('iframe').some(e=>/captcha/i.test(e.getAttribute('title')||'')))throw new Error('Platforma wymaga weryfikacji w przeglądarce.');await delay(400);}throw new Error('Nie potwierdzono: '+description+'. Sprawdź kartę platformy.');}
 async function press(test,role='button',root=document,timeout=60000){const e=await wait(()=>{const e=control(test,role,root);return enabled(e)?e:null;},String(test),timeout);click(e);return e;}
 function fill(e,value){if(!visible(e))throw new Error('Pole tekstowe nie jest widoczne.');e.focus();if(e.isContentEditable){const selection=window.getSelection();const range=document.createRange();range.selectNodeContents(e);selection.removeAllRanges();selection.addRange(range);if(!document.execCommand('insertText',false,value)){e.textContent=value;e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));}}else{const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}if(norm(e.isContentEditable?e.innerText:e.value)!==norm(value))throw new Error('Nie udało się zapisać tekstu.');}
 function field(pattern){const hits=all('textarea,input:not([type=file]),[contenteditable="true"]').filter(e=>matches(norm(e.getAttribute('aria-label')||e.getAttribute('placeholder')||''),pattern));return hits.length===1?hits[0]:null;}
 function editable(role){const hits=all('[contenteditable="true"]').filter(e=>(!role||e.getAttribute('role')===role)&&!/(Napisz do:|Message to:|Napisz wiadomość|Write a message)/i.test(e.getAttribute('aria-label')||''));return hits.length===1?hits[0]:null;}
 const send=(job,platform,type,data={})=>chrome.runtime.sendMessage({id:job.id,platform,type,...data}).then(r=>{if(!r?.ok)throw new Error(r?.error||'Brak odpowiedzi UplowWork.');return r;});
 async function video(job,platform){const parts=[];for(let offset=0;offset<job.size;){const r=await send(job,platform,'CHUNK',{offset});const data=Uint8Array.from(atob(r.data),c=>c.charCodeAt(0));if(!data.length||data.length!==r.length)throw new Error('Nieprawidłowy fragment filmu.');parts.push(data);offset+=data.length;}const file=new File(parts,job.filename,{type:job.mime});if(file.size!==job.size)throw new Error('Niepełny plik.');return file;}
 async function attach(job,platform){const input=await wait(()=>{let inputs=[...document.querySelectorAll('input[type="file"]')].filter(e=>{const accept=e.getAttribute('accept')||'';return !accept||/video|mp4|mov|webm/i.test(accept);});if(inputs.length>1){const scoped=inputs.filter(e=>{const dialog=e.closest('[role="dialog"]');return visible(dialog)&&/Utwórz rolkę|Create reel|Prześlij filmy|Upload videos|Utwórz nowy post|Create new post/i.test(dialog.innerText);});if(scoped.length===1)inputs=scoped;}return inputs.length===1?inputs[0]:null;},'pole wyboru filmu');await send(job,platform,'PROGRESS',{status:'uploading',message:'Przesyłanie filmu do platformy.'});const f=await video(job,platform);const dt=new DataTransfer();dt.items.add(f);input.files=dt.files;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
 function read(e){return norm(e.isContentEditable?e.innerText:e.value);}
 function findToggle(pattern){
  const selector='input[type="checkbox"],[role="checkbox"],[role="switch"]';
  const direct=all(selector).filter(e=>matches(norm(e.getAttribute('aria-label')||[...(e.labels||[])].map(l=>l.innerText).join(' ')||label(e)),pattern));
  if(direct.length===1)return direct[0];
  let row=exactText(pattern);
  for(let i=0;i<6&&row;i++,row=row.parentElement){const hits=[...row.querySelectorAll(selector)];if(hits.length===1)return hits[0];if(hits.length>1)return null;}
  return null;
 }
 async function toggle(pattern,value,confirmAI=false){
  const e=await wait(()=>findToggle(pattern),'ustawienie '+pattern);
  const state=()=>{const current=findToggle(pattern);if(!current)return null;return current.parentElement?.hasAttribute('aria-checked')?current.parentElement.getAttribute('aria-checked')==='true':checked(current);};
  if(state()!==value){let target=e;if(!visible(e)||e.getAttribute('aria-hidden')==='true')target=e.closest('label')||e.parentElement;if(!enabled(e))throw new Error('Platforma nie pozwala zmienić opcji: '+pattern);click(target);}
  if(confirmAI){await wait(()=>{const confirm=control(/^(Włącz|Turn on)$/);if(confirm&&/Oznaczanie treści wygenerowanych przez AI|Labeling AI-generated content/i.test(text())){click(confirm);return true;}return state()===value;},'potwierdzenie etykiety AI');}
  await wait(()=>state()===value,'potwierdzenie opcji '+pattern);return value;
 }
 async function extraOptions(job,platform){
  const options={},requested=job.options||{};let syntheticConfirmed=!job.synthetic;
  const needs=job.synthetic||Object.values(requested).some(v=>v!=='default');
  if(platform==='tiktok'&&needs){const more=exactText(/^(Pokaż więcej|Show more)$/);if(more)click(more);}
  if(platform==='youtube'&&needs){const more=control(/^(Pokaż więcej|Show more|Pokaż ustawienia zaawansowane)$/);if(more)click(more);}
  if(platform==='instagram'&&(requested.comments&&requested.comments!=='default'||requested.likeCounts&&requested.likeCounts!=='default')){await press(/^(Ustawienia zaawansowane|Advanced settings)$/);}
  if(requested.comments&&requested.comments!=='default'&&['tiktok','instagram','youtube'].includes(platform)){
   let value=requested.comments;
   if(platform==='youtube'&&job.kids)value='off';
   else if(platform==='youtube'){
    await press(/^(Komentarze|Comments) (Włączone|Wyłączone|Wstrzymane|On|Off|Paused)$/);
    click(await wait(()=>exactText(value==='on'?/^(Włączone|On)$/:/^(Wyłączone|Off)$/),'wybór komentarzy'));
    await wait(()=>control(value==='on'?/^(Komentarze Włączone|Comments On)$/:/^(Komentarze Wyłączone|Comments Off)$/),'stan komentarzy');
   }else await toggle(platform==='tiktok'?/^(Komentarz|Comments)$/:/^(Wyłącz komentowanie|Turn off commenting)$/,platform==='tiktok'?value==='on':value==='off');
   options.comments=value;
  }
  if(requested.likeCounts&&requested.likeCounts!=='default'&&['youtube','instagram'].includes(platform)){
   await toggle(platform==='youtube'?/^(Pokaż, ilu widzom podoba się ten film|Show how many viewers like this video)$/:/^(Ukryj (liczbę polubień i wyświetleń|liczby polubień i wyświetleń).*|Hide like and view counts.*)$/,platform==='youtube'?requested.likeCounts==='show':requested.likeCounts==='hide');options.likeCounts=requested.likeCounts;
  }
  if(platform==='youtube'){
   if(requested.paidPromotion&&requested.paidPromotion!=='default'){
    const e=await press(requested.paidPromotion==='yes'?/^(Tak, mój film zawiera płatną promocję|Yes, my video contains paid promotion)$/:/^(Nie, mój film nie zawiera płatnej promocji|No, my video does not contain paid promotion)$/,'radio');await wait(()=>checked(e),'płatna promocja');options.paidPromotion=requested.paidPromotion;
   }
   if(requested.embedding&&requested.embedding!=='default'){await toggle(/^(Zezwalaj na umieszczanie na innych stronach|Zezwalaj na umieszczanie|Allow embedding)$/,requested.embedding==='on');options.embedding=requested.embedding;}
  }
  if(job.synthetic){
   if(platform==='youtube'){const ai=await press(/^(Tak, użyto AI|Yes, AI was used)$/,'radio');syntheticConfirmed=!!await wait(()=>checked(ai),'oznaczenie AI');}
   else{await toggle(platform==='tiktok'?/^(Treść wygenerowana przez AI|AI-generated content)$/:/^(Dodaj etykietę SI|Add AI label)$/,true,platform==='tiktok');syntheticConfirmed=true;}
  }
  return {options,syntheticConfirmed};
 }
 async function authorize(job,platform,proof,button){await send(job,platform,'PROGRESS',{status:'ready',message:'Sprawdzono opis i ustawienie widoczności.'});await send(job,platform,'COMMIT',{proof});committed=true;if(!enabled(button)||!visible(button))throw new Error('Przycisk publikacji zmienił stan.');click(button);}
 async function tiktok(job){
  await wait(()=>control(/^(Wybierz filmy|Select videos)$/)||document.querySelector('input[type="file"]'),'zalogowanie do TikTok Studio');await attach(job,'tiktok');
  const caption=await wait(()=>editable('combobox'),'opis TikToka');fill(caption,job.caption);
  const hint=control(/^(Rozumiem|Got it)$/);if(hint)click(hint);
  const privacy=await wait(()=>all('[role="combobox"]').find(e=>/^(Wszyscy|Everyone|Tylko Ty|Only you|Znajomi|Friends)$/.test(label(e))),'wybór widoczności TikToka');
  click(privacy);const option=await wait(()=>control(job.privacy==='private'?/^(Tylko Ty|Only you)$/:/^(Wszyscy|Everyone)$/,'option'),'opcja widoczności');click(option);
  const expected=job.privacy==='private'?/^(Tylko Ty|Only you)$/:/^(Wszyscy|Everyone)$/;
  await wait(()=>expected.test(label(privacy)),'ustawiona widoczność');
  const extra=await extraOptions(job,'tiktok');
  await wait(()=>/Przesłano|Uploaded/.test(text()),'zakończenie przesyłania',600000);
  const publish=await wait(()=>{const e=control(/^(Opublikuj|Post)$/);return enabled(e)&&e;},'gotowość do publikacji',600000);
  if(read(caption)!==norm(job.caption)||!expected.test(label(privacy)))throw new Error('Opis lub prywatność uległy zmianie.');
  await authorize(job,'tiktok',{privacy:job.privacy,privacyConfirmed:true,caption:job.caption,...extra},publish);
  // The content-check confirmation is optional and is not a second publish attempt.
  await wait(()=>{const confirm=control(/^(Opublikuj teraz|Post now)$/);if(confirm&&/Wciąż sprawdzamy|still checking/i.test(text())){click(confirm);return true;}return /\/tiktokstudio\/content/.test(location.pathname);},'potwierdzenie publikacji',120000);
  const result=await wait(()=>all('a[href*="/video/"]').find(a=>norm(a.innerText)===norm(job.caption)),'film na liście treści',120000);
  let row=result.parentElement;for(let i=0;i<5&&row;i++,row=row.parentElement){const privacyButton=controls(job.privacy==='private'?/^(Tylko ja|Only me|Only you)$/:/^(Wszyscy|Everyone)$/,'button',row);if(privacyButton.length===1&&all('a[href*="/video/"]',row).length===1){return {status:'published',message:job.privacy==='private'?'Potwierdzono na liście: Tylko ja.':'Potwierdzono na liście: Wszyscy.',url:result.href};}}
  return {status:'submitted',message:'Film jest na liście. Sprawdź końcową widoczność na platformie.',url:result.href};
 }
 async function youtube(job){
  const upload=await wait(()=>{const e=document.getElementById('upload-icon');return visible(e)&&enabled(e)?e:control(/^(Prześlij filmy|Upload videos)$/);},'przycisk przesyłania YouTube');click(upload);await attach(job,'youtube');
  const title=await wait(()=>field(/^(Dodaj tytuł|Add a title)/),'tytuł YouTube');fill(title,job.title);
  const description=await wait(()=>field(/^(Opowiedz widzom|Tell viewers)/),'opis YouTube');fill(description,job.caption);
  const audience=await press(job.kids?/^(Przeznaczony dla dzieci|Yes, it.s made for kids)/:/^(Nieprzeznaczony dla dzieci|No, it.s not made for kids)$/,'radio');await wait(()=>checked(audience),'odbiorcy YouTube');
  const extra=await extraOptions(job,'youtube');
  if(read(title)!==norm(job.title)||read(description)!==norm(job.caption))throw new Error('YouTube nie zapisał tekstu.');
  await press(/^(Widoczność|Visibility)$/,'tab');
  const privacy=await press(job.privacy==='private'?/^(Prywatny|Private)$/:/^(Publiczny|Public)$/,'radio');await wait(()=>checked(privacy),'widoczność YouTube');
  const link=await wait(()=>all('a').find(a=>/^https:\/\/(www\.)?youtube\.com\/(shorts\/|watch\?v=)/.test(a.href)),'link do filmu');
  const url=link.href;const videoUrl=new URL(url);const videoId=videoUrl.searchParams.get('v')||videoUrl.pathname.split('/').pop();
  await wait(()=>!/Przetwarzam do SD|Processing.*SD|Przetwarzanie rozpocznie|Processing will begin/i.test(text()),'przetworzenie filmu',600000);
  const save=await wait(()=>{const e=control(job.privacy==='private'?/^(Zapisz|Save)$/:/^(Opublikuj|Publish)$/);return enabled(e)&&e;},'przycisk zapisu');
  if(!checked(privacy))throw new Error('Nie potwierdzono widoczności YouTube.');
  await authorize(job,'youtube',{privacy:job.privacy,privacyConfirmed:true,caption:job.caption,title:job.title,kids:job.kids,...extra},save);
  await wait(()=>!visible(save)||!document.contains(save)||/Film opublikowany|Video published|Film został zapisany|Video saved/.test(text()),'zapis YouTube',120000);
  // An explicit saved confirmation is required; closing the dialog alone is not a publication proof.
  const contentLink=all('a').find(a=>/\/content(?:\?|$|\/)/.test(a.href)&&/Treści|Content/.test(label(a)));
  const contentControl=contentLink||exactText(/^(Treści|Content)$/);
  if(contentControl){click(contentControl);const rowLink=await wait(()=>all('a').find(a=>a.href.includes(`/video/${videoId}/`)&&label(a).includes(job.title)),'zapisany film na kanale',120000);let row=rowLink.parentElement;for(let i=0;i<6&&row;i++,row=row.parentElement){const expected=job.privacy==='private'?/Prywatny|Private/:/Publiczny|Public/;if(expected.test(label(rowLink))||expected.test(norm(row.innerText)))return {status:'published',message:job.privacy==='private'?'Potwierdzono na kanale: Prywatny.':'Potwierdzono na kanale: Publiczny.',url};}}
  return {status:'submitted',message:'Zapis wysłany. Otwórz film i sprawdź końcowy status.',url};
 }
 async function facebook(job){
  const profile=all('a').find(e=>/^Oś czasu |^Timeline /.test(label(e)))?.href;
  await press(/^(Menu Facebooka|Facebook menu)$/);await press(/^(Rolka|Reel)$/);await attach(job,'facebook');
  await press(/^(Dalej|Next)$/);await wait(()=>/Edytuj rolkę|Edit reel/.test(text()),'edycja rolki');await press(/^(Dalej|Next)$/);
  await wait(()=>/Ustawienia rolki|Reel settings/.test(text()),'ustawienia rolki');const caption=await wait(()=>editable(),'opis rolki Facebooka');fill(caption,job.caption);
  const audience=await wait(()=>all('button,[role="button"]').find(e=>/^(Znajomi Twoi znajomi|Publiczne Każdy|Tylko ja Tylko ja|Friends Your friends|Public Anyone|Only me Only me)/.test(label(e))),'przycisk odbiorców');click(audience);
  const option=await press(job.privacy==='private'?/^(Tylko ja|Only me)$/:/^(Publiczne Każdy|Public Anyone)/,'radio');await wait(()=>checked(option),'wybrana grupa odbiorców');
  await press(/^(Zakończ wybór ustawienia prywatności odbiorców i zamknij okno dialogowe|Finish selecting audience privacy and close dialog|Done)$/);
  const expected=job.privacy==='private'?/^(Tylko ja Tylko ja|Only me Only me)$/:/^(Publiczne Każdy|Public Anyone)/;
  const finalAudience=await wait(()=>all('button,[role="button"]').find(e=>expected.test(label(e))),'potwierdzenie widoczności Facebooka');
  let syntheticConfirmed=!job.synthetic;
  if(job.synthetic){const ai=control(/^(Dodaj etykietę SI|Add AI label)$/,'switch');if(!ai)throw new Error('Nie znaleziono oznaczenia AI.');if(!checked(ai))click(ai);syntheticConfirmed=!!await wait(()=>checked(ai),'oznaczenie AI');}
  const publish=await wait(()=>{const e=control(/^(Opublikuj|Publish)$/);return enabled(e)&&e;},'gotowy film',600000);
  if(!expected.test(label(finalAudience))||read(caption)!==norm(job.caption))throw new Error('Nie potwierdzono opisu lub widoczności.');
  await authorize(job,'facebook',{privacy:job.privacy,privacyConfirmed:true,caption:job.caption,syntheticConfirmed},publish);
  await wait(()=>/Post został udostępniony|Your post has been shared|Trwa przetwarzanie rolki|Your reel is processing/.test(text()),'potwierdzenie Facebooka',120000);
  return {status:'submitted',message:job.privacy==='private'?'Facebook potwierdził wysłanie z ustawieniem Tylko ja. Rolka może jeszcze być przetwarzana.':'Facebook przyjął rolkę do przetwarzania.',url:profile};
 }
 async function instagram(job){
  if(job.privacy!=='public')return {status:'blocked',message:'Instagram Reels nie ma potwierdzonej opcji Tylko ja. Nic nie wysłano.'};
  const create=await wait(()=>globalThis.UplowWorkDOM.instagramCreate(),'utworzenie rolki Instagram');click(create);await attach(job,'instagram');
  await wait(()=>control(/^(OK)$/)||/Przytnij|Crop/.test(text()),'kadrowanie');const ok=control('OK');if(ok)click(ok);
  await press(/^(Dalej|Next)$/);await wait(()=>/Edytuj|Edit/.test(text()),'edycja Instagrama');await press(/^(Dalej|Next)$/);
  const caption=await wait(()=>field(/^(Dodaj opis|Write a caption)/),'opis Instagrama');fill(caption,job.caption);
  // Disable crossposting to avoid a duplicate or a different Facebook audience.
  const fbLabel=exactText(/.+Facebook · (Publiczne|Public|Znajomi|Friends)/);if(fbLabel){let row=fbLabel.parentElement;for(let i=0;i<4&&row;i++,row=row.parentElement){const switches=all('[role="switch"]',row);if(switches.length===1){if(checked(switches[0]))click(switches[0]);await wait(()=>!checked(switches[0]),'wyłączone równoległe udostępnianie na Facebooku');break;}if(i===3)throw new Error('Nie potwierdzono wyłączenia dodatkowego udostępniania na Facebooku.');}}
  const extra=await extraOptions(job,'instagram');
  // Public posting is allowed only after an explicit public audience disclosure.
  const publicProof=/każdy będzie mógł ją zobaczyć|anyone can see|everyone can see/i.test(text());if(!publicProof)throw new Error('Nie potwierdzono publicznej widoczności rolki.');
  const share=await wait(()=>{const e=control(/^(Udostępnij|Share)$/);return enabled(e)&&e;},'gotowość rolki');
  if(read(caption)!==norm(job.caption))throw new Error('Nie potwierdzono opisu.');await authorize(job,'instagram',{privacy:'public',privacyConfirmed:publicProof,caption:job.caption,...extra},share);
  await wait(()=>/Twoja rolka została udostępniona|Twój post został udostępniony|Your reel has been shared|Your post has been shared/.test(text()),'potwierdzenie Instagrama',120000);return {status:'published',message:'Instagram potwierdził udostępnienie rolki.'};
 }
 async function probe(platform){let result={connected:false,label:platform==='instagram'?'Nie wykryto przycisku tworzenia posta. Otwórz Instagram, sprawdź logowanie i kliknij Sprawdź.':'Zaloguj się w otwartej karcie, następnie kliknij Sprawdź.'};try{await wait(()=>{if(platform==='tiktok')return control(/^(Wybierz filmy|Select videos)$/);if(platform==='facebook')return control(/^(Menu Facebooka|Facebook menu)$/);if(platform==='instagram')return globalThis.UplowWorkDOM.instagramCreate();return control(/^(Prześlij filmy|Upload videos)$/)||control(/^(Utwórz|Create)$/);},'sesja',12000);let name='Zalogowano · '+({facebook:'Facebook',instagram:'Instagram',youtube:'YouTube Studio',tiktok:'TikTok Studio'}[platform]);if(platform==='facebook'){const a=all('a').find(e=>/^Oś czasu |^Timeline /.test(label(e)));if(a)name=label(a).replace(/^Oś czasu |^Timeline /,'');}if(platform==='instagram')name='Zalogowano · Instagram';result={connected:true,label:name};}catch{}return result;}
 chrome.runtime.onMessage.addListener((m,s,reply)=>{
  if(s.id!==chrome.runtime.id)return;
  if(m.type==='PROBE'){probe(m.platform).then(reply);return true;}
  if(m.type!=='RUN')return;
  if(running){reply({started:false});return;}running=true;reply({started:true});
  const job=m.job,platform=m.platform;const heartbeat=setInterval(()=>send(job,platform,'HEARTBEAT').then(r=>{cancelled=r.cancelled;}).catch(()=>{cancelled=true;}),10000);
  (async()=>{try{const handler={tiktok,youtube,facebook,instagram}[platform];if(!handler)throw new Error('Nieznana platforma.');const result=await handler(job);await send(job,platform,'FINISH',result);}catch(e){await send(job,platform,'FINISH',{status:committed?'unknown':'blocked',message:e.message}).catch(()=>{});}finally{clearInterval(heartbeat);}})();
 });
})();
