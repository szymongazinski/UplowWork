// Isolated-world content script. Reads and operates the visible publishing UI;
// it does not read cookies, passwords, internal APIs or page application stores.
(()=>{
 if(globalThis.__wrzutkaInstalled)return;globalThis.__wrzutkaInstalled='0.1.5';
 const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
 const visible=e=>e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[aria-hidden="true"],[inert]');
 const enabled=e=>e&&!e.disabled&&e.getAttribute('aria-disabled')!=='true';
 const label=e=>globalThis.UplowWorkDOM.accessibleLabel(e);
 const all=(selector,root=document)=>[...root.querySelectorAll(selector)].filter(visible);
 const matches=(value,test)=>test instanceof RegExp?test.test(value):value===test;
 function unique(elements,description){if(elements.length!==1)throw new Error(elements.length?'Niejednoznaczny element: '+description:'Nie znaleziono: '+description);return elements[0];}
 function controls(test,role='button',root=document){return globalThis.UplowWorkDOM.roleControls(test,role,root);}
 function control(test,role='button',root=document){const hits=controls(test,role,root);return hits.length===1?hits[0]:null;}
 function exactText(test,root=document){const hits=all('button,[role="button"],span,div,label',root).filter(e=>matches(norm(e.innerText),test));return hits.filter(e=>!hits.some(other=>other!==e&&e.contains(other)))[0]||null;}
 const text=()=>norm(document.body.innerText);
 const click=e=>{if(!e||!visible(e)||!enabled(e))throw new Error('Element formularza nie jest gotowy.');e.click();};
 const checked=e=>e?.getAttribute('aria-checked')==='true'||e?.checked===true||e?.getAttribute('data-state')==='checked';
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 let cancelled=false,running=false,committed=false,currentStep='Uruchamianie formularza',currentJob=null,currentPlatform=null;
 function step(description){currentStep=description;if(currentJob&&!committed)send(currentJob,currentPlatform,'PROGRESS',{status:'uploading',message:description}).catch(()=>{});}
 async function wait(fn,description,timeout=60000){step(description);const start=Date.now();while(Date.now()-start<timeout){if(cancelled&&!committed)throw new Error('Wysyłka zatrzymana.');if(currentPlatform==='tiktok'&&!committed){const failure=text().match(/(?:Nie udało się przesłać|Przesyłanie nie powiodło się|Upload failed|Couldn.t upload)[^.\n]*/i);if(failure)throw new Error(failure[0]);}const value=fn();if(value)return value;if(all('iframe').some(e=>/captcha/i.test(e.getAttribute('title')||'')))throw new Error('Platforma wymaga weryfikacji w przeglądarce.');await delay(400);}throw new Error('Nie potwierdzono: '+description+'. Sprawdź kartę platformy.');}
 async function press(test,role='button',root=document,timeout=60000){const e=await wait(()=>{const e=control(test,role,root);return enabled(e)?e:null;},String(test),timeout);click(e);return e;}
 function fill(e,value){if(!visible(e))throw new Error('Pole tekstowe nie jest widoczne.');e.focus();if(e.isContentEditable){const selection=window.getSelection();const range=document.createRange();range.selectNodeContents(e);selection.removeAllRanges();selection.addRange(range);if(!document.execCommand('insertText',false,value)){e.textContent=value;e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));}}else{const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}if(norm(e.isContentEditable?e.innerText:e.value)!==norm(value))throw new Error('Nie udało się zapisać tekstu.');}
 function field(pattern){const hits=all('textarea,input:not([type=file]),[contenteditable="true"]').filter(e=>matches(norm(e.getAttribute('aria-label')||e.getAttribute('placeholder')||''),pattern));return hits.length===1?hits[0]:null;}
 function editable(role){const hits=all('[contenteditable="true"]').filter(e=>(!role||e.getAttribute('role')===role)&&!/(Napisz do:|Message to:|Napisz wiadomość|Write a message)/i.test(e.getAttribute('aria-label')||''));return hits.length===1?hits[0]:null;}
 const send=(job,platform,type,data={})=>chrome.runtime.sendMessage({id:job.id,attemptId:job.attemptId,platform,type,...data}).then(r=>{if(!r?.ok)throw new Error(r?.error||'Brak odpowiedzi UplowWork.');return r;});
 async function video(job,platform){const parts=[];for(let offset=0;offset<job.size;){const r=await send(job,platform,'CHUNK',{offset});const data=Uint8Array.from(atob(r.data),c=>c.charCodeAt(0));if(!data.length||data.length!==r.length)throw new Error('Nieprawidłowy fragment filmu.');parts.push(data);offset+=data.length;}const file=new File(parts,job.filename,{type:job.mime});if(file.size!==job.size)throw new Error('Niepełny plik.');if(job.digest){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==job.digest)throw new Error('Plik zmienił się podczas przekazywania do przeglądarki. Wysyłka zatrzymana.');}return file;}
 async function attach(job,platform){
  const input=await wait(()=>globalThis.UplowWorkDOM.videoInput(platform),'pole filmu w kreatorze '+platform,120000);
  step('Przesyłanie filmu do '+platform+'.');const f=await video(job,platform);const dt=new DataTransfer();dt.items.add(f);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 }
 async function cover(job,platform){
  if(!job.thumbnail?.platforms.includes(platform))return {};
  step('Ustawianie miniatury '+platform+'.');
  if(platform==='tiktok')click(await wait(()=>exactText(/^(Edytuj okładkę|Edit cover)$/),'edycja okładki TikToka'));
  if(platform==='facebook'){
   const edit=control(/^(Edytuj miniaturę|Edytuj okładkę|Zmień miniaturę|Edit thumbnail|Edit cover)$/)||exactText(/^(Miniatura|Thumbnail)$/);
   if(edit)click(edit);
  }
  const input=await wait(()=>{const hits=[...document.querySelectorAll('input[type="file"]')].filter(e=>/image\/(jpeg|png|\*)/i.test(e.getAttribute('accept')||'')&&!/video/i.test(e.getAttribute('accept')||''));return hits.length===1?hits[0]:null;},'pole własnej miniatury. Jeśli konto go nie udostępnia, użyj domyślnej okładki platformy',15000);
  const parts=[];for(let offset=0;offset<job.thumbnail.size;){const r=await send(job,platform,'CHUNK',{asset:'thumbnail',offset});const bytes=Uint8Array.from(atob(r.data),c=>c.charCodeAt(0));if(!bytes.length)throw new Error('Niepełna miniatura.');parts.push(bytes);offset+=bytes.length;}
  const beforeImages=new Set(all('img,[style]').map(e=>e.getAttribute('src')||e.getAttribute('style')).filter(Boolean));
  const f=new File(parts,job.thumbnail.mime==='image/png'?'miniatura.png':'miniatura.jpg',{type:job.thumbnail.mime}),dt=new DataTransfer();dt.items.add(f);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>all('img,[style]').some(e=>{const value=e.getAttribute('src')||e.getAttribute('style')||'';return /blob:|data:image/.test(value)&&!beforeImages.has(value);}), 'podgląd wybranej miniatury',30000);
  if(platform==='tiktok'){await press(/^(Zapisz|Save)$/);await wait(()=>!control(/^(Upload cover image|Uploaded cover image)$/)&&!!editable('combobox'),'zapis okładki TikToka');}
  else if(platform==='facebook'){const save=control(/^(Zapisz|Save|Gotowe|Done)$/);if(save)click(save);}
  return {thumbnailConfirmed:true};
 }

 function read(e){return norm(e.isContentEditable?e.innerText:e.value);}
 function captionMatches(e,expected){const clean=s=>String(s||'').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').trim();return clean(e.isContentEditable?e.innerText:e.value)===clean(expected);}
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
 async function authorize(job,platform,proof,button){await send(job,platform,'PROGRESS',{status:'ready',message:'Sprawdzono opis i ustawienie widoczności.'});if(job.dryRun){await send(job,platform,'CHECK',{proof});const done=new Error('Formularz i ustawienia sprawdzone. Zatrzymano przed publikacją.');done.code='DRY_RUN_COMPLETE';throw done;}await send(job,platform,'COMMIT',{proof});committed=true;if(!enabled(button)||!visible(button))throw new Error('Przycisk publikacji zmienił stan.');click(button);}
 async function tiktok(job){
  await wait(()=>control(/^(Wybierz filmy|Select videos)$/)||document.querySelector('input[type="file"]'),'zalogowanie do TikTok Studio');await attach(job,'tiktok');
  await wait(()=>{const failure=all('[role=alert]').map(e=>norm(e.innerText)).find(t=>/nie udało|błąd|failed|couldn.t|error/i.test(t));if(failure)throw new Error('TikTok odrzucił przesyłanie: '+failure);if(/Something went wrong|Coś poszło nie tak/i.test(text())){const error=new Error('TikTok: Something went wrong — platforma nie przyjęła przesyłania.');error.code='TIKTOK_UPLOAD_REJECTED';throw error;}return /Przesłano|Uploaded/.test(text());},'zakończenie przesyłania TikToka',600000);
  const thumbnail=await cover(job,'tiktok');
  const caption=await wait(()=>editable('combobox')||editable('textbox')||field(/^(Opis|Description|Caption)/),'opis TikToka',600000);fill(caption,job.caption);
  const hint=control(/^(Rozumiem|Got it)$/);if(hint)click(hint);
  const privacy=await wait(()=>all('[role="combobox"]').find(e=>/^(Wszyscy|Everyone|Tylko Ty|Only you|Znajomi|Friends)$/.test(label(e))),'wybór widoczności TikToka');
  click(privacy);const option=await wait(()=>control(job.privacy==='private'?/^(Tylko Ty|Only you)$/:/^(Wszyscy|Everyone)$/,'option'),'opcja widoczności');click(option);
  const expected=job.privacy==='private'?/^(Tylko Ty|Only you)$/:/^(Wszyscy|Everyone)$/;
  await wait(()=>expected.test(label(privacy)),'ustawiona widoczność');
  const extra=await extraOptions(job,'tiktok');
  const publish=await wait(()=>{const e=control(/^(Opublikuj|Post)$/);return enabled(e)&&e;},'gotowość do publikacji',600000);
  if(!captionMatches(caption,job.caption)||!expected.test(label(privacy)))throw new Error('Opis lub prywatność uległy zmianie.');
  await authorize(job,'tiktok',{privacy:job.privacy,privacyConfirmed:true,caption:job.caption,...extra,...thumbnail},publish);
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
  const extra=await extraOptions(job,'youtube');const thumbnail=await cover(job,'youtube');
  if(read(title)!==norm(job.title)||!captionMatches(description,job.caption))throw new Error('YouTube nie zapisał tekstu.');
  await press(/^(Widoczność|Visibility)$/,'tab');
  const privacy=await press(job.privacy==='private'?/^(Prywatny|Private)$/:/^(Publiczny|Public)$/,'radio');await wait(()=>checked(privacy),'widoczność YouTube');
  const link=await wait(()=>all('a').find(a=>/^https:\/\/(www\.)?youtube\.com\/(shorts\/|watch\?v=)/.test(a.href)),'link do filmu');
  const url=link.href;const videoUrl=new URL(url);const videoId=videoUrl.searchParams.get('v')||videoUrl.pathname.split('/').pop();
  await wait(()=>!/Przetwarzam do SD|Processing.*SD|Przetwarzanie rozpocznie|Processing will begin/i.test(text()),'przetworzenie filmu',600000);
  const save=await wait(()=>{const e=control(job.privacy==='private'?/^(Zapisz|Save)$/:/^(Opublikuj|Publish)$/);return enabled(e)&&e;},'przycisk zapisu');
  if(!checked(privacy))throw new Error('Nie potwierdzono widoczności YouTube.');
  await authorize(job,'youtube',{privacy:job.privacy,privacyConfirmed:true,caption:job.caption,title:job.title,kids:job.kids,...extra,...thumbnail},save);
  await wait(()=>!visible(save)||!document.contains(save)||/Film opublikowany|Video published|Film został zapisany|Video saved/.test(text()),'zapis YouTube',120000);
  // An explicit saved confirmation is required; closing the dialog alone is not a publication proof.
  const contentLink=all('a').find(a=>/\/content(?:\?|$|\/)/.test(a.href)&&/Treści|Content/.test(label(a)));
  const contentControl=contentLink||exactText(/^(Treści|Content)$/);
  if(contentControl){click(contentControl);const rowLink=await wait(()=>all('a').find(a=>a.href.includes(`/video/${videoId}/`)&&label(a).includes(job.title)),'zapisany film na kanale',120000);let row=rowLink.parentElement;for(let i=0;i<6&&row;i++,row=row.parentElement){const expected=job.privacy==='private'?/Prywatny|Private/:/Publiczny|Public/;if(expected.test(label(rowLink))||expected.test(norm(row.innerText)))return {status:'published',message:job.privacy==='private'?'Potwierdzono na kanale: Prywatny.':'Potwierdzono na kanale: Publiczny.',url};}}
  return {status:'submitted',message:'Zapis wysłany. Otwórz film i sprawdź końcowy status.',url};
 }
 async function facebook(job){
  const profile=all('a').find(e=>/^Oś czasu |^Timeline /.test(label(e)))?.href;
  step('Otwieranie kreatora Facebook Reels.');
  if(!globalThis.UplowWorkDOM.facebookReelStage(/^(Utwórz rolkę|Create reel)$/)){await press(/^(Menu Facebooka|Facebook menu)$/);await press(/^(Rolka|Reel)$/);}
  await wait(()=>globalThis.UplowWorkDOM.facebookReelStage(/^(Utwórz rolkę|Create reel)$/),'kreator rolki Facebooka');await attach(job,'facebook');
  await press(/^(Dalej|Next)$/);await wait(()=>globalThis.UplowWorkDOM.facebookReelStage(/^(Edytuj rolkę|Edit reel)$/),'edycja rolki');const thumbnail=await cover(job,'facebook');await press(/^(Dalej|Next)$/);
  await wait(()=>globalThis.UplowWorkDOM.facebookReelStage(/^(Ustawienia rolki|Reel settings)$/),'ustawienia rolki');const caption=await wait(()=>editable(),'opis rolki Facebooka');fill(caption,job.caption);
  const audience=await wait(()=>all('button,[role="button"]').find(e=>/^(Znajomi Twoi znajomi|Publiczne Każdy|Tylko ja Tylko ja|Friends Your friends|Public Anyone|Only me Only me)/.test(label(e))),'przycisk odbiorców');click(audience);
  const audienceDialog=await wait(()=>all('[role=\"dialog\"]').find(e=>/Wybierz grupę odbiorców|Select audience/.test(label(e))),'okno odbiorców Facebooka');
  const audienceName=job.privacy==='private'?/^(Tylko ja|Only me)$/:/^(Publiczne|Public)(?: |$)/;
  await press(audienceName,'radio',audienceDialog);await wait(()=>checked(control(audienceName,'radio',audienceDialog)),'wybrana grupa odbiorców');
  await press(/^(Zakończ wybór ustawienia prywatności odbiorców i zamknij okno dialogowe|Finish selecting audience privacy and close dialog|Gotowe|Done)$/);
  const expected=job.privacy==='private'?/^(Tylko ja Tylko ja|Only me Only me)$/:/^(Publiczne Każdy|Public Anyone)/;
  const finalAudience=await wait(()=>all('button,[role="button"]').find(e=>expected.test(label(e))),'potwierdzenie widoczności Facebooka');
  let syntheticConfirmed=!job.synthetic;
  if(job.synthetic){const ai=control(/^(Dodaj etykietę SI|Add AI label)$/,'switch');if(!ai)throw new Error('Nie znaleziono oznaczenia AI.');if(!checked(ai))click(ai);syntheticConfirmed=!!await wait(()=>checked(ai),'oznaczenie AI');}
  const publish=await wait(()=>{const e=control(/^(Opublikuj|Publish)$/);return enabled(e)&&e;},'gotowy film',600000);
  if(!expected.test(label(finalAudience))||!captionMatches(caption,job.caption))throw new Error('Nie potwierdzono opisu lub widoczności.');
  if(!globalThis.UplowWorkDOM.facebookReelStage(/^(Ustawienia rolki|Reel settings)$/))throw new Error('Zamknięto kreator rolki. Publikacja zatrzymana.');
  await authorize(job,'facebook',{mediaKind:'reel',...thumbnail,privacy:job.privacy,privacyConfirmed:true,caption:job.caption,syntheticConfirmed},publish);
  await wait(()=>/Post został udostępniony|Your post has been shared|Trwa przetwarzanie rolki|Your reel is processing/.test(text()),'potwierdzenie Facebooka',120000);
  return {status:'submitted',message:job.privacy==='private'?'Facebook potwierdził wysłanie z ustawieniem Tylko ja. Rolka może jeszcze być przetwarzana.':'Facebook przyjął rolkę do przetwarzania.',url:profile};
 }
 async function instagram(job){
  if(job.privacy!=='public')return {status:'blocked',message:'Instagram Reels nie ma potwierdzonej opcji Tylko ja. Nic nie wysłano.'};
  step('Otwieranie kreatora Instagrama.');
  const create=await wait(()=>globalThis.UplowWorkDOM.instagramCreate(),'przycisk tworzenia Instagrama',120000);
  create.scrollIntoView({block:'center',inline:'center'});create.focus({preventScroll:true});
  for(const type of ['pointerdown','mousedown','pointerup','mouseup']){const EventClass=type.startsWith('pointer')?PointerEvent:MouseEvent;create.dispatchEvent(new EventClass(type,{bubbles:true,cancelable:true,button:0,buttons:type.endsWith('down')?1:0,pointerType:'mouse',isPrimary:true}));}click(create);
  let submenuClicked=false;await wait(()=>{if(globalThis.UplowWorkDOM.videoInput('instagram'))return true;const post=control(/^(Post|Publikacja|Rolka|Reel)$/);if(post&&!submenuClicked){submenuClicked=true;click(post);}return false;},'wybór filmu w kreatorze Instagrama',120000);await attach(job,'instagram');
  await wait(()=>control(/^(OK)$/)||/Przytnij|Crop/.test(text()),'kadrowanie');const ok=control('OK');if(ok)click(ok);
  await press(/^(Dalej|Next)$/);await wait(()=>/Edytuj|Edit/.test(text()),'edycja Instagrama');const thumbnail=await cover(job,'instagram');await press(/^(Dalej|Next)$/);
  const caption=await wait(()=>field(/^(Dodaj opis|Write a caption)/),'opis Instagrama');fill(caption,job.caption);
  // Disable crossposting to avoid a duplicate or a different Facebook audience.
  const fbLabel=exactText(/.+Facebook · (Publiczne|Public|Znajomi|Friends)/);if(fbLabel){let row=fbLabel.parentElement;for(let i=0;i<4&&row;i++,row=row.parentElement){const switches=all('[role="switch"]',row);if(switches.length===1){if(checked(switches[0]))click(switches[0]);await wait(()=>!checked(switches[0]),'wyłączone równoległe udostępnianie na Facebooku');break;}if(i===3)throw new Error('Nie potwierdzono wyłączenia dodatkowego udostępniania na Facebooku.');}}
  const extra=await extraOptions(job,'instagram');
  // Public posting is allowed only after an explicit public audience disclosure.
  const publicProof=/każdy będzie mógł ją zobaczyć|anyone can see|everyone can see/i.test(text());if(!publicProof)throw new Error('Nie potwierdzono publicznej widoczności rolki.');
  const share=await wait(()=>{const e=control(/^(Udostępnij|Share)$/);return enabled(e)&&e;},'gotowość rolki');
  if(!captionMatches(caption,job.caption))throw new Error('Nie potwierdzono opisu.');await authorize(job,'instagram',{privacy:'public',privacyConfirmed:publicProof,caption:job.caption,...extra,...thumbnail},share);
  await wait(()=>/Twoja rolka została udostępniona|Twój post został udostępniony|Your reel has been shared|Your post has been shared/.test(text()),'potwierdzenie Instagrama',120000);return {status:'published',message:'Instagram potwierdził udostępnienie rolki.'};
 }
 async function probe(platform){let result={connected:false,label:platform==='instagram'?'Nie wykryto przycisku tworzenia posta. Otwórz Instagram, sprawdź logowanie i kliknij Sprawdź.':'Zaloguj się w otwartej karcie, następnie kliknij Sprawdź.'};try{await wait(()=>{if(platform==='tiktok')return control(/^(Wybierz filmy|Select videos)$/);if(platform==='facebook')return control(/^(Menu Facebooka|Facebook menu)$/);if(platform==='instagram')return globalThis.UplowWorkDOM.instagramCreate();return control(/^(Prześlij filmy|Upload videos)$/)||control(/^(Utwórz|Create)$/);},'sesja',12000);let name='Zalogowano · '+({facebook:'Facebook',instagram:'Instagram',youtube:'YouTube Studio',tiktok:'TikTok Studio'}[platform]);if(platform==='facebook'){const a=all('a').find(e=>/^Oś czasu |^Timeline /.test(label(e)));if(a)name=label(a).replace(/^Oś czasu |^Timeline /,'');}if(platform==='instagram')name='Zalogowano · Instagram';result={connected:true,label:name};}catch{}return result;}
 chrome.runtime.onMessage.addListener((m,s,reply)=>{
  if(s.id!==chrome.runtime.id)return;
  if(m.type==='PROBE'){probe(m.platform).then(reply);return true;}
  if(m.type!=='RUN')return;
  if(running){reply({started:false});return;}running=true;reply({started:true,version:globalThis.__wrzutkaInstalled});
  cancelled=false;committed=false;const job=m.job,platform=m.platform;currentJob=job;currentPlatform=platform;const heartbeat=setInterval(()=>send(job,platform,'HEARTBEAT').then(r=>{cancelled=r.cancelled;}).catch(()=>{cancelled=true;}),10000);
  (async()=>{try{const handler={tiktok,youtube,facebook,instagram}[platform];if(!handler)throw new Error('Nieznana platforma.');const result=await handler(job);await send(job,platform,'FINISH',result);}catch(e){await send(job,platform,'FINISH',{status:e.code==='DRY_RUN_COMPLETE'?'draft':committed?'unknown':'blocked',message:e.code==='DRY_RUN_COMPLETE'?e.message:currentStep+': '+e.message,diagnostic:{version:globalThis.__wrzutkaInstalled,step:currentStep,code:e.code||'FORM_ERROR',fileInputs:[...document.querySelectorAll('input[type=file]')].map(e=>e.getAttribute('accept')||''),instagramCreateFound:platform==='instagram'?!!globalThis.UplowWorkDOM.instagramCreate():undefined}}).catch(()=>{});}finally{clearInterval(heartbeat);}})();
 });
})();
