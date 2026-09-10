// One setting can target several platforms; the worker verifies each target separately.
export const OPTION_DEFS = [
 {id:'comments',label:'Komentarze',platforms:['tiktok','instagram','youtube'],choices:[['default','Ustawienie platformy'],['on','Włączone'],['off','Wyłączone']]},
 {id:'likeCounts',label:'Liczba polubień',platforms:['instagram','youtube'],choices:[['default','Ustawienie platformy'],['show','Pokazuj'],['hide','Ukryj']],help:'Na Instagramie ustawienie dotyczy również liczby wyświetleń rolki.'},
 {id:'paidPromotion',label:'Płatna promocja',platforms:['youtube'],choices:[['default','Ustawienie platformy'],['yes','Tak, film zawiera płatną promocję'],['no','Nie, film nie zawiera płatnej promocji']]},
 {id:'embedding',label:'Osadzanie filmu na innych stronach',platforms:['youtube'],choices:[['default','Ustawienie platformy'],['on','Zezwalaj'],['off','Nie zezwalaj']]},
];
export const DEFAULT_OPTIONS={comments:'on',likeCounts:'show',paidPromotion:'no',embedding:'on'};
export function validateOptions(options={}){
 if(!options||typeof options!=='object'||Array.isArray(options))throw new Error('Nieprawidłowe opcje filmu.');
 for(const [key,value] of Object.entries(options)){
  const def=OPTION_DEFS.find(o=>o.id===key);
  if(!def||!def.choices.some(([id])=>id===value))throw new Error('Nieprawidłowe ustawienie: '+key);
 }
}
export function expectedOptions(job,platform){
 const result={};
 for(const def of OPTION_DEFS){const value=job.options?.[def.id]||'default';if(value!=='default'&&def.platforms.includes(platform))result[def.id]=def.id==='comments'&&platform==='youtube'&&job.kids?'off':value;}
 return result;
}
