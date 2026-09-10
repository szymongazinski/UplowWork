// Shared destination validation and DOM evidence. No account APIs or cookies.
(()=>{
 function page(value){
  const input=typeof value==='string'?value:value?.url;
  let url;try{url=new URL(input);}catch{throw new Error('Podaj link Facebooka profile.php?id=… do swojej strony.');}
  const id=url.searchParams.get('id');
  if(url.protocol!=='https:'||!['www.facebook.com','facebook.com'].includes(url.hostname)||url.port||url.username||url.password||url.pathname!=='/profile.php'||!/^\d{5,25}$/.test(id||''))throw new Error('Podaj link strony https://www.facebook.com/profile.php?id=…');
  if(typeof value==='object'&&value.id!==undefined&&value.id!==id)throw new Error('Identyfikator strony nie zgadza się z jej linkiem.');
  return {id,url:'https://www.facebook.com/profile.php?id='+id};
 }
 const visible=e=>e.isConnected&&e.getClientRects().length>0&&!e.closest('[aria-hidden="true"],[inert]')&&getComputedStyle(e).visibility!=='hidden';
 function actor(root=document){
  const navs=[...root.querySelectorAll('nav[aria-label="Facebook"],[role="navigation"][aria-label="Facebook"]')].filter(visible);
  if(navs.length!==1)return null;
  const ids=[...new Set([...navs[0].querySelectorAll('a[href]')].filter(visible).flatMap(a=>{
   try{const u=new URL(a.getAttribute('href'),'https://www.facebook.com/');const m=u.pathname.match(/^\/(\d{5,25})\/ad_center\/?$/);return u.origin==='https://www.facebook.com'&&m?[m[1]]:[];}catch{return [];}
  }))];
  return ids.length===1?ids[0]:null;
 }
 function assertActor(target,root=document){const expected=page(target);if(actor(root)!==expected.id)throw new Error('Facebook nie działa jako wybrana strona. Publikacja na profilu osobistym jest zablokowana.');return {facebookPageId:expected.id,facebookPageConfirmed:true};}
 globalThis.UplowWorkFacebookPage=Object.freeze({page,actor,assertActor});
})();
