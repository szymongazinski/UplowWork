// Shared DOM-only helpers. No cookies, storage, network requests or account APIs.
(()=>{
 const norm=value=>String(value||'').replace(/\s+/g,' ').trim();
 const visible=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[aria-hidden="true"],[inert]');
 const names=e=>[e.getAttribute('aria-label'),e.innerText,e.textContent,...Array.from(e.querySelectorAll('svg[aria-label],img[alt],svg title')).map(icon=>icon.getAttribute('aria-label')||icon.getAttribute('alt')||icon.textContent)].map(norm).filter(Boolean);
 function accessibleLabel(e){
  const labelled=(e.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>e.ownerDocument.getElementById(id)?.textContent||'').join(' ');
  return norm(e.getAttribute('aria-label')||labelled||Array.from(e.labels||[]).map(l=>l.innerText||l.textContent).join(' ')||e.closest('label')?.innerText||e.closest('label')?.textContent||e.innerText||e.textContent);
 }
 const roleSelectors={button:'button,[role="button"]',radio:'input[type="radio"],[role="radio"]',checkbox:'input[type="checkbox"],[role="checkbox"]'};
 function roleControls(test,role='button',root=document){
  const hits=Array.from(root.querySelectorAll(roleSelectors[role]||`[role="${role}"]`)).filter(e=>visible(e)&&(test instanceof RegExp?test.test(accessibleLabel(e)):accessibleLabel(e)===test));
  return hits.filter(e=>!hits.some(other=>other!==e&&e.contains(other)));
 }
 function instagramCreate(root=document){
  if(Array.from(root.querySelectorAll('input[type="password"],input[name="username"]')).some(visible))return null;
  const pattern=/^(Nowy post|Utwórz|Utwórz post|Utwórz nowy post|Dodaj post|Utwórz rolkę|Create|New post|Create post|Create new post|Create reel)$/i;
  const hits=Array.from(root.querySelectorAll('a,button,[role="button"],[role="link"]')).filter(e=>visible(e)&&names(e).some(name=>pattern.test(name)));
  const leaves=hits.filter(e=>!hits.some(other=>other!==e&&e.contains(other)));
  return leaves.length===1?leaves[0]:null;
 }
 function instagramComposer(root=document){
  const title=/^(Utwórz nowy post|Create new post|Nowy post|New post|Nowa rolka|New reel|Przytnij|Crop|Edytuj|Edit)$/i;
  const dialogs=Array.from(root.querySelectorAll('[role="dialog"]')).filter(e=>visible(e)&&(title.test(accessibleLabel(e))||Array.from(e.querySelectorAll('h1,h2,[role="heading"]')).some(h=>visible(h)&&title.test(norm(h.textContent)))));
  return dialogs.length===1?dialogs[0]:null;
 }
 function instagramPost(root=document){
  const pattern=/^(Post|Publikacja|Rolka|Reel)$/i;
  const hits=Array.from(root.querySelectorAll('a,button,[role="button"],[role="link"],[role="menuitem"]')).filter(e=>visible(e)&&names(e).some(name=>pattern.test(name)));
  const leaves=hits.filter(e=>!hits.some(other=>other!==e&&e.contains(other)));
  return leaves.length===1?leaves[0]:null;
 }
 function instagramCaption(root=document){
  const composer=instagramComposer(root);if(!composer)return null;
  // Instagram currently uses “Add a caption...” in English. Its textarea and
  // contenteditable variants expose that hint through different attributes.
  const pattern=/^(Dodaj opis|(?:Write|Add) a caption)(?:\.{3}|…)?$/i;
  const hits=Array.from(composer.querySelectorAll('textarea,[contenteditable="true"]')).filter(e=>visible(e)&&[
   e.getAttribute('aria-label'),e.getAttribute('placeholder'),e.getAttribute('data-placeholder'),e.getAttribute('aria-placeholder'),accessibleLabel(e),
  ].some(name=>pattern.test(norm(name))));
  return hits.length===1?hits[0]:null;
 }
 function instagramUncroppedPreview(meta,root=document){
  const composer=instagramComposer(root);if(!composer||!meta?.width||!meta?.height)return false;
  const videos=Array.from(composer.querySelectorAll('video')).filter(visible);if(videos.length!==1)return false;
  const video=videos[0],ratio=meta.width/meta.height,box=video.getBoundingClientRect(),style=getComputedStyle(video);
  if(!video.videoWidth||!video.videoHeight||!box.width||!box.height||Math.abs(video.videoWidth/video.videoHeight/ratio-1)>.01)return false;
  let image={left:box.left,top:box.top,right:box.right,bottom:box.bottom};
  // A cover/filled square cuts or distorts a portrait even when the underlying
  // video element still reports the original source dimensions.
  if(style.objectFit==='contain'||style.objectFit==='scale-down'){
   const scale=Math.min(box.width/video.videoWidth,box.height/video.videoHeight,style.objectFit==='scale-down'?1:Infinity);
   const width=video.videoWidth*scale,height=video.videoHeight*scale;
   const position=(style.objectPosition||'50% 50%').split(/\s+/).map(v=>/^\d+(?:\.\d+)?%$/.test(v)?parseFloat(v)/100:NaN);
   if(position.length!==2||position.some(v=>!Number.isFinite(v)))return false;
   image.left=box.left+(box.width-width)*position[0];image.top=box.top+(box.height-height)*position[1];image.right=image.left+width;image.bottom=image.top+height;
  }else if(Math.abs(box.width/box.height/ratio-1)>.01)return false;
  for(let parent=video.parentElement;parent;parent=parent.parentElement){
   const parentStyle=getComputedStyle(parent),clipX=/^(hidden|clip|auto|scroll)$/.test(parentStyle.overflowX||parentStyle.overflow||''),clipY=/^(hidden|clip|auto|scroll)$/.test(parentStyle.overflowY||parentStyle.overflow||'');
   if(clipX||clipY){const bounds=parent.getBoundingClientRect();if(clipX&&(image.left<bounds.left-2||image.right>bounds.right+2)||clipY&&(image.top<bounds.top-2||image.bottom>bounds.bottom+2))return false;}
   if(parent===composer)break;
  }
  return true;
 }
 function videoInput(platform,root=document){
  const accepts=e=>!e.disabled&&/video|mp4|mov|webm/i.test(e.getAttribute('accept')||'');
  if(platform==='youtube'){
   // Studio's native Filedata picker intentionally has no accept attribute
   // and is hidden. Scope by its visible upload component, not by MIME hints.
   const pickers=Array.from(root.querySelectorAll('ytcp-uploads-file-picker')).filter(visible);
   if(pickers.length!==1)return null;
   const hits=Array.from(pickers[0].querySelectorAll('input[type="file"][name="Filedata"]')).filter(e=>!e.disabled);
   return hits.length===1?hits[0]:null;
  }
  if(platform==='facebook'){
   // Facebook mounts two reel inputs outside its dialog, plus an unrelated post input.
   const forms=Array.from(root.querySelectorAll('[role="form"][aria-label="Rolki"],[role="form"][aria-label="Reels"]')).filter(visible);
   if(forms.length!==1)return null;
   const hits=Array.from(forms[0].querySelectorAll('input[type="file"]')).filter(accepts);
   return hits.length===1?hits[0]:null;
  }
  // Instagram leaves other attachment fields mounted behind its active modal.
  // Only the visible creator owns the file selected for a reel.
  const scope=platform==='instagram'?instagramComposer(root):root;
  if(!scope)return null;
  const inputs=Array.from(scope.querySelectorAll('input[type="file"]')).filter(accepts);
  return inputs.length===1?inputs[0]:null;
 }
 function facebookReelStage(stage,root=document){return Array.from(root.querySelectorAll('h1,h2,[role="heading"]')).some(e=>visible(e)&&stage.test(norm(e.innerText||e.textContent)));}
 globalThis.UplowWorkDOM={names,accessibleLabel,roleControls,instagramCreate,instagramComposer,instagramPost,instagramCaption,instagramUncroppedPreview,videoInput,facebookReelStage};
})();
