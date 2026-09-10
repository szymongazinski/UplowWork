import React,{useRef,useState,useEffect} from 'react';
import {Heart,ThumbsUp,ThumbsDown,MessageCircle,Send,Forward,Bookmark,MoreHorizontal,MoreVertical,Camera,Search,ChevronDown,ArrowLeft,Music2,Play,Pause,Volume2,VolumeX,Home,Plus,User,Users,Clapperboard,Film} from 'lucide-react';

const names={tiktok:'TikTok',instagram:'Instagram Reels',facebook:'Facebook Reels',youtube:'YouTube Shorts'};
function Glyph({icon:Icon,label,fill=false}){return <div className="social-action"><Icon size={27} strokeWidth={1.8} fill={fill?'currentColor':'none'}/>{label!==undefined&&<span>{label}</span>}</div>;}
export default function Preview({platform,src,caption,title,options,kids,synthetic,onMetadata,onError}){
 const video=useRef(null);const [playing,setPlaying]=useState(false),[muted,setMuted]=useState(true),[progress,setProgress]=useState(0),[duration,setDuration]=useState(0),[expanded,setExpanded]=useState(false),[account,setAccount]=useState('twoje_konto');
 useEffect(()=>{setExpanded(false);},[platform,src]);
 useEffect(()=>{setPlaying(false);setProgress(0);setDuration(0);},[src]);
 const isYT=platform==='youtube',isIG=platform==='instagram',isTT=platform==='tiktok',isFB=platform==='facebook';
 const comments=isFB||(options.comments!=='off'&&!(isYT&&kids==='yes'));
 const count=options.likeCounts==='hide'&&(isIG||isYT)?'Polub':'0';
 const handle=account.trim().replace(/^@/,'')||'twoje_konto';
 const displayCaption=isYT?(title||'Tytuł Twojego Shorta'):(caption||'Twój opis i hashtagi pojawią się tutaj');
 const time=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
 async function toggle(){if(!video.current)return;if(video.current.paused){try{await video.current.play();}catch{setPlaying(false);}}else video.current.pause();}
 return <>
  <div className="preview-device-label"><strong>{names[platform]}</strong><span>Widok mobilny</span></div>
  <div className={'social-phone social-'+platform} data-platform={platform}>
   {src?<video ref={video} src={src} playsInline muted={muted} preload="metadata" onLoadedMetadata={e=>{setDuration(e.target.duration);onMetadata({duration:e.target.duration,width:e.target.videoWidth,height:e.target.videoHeight});}} onError={onError} onTimeUpdate={e=>setProgress(e.target.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/>:<div className="social-empty"><Film size={38} strokeWidth={1}/><strong>Twój film</strong><span>Dodaj plik, aby sprawdzić kadr<br/>pod przyciskami i opisem</span></div>}
   <div className="social-shade"/>
   <div className="social-top" aria-hidden="true">
    {isTT?<><span>LIVE</span><div><span>Obserwowani</span><strong>Dla Ciebie</strong></div><Search size={21}/></>:isIG?<><strong>Rolki <ChevronDown size={16}/></strong><Camera size={25}/></>:isFB?<><ArrowLeft size={24}/><strong>Reels</strong><Camera size={24}/></>:<><strong>Shorts <ChevronDown size={16}/></strong><div><Search size={23}/><MoreVertical size={23}/></div></>}
   </div>
   <div className="social-rail" aria-hidden="true">
    {isTT&&<div className="social-avatar rail-avatar">{handle.slice(0,1).toUpperCase()}<span>+</span></div>}
    <Glyph icon={isYT||isFB?ThumbsUp:Heart} label={count} fill={!isYT&&!isFB}/>
    {isYT&&<Glyph icon={ThumbsDown} label="Nie lubię"/>}
    {comments&&<Glyph icon={MessageCircle} label="0"/>}
    {isTT&&<Glyph icon={Bookmark} label="0" fill/>}
    <Glyph icon={isIG?Send:Forward} label={isIG?'':isYT?'Udostępnij':'0'}/>
    {isIG&&<Glyph icon={MoreHorizontal}/>}
    {isFB&&<Glyph icon={MoreHorizontal}/>}
    {isYT&&<Glyph icon={Music2} label="Remiks"/>}
    {!isFB&&<div className={'sound-cover '+(isTT?'round':'')}><Music2 size={18}/></div>}
   </div>
   <div className="social-copy">
    <div className="social-identity">{!isTT&&<span className="social-avatar">{handle.slice(0,1).toUpperCase()}</span>}<strong>{isYT||isTT?'@':''}{handle}</strong>{!isTT&&<span className="follow-label">{isYT?'Subskrybuj':'Obserwuj'}</span>}</div>
    {synthetic&&<div className="social-disclosure">Informacje o AI</div>}
    {isYT&&options.paidPromotion==='yes'&&<div className="social-disclosure">Zawiera płatną promocję</div>}
    <p className={'social-description '+(!expanded||isYT?'collapsed':'')}>{displayCaption}</p>
    <button className="social-more" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>{expanded?'mniej':isYT?'Opis filmu':'więcej'}</button>
    {!isYT&&<div className="social-audio"><Music2 size={12}/><span>{isIG?handle+' · Oryginalny dźwięk':'Oryginalny dźwięk · '+handle}</span>{isIG&&<Bookmark size={16}/>}</div>}
   </div>
   {isYT&&expanded&&<div className="youtube-description-sheet"><div><strong>Opis</strong><button onClick={()=>setExpanded(false)} aria-label="Zamknij opis">×</button></div><strong>{title||'Tytuł Twojego Shorta'}</strong><p>{caption||'Dodaj opis filmu'}</p></div>}
   <div className="social-nav" aria-hidden="true">
    {isTT?<><Glyph icon={Home} label="Główna"/><Glyph icon={Users} label="Znajomi"/><span className="tiktok-add"><Plus size={23}/></span><Glyph icon={MessageCircle} label="Skrzynka"/><Glyph icon={User} label="Profil"/></>:isIG?<><Home size={23}/><Clapperboard size={23}/><Send size={23}/><Search size={23}/><span className="social-avatar">{handle.slice(0,1).toUpperCase()}</span></>:isFB?<><span>Dodaj komentarz…</span><Heart size={20}/><Send size={19}/></>:<><Glyph icon={Home} label="Główna"/><Glyph icon={Clapperboard} label="Shorts"/><Plus size={26}/><Glyph icon={Users} label="Subskrypcje"/><Glyph icon={User} label="Ty"/></>}
   </div>
  </div>
  <div className="preview-playback"><button className="icon-button" disabled={!src} onClick={toggle} aria-label={playing?'Wstrzymaj podgląd':'Odtwórz podgląd'}>{playing?<Pause size={18}/>:<Play size={18}/>}</button><span>{time(progress)} / {time(duration)}</span><input type="range" aria-label="Pozycja filmu" min={0} max={duration||1} step="0.1" value={progress} disabled={!src} onChange={e=>{if(video.current){video.current.currentTime=Number(e.target.value);setProgress(Number(e.target.value));}}}/><button className="icon-button" disabled={!src} onClick={()=>setMuted(!muted)} aria-label={muted?'Włącz dźwięk podglądu':'Wycisz podgląd'}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button></div>
  <label className="small preview-account">Nazwa konta w podglądzie<input aria-label="Nazwa konta w podglądzie" value={account} maxLength={30} onChange={e=>setAccount(e.target.value)} /></label>
  <details className="sent-caption"><summary>Pełny opis wysyłany do {names[platform]}</summary><p>{caption||'Dodaj opis lub hashtagi.'}</p></details>
  <p className="small preview-note">Symulacja mobilnego interfejsu — układ zależy od wersji aplikacji i ekranu. Przyciski i liczniki są poglądowe. Nakładka nie jest zapisywana w pliku filmu.</p>
 </>;
}
