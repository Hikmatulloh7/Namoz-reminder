// Namoz Reminder - Namangan shahri
// Manba: namoz-vaqti.uz (Din ishlari qo'mitasi xulosasi asosida). Peshin doimiy 12:35.
const REGION = "namangan-shahri";
const API = "https://namoz-vaqti.uz/index.php";
const PESHIN = "12:35";
const TZ = "Asia/Tashkent"; // UTC+5, yozgi/qishki vaqt yo'q
const names = [["bomdod","Bomdod"],["quyosh","Quyosh"],["peshin","Peshin"],["asr","Asr"],["shom","Shom"],["xufton","Xufton"]];
const $ = id => document.getElementById(id);
let days = {};       // "YYYY-MM-DD" -> {bomdod, quyosh, peshin, asr, shom, xufton}
let timer;
let reminderTimeouts = [];

function ymd(d){ return d.toLocaleDateString("en-CA", {timeZone: TZ}); }
function addDays(s, n){ return ymd(new Date(new Date(s + "T12:00:00+05:00").getTime() + n * 86400000)); }
function cleanTime(v){ return (v || "").trim().slice(0, 5); }
function atTime(dateStr, t){ return new Date(`${dateStr}T${t}:00+05:00`); }
function showDate(s){ const [y, m, d] = s.split("-"); return `${d}-${m}-${y}`; }
function store(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){} }
function restore(key){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }catch(e){ return null; } }

async function fetchMonth(ym){
  const key = "namoz_" + REGION + "_" + ym;
  try{
    const r = await fetch(`${API}?format=json&lang=en&period=${ym}&region=${REGION}`, {cache: "no-store"});
    if(!r.ok) throw new Error("API javob bermadi: " + r.status);
    const j = await r.json();
    if(!Array.isArray(j.period_table) || !j.period_table.length) throw new Error("Jadval bo'sh keldi");
    const rows = j.period_table.map(x => { const [dd, mm, yy] = x.date.split("."); return {date: `${yy}-${mm}-${dd}`, times: x.times}; });
    store(key, rows);
    return {rows, cached: false};
  }catch(e){
    const c = restore(key);
    if(c) return {rows: c, cached: true};
    throw e;
  }
}

function timesFor(dateStr){
  const row = days[dateStr];
  if(!row) return null;
  return {...row, peshin: PESHIN};
}

async function loadTimes(){
  $("status").textContent = "Yuklanmoqda";
  try{
    const today = ymd(new Date());
    const ym = today.slice(0, 7);
    const nextYm = addDays(ym + "-01", 32).slice(0, 7);
    const [cur, nxt] = await Promise.allSettled([fetchMonth(ym), fetchMonth(nextYm)]);
    if(cur.status !== "fulfilled") throw cur.reason;
    days = {};
    [cur, nxt].forEach(p => { if(p.status === "fulfilled") p.value.rows.forEach(r => { days[r.date] = r.times; }); });
    if(!days[today]) throw new Error("Bugungi kun jadvalda yo'q");
    $("today").textContent = "Namangan";
    $("date").textContent = showDate(today);
    render();
    const cached = cur.value.cached;
    $("status").textContent = cached ? "Internet yo'q, saqlangan jadval ko'rsatilmoqda" : "Yangilandi";
    $("updated").textContent = `Yangilangan: ${new Date().toLocaleTimeString("uz-UZ", {hour: "2-digit", minute: "2-digit"})}`;
    scheduleWhileOpen();
  }catch(e){
    $("status").textContent = "Ulanishda xato";
    $("date").textContent = "Internetni tekshirib, qayta urinib ko'ring.";
    console.error(e);
  }
}

function findNext(){
  const now = new Date();
  const today = ymd(now);
  for(const dateStr of [today, addDays(today, 1)]){
    const t = timesFor(dateStr);
    if(!t) continue;
    for(const [key, label] of names){
      if(key === "quyosh") continue;
      const time = cleanTime(t[key]);
      const at = atTime(dateStr, time);
      if(at > now) return {key, label, time, at};
    }
  }
  return null;
}

function render(){
  const today = ymd(new Date());
  const t = timesFor(today);
  if(!t) return;
  $("prayers").innerHTML = names.map(([key, label]) => `<div class="prayer" data-key="${key}"><span>${label}</span><time>${cleanTime(t[key])}</time></div>`).join("");
  const next = findNext();
  if(!next){ $("nextName").textContent = "-"; $("nextAt").textContent = "--:--"; $("countdown").textContent = "--:--:--"; return; }
  $("nextName").textContent = next.label;
  $("nextAt").textContent = next.time;
  document.querySelectorAll(".prayer").forEach(el => { if(el.dataset.key === next.key) el.classList.add("active"); });
  tick(next);
}

function tick(next){
  clearInterval(timer);
  const update = () => {
    const ms = next.at - new Date();
    if(ms <= 0){ clearInterval(timer); render(); return; }
    const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
    $("countdown").textContent = [h, m, s].map(x => String(x).padStart(2, "0")).join(":");
  };
  update();
  timer = setInterval(update, 1000);
}

async function notify(title, body, tag){
  try{
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {body, tag});
  }catch(e){
    try{ new Notification(title, {body, tag}); }catch(err){ console.error(err); }
  }
}

function scheduleWhileOpen(){
  reminderTimeouts.forEach(clearTimeout);
  reminderTimeouts = [];
  if(!("Notification" in window) || Notification.permission !== "granted" || !$("notifications").checked) return;
  const lead = Number($("lead").value);
  const today = ymd(new Date());
  [today, addDays(today, 1)].forEach(dateStr => {
    const t = timesFor(dateStr);
    if(!t) return;
    names.filter(([k]) => k !== "quyosh").forEach(([key, label]) => {
      const at = atTime(dateStr, cleanTime(t[key]));
      const delay = at.getTime() - lead * 60000 - Date.now();
      if(delay > 0 && delay < 36 * 60 * 60 * 1000){
        reminderTimeouts.push(setTimeout(() => notify("Namoz vaqti yaqinlashmoqda", `${label} namoziga ${lead} daqiqa qoldi.`, `${key}-${dateStr}`), delay));
      }
    });
  });
  $("notice").textContent = "Eslatmalar shu sahifa ochiq turgan paytda ishlaydi. Ishonchli fon bildirishnomalari uchun keyingi bosqichda push-server ulaymiz.";
}

$("notifications").addEventListener("change", async e => {
  if(e.target.checked){
    if(!("Notification" in window)){ e.target.checked = false; $("notice").textContent = "Bu brauzer bildirishnomalarni qo'llamaydi."; return; }
    const permission = await Notification.requestPermission();
    if(permission !== "granted"){ e.target.checked = false; $("notice").textContent = "Bildirishnomalarga ruxsat berilmadi."; return; }
  }
  scheduleWhileOpen();
});
$("lead").addEventListener("change", scheduleWhileOpen);
$("refresh").addEventListener("click", loadTimes);
loadTimes();
if("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.error));
