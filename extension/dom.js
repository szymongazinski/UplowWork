// Shared DOM-only helpers. No cookies, storage, network requests or account APIs.
(()=>{
 const norm=value=>String(value||'').replace(/\s+/g,' ').trim();
 const visible=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
 const names=e=>[e.getAttribute('aria-label'),e.innerText,e.textContent,...Array.from(e.querySelectorAll('svg[aria-label],img[alt],svg title')).map(icon=>icon.getAttribute('aria-label')||icon.getAttribute('alt')||icon.textContent)].map(norm).filter(Boolean);
 function instagramCreate(root=document){
  if(Array.from(root.querySelectorAll('input[type="password"],input[name="username"]')).some(visible))return null;
  const pattern=/^(Nowy post|Utwórz|Utwórz post|Utwórz nowy post|Dodaj post|Create|New post|Create post|Create new post)$/i;
  const hits=Array.from(root.querySelectorAll('a,button,[role="button"],[role="link"]')).filter(e=>visible(e)&&names(e).some(name=>pattern.test(name)));
  const leaves=hits.filter(e=>!hits.some(other=>other!==e&&e.contains(other)));
  return leaves.length===1?leaves[0]:null;
 }
 globalThis.UplowWorkDOM={names,instagramCreate};
})();
