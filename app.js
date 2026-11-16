"use strict";
// IRONMAN Barcelona 2027, rebuilt plan v2. The workout data lives in training-plan.json.
const RACE = "2027-10-03";
const KEY = "ironmanBarcelonaLogs1"; // preserve existing data from the previous app
const DATA_URL = "./training-plan.json";
let plan = [];
let byDate = new Map();
let gymProgramme = {};
let week = null;
let logs = {};
try {
  const prior = JSON.parse(localStorage.getItem(KEY) || "{}");
  if (prior && typeof prior === 'object' && !Array.isArray(prior)) logs = prior;
} catch (e) { /* malformed prior data, app still works */ }

function $(id) { return document.getElementById(id); }
function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function iso(d = new Date()) { return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); }
function dt(s) { const x=String(s).split('-').map(Number); return new Date(x[0],x[1]-1,x[2],12); }
function add(s,n) { const d=dt(s); d.setDate(d.getDate()+n); return iso(d); }
function mon(s) { const d=dt(s); d.setDate(d.getDate()-(d.getDay()+6)%7); return iso(d); }
function fmt(s,opts={day:'numeric',month:'short'}) {return dt(s).toLocaleDateString('en-GB',opts);}
function todayISO() {return iso();}
function duration(n) {const x=Math.max(0,Math.round(Number(n)||0));return Math.floor(x/60)+'h '+String(x%60).padStart(2,'0')+'m';}
function planned(s) {return byDate.get(s)||{date:s,weekday:'',week:0,phase:'Outside plan',priority:'',sessions:'No scheduled session',plannedMinutes:0,swimMinutes:0,bikeMinutes:0,runMinutes:0,gymMinutes:0,swim:'',bike:'',run:'',gym:'',gymDetails:'',notes:'',milestone:''};}
function st(s) {return logs[s]?.status||'Not logged';}
function isRest(x) {return x.priority==='Protected rest'||x.priority==='Recovery / logistics';}
function pointsFor(s) {const x=planned(s),status=st(s); if(status==='Skipped'||status==='Not logged')return 0;if(status==='Rest honoured')return isRest(x)?2:0;if(status==='Done')return isRest(x)?0:2;if(status==='Modified')return isRest(x)?0:1;return 0;}
function dates(m){return Array.from({length:7},(_,i)=>add(m,i));}
function stats(m){const ds=dates(m),n=ds.filter(d=>st(d)!=='Not logged').length,points=ds.reduce((a,d)=>a+pointsFor(d),0),mins=ds.reduce((a,d)=>a+(+logs[d]?.minutes||0),0),plannedMins=ds.reduce((a,d)=>a+(+planned(d).plannedMinutes||0),0);return {ds,n,points,mins,plannedMins,pct:Math.round(points/14*100)};}
function cls(s) {return s==='Rest honoured'?'Rest':String(s).replaceAll(' ','');}
function show(v){document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===v));document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',el.dataset.v===v));if(v==='home')home();if(v==='week')renderWeek();if(v==='progress')progress();window.scrollTo(0,0);}
function details(x){
  const parts=[['Swim',x.swimMinutes,x.swim],['Bike',x.bikeMinutes,x.bike],['Run / brick',x.runMinutes,x.run]];
  let html=parts.filter(a=>a[1]>0||a[2]).map(a=>'<div class="sessiondetail"><h3>'+esc(a[0])+' · '+esc(a[1]||0)+' minutes</h3><p>'+esc(a[2]||'Easy / as prescribed')+'</p></div>').join('');
  if(x.gymMinutes>0){html+='<div class="sessiondetail"><h3>Strength · '+esc(x.gymMinutes)+' minutes</h3><p>'+esc(x.gym||'Maintenance gym')+'</p></div>';}
  if(x.notes)html+='<div class="sessiondetail"><h3>Coaching note</h3><p>'+esc(x.notes)+'</p></div>';
  if(x.milestone)html+='<div class="sessiondetail"><h3>Milestone</h3><p>'+esc(x.milestone)+'</p></div>';
  return html;
}
function gymGuide(x){
  if(!x.gym) return '';
  const key=Object.keys(gymProgramme).find(k=>x.gym.startsWith(k));
  let html='<div class="gymguide"><h3>'+esc(x.gym)+' · '+esc(x.gymMinutes)+' min</h3>';
  html+='<p><strong>Today’s prescription:</strong> '+esc(x.gymDetails||'Use controlled movement and stay fresh for endurance work.')+'</p>';
  if(key && !/easy prep/i.test(x.gym)){
    html+='<p><strong>Exercise references and execution cues</strong> (reference loads are not mandatory targets):</p><ol class="gymtable">';
    const peak=/(build|peak|specific|taper)/i.test(x.phase);
    for(const item of gymProgramme[key]){
      html+='<li><b>'+esc(item.exercise)+'</b><span>'+esc(peak?item.buildPeak:item.foundation)+' · '+esc(item.loadReference)+'</span><span>'+esc(item.cue)+'</span></li>';
    }
    html+='</ol>';
  }
  html+='<p>5-minute brisk walking warm-up; add easy ramp-up sets. Keep 2–3 reps in reserve and avoid failure. Decrease accessory volume when swimming or cycling recovery suffers. Reintroduce heavy hinging only when symptom-free and agreed with your physiotherapist.</p></div>';
  return html;
}
function distribute(s,mins){
  const x=planned(s),weights={Swim:+x.swimMinutes||0,Bike:+x.bikeMinutes||0,Run:+x.runMinutes||0,Strength:+x.gymMinutes||0};
  const sum=Object.values(weights).reduce((a,v)=>a+v,0);
  if(!sum)return {Swim:0,Bike:0,Run:0,Strength:0,Other:mins};
  return {Swim:mins*weights.Swim/sum,Bike:mins*weights.Bike/sum,Run:mins*weights.Run/sum,Strength:mins*weights.Strength/sum,Other:0};
}
function home(){
  const t=todayISO(),m=mon(t),s=stats(m),daysLeft=Math.ceil((dt(RACE)-dt(t))/86400000);
  $('countdown').textContent=daysLeft>0?daysLeft+' days to race':daysLeft===0?'RACE DAY':'Race day passed';
  $('weekHours').textContent=duration(s.mins);$('weekPct').textContent=s.points+' / 14';$('weekBar').style.width=s.pct+'%';
  $('weekDone').textContent=s.n+' of 7 days logged';$('weekPlanned').textContent=s.plannedMins+' planned min';$('weekLabel').textContent='Week of '+fmt(m);
  const x=planned(t);$('todayPhase').textContent=x.phase+(x.priority?' · '+x.priority:'');$('todaySession').textContent=x.sessions;
  $('todayMeta').textContent=x.plannedMinutes+' planned min · '+(x.gym||'No gym');$('todayFocus').textContent=x.phase==='Outside plan'?'Your plan runs 16 Nov 2026 – 3 Oct 2027.':'';
  $('todayDetails').innerHTML=details(x);$('todayGym').innerHTML=gymGuide(x);
  const badge=$('todayStatus');badge.textContent=st(t);badge.className='status '+cls(st(t));
  const totals={Swim:0,Bike:0,Run:0};
  for(let i=0;i<7;i++){const d=add(t,-i),allocation=distribute(d,+logs[d]?.minutes||0);for(const k in totals)totals[k]+=allocation[k];}
  for(const k in totals)$(k.toLowerCase()).textContent=duration(totals[k]);
}
function renderWeek(){
  week=week||mon(todayISO());const s=stats(week);
  $('weekRange').textContent=fmt(week)+' – '+fmt(add(week,6),{day:'numeric',month:'short',year:'numeric'});
  $('weekScore').textContent=s.points+' / 14 points';
  $('days').innerHTML=s.ds.map(d=>{const x=planned(d),v=st(d);return '<button class="day" onclick="openLog(\''+d+'\')"><div class="datebox"><span class="muted small">'+esc(fmt(d,{weekday:'short'}))+'</span><b>'+dt(d).getDate()+'</b></div><div class="dayinfo"><strong>'+esc(x.sessions)+'</strong><small>'+x.plannedMinutes+' planned min'+(x.priority==='Protected rest'?' · REST':(x.priority==='Key endurance'?' · KEY':''))+(d===todayISO()?' · TODAY':'')+'</small></div><span class="status '+cls(v)+'">'+esc(v)+'</span></button>';}).join('');
}
function shift(n){week=add(week||mon(todayISO()),7*n);renderWeek();}
function updateLogDate(){const x=planned($('date').value);$('sessionInfo').textContent=x.sessions+' · '+x.plannedMinutes+' planned min · '+x.phase;$('logDetails').innerHTML=details(x);$('logGym').innerHTML=gymGuide(x);}
function openLog(d){
  const x=planned(d),l=logs[d]||{};$('date').value=d;
  $('logHeading').textContent='Log · '+fmt(d,{weekday:'long',day:'numeric',month:'long'});
  updateLogDate();$('status').value=l.status||(isRest(x)?'Rest honoured':'Done');$('minutes').value=l.minutes??(x.plannedMinutes||0);
  $('distance').value=l.distance||'';$('rpe').value=l.rpe||'';$('notes').value=l.notes||'';$('saved').textContent='';show('log');
}
function save(){
  const d=$('date').value;if(!d)return;
  const minutes=Math.max(0,Math.round(Number($('minutes').value)||0));
  logs[d]={status:$('status').value,minutes,distance:$('distance').value,rpe:$('rpe').value,notes:$('notes').value};
  try{localStorage.setItem(KEY,JSON.stringify(logs));$('saved').textContent='Saved on this device. '+pointsFor(d)+' points earned.';}catch(err){$('saved').textContent='Unable to save to device storage; check Safari settings.';return;}
  home();
}
function progress(){
  const ks=Object.keys(logs).filter(d=>logs[d]&&typeof logs[d]==='object'),mins=ks.reduce((a,d)=>a+(+logs[d].minutes||0),0),scored=ks.filter(d=>pointsFor(d)>0).length;
  $('totalTime').textContent=duration(mins);$('totalSessions').textContent=scored;
  const totals={Swim:0,Bike:0,Run:0,Strength:0,Other:0};
  for(const d of ks){const allocation=distribute(d,+logs[d].minutes||0);for(const k of Object.keys(totals))totals[k]+=allocation[k]||0;}
  const max=Math.max(1,...Object.values(totals));
  $('bars').innerHTML=Object.entries(totals).map(([k,v])=>'<div class="chart"><span>'+esc(k)+'</span><div class="bar"><i style="width:'+(v/max*100).toFixed(1)+'%"></i></div><b>'+Math.round(v)+'m</b></div>').join('')+'<p class="muted small">Discipline times are estimates based on the planned split of combined sessions; total logged time is exact.</p>';
  $('recent').innerHTML=Array.from({length:6},(_,i)=>{const m=add(mon(todayISO()),-7*i),s=stats(m);return '<div class="row" style="margin:12px 0"><span class="muted small">'+esc(fmt(m))+'</span><span>'+duration(s.mins)+'</span><b>'+s.points+'/14 points</b></div><div class="progress"><i style="width:'+s.pct+'%"></i></div>';}).join('');
}
async function backup(){
  const payload=JSON.stringify({app:'IRONMAN Barcelona 2027',version:2,exportedAt:new Date().toISOString(),logs},null,2),stamp=todayISO(),filename='ironman-training-backup-'+stamp+'.json';
  const msg=$('backupMsg');
  try{
    const file=new File([payload],filename,{type:'application/json'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:'IRONMAN training backup',text:'Save in OneDrive / IRONMAN Barcelona 2027.'});
      msg.textContent='Share sheet opened. Save this file to OneDrive.';return;
    }
  }catch(err){if(err?.name==='AbortError'){msg.textContent='Sharing cancelled. No backup was sent.';return;}}
  const u=URL.createObjectURL(new Blob([payload],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);msg.textContent='Backup downloaded. Save it to OneDrive.';
}
function restore(event){
  const file=event.target.files[0];if(!file)return;const reader=new FileReader();
  reader.onload=()=>{try{
    const x=JSON.parse(reader.result);if(!x.logs||typeof x.logs!=='object'||Array.isArray(x.logs))throw new Error('Invalid backup');
    if(!confirm('Restore this backup? It replaces the training log currently saved on this device.'))return;
    localStorage.setItem(KEY,JSON.stringify(x.logs));logs=x.logs;home();progress();$('backupMsg').textContent='Backup restored successfully.';
  }catch(err){$('backupMsg').textContent='The backup could not be restored. Current logs remain unchanged.';}finally{event.target.value='';}};
  reader.onerror=()=>{$('backupMsg').textContent='Could not read the selected file.';event.target.value='';};reader.readAsText(file);
}
async function loadSchedule(){
  try{
    const response=await fetch(DATA_URL,{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);
    const data=await response.json();
    if(data.schema!=='ironman-barcelona-2027-daily-plan-v2'||!Array.isArray(data.days)||data.days.length!==322||!data.gymProgramme)throw new Error('Unexpected schedule format');
    plan=data.days;byDate=new Map(plan.map(d=>[d.date,d]));gymProgramme=data.gymProgramme;
    $('scheduleStatus').textContent='Rebuilt programme loaded · '+data.startDate+' to '+data.endDate+' · offline-ready after first full load';
  }catch(err){
    $('scheduleStatus').textContent='Schedule not loaded. Please open the app online once and refresh. '+String(err.message||err);
  }
  home();
}
$('date').addEventListener('change',()=>{
  updateLogDate();
  const d=$('date').value,l=logs[d]||{},x=planned(d);
  $('status').value=l.status||(isRest(x)?'Rest honoured':'Done');$('minutes').value=l.minutes??(x.plannedMinutes||0);
  $('distance').value=l.distance||'';$('rpe').value=l.rpe||'';$('notes').value=l.notes||'';
});
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
loadSchedule();
