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
 function videoInput(platform,root=document){
  const accepts=e=>/video|mp4|mov|webm/i.test(e.getAttribute('accept')||'');
  if(platform==='facebook'){
   // Facebook mounts two reel inputs outside its dialog, plus an unrelated post input.
   const forms=Array.from(root.querySelectorAll('[role="form"][aria-label="Rolki"],[role="form"][aria-label="Reels"]')).filter(visible);
   if(forms.length!==1)return null;
   const hits=Array.from(forms[0].querySelectorAll('input[type="file"]')).filter(accepts);
   return hits.length===1?hits[0]:null;
  }
  const inputs=Array.from(root.querySelectorAll('input[type="file"]')).filter(accepts);
  return inputs.length===1?inputs[0]:null;
 }
 function facebookReelStage(stage,root=document){return Array.from(root.querySelectorAll('h1,h2,[role="heading"]')).some(e=>visible(e)&&stage.test(norm(e.innerText||e.textContent)));}
 globalThis.UplowWorkDOM={names,accessibleLabel,roleControls,instagramCreate,videoInput,facebookReelStage};
})();
