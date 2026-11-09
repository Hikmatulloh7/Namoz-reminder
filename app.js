// Namoz Reminder - Namangan shahri
// Vaqtlar ilovaning ichida hisoblanadi (internet va tashqi sayt kerak emas).
// Hisob Namangan shahri uchun rasmiy jadval (namoz-vaqti.uz) bilan moslashtirilgan.
// Peshin doimiy 12:35.
const PESHIN = "12:35";
const TZ = "Asia/Tashkent"; // UTC+5, yozgi/qishki vaqt yo'q
const LAT = 40.9983, LON = 71.6726;
// Rasmiy jadvalga moslangan sozlamalar
const P = {fa:15.5, fo:0, sa:0.3, so:-2.5, ak:2.06, ao:-3.0, ma:0.6, mo:3.75, ia:15.3, io:0.5};

const names = [["bomdod","Bomdod"],["quyosh","Quyosh"],["peshin","Peshin"],["asr","Asr"],["shom","Shom"],["xufton","Xufton"]];
const $ = id => document.getElementById(id);
let timer;
let reminderTimeouts = [];

const rad = x => x * Math.PI / 180;
function julian(y, m, d, h){
  if(m <= 2){ y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + h / 24;
}
function sunPos(J){
  const n = J - 2451545.0;
  const L = (((280.460 + 0.9856474 * n) % 360) + 360) % 360;
  const g = rad((((357.528 + 0.9856003 * n) % 360) + 360) % 360);
  const lam = rad(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
  const eps = rad(23.439 - 0.0000004 * n);
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const ra = ((Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * 180 / Math.PI) % 360 + 360) % 360;
  const eot = ((((L - ra + 180) % 360) + 360) % 360 - 180) * 4;
  return {dec, eot};
}
function hourAngle(dec, alt){
  const la = rad(LAT);
  let c = (Math.sin(rad(alt)) - Math.sin(la) * Math.sin(dec)) / (Math.cos(la) * Math.cos(dec));
  c = Math.max(-1, Math.min(1, c));
  return Math.acos(c) * 180 / Math.PI * 4; // daqiqada
}
function asrAltitude(dec, k){
  return Math.atan(1 / (k + Math.tan(Math.abs(rad(LAT) - dec)))) * 180 / Math.PI;
}
function fmt(min){
  const x = Math.round(min);
  return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0");
}
// dateStr: "YYYY-MM-DD" -> {bomdod, quyosh, peshin, asr, shom, xufton}
function timesFor(dateStr){
  const [y, m, d] = dateStr.split("-").map(Number);
  const {dec, eot} = sunPos(julian(y, m, d, 7.0));
  const noon = 720 - 4 * LON - eot + 300;
  return {
    bomdod: fmt(noon - hourAngle(dec, -P.fa) + P.fo),
    quyosh: fmt(noon - hourAngle(dec, -P.sa) + P.so),
    peshin: PESHIN,
    asr:    fmt(noon + hourAngle(dec, asrAltitude(dec, P.ak)) + P.ao),
    shom:   fmt(noon + hourAngle(dec, -P.ma) + P.mo),
    xufton: fmt(noon + hourAngle(dec, -P.ia) + P.io)
  };
}

function ymd(d){ return d.toLocaleDateString("en-CA", {timeZone: TZ}); }
function addDays(s, n){ return ymd(new Date(new Date(s + "T12:00:00+05:00").getTime() + n * 86400000)); }
function atTime(dateStr, t){ return new Date(`${dateStr}T${t}:00+05:00`); }
function showDate(s){ const [y, m, d] = s.split("-"); return `${d}-${m}-${y}`; }

function loadTimes(){
  const today = ymd(new Date());
  $("today").textContent = "Namangan";
  $("date").textContent = showDate(today);
  render();
  $("status").textContent = "Yangilandi";
  $("updated").textContent = `Yangilangan: ${new Date().toLocaleTimeString("uz-UZ", {hour: "2-digit", minute: "2-digit"})}`;
  scheduleWhileOpen();
}

function findNext(){
  const now = new Date();
  const today = ymd(now);
  for(const dateStr of [today, addDays(today, 1)]){
    const t = timesFor(dateStr);
    for(const [key, label] of names){
      if(key === "quyosh") continue;
      const at = atTime(dateStr, t[key]);
      if(at > now) return {key, label, time: t[key], at};
    }
  }
  return null;
}

function render(){
  const t = timesFor(ymd(new Date()));
  $("prayers").innerHTML = names.map(([key, label]) => `<div class="prayer" data-key="${key}"><span>${label}</span><time>${t[key]}</time></div>`).join("");
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
    if(ms <= 0){ clearInterval(timer); loadTimes(); return; }
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
    names.filter(([k]) => k !== "quyosh").forEach(([key, label]) => {
      const at = atTime(dateStr, t[key]);
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
