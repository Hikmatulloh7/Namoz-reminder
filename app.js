const CITY = "Namangan";
const API = "https://api.aladhan.com/v1/timingsByCity";
const names = [["Fajr","Bomdod"],["Sunrise","Quyosh"],["Dhuhr","Peshin"],["Asr","Asr"],["Maghrib","Shom"],["Isha","Xufton"]];
let timings = {};
let timer;
const $ = id => document.getElementById(id);
function localDate(){const d=new Date();return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;}
function cleanTime(v){return (v||"").split(" ")[0].slice(0,5);}
function dateForTime(t){const [h,m]=t.split(":").map(Number);const d=new Date();d.setHours(h,m,0,0);return d;}
async function loadTimes(){
  $("status").textContent="Yuklanmoqda";
  try{
    const d=new Date();
    const url=`${API}/${d.getDate()}-${d.getMonth()+1}-${d.getFullYear()}?city=${encodeURIComponent(CITY)}&country=Uzbekistan&method=3`;
    const r=await fetch(url); if(!r.ok) throw new Error("API javob bermadi");
    const j=await r.json(); if(j.code!==200) throw new Error("Vaqtlarni olish imkoni bo‘lmadi");
    timings=j.data.timings;
    $("today").textContent="Namangan";
    $("date").textContent=`${localDate()} · ${j.data.date.hijri.day} ${j.data.date.hijri.month.uz || j.data.date.hijri.month.en} ${j.data.date.hijri.year}`;
    render(); $("status").textContent="Yangilandi"; $("updated").textContent=`Yangilangan: ${new Date().toLocaleTimeString("uz-UZ",{hour:"2-digit",minute:"2-digit"})}`;
    scheduleWhileOpen();
  }catch(e){$("status").textContent="Ulanishda xato";$("date").textContent="Internetni tekshirib, qayta urinib ko‘ring.";console.error(e);}
}
function render(){
  const now=new Date(); const list=names.map(([key,label])=>({key,label,time:cleanTime(timings[key])}));
  $("prayers").innerHTML=list.map(p=>`<div class="prayer" data-key="${p.key}"><span>${p.label}</span><time>${p.time}</time></div>`).join("");
  const upcoming=list.filter(p=>p.key!=="Sunrise").map(p=>({...p,at:dateForTime(p.time)})).find(p=>p.at>now);
  const next=upcoming||{...list[0],at:(()=>{const x=dateForTime(list[0].time);x.setDate(x.getDate()+1);return x;})()};
  $("nextName").textContent=next.label;$("nextAt").textContent=`${next.time}`;
  document.querySelectorAll(".prayer").forEach(el=>{if(el.dataset.key===next.key)el.classList.add("active")});
  tick(next);
}
function tick(next){
  clearInterval(timer);
  const update=()=>{let ms=next.at-new Date();if(ms<=0){loadTimes();return;}const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);$("countdown").textContent=[h,m,s].map(x=>String(x).padStart(2,"0")).join(":");};
  update();timer=setInterval(update,1000);
}
function scheduleWhileOpen(){
  if(!("Notification" in window)||Notification.permission!=="granted"||!$("notifications").checked)return;
  const lead=Number($("lead").value);
  names.filter(([k])=>k!=="Sunrise").forEach(([key,label])=>{
    const at=dateForTime(cleanTime(timings[key]));const fire=at.getTime()-lead*60000;
    const delay=fire-Date.now();
    if(delay>0&&delay<24*60*60*1000){setTimeout(()=>new Notification("Namoz vaqti yaqinlashmoqda",{body:`${label} namoziga ${lead} daqiqa qoldi.`,tag:`${key}-${localDate()}`} ),delay);}
  });
  $("notice").textContent="Eslatmalar shu sahifa ochiq turgan paytda ishlaydi. Ishonchli fon bildirishnomalari uchun keyingi bosqichda push-server ulaymiz.";
}
$("notifications").addEventListener("change",async e=>{
  if(e.target.checked){
    if(!("Notification" in window)){e.target.checked=false;$("notice").textContent="Bu brauzer bildirishnomalarni qo‘llamaydi.";return;}
    const permission=await Notification.requestPermission();
    if(permission!=="granted"){e.target.checked=false;$("notice").textContent="Bildirishnomalarga ruxsat berilmadi.";return;}
  }
  scheduleWhileOpen();
});
$("lead").addEventListener("change",scheduleWhileOpen);
$("refresh").addEventListener("click",loadTimes);
loadTimes();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(console.error));
