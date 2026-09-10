// Operates TikTok's visible scheduling controls. Never clicks the final button.
(()=>{
 const MINUTE=60000;
 const MONTHS=[['styczeń','january'],['luty','february'],['marzec','march'],['kwiecień','april'],['maj','may'],['czerwiec','june'],['lipiec','july'],['sierpień','august'],['wrzesień','september'],['październik','october'],['listopad','november'],['grudzień','december']];
 const norm=value=>String(value||'').replace(/\s+/g,' ').trim();
 async function prepare({wait,click,control,all,visible,enabled,checked}){
  const schedule=globalThis.UplowWorkSchedule;
  if(!schedule?.earliestSchedule||!schedule?.readSchedule)throw new Error('Brak obsługi harmonogramu TikToka. Przeładuj rozszerzenie.');
  const one=elements=>elements.length===1?elements[0]:null;
  const radio=()=>one([...document.querySelectorAll('input[type="radio"][name="postSchedule"][value="schedule"]')].filter(e=>e.isConnected&&!e.closest('[inert]')));
  const scheduleSelected=()=>{const selected=radio();return selected&&checked(selected)&&![...document.querySelectorAll('input[type="radio"][name="postSchedule"]')].some(e=>e!==selected&&checked(e));};
  const fields=()=>{
   const inputs=all('.scheduled-picker input[readonly]');
   const date=one(inputs.filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.value)));
   const time=one(inputs.filter(e=>/^\d{2}:\d{2}$/.test(e.value)));
   return date&&time?{date,time}:null;
  };
  const button=()=>{const e=control(/^(Zaplanuj|Schedule)$/);return e&&visible(e)&&enabled(e)?e:null;};
  const calendar=()=>one(all('.calendar-wrapper'));
  const timepicker=()=>one(all('.tiktok-timepicker-time-picker-container'));
  const monthInfo=element=>{
   const monthTitle=one(all('.month-title',element)),yearTitle=one(all('.year-title',element));
   const month=MONTHS.findIndex(names=>names.includes(norm(monthTitle?.textContent).toLocaleLowerCase('pl-PL')));
   const yearText=norm(yearTitle?.textContent);
   if(month<0||!/^\d{4}$/.test(yearText))throw new Error('Nie rozpoznano miesiąca i roku w kalendarzu TikToka.');
   return {year:Number(yearText),month};
  };
  const dayAt=(element,target)=>{
   const {year,month}=monthInfo(element),days=all('.days-wrapper .day',element);
   if(days.length<28||days.length>49)throw new Error('Nie rozpoznano układu dni w kalendarzu TikToka.');
   // Some grids include the preceding Sunday even when day 1 is a Sunday.
   const first=Number(norm(days[0].textContent)),weekday=new Date(year,month,1).getDay();
   const offset=first===1?0:(weekday||7);
   const start=Date.UTC(year,month,1-offset);
   if(days.some((day,index)=>Number(norm(day.textContent))!==new Date(start+index*86400000).getUTCDate()))throw new Error('Nie potwierdzono kolejności dni w kalendarzu TikToka.');
   const [targetYear,targetMonth,targetDay]=target.date.split('-').map(Number);
   const index=(Date.UTC(targetYear,targetMonth-1,targetDay)-start)/86400000;
   return {day:Number.isInteger(index)&&index>=0&&index<days.length?days[index]:null,monthDelta:(targetYear-year)*12+targetMonth-1-month};
  };
  async function chooseDate(target){
   const current=await wait(fields,'pola daty i godziny TikToka',30000);
   if(current.date.value===target.date)return;
   click(current.date);
   await wait(calendar,'kalendarz harmonogramu TikToka',15000);
   for(let navigation=0;navigation<12;navigation++){
    const element=await wait(calendar,'kalendarz harmonogramu TikToka',15000);
    const {day,monthDelta}=dayAt(element,target);
    if(day?.classList.contains('valid')&&enabled(day)){
     day.scrollIntoView?.({block:'nearest'});
     click(day);
     await wait(()=>fields()?.date.value===target.date,'potwierdzenie daty '+target.date+' na TikToku',15000);
     return;
    }
    if(monthDelta===0)throw new Error('Najbliższa data jest niedostępna w kalendarzu TikToka.');
    const arrows=all('.month-header-wrapper .arrow',element);
    if(arrows.length!==2)throw new Error('Nie znaleziono przycisków zmiany miesiąca TikToka.');
    const arrow=arrows[monthDelta<0?0:1];
    if(!enabled(arrow))throw new Error('TikTok nie pozwala przejść do wymaganego miesiąca.');
    const before=monthInfo(element);click(arrow);
    await wait(()=>{const next=calendar();if(!next)return false;const value=monthInfo(next);return value.year!==before.year||value.month!==before.month;},'zmiana miesiąca kalendarza TikToka',15000);
   }
   throw new Error('Nie udało się wybrać najbliższej daty TikToka.');
  }
  async function chooseTime(target){
   const current=await wait(fields,'pola daty i godziny TikToka',30000);
   if(current.time.value===target.time)return;
   click(current.time);
   await wait(timepicker,'wybór godziny harmonogramu TikToka',15000);
   const [hour,minute]=target.time.split(':');
   if(fields()?.time.value.split(':')[0]!==hour){
    const hourControl=await wait(()=>{const picker=timepicker();return picker&&one(all('.tiktok-timepicker-left',picker).filter(e=>norm(e.textContent)===hour&&enabled(e)));},'godzina '+hour+' w harmonogramie TikToka',15000);
    hourControl.scrollIntoView?.({block:'nearest'});
    click(hourControl);
    await wait(()=>{const picker=timepicker();return fields()?.time.value.split(':')[0]===hour||picker&&all('.tiktok-timepicker-left.tiktok-timepicker-is-active',picker).some(e=>norm(e.textContent)===hour);},'potwierdzenie godziny TikToka',15000);
   }
   if(fields()?.time.value!==target.time){
    const minuteControl=await wait(()=>{const picker=timepicker();return picker&&one(all('.tiktok-timepicker-right',picker).filter(e=>norm(e.textContent)===minute&&enabled(e)));},'minuta '+minute+' w harmonogramie TikToka',15000);
    minuteControl.scrollIntoView?.({block:'nearest'});
    click(minuteControl);
   }
   await wait(()=>fields()?.time.value===target.time,'potwierdzenie czasu '+target.time+' na TikToku',15000);
  }
  const option=await wait(radio,'opcja Zaplanuj TikToka — konto musi udostępniać harmonogram',30000);
  if(!checked(option)){
   const target=visible(option)?option:option.closest('label');
   if(!target||!visible(target)||!enabled(option))throw new Error('Opcja harmonogramu TikToka jest niedostępna.');
   click(target);
  }
  await wait(()=>scheduleSelected()&&fields()&&button(),'aktywny harmonogram i przycisk Zaplanuj TikToka',30000);
  for(let attempt=0;attempt<3;attempt++){
   const target=schedule.earliestSchedule(Date.now()+2000);
   await chooseDate(target);
   await chooseTime(target);
   const result=await wait(()=>{
    if(!scheduleSelected())throw new Error('TikTok wyłączył harmonogram. Wysyłka zatrzymana.');
    const value=fields(),ready=button();
    return value&&ready&&value.date.getAttribute('aria-invalid')!=='true'&&value.time.getAttribute('aria-invalid')!=='true'&&value.date.value===target.date&&value.time.value===target.time?{date:value.date.value,time:value.time.value,button:ready}:null;
   },'końcowe potwierdzenie harmonogramu TikToka',30000);
   const actual=schedule.readSchedule(result.date,result.time),remaining=actual.timestamp-Date.now();
   if(remaining<15*MINUTE||remaining>20*MINUTE+5000)continue;
   if(actual.timestamp!==target.timestamp||actual.timezoneOffset!==target.timezoneOffset)throw new Error('Strefa czasowa harmonogramu TikToka zmieniła się. Wysyłka zatrzymana.');
   return {button:result.button,proof:{scheduleConfirmed:true,scheduleDate:actual.date,scheduleTime:actual.time,scheduledAt:actual.timestamp,scheduleTimezoneOffset:actual.timezoneOffset}};
  }
  throw new Error('Nie potwierdzono terminu TikToka za co najmniej 15 minut. Ponów przygotowanie harmonogramu.');
 }
 globalThis.UplowWorkTikTokSchedule=Object.freeze({prepare});
})();
