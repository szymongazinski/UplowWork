import React,{useEffect,useRef,useState} from 'react';

export default function ThumbnailPicker({src,disabled,selected,onChange}){
 const [mode,setMode]=useState('platform'),[image,setImage]=useState(null),[preview,setPreview]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[time,setTime]=useState(0);
 const [targets,setTargets]=useState(['tiktok','facebook','instagram','youtube']);
 const generation=useRef(0),callback=useRef(onChange);callback.current=onChange;
 useEffect(()=>{setImage(null);setMode('platform');setError('');},[src]);
 useEffect(()=>{callback.current({blob:image,mode,time,pending:mode!=='platform'&&!image,platforms:targets.filter(p=>selected.includes(p))});},[image,mode,time,targets,selected]);
 useEffect(()=>{if(!image){setPreview('');return;}const url=URL.createObjectURL(image);setPreview(url);return()=>URL.revokeObjectURL(url);},[image]);
 useEffect(()=>{
  const token=++generation.current;if(mode!=='middle'||!src){setLoading(false);return;}
  setLoading(true);setImage(null);setError('');
  const video=document.createElement('video');video.muted=true;video.preload='auto';video.src=src;
  const fail=()=>{if(token===generation.current){setError('Nie udało się odczytać klatki. Wybierz własny obraz.');setLoading(false);}};
  const timeout=setTimeout(fail,30000);
  video.onloadedmetadata=()=>{if(!Number.isFinite(video.duration)||video.duration<=0){fail();return;}setTime(video.duration/2);video.currentTime=video.duration/2;};
  video.onseeked=()=>{const canvas=document.createElement('canvas');const ratio=Math.min(1,1080/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.round(video.videoWidth*ratio);canvas.height=Math.round(video.videoHeight*ratio);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{if(token!==generation.current)return;clearTimeout(timeout);if(!blob){fail();return;}setImage(blob);setLoading(false);},'image/jpeg',.88);};
  video.onerror=fail;return()=>{generation.current++;clearTimeout(timeout);video.removeAttribute('src');video.load();};
 },[src,mode]);
 async function custom(file){setError('');setImage(null);if(!file)return;if(!['image/jpeg','image/png'].includes(file.type)||file.size>2*1024*1024){setError('Wybierz JPG lub PNG do 2 MB.');return;}try{const bitmap=await createImageBitmap(file);bitmap.close();setImage(file);}catch{setError('Nie można odczytać obrazu.');}}
 const labels={tiktok:'TikTok',facebook:'Facebook',instagram:'Instagram',youtube:'YouTube'};
 return <div className="thumbnail-picker"><label className="field-label" htmlFor="thumbnail-mode">Miniatura / okładka filmu</label>
  <select id="thumbnail-mode" value={mode} disabled={disabled||!src} onChange={e=>{setImage(null);setError('');setMode(e.target.value);}}><option value="platform">Domyślna miniatura platformy</option><option value="middle">Automatycznie — klatka ze środka filmu</option><option value="custom">Własny obraz JPG / PNG</option></select>
  {mode==='custom'&&<input aria-label="Wybierz miniaturę" type="file" accept="image/jpeg,image/png" disabled={disabled} onChange={e=>custom(e.target.files[0])}/>}
  {loading&&<p className="small" role="status">Wybieram klatkę ze środka filmu…</p>}
  {preview&&<div className="thumbnail-preview"><img src={preview} alt="Wybrana miniatura filmu"/><div><strong>{mode==='middle'?`Klatka z ${time.toFixed(1)} s`:'Własna miniatura'}</strong><a href={preview} download={mode==='middle'?'miniatura.jpg':'miniatura.'+(image.type==='image/png'?'png':'jpg')}>Pobierz miniaturę</a></div></div>}
  {mode!=='platform'&&<><p className="option-scope">Zastosuj tę miniaturę do:</p><div className="thumbnail-targets">{selected.map(p=><label key={p}><input type="checkbox" checked={targets.includes(p)} disabled={disabled} onChange={e=>setTargets(t=>e.target.checked?[...t,p]:t.filter(x=>x!==p))}/>{labels[p]}</label>)}</div><p className="small">Facebook zapisuje wybrany obraz w edytorze miniatury rolki. Jeśli formularz konta nie udostępnia własnej okładki, wysyłka tej platformy zatrzyma się przed publikacją. Możesz pobrać obraz i ustawić go ręcznie. Dostępność miniatur Shorts zależy od konta YouTube.</p></>}
  {error&&<p className="error" role="alert">{error}</p>}
 </div>;
}
