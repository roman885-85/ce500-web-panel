'use strict';
/* Панель керування комутатором Cisco Catalyst Express 500. Церква «Відродження».
   Сторінка живе у пам'яті самого комутатора й звертається до нього напряму. */
const $ = (s, r = document) => r.querySelector(s);
const el = sel => $(sel) || document.createElement('button');

const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let PORTS = [], OV = {}, SEL = null, busy = false, paused = false, tick = 0, marked = new Set();

/* ---------- зв'язок ---------- */
function strip(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<h1>[\s\S]*?<\/h1>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/command completed\./g, '')
    .replace(/&#34;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .split('\n')
    .filter(l => !/^\s*$|^\s*Home\s+Exec\s+Configure|Command base-URL|^Complete URL|^Command was|\/level\/15|^Output$/.test(l))
    .map(l => l.replace(/\s+$/, '')).join('\n');
}
async function exec(cmd) {
  if (cmd.includes('/')) return execRaw(cmd);
  const path = cmd.trim().split(/\s+/).map(encodeURIComponent).join('/');
  return strip(await (await fetch(`/level/15/exec/${path}/CR`, { cache: 'no-store' })).text());
}
async function execRaw(cmd) {
  const body = new URLSearchParams({ command: cmd, command_url: '/level/15/exec/-' });
  const r = await fetch('/level/15/exec/-/configure/http', {
    method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store' });
  return strip(await r.text());
}
async function cfg(cmd, iface) {
  const base = iface ? `/level/15/interface/${iface}/-` : '/level/15/configure/-';
  const path = cmd.trim().split(/\s+/).map(encodeURIComponent).join('/');
  return strip(await (await fetch(`${base}/${path}/CR`, { cache: 'no-store' })).text());
}
async function cfgLines(lines) {
  const f = 'panel.cli';
  const put = async (seg, first) => {
    const p = seg === '\n' ? '%0A' : seg.trim().split(/\s+/).map(encodeURIComponent).join('/');
    await fetch(`/level/15/exec/cluster/pref/file/${first ? '' : 'append/'}${f}/${p}/CR`, { cache: 'no-store' });
  };
  await put('\n', true);
  for (const l of lines) { await put(l); await put('\n'); }
  await put('end'); await put('\n');
  const out = await exec(`copy ${f} running-config`);
  await exec(`del flash:${f}`);
  return out;
}
/* підписи портів українською — у файлі комутатора, щоб їх бачили всі пристрої */
const LBL_FILE = 'flash:html/labels.txt';
let LABELS = {};
async function loadLabels() {
  try {
    const r = await fetch('/labels.txt?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('немає файлу');
    const b64 = (await r.text()).trim().replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    LABELS = JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    try { LABELS = JSON.parse(localStorage.getItem('portLabels') || '{}'); } catch (e2) { LABELS = {}; }
  }
}
async function saveLabels() {
  try { localStorage.setItem('portLabels', JSON.stringify(LABELS)); } catch (e) {}
  const bytes = new TextEncoder().encode(JSON.stringify(LABELS));
  const enc = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
  const parts = enc.match(/.{1,90}/g) || [''];
  await execRaw(`del ${LBL_FILE}`);
  for (let i = 0; i < parts.length; i++)
    await execRaw(`cluster pref file ${i ? 'append ' : ''}labels.txt ${parts[i]}`);
  await execRaw(`copy flash:labels.txt ${LBL_FILE}`);
  await execRaw('del flash:labels.txt');
}

/* ---------- дрібниці ---------- */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (bad ? ' bad' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.className = 'toast', 3600);
}
const TR = { 'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ie','ж':'zh','з':'z','и':'y','і':'i','ї':'i','й':'i',
  'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh',
  'щ':'shch','ь':'','ю':'iu','я':'ia','ы':'y','э':'e','ъ':'','ё':'e' };
function translit(s) {
  let o = '';
  for (const ch of s) {
    const l = ch.toLowerCase();
    if (TR[l] !== undefined) { const t = TR[l]; o += ch === l ? t : (t ? t[0].toUpperCase() + t.slice(1) : ''); }
    else if (/[A-Za-z0-9 \-_.,()]/.test(ch)) o += ch; else o += ' ';
  }
  return o.replace(/\s+/g, ' ').trim().slice(0, 60);
}
/* виробники за початком апаратної адреси */
const OUI = {
  '001ef6':'Cisco','000142':'Cisco','0023eb':'Cisco','50ff20':'Keenetic','8c8590':'Apple','001ec2':'Apple','3c0754':'Apple',
  'f01898':'Apple','a483e7':'Apple','ac87a3':'Apple','bcad28':'Hikvision','c056e3':'Hikvision','4cbd8f':'Hikvision',
  '4447cc':'Hikvision','a41437':'Hikvision','2857be':'Hikvision','54c415':'Hikvision','b4a382':'Hikvision','686dbc':'Hikvision',
  '3cef8c':'Dahua','4c11bf':'Dahua','14a78b':'Dahua','9002a9':'Dahua','e0508b':'Dahua','bc325f':'Dahua',
  '50c7bf':'TP-Link','14cc20':'TP-Link','60e327':'TP-Link','a42bb0':'TP-Link','ac84c6':'TP-Link','9c5322':'TP-Link',
  '0418d6':'Ubiquiti','24a43c':'Ubiquiti','788a20':'Ubiquiti','fcecda':'Ubiquiti','68d79a':'Ubiquiti',
  '00408c':'Axis','accc8e':'Axis','b8a44f':'Axis','001132':'Synology','9009d0':'Synology',
  'b827eb':'Raspberry Pi','dca632':'Raspberry Pi','e45f01':'Raspberry Pi','246f28':'Espressif','7c9ebd':'Espressif',
  'a0764e':'Espressif','30aea4':'Espressif','ecda3b':'Espressif','00e04c':'Realtek','525400':'віртуальна машина',
  '001c14':'VMware','005056':'VMware','000c29':'VMware','08a189':'Uniview','9c1463':'Uniview','784558':'Hanwha',
  'f8710c':'Sony','001a11':'Google','3c5ab4':'Google','d83134':'Xiaomi','64b473':'Xiaomi','2c3ae8':'Espressif',
};
function vendor(mac) {
  const hex = (mac || '').replace(/[.:-]/g, '').toLowerCase();
  if (hex.length < 6) return '';
  const first = parseInt(hex.slice(0, 2), 16);
  if (first & 2) return 'випадкова адреса';
  return OUI[hex.slice(0, 6)] || '';
}
const MON = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
const MONEN = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
function plural(n, f) { n = Math.abs(+n); const a = n % 10, b = n % 100;
  return (a === 1 && b !== 11) ? f[0] : (a >= 2 && a <= 4 && !(b >= 12 && b <= 14)) ? f[1] : f[2]; }
function uptimeUk(t) {
  const u = { week:['тиждень','тижні','тижнів'], day:['день','дні','днів'], hour:['година','години','годин'],
              minute:['хвилина','хвилини','хвилин'], second:['секунда','секунди','секунд'] };
  const o = [];
  (t || '').replace(/(\d+)\s+(week|day|hour|minute|second)s?/g, (_, n, k) => o.push(`${n} ${plural(n, u[k])}`));
  return o.join(', ') || (t || '—');
}
function restartUk(t) {
  t = (t || '').toLowerCase();
  if (t.includes('power-on')) return 'увімкнення живлення';
  if (t.includes('command')) return 'перезавантаження з панелі';
  if (t.includes('error') || t.includes('exception')) return 'збій програми комутатора';
  return t || '—';
}
function clockUk(t) {
  const m = (t || '').match(/(\d{2}):(\d{2}):\d{2}[.\d]*\s+\S+\s+\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{4})/);
  return m ? `${m[1]}:${m[2]} · ${+m[4]} ${MON[MONEN[m[3]]] ?? m[3]} ${m[5]}` : (t || '').replace(/^[.*\s]+/, '');
}
function rate(bits) {
  if (!bits) return '—';
  if (bits >= 1e6) return (bits / 1e6).toFixed(1) + ' Мбіт/с';
  if (bits >= 1e3) return Math.round(bits / 1e3) + ' Кбіт/с';
  return bits + ' біт/с';
}
const full = id => id.startsWith('Fa') ? 'FastEthernet' + id.slice(2) : 'GigabitEthernet' + id.slice(2);

/* ---------- читання стану ---------- */
function parsePoe(txt) {
  const map = {}; let budget = { available: 0, used: 0, remaining: 0 };
  const b = txt.match(/Available:([\d.]+)\(w\)\s+Used:([\d.]+)\(w\)\s+Remaining:([\d.]+)\(w\)/);
  if (b) budget = { available: +b[1], used: +b[2], remaining: +b[3] };
  for (const line of txt.split('\n')) {
    const m = line.match(/^(Fa\d+)\s+(auto|static|never)\s+(\S+)\s+([\d.]+)\s+(.*?)\s+(\S+)\s+([\d.]+)\s*$/);
    if (m) map[m[1]] = { admin: m[2], oper: m[3], watts: +m[4], cls: m[6] };
  }
  return { map, budget };
}
function parseRates(txt) {
  const out = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^[* ]\s*(FastEthernet|GigabitEthernet)(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (m) out[(m[1] === 'FastEthernet' ? 'Fa' : 'Gi') + m[2]] = { rx: +m[7], tx: +m[9], drops: +m[4] + +m[6] };
  }
  return out;
}
function parseErrors(txt) {
  const out = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^(Fa\d+|Gi\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (m) out[m[1]] = { align: +m[2], fcs: +m[3], xmit: +m[4], rcv: +m[5], under: +m[6],
                         total: +m[2] + +m[3] + +m[4] + +m[5] + +m[6] };
  }
  return out;
}
function parseSecure(cfgTxt) {
  const out = {};
  let cur = null;
  for (const line of cfgTxt.split('\n')) {
    const i = line.match(/^interface (FastEthernet|GigabitEthernet)(\d+)/);
    if (i) { cur = (i[1] === 'FastEthernet' ? 'Fa' : 'Gi') + i[2]; continue; }
    if (cur && /^ switchport port-security$/.test(line)) out[cur] = true;
    if (/^\S/.test(line) && !/^interface/.test(line)) cur = null;
  }
  return out;
}
async function loadPorts() {
  const st = await exec('show interfaces status');
  const { map, budget } = parsePoe(await exec('show power inline'));
  const rates = parseRates(await exec('show interfaces summary'));
  const errs = parseErrors(await exec('show interfaces counters errors'));
  PORTS = [];
  for (const line of st.split('\n')) {
    const m = line.match(/^(Fa\d+|Gi\d+)\s+(.*?)\s+(connected|notconnect|disabled|err-disabled|monitoring|inactive)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(.*))?$/);
    if (!m) continue;
    const id = m[1], p = map[id] || {}, r = rates[id] || {}, e = errs[id] || {};
    const lb = LABELS[id];
    const lname = typeof lb === 'string' ? lb : (lb?.n || '');
    const lip = typeof lb === 'object' ? (lb.ip || '') : '';
    PORTS.push({ id, switchName: m[2].trim(), label: lname || m[2].trim(), ip: lip, alive: ALIVE[id], status: m[3], vlan: m[4],
      duplex: m[5], speed: m[6], type: (m[7] || '').trim(), poeCapable: id in map,
      poeAdmin: p.admin || '', poeOper: p.oper || '', poeWatts: p.watts || 0, poeClass: p.cls || '',
      rx: r.rx || 0, tx: r.tx || 0, drops: r.drops || 0, errors: e.total || 0, err: e });
  }
  OV.poe = budget;
}
async function loadOverview() {
  const ver = await exec('show version');
  const cfgTxt = await exec('show running-config');
  const ipTxt = await exec('show ip interface brief');
  const f = (rx, d = '') => { const m = ver.match(rx); return m ? m[1].trim() : d; };
  const secure = parseSecure(cfgTxt);
  PORTS.forEach(p => p.secured = !!secure[p.id]);
  const mgmt = ipTxt.match(/^Vlan1\s+(\S+)/m);
  Object.assign(OV, {
    hostname: f(/^(\S+) uptime is/m), model: f(/Model number\s*:\s*(\S+)/), serial: f(/System serial number\s*:\s*(\S+)/),
    ios: f(/Version (\S+?),/), image: f(/System image file is "([^"]+)"/),
    uptime: uptimeUk(f(/uptime is (.+)$/m)), restart: restartUk(f(/System returned to ROM by (.+)$/m)),
    ip: mgmt ? mgmt[1] : location.hostname,
    mask: (cfgTxt.match(/ip address \S+ (\S+)/) || [])[1] || '',
    gateway: (cfgTxt.match(/ip default-gateway (\S+)/) || [])[1] || '',
    ntp: (cfgTxt.match(/ntp server \S+/g) || []).map(s => s.split(' ')[2]),
    secured: Object.keys(secure).length,
    clock: clockUk(await exec('show clock')),
  });
}

/* ---------- вигляд ---------- */
function statusText(p) {
  if (p.status === 'disabled') return 'вимкнений';
  if (p.status === 'connected') return 'працює ' + p.speed.replace('a-', '') + ' Мбіт';
  if (p.status === 'err-disabled') return 'заблокований через помилку';
  return 'вільний';
}
function portClass(p) {
  if (p.status === 'disabled') return 'off';
  if (p.status === 'err-disabled' || p.status === 'inactive') return 'err';
  if (p.poeOper === 'on') return 'poe';
  if (p.status === 'connected') return 'link';
  return '';
}
function tag(p) {
  if (p.status === 'disabled') return '<span class="tag off">вимкнений</span>';
  if (p.status === 'err-disabled') return '<span class="tag err">помилка</span>';
  if (p.poeOper === 'on') return '<span class="tag poe">живить</span>';
  if (p.status === 'connected') return '<span class="tag ok">працює</span>';
  return '<span class="tag">вільний</span>';
}
function showPortHover(id) {
  const el = $('#portHover'); if (!el) return;
  const p = PORTS.find(x => x.id === id); if (!p) return;
  const bits = [`<b>${p.id}</b>`];
  if (p.label) bits.push(esc(p.label));
  bits.push(statusText(p));
  if (p.poeOper === 'on') bits.push(p.poeWatts.toFixed(1) + ' Вт');
  const ip = labelIp(p.id) || ipForPort(p.id);
  if (ip) bits.push(esc(ip));
  if (p.errors) bits.push(`<span class="bad">помилок: ${p.errors}</span>`);
  el.innerHTML = bits.join(' · ');
}
function drawPanel(el, mini) {
  if (!el) return;
  const fa = PORTS.filter(p => p.id.startsWith('Fa')), gi = PORTS.filter(p => p.id.startsWith('Gi'));
  const cell = p => {
    const n = p.id.replace(/\D/g, '');
    const w = p.poeOper === 'on' ? `<span class="w">${p.poeWatts.toFixed(1)}</span>` : '';
    const named = p.label ? '<span class="named"></span>' : '';
    const extra = p.errors ? ' has-err' : '';
    return `<button class="port ${portClass(p)}${extra}${SEL === p.id ? ' sel' : ''}${marked.has(p.id) ? ' marked' : ''}"
      draggable="true" data-id="${p.id}" title="${esc(p.id + (p.label ? ' — ' + p.label : '') + ' · ' + statusText(p) + (p.poeOper === 'on' ? ' · ' + p.poeWatts.toFixed(1) + ' Вт' : '') + (p.errors ? ' · помилок: ' + p.errors : ''))}">${n}${w}${named}</button>`;
  };
  const odd = fa.filter((_, i) => i % 2 === 0), even = fa.filter((_, i) => i % 2 === 1);
  el.innerHTML =
    `<div class="pgroup"><div class="cap">Порти 1–24 · живлення PoE</div>
       <div class="prow">${odd.map(cell).join('')}</div><div class="prow">${even.map(cell).join('')}</div></div>
     <div class="pgroup"><div class="cap">Гігабітні</div>
       <div class="prow">${gi.slice(0, 1).map(cell).join('')}</div><div class="prow">${gi.slice(1).map(cell).join('')}</div></div>`;
  $$('.port', el).forEach(b => {
    b.onclick = () => openPort(b.dataset.id);
    b.ondragstart = e => e.dataTransfer.setData('text/plain', b.dataset.id);
    b.onmouseenter = () => showPortHover(b.dataset.id);
  });
}
function drawCards() {
  const up = PORTS.filter(p => p.status === 'connected').length;
  const poeOn = PORTS.filter(p => p.poeOper === 'on').length;
  const errs = PORTS.filter(p => p.errors > 0).length;
  const pct = OV.poe?.available ? Math.round(OV.poe.used / OV.poe.available * 100) : 0;
  const totalRx = PORTS.reduce((s, p) => s + p.rx, 0), totalTx = PORTS.reduce((s, p) => s + p.tx, 0);
  $('#ovCards').innerHTML = [
    ['Модель', OV.model, OV.serial ? 'Заводський номер ' + OV.serial : ''],
    ['Адреса', OV.ip, 'шлюз ' + (OV.gateway || '—')],
    ['Працює без перерви', OV.uptime, 'останній запуск: ' + OV.restart],
    ['Активні порти', up + ' з ' + PORTS.length, poeOn + ' живить пристрої'],
    ['Живлення PoE', (OV.poe?.used ?? 0).toFixed(1) + ' Вт', `з ${(OV.poe?.available ?? 0).toFixed(0)} Вт (${pct}%)`],
    ['Трафік зараз', rate(totalRx + totalTx), `вхід ${rate(totalRx)} · вихід ${rate(totalTx)}`],
    ['Помилки на портах', errs ? errs + ' ' + plural(errs, ['порт','порти','портів']) : 'немає', errs ? 'перевірте кабелі' : 'усі лінії чисті'],
    ['Версія ПЗ', OV.ios, OV.image === 'ucode0:' ? 'аварійний образ' : 'звичайний образ'],
  ].map(([k, v, x]) => `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${esc(v || '—')}</div><div class="x">${esc(x)}</div></div>`).join('');
  $('#hdrHost').textContent = (OV.hostname || '') + ' · ' + (OV.ip || '');
  $('#hdrClock').textContent = OV.clock || '—';
  $('#hdrModel').textContent = OV.model || 'Catalyst Express 500';
  $('#footIp').textContent = OV.ip || location.hostname;
  const bar = $('#poeBar')?.firstElementChild;
  if (bar) { bar.style.width = pct + '%';
    $('#poeText').textContent = `${(OV.poe?.used ?? 0).toFixed(1)} Вт з ${(OV.poe?.available ?? 0).toFixed(0)} Вт · вільно ${(OV.poe?.remaining ?? 0).toFixed(1)} Вт`; }
  const act = document.activeElement?.id;
  const set = (id, v) => { if ($(id) && act !== id.slice(1)) $(id).value = v; };
  set('#sysHost', OV.hostname || ''); set('#sysIp', OV.ip || ''); set('#sysMask', OV.mask || '');
  set('#sysGw', OV.gateway || ''); set('#sysNtp', (OV.ntp || []).join(', '));
  if ($('#clockHint')) $('#clockHint').textContent =
    'Годинник комутатора: ' + (OV.clock || '—') + '. Сервери часу: ' + ((OV.ntp || []).join(', ') || 'не задано');
}
/* поки користувач друкує в полі таблиці — не перемальовувати її */
function isEditingIn(sel) {
  const a = document.activeElement;
  return a && a.tagName === 'INPUT' && a.closest(sel);
}
function isAnyEditing() {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA');
}

function drawTables() {
  if (isEditingIn('#portTable')) return;
  const q = ($('#portSearch')?.value || '').toLowerCase();
  const list = PORTS.filter(p => !q || p.id.toLowerCase().includes(q)
    || (p.label || '').toLowerCase().includes(q) || labelIp(p.id).includes(q));
  $('#portTable').innerHTML =
    `<tr><th style="width:2rem"></th><th>Порт</th><th>Підпис</th><th>Камера</th><th>Стан</th><th>Швидкість</th><th>Трафік</th>
      <th>Помилки</th><th>VLAN</th><th>Живлення</th><th></th></tr>` +
    list.map(p => `<tr><td><input type="checkbox" class="mark" data-id="${p.id}" ${marked.has(p.id) ? 'checked' : ''}></td>
      <td><b>${p.id}</b>${p.secured ? ' <span class="tag" title="прив’язаний пристрій">🔒</span>' : ''}</td>
      <td>${esc(p.label || '')}</td>
      <td>${(() => {
          const manual = labelIp(p.id), auto = ipForPort(p.id), ip = manual || auto;
          if (!ip) return '—';
          const src = manual ? '' : ' <span class="hint">(в мережі)</span>';
          const state = manual ? (p.alive ? (p.alive.ok ? '<span class="tag ok">відповідає</span>' : '<span class="tag err">не відповідає</span>') : '<span class="tag">не перевірено</span>') : '';
          return `<span class="hint">${esc(ip)}${src}</span>${state ? '<br>' + state : ''}`;
        })()}</td>
      <td>${tag(p)}</td>
      <td class="num">${p.status === 'connected' ? esc(p.speed.replace('a-', '')) + ' / ' + esc(p.duplex.replace('a-', '')) : '—'}</td>
      <td class="num">${p.rx || p.tx ? rate(p.rx) + ' ↓<br>' + rate(p.tx) + ' ↑' : '—'}</td>
      <td class="num ${p.errors ? 'bad' : ''}">${p.errors || '—'}</td>
      <td class="num">${esc(p.vlan)}</td>
      <td class="num">${p.poeCapable ? (p.poeOper === 'on' ? p.poeWatts.toFixed(1) + ' Вт' : '—') : 'немає'}</td>
      <td><button class="btn" data-open="${p.id}">Відкрити</button></td></tr>`).join('');
  $$('#portTable [data-open]').forEach(b => {
    b.onclick = () => openPort(b.dataset.open);
    b.draggable = true;
    b.ondragstart = e => e.dataTransfer.setData('text/plain', b.dataset.open);
  });
  $$('#portTable .mark').forEach(c => c.onchange = () => {
    c.checked ? marked.add(c.dataset.id) : marked.delete(c.dataset.id);
    updateBulk(); drawPanel($('#panelFull'), false);
  });
  updateBulk();

  $('#poeTable').innerHTML = `<tr><th>Порт</th><th>Підпис</th><th>Режим</th><th>Стан</th><th>Спожито</th><th>Клас</th><th></th></tr>` +
    PORTS.filter(p => p.poeCapable).map(p => `<tr><td><b>${p.id}</b></td><td>${esc(p.label || '')}</td>
      <td>${p.poeAdmin === 'auto' ? 'увімкнено' : 'вимкнено'}</td>
      <td>${p.poeOper === 'on' ? '<span class="tag poe">живить</span>' : '<span class="tag">—</span>'}</td>
      <td class="num">${p.poeOper === 'on' ? p.poeWatts.toFixed(1) + ' Вт' : '—'}</td>
      <td class="num">${esc(p.poeClass === 'n/a' ? '—' : p.poeClass)}</td>
      <td><button class="btn" data-reset="${p.id}" ${p.poeOper === 'on' ? '' : 'disabled'}>Перезапустити живлення</button></td></tr>`).join('');
  $$('#poeTable [data-reset]').forEach(b => b.onclick = () => poeReset(b.dataset.reset));
}
function updateBulk() {
  const box = $('#bulkBar'); if (!box) return;
  box.style.display = marked.size ? 'flex' : 'none';
  $('#bulkCount').textContent = marked.size + ' ' + plural(marked.size, ['порт','порти','портів']);
}

/* ---------- дії ---------- */
async function guard(fn, okMsg) {
  if (busy) return toast('Зачекайте, виконується попередня дія', true);
  busy = true;
  try { await fn(); if (okMsg) toast(okMsg); await refresh(true); }
  catch (e) { toast('Не вдалося: ' + e.message, true); }
  finally { busy = false; }
}
async function poeReset(id) {
  if (!confirm(`Перезапустити живлення на порту ${id}? Пристрій на ньому перезавантажиться.`)) return;
  await guard(async () => {
    await cfg('power inline never', full(id));
    await new Promise(r => setTimeout(r, 3000));
    await cfg('power inline auto', full(id));
  }, 'Живлення перезапущено');
}
async function cableTest(id, out) {
  out.textContent = 'перевіряю кабель, зачекайте…';
  await exec(`test cable-diagnostics tdr interface ${full(id)}`);
  await new Promise(r => setTimeout(r, 6000));
  const txt = await exec(`show cable-diagnostics tdr interface ${full(id)}`);
  const pairs = [];
  for (const line of txt.split('\n')) {
    const m = line.match(/Pair ([A-D])\s+(\d+|N\/A)\s*(?:\+\/-\s*(\d+)\s*meters)?\s+(\S+)\s+(.+)$/);
    if (m) pairs.push({ pair: m[1], len: m[2], pm: m[3], status: m[5].trim() });
  }
  const word = { 'Open': 'обрив', 'Short': 'замикання', 'Normal': 'ціла', 'Terminated': 'ціла',
                 'Not Supported': 'не перевіряється', 'Impedance Mis': 'погана якість' };
  if (!pairs.length) return out.textContent = txt || 'комутатор не повернув результат';
  out.innerHTML = '<table class="grid"><tr><th>Пара</th><th>Довжина</th><th>Стан</th></tr>' +
    pairs.map(p => {
      const st = word[p.status] || p.status;
      const bad = /обрив|замикання|погана/.test(st);
      return `<tr><td>${p.pair}</td><td class="num">${p.len === 'N/A' ? '—' : p.len + ' м' + (p.pm ? ' ±' + p.pm : '')}</td>
              <td class="${bad ? 'bad' : ''}">${esc(st)}</td></tr>`;
    }).join('') + '</table>' +
    '<p class="hint">«Обрив» на вільному порту — це норма: кабель просто нікуди не веде. На порту з камерою обрив або замикання означають пошкоджену лінію, а довжина показує, на якій відстані вона обірвана.</p>';
}
function openPort(id) { SEL = id; renderDrawer(); $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); drawPanel($('#panelFull'), false); }
function closeDrawer() { SEL = null; $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); drawPanel($('#panelFull'), false); }
el('#drawerClose').onclick = closeDrawer; el('#scrim').onclick = closeDrawer;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

function renderDrawer() {
  const p = PORTS.find(x => x.id === SEL); if (!p) return;
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#drawerBody')
      && document.activeElement.tagName === 'INPUT') return;
  const isFa = p.id.startsWith('Fa');
  const dev = (MACS || []).filter(m => m.port === p.id);
  $('#drawerTitle').textContent = 'Порт ' + p.id + (p.label ? ' — ' + p.label : '');
  $('#drawerBody').innerHTML = `
    <dl class="kv">
      <dt>Стан</dt><dd>${tag(p)} ${esc(statusText(p))}</dd>
      <dt>Швидкість</dt><dd>${p.status === 'connected' ? esc(p.speed.replace('a-', '')) + ' Мбіт, ' + esc(p.duplex.replace('a-', '')) : '—'}</dd>
      <dt>Трафік</dt><dd>${p.rx || p.tx ? `вхід ${rate(p.rx)}, вихід ${rate(p.tx)}` : 'немає'}</dd>
      <dt>Помилки</dt><dd class="${p.errors ? 'bad' : ''}">${p.errors
        ? `${p.errors} (FCS ${p.err.fcs}, вирівнювання ${p.err.align}, приймання ${p.err.rcv})` : 'немає'}</dd>
      <dt>Мережа VLAN</dt><dd>${esc(p.vlan)}</dd>
      <dt>Живлення</dt><dd>${isFa ? (p.poeOper === 'on' ? p.poeWatts.toFixed(1) + ' Вт, клас ' + esc(p.poeClass)
        : (p.poeAdmin === 'auto' ? 'увімкнене, пристрою немає' : 'вимкнене')) : 'немає на гігабітних'}</dd>
      <dt>Пристрій</dt><dd>${dev.length ? dev.map(d => esc(d.mac) + (vendor(d.mac) ? ' · ' + esc(vendor(d.mac)) : '')).join('<br>') : 'не видно'}</dd>
      <dt>Прив'язка</dt><dd>${p.secured ? 'увімкнена — чужий пристрій не запрацює' : 'немає'}</dd>
    </dl>
    <label style="width:100%">Підпис порту<input type="text" id="dLabel" value="${esc(p.label)}" placeholder="напр. Камера над входом"></label>
    <label style="width:100%">Адреса пристрою (щоб перевіряти зв'язок)
      <input type="text" id="dIp" value="${esc(labelIp(p.id))}" placeholder="напр. 192.168.1.71"></label>
    <div class="actions">
      <button class="btn primary" id="dLabelSave">Зберегти підпис і адресу</button>
      <button class="btn" id="dPing" ${labelIp(p.id) ? '' : 'disabled'}>Перевірити зв'язок</button>
    </div>
    <div id="dPingOut" class="hint"></div>
    <div class="actions">
      <button class="btn" id="dCable">Перевірити кабель</button>
      <button class="btn" id="dToggle">${p.status === 'disabled' ? 'Увімкнути порт' : 'Вимкнути порт'}</button>
      ${isFa ? `<button class="btn" id="dPoeReset" ${p.poeOper === 'on' ? '' : 'disabled'}>Перезапустити живлення</button>
                <button class="btn" id="dPoeMode">${p.poeAdmin === 'auto' ? 'Вимкнути живлення' : 'Увімкнути живлення'}</button>` : ''}
      <button class="btn" id="dSecure">${p.secured ? 'Зняти прив’язку' : 'Прив’язати пристрій'}</button>
    </div>
    <div id="dCableOut" class="mono" style="display:none"></div>
    <label>Мережа VLAN <input type="number" id="dVlan" min="1" max="4094" value="${esc(p.vlan)}"></label>
    <div class="actions"><button class="btn" id="dVlanSave">Перенести в мережу</button></div>
    <details><summary class="hint">Подробиці від комутатора</summary><pre class="mono" id="dRaw">розгорніть, щоб завантажити</pre></details>`;

  el('#dLabelSave').onclick = () => guard(async () => {
    const text = $('#dLabel').value.trim();
    const ip = $('#dIp') ? $('#dIp').value.trim() : '';
    if (ip && !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) throw new Error('адреса має вигляд 192.168.1.71');
    setLabel(p.id, text, ip);
    await cfg(text ? 'description ' + translit(text) : 'no description', full(p.id));
    await saveLabels();
  }, 'Збережено');
  if ($('#dPing')) $('#dPing').onclick = async () => {
    const out = $('#dPingOut'); out.textContent = 'перевіряю…';
    try {
      const r = await pingPort(p.id);
      out.innerHTML = r && r.ok ? `<span class="tag ok">відповідає</span> ${r.rate}% пакетів дійшло`
        : '<span class="tag err">не відповідає</span> пристрій за адресою мовчить';
      drawTables();
    } catch (e) { out.textContent = 'не вдалося: ' + e.message; }
  };
  el('#dCable').onclick = async () => {
    if (p.status === 'connected' && !confirm('Перевірка на робочому порту на кілька секунд розірве зв’язок із пристроєм. Продовжити?')) return;
    const out = $('#dCableOut'); out.style.display = 'block';
    try { await cableTest(p.id, out); } catch (e) { out.textContent = 'не вдалося: ' + e.message; }
  };
  el('#dVlanSave').onclick = () => {
    const v = +$('#dVlan').value;
    if (!confirm(`Перенести порт ${p.id} у мережу VLAN ${v}?`)) return;
    guard(() => cfg(`switchport access vlan ${v}`, full(p.id)), 'Порт перенесено');
  };
  el('#dToggle').onclick = () => {
    const on = p.status === 'disabled';
    if (!on && !confirm(`Вимкнути порт ${p.id}? Пристрій на ньому втратить зв’язок і живлення.`)) return;
    guard(() => cfg(on ? 'no shutdown' : 'shutdown', full(p.id)), on ? 'Порт увімкнено' : 'Порт вимкнено');
  };
  el('#dSecure').onclick = () => {
    if (p.secured) return guard(() => cfgLines([`interface ${full(p.id)}`, 'no switchport port-security',
      'no switchport port-security mac-address sticky', 'no switchport port-security maximum',
      'no switchport port-security violation', 'exit']), 'Прив’язку знято');
    if (!confirm('Прив’язати до порту той пристрій, що підключений зараз? Інший пристрій у цьому порту працювати не буде.')) return;
    guard(() => cfgLines([`interface ${full(p.id)}`, 'switchport port-security maximum 1',
      'switchport port-security mac-address sticky', 'switchport port-security violation restrict',
      'switchport port-security', 'exit']), 'Пристрій прив’язано');
  };
  if (isFa) {
    el('#dPoeReset').onclick = () => poeReset(p.id);
    el('#dPoeMode').onclick = () => guard(() => cfg('power inline ' + (p.poeAdmin === 'auto' ? 'never' : 'auto'), full(p.id)), 'Режим живлення змінено');
  }
  $('#drawerBody').querySelector('details').ontoggle = async function () {
    if (!this.open) return;
    const el = $('#dRaw'); el.textContent = 'завантаження…';
    try { el.textContent = await exec('show interfaces ' + full(p.id)); } catch (e) { el.textContent = 'не вдалося'; }
  };
}

/* масові дії */
el('#bulkPoe').onclick = () => {
  if (!confirm(`Перезапустити живлення на ${marked.size} портах? Пристрої перезавантажаться.`)) return;
  guard(async () => {
    for (const id of marked) if (id.startsWith('Fa')) await cfg('power inline never', full(id));
    await new Promise(r => setTimeout(r, 3000));
    for (const id of marked) if (id.startsWith('Fa')) await cfg('power inline auto', full(id));
  }, 'Живлення перезапущено');
};
el('#bulkOff').onclick = () => {
  if (!confirm(`Вимкнути ${marked.size} портів? Пристрої втратять зв’язок і живлення.`)) return;
  guard(async () => { for (const id of marked) await cfg('shutdown', full(id)); }, 'Порти вимкнено');
};
el('#bulkOn').onclick = () => guard(async () => { for (const id of marked) await cfg('no shutdown', full(id)); }, 'Порти увімкнено');
el('#bulkVlan').onclick = () => {
  const v = +prompt('У яку мережу VLAN перенести обрані порти?', '1');
  if (!(v >= 1 && v <= 4094)) return;
  guard(async () => { for (const id of marked) await cfg(`switchport access vlan ${v}`, full(id)); }, 'Порти перенесено');
};
el('#bulkClear').onclick = () => { marked.clear(); drawTables(); drawPanel($('#panelFull'), false); };

/* ---------- розділи ---------- */
let MACS = [];
async function loadVlans() {
  const txt = await exec('show vlan brief');
  const rows = [];
  for (const line of txt.split('\n')) {
    const m = line.match(/^(\d+)\s+(\S+)\s+(\S+)\s*(.*)$/);
    if (m) rows.push({ id: +m[1], name: m[2], status: m[3], ports: m[4].trim() });
  }
  $('#vlanTable').innerHTML = `<tr><th>Номер</th><th>Назва</th><th>Стан</th><th>Порти</th><th></th></tr>` +
    rows.map(v => `<tr><td class="num"><b>${v.id}</b></td><td>${esc(v.name)}</td><td>${esc(v.status)}</td>
      <td class="hint">${esc(v.ports || '—')}</td>
      <td>${v.id > 1 && v.id < 1002 ? `<button class="btn" data-del="${v.id}">Видалити</button>` : ''}</td></tr>`).join('');
  $$('#vlanTable [data-del]').forEach(b => b.onclick = () => {
    if (!confirm(`Видалити мережу VLAN ${b.dataset.del}?`)) return;
    guard(() => cfgLines([`no vlan ${b.dataset.del}`]), 'Мережу видалено').then(loadVlans);
  });
}
el('#btnVlanAdd').onclick = () => {
  const id = +$('#vlanId').value, name = translit($('#vlanName').value.trim()).replace(/\s+/g, '-').slice(0, 32);
  if (!(id >= 2 && id <= 4094)) return toast('Дозволені номери 2–4094', true);
  guard(() => cfgLines([`vlan ${id}`].concat(name ? [`name ${name}`] : [])), 'Мережу додано').then(loadVlans);
};
/* ---------- IP-адреси пристроїв (ARP) ---------- */
let ARP_MAP = {};
let IP_CACHE = {};   // { mac: {ip, at} } — останні відомі адреси, переживають спорожніння ARP
try { IP_CACHE = JSON.parse(localStorage.getItem('ipCache') || '{}'); } catch (e) { IP_CACHE = {}; }
function saveIpCache() { try { localStorage.setItem('ipCache', JSON.stringify(IP_CACHE)); } catch (e) {} }
function parseArp(txt) {
  const m = {};
  for (const line of txt.split('\n')) {
    const r = line.match(/Internet\s+(\d+\.\d+\.\d+\.\d+)\s+\S+\s+([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})/i);
    if (r) m[r[2].toLowerCase()] = r[1];
  }
  return m;
}
async function loadArp() {
  try {
    const fresh = parseArp(await exec('show ip arp'));
    const now = Date.now();
    for (const mac in fresh) IP_CACHE[mac] = { ip: fresh[mac], at: now };  // освіжаємо кеш
    // кеш старший за 24 год відкидаємо
    for (const mac in IP_CACHE) if (now - IP_CACHE[mac].at > 864e5) delete IP_CACHE[mac];
    saveIpCache();
    // ARP_MAP = свіже + кеш (свіже має пріоритет)
    ARP_MAP = {};
    for (const mac in IP_CACHE) ARP_MAP[mac] = IP_CACHE[mac].ip;
    for (const mac in fresh) ARP_MAP[mac] = fresh[mac];
  } catch (e) {}
  return ARP_MAP;
}
function ipForMac(mac) { return ARP_MAP[(mac || '').toLowerCase()] || ''; }
function ipForPort(id) {
  const dev = (MACS || []).find(r => r.port === id && ipForMac(r.mac));
  return dev ? ipForMac(dev.mac) : '';
}

/* ---------- автовизначення IP у фоні ---------- */
let autoScanRunning = false, lastAutoScan = 0;
async function ensureIps(force) {
  if (autoScanRunning) return;
  // чи є під'єднані пристрої без відомого IP?
  const needed = (MACS || []).some(r => {
    const p = PORTS.find(x => x.id === r.port);
    return p && p.status === 'connected' && !ipForMac(r.mac);
  });
  const stale = Date.now() - lastAutoScan > 5 * 60 * 1000;   // не частіше ніж раз на 5 хв
  if (!force && (!needed || !stale)) return;
  autoScanRunning = true; lastAutoScan = Date.now();
  try {
    const base = (OV.ip || location.hostname).replace(/\.\d+$/, '');
    const targets = []; for (let i = 1; i <= 254; i++) targets.push(base + '.' + i);
    let idx = 0;
    async function worker() {
      while (idx < targets.length) {
        if (paused || document.hidden) { await new Promise(r => setTimeout(r, 500)); continue; }
        const ip = targets[idx++];
        try { await fetch(`/level/15/exec/ping/${ip}/repeat/1/timeout/1/CR`, { cache: 'no-store' }); } catch (e) {}
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker));
    await loadArp();
    if (TAB === 'mac') drawMac();
    drawTables();
  } finally { autoScanRunning = false; }
}

async function scanIps() {
  const base = (OV.ip || location.hostname).replace(/\.\d+$/, '');
  const btn = $('#btnScanIp'); if (btn) btn.disabled = true;
  const prog = $('#scanState');
  const targets = []; for (let i = 1; i <= 254; i++) targets.push(base + '.' + i);
  let done = 0, idx = 0;
  async function worker() {
    while (idx < targets.length) {
      const ip = targets[idx++];
      try { await fetch(`/level/15/exec/ping/${ip}/repeat/1/timeout/1/CR`, { cache: 'no-store' }); } catch (e) {}
      done++;
      if (prog && done % 8 === 0) prog.textContent = `опитано ${done} з 254…`;
    }
  }
  if (prog) prog.textContent = 'опитую мережу…';
  await Promise.all(Array.from({ length: 8 }, worker));
  await loadArp();
  drawMac();
  const found = Object.keys(ARP_MAP).length;
  if (prog) prog.textContent = `готово: знайдено ${found} ${plural(found, ['адресу', 'адреси', 'адрес'])}`;
  if (btn) btn.disabled = false;
}

/* ---------- назви пристроїв (за MAC, окремо від підписів портів) ---------- */
let DEVNAMES = {};   // { "08a1.892e.9bc5": "Камера над входом" }
async function loadDevNames() {
  try {
    const r = await fetch('/devices.txt?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw 0;
    const b64 = (await r.text()).trim().replace(/-/g, '+').replace(/_/g, '/');
    DEVNAMES = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))));
  } catch (e) {
    try { DEVNAMES = JSON.parse(localStorage.getItem('devNames') || '{}'); } catch (e2) { DEVNAMES = {}; }
  }
}
async function saveDevNames() {
  try { localStorage.setItem('devNames', JSON.stringify(DEVNAMES)); } catch (e) {}
  const bytes = new TextEncoder().encode(JSON.stringify(DEVNAMES));
  const enc = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
  const parts = enc.match(/.{1,90}/g) || [''];
  await execRaw('del flash:html/devices.txt');
  for (let i = 0; i < parts.length; i++)
    await execRaw(`cluster pref file ${i ? 'append ' : ''}devices.txt ${parts[i]}`);
  await execRaw('copy flash:devices.txt flash:html/devices.txt');
  await execRaw('del flash:devices.txt');
}
function devName(mac) { return DEVNAMES[(mac || '').toLowerCase()] || ''; }
function setDevName(mac, name) {
  mac = (mac || '').toLowerCase();
  if (name) DEVNAMES[mac] = name.slice(0, 40); else delete DEVNAMES[mac];
}

async function loadMac() {
  const txt = await exec('show mac address-table');
  await loadArp();
  await loadDevNames();
  MACS = [];
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+([0-9a-f.]{14})\s+(\S+)\s+(\S+)/i);
    if (m) MACS.push({ vlan: m[1], mac: m[2], type: m[3], port: m[4] });
  }
  drawMac();
}
function drawMac() {
  if (isEditingIn('#macTable')) return;
  const f = ($('#macFilter')?.value || '').toLowerCase();
  const list = MACS.filter(r => !f || r.mac.toLowerCase().includes(f) || r.port.toLowerCase().includes(f)
    || (vendor(r.mac) || '').toLowerCase().includes(f) || ipForMac(r.mac).includes(f)
    || devName(r.mac).toLowerCase().includes(f));
  $('#macTable').innerHTML = `<tr><th>Назва пристрою</th><th>IP-адреса</th><th>Виробник</th><th>Апаратна адреса</th><th>Порт</th></tr>` +
    (list.map(r => {
      const p = PORTS.find(x => x.id === r.port);
      const ip = ipForMac(r.mac);
      return `<tr><td><input type="text" class="devname" data-mac="${esc(r.mac)}" value="${esc(devName(r.mac))}" placeholder="напр. Камера над входом"></td>
              <td class="num">${ip ? esc(ip) : '<span class="hint">—</span>'}</td>
              <td>${esc(vendor(r.mac) || '—')}</td>
              <td class="num">${esc(r.mac)}</td>
              <td><b>${esc(r.port)}</b>${p && labelName(p.id) ? '<br><span class="hint">' + esc(labelName(p.id)) + '</span>' : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="hint">нічого не знайдено</td></tr>');
  $$('#macTable .devname').forEach(inp => {
    inp.onchange = async () => {
      const mac = inp.dataset.mac, val = inp.value.trim();
      if (val === devName(mac)) return;
      inp.disabled = true; busy = true;
      try {
        setDevName(mac, val);
        await saveDevNames();
        toast(val ? 'Назву збережено' : 'Назву прибрано');
      } catch (e) { toast('Не вдалося: ' + e.message, true); }
      finally { busy = false; }
      inp.disabled = false;
    };
  });
}
if ($('#macFilter')) el('#macFilter').oninput = drawMac;
el('#btnScanIp').onclick = scanIps;
if ($('#portSearch')) el('#portSearch').oninput = drawTables;
el('#btnLogRefresh').onclick = () => loadLog().catch(e => toast(e.message, true));

el('#btnSysSave').onclick = () => {
  const lines = [];
  const host = translit($('#sysHost').value.trim()).replace(/\s+/g, '-');
  if (host && host !== OV.hostname) lines.push('hostname ' + host);
  const gw = $('#sysGw').value.trim();
  if (gw && gw !== OV.gateway) lines.push('ip default-gateway ' + gw);
  const ip = $('#sysIp').value.trim(), mask = $('#sysMask').value.trim();
  if (ip && mask && (ip !== OV.ip || mask !== OV.mask)) {
    if (!confirm(`Змінити адресу комутатора на ${ip}? Ця сторінка перестане відповідати — відкрийте її за новою адресою.`)) return;
    lines.push('interface Vlan1', `ip address ${ip} ${mask}`, 'exit');
  }
  if (!lines.length) return toast('Нічого змінювати');
  guard(() => cfgLines(lines), 'Застосовано. Не забудьте зберегти налаштування.');
};
el('#btnNtpSave').onclick = () => {
  const list = $('#sysNtp').value.split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return toast('Вкажіть хоча б один сервер', true);
  guard(() => cfgLines(list.map(s => 'ntp server ' + s)), 'Сервери часу збережено');
};
el('#btnSecSet').onclick = () => {
  const p1 = $('#secPwd').value, p2 = $('#secPwd2').value;
  if (p1 !== p2) return toast('Паролі не збігаються', true);
  if (!/^[A-Za-z0-9!@#$%^&*()_.-]{6,25}$/.test(p1)) return toast('6–25 символів: латиниця, цифри, знаки !@#$%^&*()_.-', true);
  if (!confirm('Встановити пароль? Браузер питатиме його при кожному вході — ім’я користувача залишайте порожнім.')) return;
  guard(async () => {
    await cfgLines([`enable secret ${p1}`, 'ip http authentication enable', 'line vty 5 15', `password ${p1}`, 'login', 'exit']);
    await saveConfig();
  }, 'Пароль встановлено');
};
el('#btnSecClear').onclick = () => {
  if (!confirm('Зняти пароль? Керування знову буде відкрите всім у мережі.')) return;
  guard(async () => {
    await cfgLines(['no enable secret', 'no ip http authentication enable', 'line vty 5 15', 'no password', 'no login', 'exit']);
    await saveConfig();
  }, 'Пароль знято');
};
el('#btnPing').onclick = async () => {
  const t = $('#pingTarget').value.trim();
  if (!/^[\w.-]{1,60}$/.test(t)) return $('#pingOut').textContent = 'некоректна адреса';
  $('#pingOut').textContent = 'перевіряю…';
  try { $('#pingOut').textContent = await exec('ping ' + t); } catch (e) { $('#pingOut').textContent = 'не вдалося: ' + e.message; }
};
el('#btnCmd').onclick = async () => {
  const c = $('#cmdInput').value.trim();
  if (!/^(show|ping|dir|more|test)\b/.test(c)) return toast('Дозволені лише команди перегляду', true);
  $('#cmdOut').textContent = 'виконую…';
  try { $('#cmdOut').textContent = await exec(c); } catch (e) { $('#cmdOut').textContent = 'не вдалося: ' + e.message; }
};
async function showCfg() { $('#cfgText').textContent = 'завантаження…'; $('#cfgText').textContent = await exec('show running-config'); }
el('#btnCfgRefresh').onclick = () => showCfg().catch(e => toast(e.message, true));
el('#btnCfgDownload').onclick = async () => {
  const txt = await exec('show running-config');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
  a.download = 'komutator-' + new Date().toISOString().slice(0, 10) + '.txt';
  a.click();
};
async function saveConfig() {
  const out = await exec('write memory');
  if (/\[OK\]/.test(out)) return out;
  return exec('copy running-config flash:config.text');   // аварійний образ write memory не вміє
}
const saveAll = () => guard(saveConfig, 'Налаштування записано в пам’ять комутатора');
el('#btnSave').onclick = saveAll;
el('#btnCfgSave').onclick = saveAll;
el('#btnReload').onclick = () => {
  if (!confirm('Перезавантажити комутатор? Мережа і камери будуть недоступні близько двох хвилин.')) return;
  guard(async () => { await saveConfig(); await exec('reload'); }, 'Комутатор перезавантажується…');
};
el('#btnFw').onclick = () => {
  const url = $('#fwUrl').value.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) return toast('Вкажіть адресу файлу прошивки', true);
  if (!confirm('Залити прошивку? Процес триває кілька хвилин. Перезавантаження — окремою кнопкою, коли будете готові.')) return;
  $('#fwOut').textContent = 'заливаю, це може тривати кілька хвилин…';
  guard(async () => {
    const out = await execRaw(`archive download-sw /imageonly /overwrite /http ${url}`);
    $('#fwOut').textContent = out;
    if (/fail|error/i.test(out)) throw new Error('комутатор не прийняв образ — див. вивід');
    // новий образ переводить веб-сервер на свою теку, і панель відкривалась би порожньою
    await cfg('ip http path flash:html');
    await saveConfig();
    $('#fwOut').textContent += '\n\nШлях до панелі збережено. Перезавантажте комутатор, щоб він стартував з нового образу.';
  }, 'Образ залито');
};


/* ---------- системний монітор ---------- */
const HIST_MAX = 120;
let HIST = { cpu: [], mem: [], rx: [], tx: [], poe: [] };
try { const h = JSON.parse(localStorage.getItem('hist') || 'null');
      if (h && h.cpu) HIST = h; } catch (e) {}
let SYS = { cpu5: 0, cpu1: 0, cpu5m: 0, memUsed: 0, memTotal: 0, env: [] };
function pushHist(k, v) { HIST[k].push(v); while (HIST[k].length > HIST_MAX) HIST[k].shift(); }
function saveHist() { try { localStorage.setItem('hist', JSON.stringify(HIST)); } catch (e) {} }

function spark(sel, series, opts = {}) {
  const el = $(sel); if (!el) return;
  const W = 300, H = 60, pad = 3;
  const flat = series.flatMap(s => s.data);
  const max = Math.max(opts.min || 1, ...flat) * 1.15;
  const step = W / Math.max(1, HIST_MAX - 1);
  const y = v => (H - pad - (v / max) * (H - pad * 2)).toFixed(1);
  const line = d => d.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${y(v)}`).join('');
  let svg = '';
  for (let g = 1; g <= 2; g++) svg += `<line class="grid-l" x1="0" x2="${W}" y1="${H * g / 3}" y2="${H * g / 3}"/>`;
  series.forEach((sr, i) => {
    if (!sr.data.length) return;
    if (i === 0) svg += `<path class="area" d="${line(sr.data)}L${((sr.data.length - 1) * step).toFixed(1)},${H} L0,${H} Z"/>`;
    svg += `<path class="${i === 0 ? 'line' : 'line2'}" d="${line(sr.data)}"/>`;
  });
  el.innerHTML = svg;
}
function drawMonitor() {
  const rxNow = HIST.rx.at(-1) || 0, txNow = HIST.tx.at(-1) || 0;
  spark('#sparkCpu', [{ data: HIST.cpu }], { min: 10 });
  spark('#sparkMem', [{ data: HIST.mem }], { min: 10 });
  spark('#sparkNet', [{ data: HIST.rx }, { data: HIST.tx }], { min: 1000 });
  spark('#sparkPoe', [{ data: HIST.poe }], { min: 10 });
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  set('#monCpuVal', SYS.cpu5 + '%');
  set('#monCpuFoot', `за хвилину ${SYS.cpu1}% · за 5 хвилин ${SYS.cpu5m}%`);
  const memPct = SYS.memTotal ? Math.round(SYS.memUsed / SYS.memTotal * 100) : 0;
  set('#monMemVal', memPct + '%');
  set('#monMemFoot', SYS.memTotal ? `${(SYS.memUsed / 1048576).toFixed(1)} з ${(SYS.memTotal / 1048576).toFixed(1)} МБ` : '—');
  set('#monNetVal', rate(rxNow + txNow));
  set('#monNetFoot', `вхід ${rate(rxNow)} · вихід ${rate(txNow)}`);
  set('#monPoeVal', (OV.poe?.used ?? 0).toFixed(1) + ' Вт');
  set('#monPoeFoot', `вільно ${(OV.poe?.remaining ?? 0).toFixed(0)} Вт з ${(OV.poe?.available ?? 0).toFixed(0)} Вт`);
  const hw = $('#hwState');
  if (hw) hw.innerHTML = SYS.env.map(e =>
    `<span><i class="${e.ok ? '' : 'warn'}"></i>${esc(e.name)}: ${esc(e.text)}</span>`).join('') || '';
}
async function loadSystem() {
  if (isAnyEditing()) return;
  const cpu = await exec('show processes cpu');
  const m = cpu.match(/five seconds:\s*(\d+)%\/(\d+)%;\s*one minute:\s*(\d+)%;\s*five minutes:\s*(\d+)%/);
  if (m) { SYS.cpu5 = +m[1]; SYS.cpu1 = +m[3]; SYS.cpu5m = +m[4]; pushHist('cpu', SYS.cpu5); }
  const mem = await exec('show memory statistics');
  const mm = mem.match(/Processor\s+\S+\s+(\d+)\s+(\d+)\s+(\d+)/);
  if (mm) { SYS.memTotal = +mm[1]; SYS.memUsed = +mm[2];
            pushHist('mem', Math.round(SYS.memUsed / SYS.memTotal * 100)); }
  const env = await exec('show env all');
  const names = { FAN: 'вентилятор', TEMPERATURE: 'температура', POWER: 'живлення', RPS: 'резервне живлення' };
  SYS.env = env.split('\n').map(l => {
    const e = l.match(/^(\w+) is (.+)$/);
    if (!e) return null;
    const okTxt = { 'OK': 'норма', 'NOT PRESENT': 'немає', 'FAULTY': 'несправний' };
    return { name: names[e[1]] || e[1], text: okTxt[e[2].trim()] || e[2].trim(),
             ok: !/FAULT|FAIL|ALARM/i.test(e[2]) };
  }).filter(Boolean);
  pushHist('poe', OV.poe?.used || 0);
  saveHist();
}
async function loadTraffic() {
  if (isAnyEditing()) return;
  const rates = parseRates(await exec('show interfaces summary'));
  let rx = 0, tx = 0;
  for (const id in rates) { rx += rates[id].rx; tx += rates[id].tx;
    const p = PORTS.find(x => x.id === id); if (p) { p.rx = rates[id].rx; p.tx = rates[id].tx; } }
  pushHist('rx', rx); pushHist('tx', tx);
  drawMonitor();
}

/* ---------- діагностика кабелів ---------- */
const PAIRS = { A: '1–2', B: '3–6', C: '4–5', D: '7–8' };
const PAIR_WORD = { 'Open': 'обрив', 'Short': 'замикання', 'Normal': 'ціла', 'Terminated': 'ціла',
                    'Not Supported': 'не перевіряється', 'Impedance Mis': 'погана якість' };
let CABLES = {}, cableStop = false;
async function cableRun(id) {
  await exec(`test cable-diagnostics tdr interface ${full(id)}`);
  await new Promise(r => setTimeout(r, 6000));
  const txt = await exec(`show cable-diagnostics tdr interface ${full(id)}`);
  const pairs = [];
  for (const line of txt.split('\n')) {
    const m = line.match(/Pair ([A-D])\s+(\d+|N\/A)\s*(?:\+\/-\s*(\d+)\s*meters)?\s+(\S+)\s+(.+)$/);
    if (m) pairs.push({ pair: m[1], len: m[2], pm: m[3], status: m[5].trim() });
  }
  CABLES[id] = { at: new Date(), pairs };
  drawCables();
  return pairs;
}
function pairCell(pr) {
  const st = PAIR_WORD[pr.status] || pr.status;
  const na = /не перевіряється/.test(st);
  const bad = /обрив|замикання|погана/.test(st);
  return `<div class="pair ${na ? 'na' : bad ? 'bad' : 'ok'}">
    <div class="pn">пара ${pr.pair} · жили ${PAIRS[pr.pair] || ''}</div>
    <div class="ps">${esc(st)}</div>
    <div class="pn">${pr.len === 'N/A' ? '' : pr.len + ' м' + (pr.pm ? ' ±' + pr.pm : '')}</div></div>`;
}
/* редагування підпису порту прямо в таблиці */
async function savePortLabel(id, text) {
  const cur = labelName(id);
  if (text === cur) return;
  const ip = labelIp(id);
  setLabel(id, text, ip);
  await cfg(text ? 'description ' + translit(text) : 'no description', full(id));
  await saveLabels();
}
function bindPortLabelInputs(sel) {
  $$(`${sel} input.portlabel`).forEach(inp => {
    inp.onchange = async () => {
      inp.disabled = true; busy = true;
      try { await savePortLabel(inp.dataset.id, inp.value.trim()); toast('Підпис порту збережено'); }
      catch (e) { toast('Не вдалося: ' + e.message, true); }
      finally { busy = false; }
      inp.disabled = false;
    };
  });
}

function drawCables() {
  if (isEditingIn('#cableTable')) return;
  const t = $('#cableTable'); if (!t) return;
  t.innerHTML = `<tr><th>Порт</th><th>Підпис</th><th>Стан порту</th><th>Пари кабелю</th><th>Перевірено</th><th></th></tr>` +
    PORTS.map(p => {
      const c = CABLES[p.id];
      return `<tr><td><b>${p.id}</b></td>
        <td><input type="text" class="portlabel" data-id="${p.id}" value="${esc(labelName(p.id))}" placeholder="підпис порту"></td>
        <td>${tag(p)}</td>
        <td>${c ? `<div class="pairs">${c.pairs.map(pairCell).join('')}</div>` : '<span class="hint">не перевірявся</span>'}</td>
        <td class="hint">${c ? c.at.toLocaleTimeString('uk-UA') : '—'}</td>
        <td><button class="btn" data-cable="${p.id}">Перевірити</button></td></tr>`;
    }).join('');
  $$('#cableTable [data-cable]').forEach(b => b.onclick = async () => {
    const p = PORTS.find(x => x.id === b.dataset.cable);
    if (p?.status === 'connected' && !confirm(`На порту ${p.id} працює пристрій. Перевірка на кілька секунд розірве зв'язок. Продовжити?`)) return;
    b.disabled = true; b.textContent = 'перевіряю…';
    try { await cableRun(b.dataset.cable); } catch (e) { toast('Не вдалося: ' + e.message, true); }
  });
  bindPortLabelInputs('#cableTable');
}
el('#btnCableFree').onclick = async () => {
  const free = PORTS.filter(p => p.status !== 'connected');
  if (!free.length) return toast('Вільних портів немає');
  cableStop = false;
  el('#btnCableStop').style.display = '';
  for (let i = 0; i < free.length; i++) {
    if (cableStop) break;
    $('#cableProgress').textContent = `перевіряю ${free[i].id} · ${i + 1} з ${free.length}`;
    try { await cableRun(free[i].id); } catch (e) { /* пропускаємо порт */ }
  }
  $('#cableProgress').textContent = cableStop ? 'зупинено' : 'перевірку завершено';
  el('#btnCableStop').style.display = 'none';
};
el('#btnCableStop').onclick = () => { cableStop = true; $('#cableProgress').textContent = 'зупиняю…'; };

/* ---------- сповіщення про зниклі пристрої ---------- */
let prevUp = null;
function checkLost() {
  const now = new Set(PORTS.filter(p => p.status === 'connected').map(p => p.id));
  if (prevUp) {
    for (const id of prevUp) if (!now.has(id)) {
      const p = PORTS.find(x => x.id === id);
      const name = p?.label ? `${id} — ${p.label}` : id;
      toast(`Зник пристрій на порту ${name}`, true);
      try { if (Notification?.permission === 'granted') new Notification('Комутатор', { body: `Зник пристрій на порту ${name}` }); } catch (e) {}
    }
  }
  prevUp = now;
}


/* ---------- адреси камер і перевірка зв'язку ---------- */
let ALIVE = {};
function labelName(id) { const l = LABELS[id]; return typeof l === 'string' ? l : (l?.n || ''); }
function labelIp(id) { const l = LABELS[id]; return typeof l === 'object' ? (l.ip || '') : ''; }
function setLabel(id, name, ip) {
  if (!name && !ip) delete LABELS[id];
  else LABELS[id] = ip ? { n: name, ip } : name;
}
async function pingPort(id) {
  const ip = labelIp(id);
  if (!ip) return null;
  const out = await exec('ping ' + ip);
  const m = out.match(/Success rate is (\d+) percent/);
  const ok = m ? +m[1] > 0 : false;
  ALIVE[id] = { ok, at: Date.now(), rate: m ? +m[1] : 0 };
  const p = PORTS.find(x => x.id === id); if (p) p.alive = ALIVE[id];
  return ALIVE[id];
}
el('#btnPingAll').onclick = async () => {
  const list = PORTS.filter(p => labelIp(p.id));
  if (!list.length) return toast('Спочатку впишіть адреси камер у картках портів', true);
  for (let i = 0; i < list.length; i++) {
    $('#pingAllState').textContent = `перевіряю ${list[i].id} · ${i + 1} з ${list.length}`;
    try { await pingPort(list[i].id); } catch (e) {}
    drawTables();
  }
  const dead = list.filter(p => ALIVE[p.id] && !ALIVE[p.id].ok);
  $('#pingAllState').textContent = dead.length
    ? `не відповідають: ${dead.map(p => labelName(p.id) || p.id).join(', ')}`
    : 'усі камери відповідають';
};

/* ---------- обмеження широкомовного потоку ---------- */
async function stormSet(id, level) {
  if (level === null) return cfgLines([`interface ${full(id)}`, 'no storm-control broadcast level',
                                       'no storm-control multicast level', 'no storm-control action', 'exit']);
  return cfgLines([`interface ${full(id)}`, `storm-control broadcast level ${level}`,
                   `storm-control multicast level ${level}`, 'storm-control action trap', 'exit']);
}

/* ---------- дзеркалювання порту ---------- */
async function spanState() {
  const txt = await exec('show monitor');
  const src = txt.match(/Source Ports:\s*\n?\s*Both:\s*(\S+)/) || txt.match(/Source Ports.*?:\s*(\S+)/s);
  const dst = txt.match(/Destination Ports:\s*(\S+)/);
  const none = /No SPAN configuration/i.test(txt);
  const e = $('#spanState');
  if (e) e.textContent = none ? 'дзеркалювання вимкнене'
    : `копія трафіку з ${src ? src[1] : '?'} подається на ${dst ? dst[1] : '?'}`;
  return { none, src: src?.[1], dst: dst?.[1] };
}
function fillSpanSelects() {
  const mk = sel => { const e = $(sel); if (!e) return;
    const cur = e.value;
    e.innerHTML = PORTS.map(p => `<option value="${p.id}">${p.id}${labelName(p.id) ? ' — ' + esc(labelName(p.id)) : ''}</option>`).join('');
    if (cur) e.value = cur; };
  mk('#spanSrc'); mk('#spanDst');
}
el('#btnSpanOn').onclick = () => {
  const src = $('#spanSrc').value, dst = $('#spanDst').value;
  if (src === dst) return toast('Порти мають бути різні', true);
  const dp = PORTS.find(p => p.id === dst);
  if (dp?.status === 'connected' && !confirm(`На порту ${dst} працює пристрій. Поки триває дзеркалювання, він втратить звичайний зв'язок. Продовжити?`)) return;
  guard(async () => {
    await cfgLines(['no monitor session 1', `monitor session 1 source interface ${full(src)} both`,
                    `monitor session 1 destination interface ${full(dst)}`]);
    await spanState();
  }, 'Дзеркалювання увімкнено');
};
el('#btnSpanOff').onclick = () => guard(async () => {
  await cfgLines(['no monitor session 1']);
  await spanState();
}, 'Дзеркалювання вимкнено');

/* ---------- журнал подій ---------- */
const LOGMON = { Jan:'січня',Feb:'лютого',Mar:'березня',Apr:'квітня',May:'травня',Jun:'червня',
                 Jul:'липня',Aug:'серпня',Sep:'вересня',Oct:'жовтня',Nov:'листопада',Dec:'грудня' };
function parseLog(txt) {
  const rows = [];
  for (const line of txt.split('\n')) {
    const m = line.match(/^[.*]?\s*(\w{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})[.\d]*:\s*%([^\s:]+):\s*(.+)$/);
    if (!m) continue;
    const [, mon, day, time, code, text] = m;
    let what = text, port = '';
    const pm = text.match(/Interface (FastEthernet\d+|GigabitEthernet\d+|Vlan\d+)/);
    if (pm) port = pm[1].replace('FastEthernet', 'Fa').replace('GigabitEthernet', 'Gi');
    if (/LINK-3-UPDOWN/.test(code)) what = /to up/.test(text) ? 'порт піднявся' : 'порт погас';
    else if (/LINEPROTO-5-UPDOWN/.test(code)) what = /to up/.test(text) ? 'зв’язок з’явився' : 'зв’язок зник';
    else if (/ILPOWER-5-POWER_GRANTED|ILPOWER-7-DETECT/.test(code)) what = 'подано живлення PoE';
    else if (/ILPOWER-5-IEEE_DISCONNECT|ILPOWER-3/.test(code)) what = 'живлення PoE знято';
    else if (/SYS-5-RESTART|SYS-5-RELOAD/.test(code)) what = 'комутатор перезапущено';
    else if (/PLATFORM-1-CRASHED/.test(code)) what = 'збій програми комутатора';
    else if (/PORT_SECURITY/.test(code)) what = 'спрацював захист порту';
    else if (/STORM/.test(code)) what = 'широкомовний шторм';
    if (/CLS_ACC-4-NO_HTTP_PAGE/.test(code)) continue;
    rows.push({ date: `${+day} ${LOGMON[mon] || mon}`, time, port, what, code, raw: text });
  }
  return rows.reverse();
}
async function loadLog() {
  const txt = await exec('show logging');
  const raw = $('#logText'); if (raw) raw.textContent = txt || 'порожньо';
  const rows = parseLog(txt);
  const t = $('#logTable'); if (!t) return;
  t.innerHTML = `<tr><th>Коли</th><th>Порт</th><th>Що сталося</th><th>Подробиці</th></tr>` +
    (rows.map(r => {
      const p = PORTS.find(x => x.id === r.port);
      const bad = /погас|зник|збій|шторм|знято|захист/.test(r.what);
      return `<tr><td class="num">${esc(r.date)} ${esc(r.time)}</td>
        <td><b>${esc(r.port || '—')}</b>${p && labelName(p.id) ? '<br><span class="hint">' + esc(labelName(p.id)) + '</span>' : ''}</td>
        <td class="${bad ? 'bad' : ''}">${esc(r.what)}</td>
        <td class="hint">${esc(r.code)}</td></tr>`;
    }).join('') || '<tr><td colspan="4" class="hint">подій ще немає</td></tr>');
}
el('#logView').onchange = () => {
  const raw = $('#logView').value === 'raw';
  $('#logTable').style.display = raw ? 'none' : '';
  $('#logText').style.display = raw ? '' : 'none';
};

/* ---------- історія процесора від комутатора ---------- */
el('#btnCpuHist').onclick = async () => {
  const e = $('#cpuHist'); e.style.display = 'block'; e.textContent = 'завантажую…';
  try { e.textContent = await exec('show processes cpu history'); }
  catch (err) { e.textContent = 'не вдалося: ' + err.message; }
};

/* ---------- звіт про стан ---------- */
el('#btnReport').onclick = async () => {
  toast('Збираю звіт…');
  const now = new Date();
  const L = [];
  L.push(`Звіт про стан комутатора — ${now.toLocaleString('uk-UA')}`);
  L.push('='.repeat(60), '');
  L.push(`Модель: ${OV.model}   Заводський номер: ${OV.serial}`);
  L.push(`Адреса: ${OV.ip}  маска ${OV.mask}  шлюз ${OV.gateway}`);
  L.push(`Версія ПЗ: ${OV.ios} (${OV.image === 'ucode0:' ? 'аварійний образ' : 'звичайний образ'})`);
  L.push(`Працює без перерви: ${OV.uptime}; останній запуск: ${OV.restart}`);
  L.push(`Процесор: ${SYS.cpu5}%   Пам'ять: ${SYS.memTotal ? Math.round(SYS.memUsed / SYS.memTotal * 100) : '?'}%`);
  L.push(`Залізо: ${SYS.env.map(e => e.name + ' — ' + e.text).join(', ')}`);
  L.push(`Живлення PoE: ${(OV.poe?.used ?? 0).toFixed(1)} Вт з ${(OV.poe?.available ?? 0).toFixed(0)} Вт`, '');
  L.push('ПОРТИ', '-'.repeat(60));
  for (const p of PORTS) {
    const bits = [p.id.padEnd(5), (labelName(p.id) || '').padEnd(22), statusText(p).padEnd(22)];
    if (p.poeOper === 'on') bits.push(`${p.poeWatts.toFixed(1)} Вт`);
    if (p.errors) bits.push(`помилок: ${p.errors}`);
    if (labelIp(p.id)) bits.push(`${labelIp(p.id)} — ${ALIVE[p.id] ? (ALIVE[p.id].ok ? 'відповідає' : 'НЕ ВІДПОВІДАЄ') : 'не перевірено'}`);
    L.push(bits.join(' '));
  }
  if (Object.keys(CABLES).length) {
    L.push('', 'ПЕРЕВІРКА КАБЕЛІВ', '-'.repeat(60));
    for (const id in CABLES) L.push(`${id.padEnd(5)} ${CABLES[id].pairs.map(pr =>
      `${pr.pair}: ${PAIR_WORD[pr.status] || pr.status}${pr.len !== 'N/A' ? ' ' + pr.len + ' м' : ''}`).join('; ')}`);
  }
  L.push('', 'ОСТАННІ ПОДІЇ', '-'.repeat(60));
  try { parseLog(await exec('show logging')).slice(0, 25).forEach(r =>
    L.push(`${r.date} ${r.time}  ${(r.port || '').padEnd(5)} ${r.what}`)); } catch (e) {}
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([L.join('\n')], { type: 'text/plain;charset=utf-8' }));
  a.download = `stan-komutatora-${now.toISOString().slice(0, 10)}.txt`;
  a.click();
  toast('Звіт збережено');
};


/* ---------- термінал ---------- */
const TERM = {
  mode: 'exec',        // exec | config | iface
  iface: null,         // контекст інтерфейсу
  hist: [],
  pos: -1,
};
try { TERM.hist = JSON.parse(localStorage.getItem('termHist') || '[]'); } catch (e) {}

function termPrompt() {
  const host = OV.hostname || 'SW';
  if (TERM.mode === 'iface') return `${host}(config-if)#`;
  if (TERM.mode === 'config') return `${host}(config)#`;
  return `${host}#`;
}
function termWrite(text, cls) {
  const box = $('#termOut'); if (!box) return;
  const el = document.createElement('div');
  if (cls) el.className = cls;
  el.textContent = text;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}
function termSetPrompt() { const e = $('#termPrompt'); if (e) e.textContent = termPrompt(); }

const DANGEROUS = /^(del|delete|erase|format|reload|write|squeeze|archive|copy\s+\S+\s+(flash|startup))/i;
const DANGER_WORDS = {
  del: 'видалення файлу', delete: 'видалення файлу', erase: 'стирання пам’яті',
  format: 'форматування пам’яті', reload: 'перезавантаження комутатора',
  archive: 'заливка програмного забезпечення', copy: 'запис у пам’ять', write: 'запис у пам’ять',
};

/* підказка від самого комутатора: той самий URL, але без /CR */
const VIEW_CMD = /^(show|ping|dir|more|test|traceroute)\b/i;
async function termHint(cmd) {
  const parts = cmd.trim().split(/\s+/).filter(Boolean).map(encodeURIComponent);
  const base = VIEW_CMD.test(cmd) ? '/level/15/exec'
             : TERM.mode === 'iface' ? `/level/15/interface/${TERM.iface}/-`
             : TERM.mode === 'config' ? '/level/15/configure/-' : '/level/15/exec';
  const url = `${base}/${parts.join('/')}`;
  const txt = strip(await (await fetch(url, { cache: 'no-store' })).text());
  return txt;
}
async function termRun(raw) {
  const cmd = raw.trim();
  if (!cmd) return;
  termWrite(termPrompt() + ' ' + cmd, 'cmd');
  TERM.hist.push(cmd);
  if (TERM.hist.length > 200) TERM.hist.shift();
  try { localStorage.setItem('termHist', JSON.stringify(TERM.hist)); } catch (e) {}
  TERM.pos = -1;

  const low = cmd.toLowerCase();
  // внутрішні команди
  if (low === 'clear' || low === 'cls') { $('#termOut').innerHTML = ''; return; }
  if (low === 'exit' || low === 'end') {
    if (TERM.mode === 'iface') { TERM.mode = 'config'; TERM.iface = null; }
    else if (TERM.mode === 'config') TERM.mode = 'exec';
    else termWrite('вже у звичайному режимі', 'sys');
    termSetPrompt(); return;
  }
  if (/^(conf|config|configure)( t| terminal)?$/.test(low)) {
    TERM.mode = 'config'; termSetPrompt();
    termWrite('режим налаштування. Команда exit — назад', 'sys'); return;
  }
  if (cmd.endsWith('?')) {
    try { termWrite(await termHint(cmd.slice(0, -1)) || 'підказки немає', 'sys'); }
    catch (e) { termWrite('не вдалося отримати підказку', 'err'); }
    return;
  }
  // перехід у контекст інтерфейсу
  const im = cmd.match(/^interface\s+(\S+)$/i);
  if (im && TERM.mode !== 'exec') {
    const name = im[1].replace(/^fa/i, 'FastEthernet').replace(/^gi?/i, 'GigabitEthernet')
                      .replace(/^vlan/i, 'Vlan').replace(/^FastEthernetstEthernet/i, 'FastEthernet');
    TERM.mode = 'iface'; TERM.iface = name; termSetPrompt();
    termWrite(`налаштування порту ${name}`, 'sys'); return;
  }
  // небезпечні команди — підтвердження
  if (DANGEROUS.test(low)) {
    const word = DANGER_WORDS[low.split(/\s+/)[0]] || 'зміну в пам’яті комутатора';
    if (!confirm(`Команда виконає ${word}:\n\n${cmd}\n\nВиконати?`)) {
      termWrite('скасовано', 'sys'); return;
    }
  }
  const t0 = Date.now();
  try {
    let out;
    if (VIEW_CMD.test(cmd)) out = await exec(cmd);           // перегляд працює в будь-якому режимі
    else if (TERM.mode === 'iface') out = await cfg(cmd, TERM.iface);
    else if (TERM.mode === 'config') out = await cfg(cmd);
    else out = await exec(cmd);
    out = (out || '').replace(/^\s*\n/, '');
    const bad = /Invalid input|Incomplete command|Unrecognized|%Error|not found|Bad mask/i.test(out);
    termWrite(out || '(виконано, відповіді немає)', bad ? 'err' : '');
    if (!bad && !out.trim()) termWrite('готово', 'ok');
    termWrite(`— ${((Date.now() - t0) / 1000).toFixed(1)} с`, 'sys');
  } catch (e) {
    termWrite('не вдалося: ' + e.message, 'err');
  }
}
el('#termIn').onkeydown = async function (ev) {
  const inp = this;
  if (ev.key === 'Enter') {
    const v = inp.value; inp.value = '';
    await termRun(v);
    if (/^(no |ip |interface |vlan |switchport |power |storm|monitor|hostname|spanning)/i.test(v.trim())) refresh(true);
  } else if (ev.key === 'ArrowUp') {
    ev.preventDefault();
    if (!TERM.hist.length) return;
    TERM.pos = TERM.pos < 0 ? TERM.hist.length - 1 : Math.max(0, TERM.pos - 1);
    inp.value = TERM.hist[TERM.pos];
  } else if (ev.key === 'ArrowDown') {
    ev.preventDefault();
    if (TERM.pos < 0) return;
    TERM.pos++;
    if (TERM.pos >= TERM.hist.length) { TERM.pos = -1; inp.value = ''; }
    else inp.value = TERM.hist[TERM.pos];
  } else if (ev.key === 'Tab') {
    ev.preventDefault();
    const parts = inp.value.trim().split(/\s+/);
    const last = parts.pop() || '';
    try {
      const hint = await termHint(parts.join(' '));
      const words = [...hint.matchAll(/^(\S+)\s{2,}/gm)].map(m => m[1])
        .concat([...hint.matchAll(/^\s*(\S+)\s+\S/gm)].map(m => m[1]));
      const opts = [...new Set(words)].filter(w => w.toLowerCase().startsWith(last.toLowerCase()) && /^[a-z0-9-]+$/i.test(w));
      if (opts.length === 1) inp.value = [...parts, opts[0]].join(' ') + ' ';
      else if (opts.length > 1) termWrite(opts.join('   '), 'sys');
    } catch (e) { /* підказка не вийшла — нічого страшного */ }
  }
};
el('#termClear').onclick = () => { $('#termOut').innerHTML = ''; };
el('#termSave').onclick = () => {
  const txt = [...$$('#termOut > div')].map(d => d.textContent).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
  a.download = 'terminal-' + new Date().toISOString().slice(0, 16).replace(':', '-') + '.txt';
  a.click();
};

/* ---------- перетягування у термінал ---------- */
function termDropSetup() {
  const zone = $('#termOut'), inp = $('#termIn');
  if (!zone || zone.dataset.drop) return;
  zone.dataset.drop = '1';

  const stop = e => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => {
    stop(e); zone.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'copy';
  }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => {
    stop(e); zone.classList.remove('drag-over');
  }));

  zone.addEventListener('drop', async e => {
    const f = e.dataTransfer.files?.[0];
    if (f) return runFile(f);
    const txt = e.dataTransfer.getData('text/plain');
    if (!txt) return;
    const port = txt.match(/^(Fa|Gi)\d+$/);
    if (port) {
      inp.value = (TERM.mode === 'exec' ? 'show interfaces ' : 'interface ') + full(txt);
      inp.focus();
      termWrite(`перетягнуто порт ${txt}`, 'sys');
    } else if (txt.includes('\n')) {
      runLinesInteractive(txt.split('\n'));
    } else {
      inp.value = txt.trim(); inp.focus();
    }
  });
  // поле вводу теж приймає файл
  inp.addEventListener('dragover', stop);
  inp.addEventListener('drop', e => { stop(e); const f = e.dataTransfer.files?.[0]; if (f) runFile(f); });
}
async function runFile(file) {
  if (file.size > 200000) return termWrite('файл завеликий (максимум 200 КБ)', 'err');
  const text = await file.text();
  termWrite(`файл «${file.name}», ${(file.size / 1024).toFixed(1)} КБ`, 'sys');
  runLinesInteractive(text.split('\n'), file.name);
}
async function runLinesInteractive(lines, name) {
  const cmds = lines.map(l => l.replace(/\r$/, '').trim())
    .filter(l => l && !l.startsWith('!') && !l.startsWith('#') && l !== 'end' && l !== 'exit');
  if (!cmds.length) return termWrite('у файлі немає команд', 'err');
  const preview = cmds.slice(0, 8).join('\n') + (cmds.length > 8 ? `\n… і ще ${cmds.length - 8}` : '');
  if (!confirm(`Виконати ${cmds.length} команд${name ? ' із файлу «' + name + '»' : ''} на комутаторі?\n\n${preview}`)) {
    return termWrite('скасовано', 'sys');
  }
  termWrite(`виконую ${cmds.length} команд…`, 'sys');
  const wasBusy = busy; busy = true;
  try {
    const out = await cfgLines(cmds);
    const bad = /Invalid input|Incomplete|Unrecognized|%Error/i.test(out);
    termWrite(out || 'готово', bad ? 'err' : 'ok');
    if (bad) termWrite('частина команд не підійшла — подивіться повідомлення вище', 'err');
  } catch (e) {
    termWrite('не вдалося: ' + e.message, 'err');
  } finally {
    busy = wasBusy;
  }
  await refresh(true);
}

function termInit() {
  termSetPrompt();
  termDropSetup();
  if (!$('#termOut').children.length) {
    termWrite(`Комутатор ${OV.model || ''} ${OV.hostname || ''} · ${OV.ios || ''}`, 'sys');
    termWrite('Введіть команду. Наприклад: show version, show interfaces status, show power inline', 'sys');
  }
  setTimeout(() => $('#termIn')?.focus(), 50);
}


/* ---------- підказки команд ---------- */
const CHEATS = [
  ['Що зараз із комутатором', [
    ['show interfaces status', 'усі порти: стан, швидкість, мережа'],
    ['show power inline', 'живлення PoE по портах і загальний запас'],
    ['show version', 'модель, версія, скільки працює без перерви'],
    ['show processes cpu', 'навантаження процесора'],
    ['show env all', 'температура, вентилятор, живлення'],
    ['show mac address-table', 'які пристрої на яких портах'],
    ['show logging', 'журнал подій'],
  ]],
  ['Один порт докладно', [
    ['show interfaces FastEthernet5', 'усе про порт: швидкість, помилки, трафік'],
    ['show power inline FastEthernet5', 'скільки ватів бере пристрій'],
    ['show interfaces FastEthernet5 counters errors', 'помилки саме на цьому порту'],
    ['test cable-diagnostics tdr interface FastEthernet5', 'перевірити кабель'],
    ['show cable-diagnostics tdr interface FastEthernet5', 'показати результат перевірки'],
  ]],
  ['Керування портом', [
    ['configure terminal', 'увійти в режим налаштування'],
    ['interface FastEthernet5', 'перейти до порту'],
    ['shutdown', 'вимкнути порт (зніме й живлення камери)'],
    ['no shutdown', 'увімкнути порт'],
    ['power inline never', 'вимкнути живлення на порту'],
    ['power inline auto', 'повернути живлення'],
    ['description Kamera vkhid', 'підписати порт (лише латиницею)'],
    ['switchport access vlan 1', 'перенести порт у мережу'],
  ]],
  ['Перевірка зв’язку', [
    ['ping 192.168.1.1', 'чи відповідає роутер'],
    ['ping 8.8.8.8', 'чи є інтернет у комутатора'],
    ['show ip interface brief', 'адреси комутатора'],
    ['show vlan brief', 'мережі та які порти в них'],
  ]],
  ['Збереження та обслуговування', [
    ['write memory', 'зберегти налаштування'],
    ['show running-config', 'показати поточні налаштування'],
    ['dir flash:', 'що лежить у пам’яті'],
    ['show clock', 'годинник комутатора'],
  ]],
];
function drawCheats() {
  const box = $('#termCheats'); if (!box || box.dataset.ready) return;
  box.dataset.ready = '1';
  box.innerHTML = CHEATS.map(([title, list]) => `<div class="cheat-group"><h4>${esc(title)}</h4>` +
    list.map(([cmd, note]) => `<button class="cheat" data-cmd="${esc(cmd)}"><code>${esc(cmd)}</code><span>${esc(note)}</span></button>`).join('') +
    `</div>`).join('');
  $$('.cheat', box).forEach(b => b.onclick = () => {
    const inp = $('#termIn');
    inp.value = b.dataset.cmd; inp.focus();
  });
}
el('#termHelp').onclick = () => {
  const box = $('#termCheats');
  drawCheats();
  const show = box.style.display === 'none';
  box.style.display = show ? 'block' : 'none';
  $('#termHelp').textContent = show ? 'Сховати підказки' : 'Підказки команд';
};

/* ---------- довідник ---------- */
const HELP = [
  ['Камера не працює — з чого почати', `
    <ol>
      <li>Відкрийте вкладку <b>Порти</b> і знайдіть порт камери за підписом.</li>
      <li><b>Порт «вільний»</b> — сигналу від камери немає. Причина в кабелі або в самій камері:
          відкрийте порт і натисніть <b>Перевірити кабель</b>. «Обрив» на кілька метрів означає пошкоджену лінію
          саме на цій відстані; «ціла» — кабель у порядку, отже справа в камері.</li>
      <li><b>Порт «живить», але камери не видно в мережі</b> — живлення йде, камера завантажилась, але не відповідає.
          Впишіть у картці порту її адресу й натисніть <b>Перевірити зв'язок</b>. Якщо мовчить —
          натисніть <b>Перезапустити живлення</b>: камера перезавантажиться.</li>
      <li><b>Порт «працює», картинки немає</b> — камера передає щось не те. Увімкніть
          <b>дзеркалювання</b> (вкладка Діагностика), підключіть ноутбук у вказаний порт і подивіться потік.</li>
      <li>У вкладці <b>Журнал</b> видно, коли порт падав і піднімався — якщо камера моргає щоночі, це буде там.</li>
    </ol>`],
  ['Камера не вмикається від PoE', `
    <p>Комутатор дає <b>15,4 Вт на порт</b> за стандартом 802.3af. Камери з підігрівом, поворотні (PTZ) і потужні
    прожектори вимагають 25–30 Вт (стандарт 802.3at, «PoE+») — такі він не потягне, потрібен окремий інжектор.</p>
    <p>Перевірте у вкладці <b>Живлення PoE</b>: якщо навпроти порту «вимкнено» — увімкніть живлення в картці порту.
    Якщо загальний запас майже вичерпано (370 Вт на всі порти), нова камера теж не запуститься.</p>`],
  ['Підключаю нову камеру', `
    <ol>
      <li>Вставте кабель у будь-який порт <b>1–24</b> — вони всі з живленням. Гігабітні порти живлення не дають.</li>
      <li>За хвилину камера з'явиться у вкладці <b>Пристрої</b> — там видно її апаратну адресу й виробника.</li>
      <li>Відкрийте порт у вкладці <b>Порти</b>, впишіть підпис (напр. «Камера над входом») і адресу камери.</li>
      <li>Натисніть <b>Зберегти налаштування</b> вгорі, щоб підписи й налаштування пережили вимкнення живлення.</li>
    </ol>`],
  ['Що означають кольори портів', `
    <ul>
      <li><b>Зелений</b> — порт працює, пристрій на зв'язку.</li>
      <li><b>Жовтий</b> — порт живить пристрій (знизу видно, скільки ватів).</li>
      <li><b>Порожній</b> — вільний, нічого не підключено.</li>
      <li><b>Пунктирний</b> — порт вимкнений вручну.</li>
      <li><b>Червоний</b> — порт заблокований через помилку.</li>
      <li><b>Червона смужка знизу</b> — на порту є помилки передавання: перевірте кабель.</li>
    </ul>`],
  ['Помилки на портах — це страшно?', `
    <p>Поодинокі помилки бувають і в справній мережі. Тривожно, коли число <b>росте щодня</b> — тоді причина
    зазвичай у кабелі: погана скрутка, волога в гофрі, пошкодження, надто довга лінія (понад 100 метрів) або
    сусідство з силовим кабелем.</p>
    <p>Перевірте кабель у вкладці <b>Кабелі</b>: панель покаже довжину кожної пари й місце обриву.</p>`],
  ['Як зберігати налаштування', `
    <p>Кнопка <b>Зберегти налаштування</b> вгорі записує поточний стан у пам'ять комутатора. Без неї зміни
    працюють, але зникнуть після вимкнення живлення. У терміналі те саме робить команда <code>write memory</code>.</p>`],
  ['Термінал: як ним користуватися', `
    <ul>
      <li>Команди перегляду (<code>show …</code>, <code>ping …</code>) працюють завжди.</li>
      <li><code>configure terminal</code> вмикає режим налаштування, <code>exit</code> повертає назад.</li>
      <li><code>interface Fa5</code> переходить до порту — далі команди стосуються саме його.</li>
      <li><b>Tab</b> доповнює команду, <b>?</b> наприкінці показує можливі продовження, <b>↑ ↓</b> — попередні команди.</li>
      <li>У вікно терміналу можна <b>перетягнути файл</b> із командами — панель виконає їх, пропустивши коментарі.</li>
      <li>Кнопка <b>Підказки команд</b> відкриває перелік корисних команд — натисніть, щоб підставити.</li>
    </ul>`],
  ['Чому панель виглядає саме так', `
    <p>Заводська панель Cisco (Device Manager) зникла разом з очищеною пам'яттю, а Cisco цю модель уже не підтримує.
    Тому панель написана заново й лежить у пам'яті самого комутатора, у теці <code>flash:html</code>:
    відкривається за його адресою, без жодних програм на комп'ютері.</p>
    <p>Комутатор працює на прошивці <b>12.2(25)SEG6</b> (з 21.09.2026; до того — на аварійному вбудованому образі).
    Якщо після оновлення прошивки панель відкриється порожньою, поверніть їй шлях командою
    <code>ip http path flash:html</code> і збережіть.</p>`],
  ['Обмеження цього комутатора', `
    <ul>
      <li>Порти 1–24 працюють на швидкості <b>100 Мбіт</b>, гігабіт лише на двох останніх.</li>
      <li>Живлення PoE: <b>15,4 Вт</b> на порт, <b>370 Вт</b> разом.</li>
      <li>Підписи портів у самому комутаторі — лише латиницею (він не розуміє українських літер),
          тому панель показує українську назву, а в порт записує транслітерацію.</li>
      <li>Власний HTTPS комутатора знає лише застарілий протокол SSLv3, до якого сучасні браузери не підключаються,
          тому він вимкнений. Захищений вхід ззовні краще давати через роутер (наприклад, службою KeenDNS у Keenetic), а не самим комутатором.</li>
    </ul>`],
];
function drawHelp() {
  const box = $('#helpBody'); if (!box) return;
  const q = ($('#helpSearch')?.value || '').toLowerCase();
  const items = HELP.filter(([t, b]) => !q || t.toLowerCase().includes(q) || b.toLowerCase().includes(q));
  box.innerHTML = items.map(([t, b]) => `<div class="help-item"><h3>${esc(t)}</h3>${b}</div>`).join('')
    || '<p class="hint">нічого не знайшлося</p>';
}
el('#helpSearch').oninput = drawHelp;


/* ---------- самооновлення панелі ----------
   Файловий сервер комутатора віддає сторінки з max-age=3600, тож браузер тримає стару версію годину.
   Панель сама питає номер актуальної версії і перезавантажується, якщо він новіший. */
const MY_V = +((document.querySelector('script[src*="app.js"]')?.getAttribute('src') || '').match(/v=(\d+)/) || [0, 0])[1];
async function checkPanelVersion() {
  try {
    const html = await (await fetch('/home.html?t=' + Date.now(), { cache: 'no-store' })).text();
    const v = +((html.match(/app\.js\?v=(\d+)/) || [0, 0])[1]);
    if (v && MY_V && v > MY_V) {
      toast('Панель оновилась — перезавантажую');
      setTimeout(() => location.replace('/index.html?v=' + v), 1200);
    }
  } catch (e) {}
}
checkPanelVersion();
setInterval(checkPanelVersion, 10 * 60 * 1000);

/* ---------- перевірка оновлень на GitHub ---------- */
const GH_REPO = 'roman885-85/ce500-web-panel';
const GH_RAW = `https://raw.githubusercontent.com/${GH_REPO}/main/panel/version.json`;
async function checkGithubUpdate() {
  try {
    const r = await fetch(GH_RAW, { cache: 'no-store', mode: 'cors' });
    if (!r.ok) return;
    const info = await r.json();
    if (!info.version || !MY_V || info.version <= MY_V) return;
    showUpdateBanner(info.version, info.notes || '');
  } catch (e) { /* немає інтернету або GitHub недоступний — тихо */ }
}
function showUpdateBanner(ver, notes) {
  if (document.getElementById('ghBanner')) return;
  const b = document.createElement('div');
  b.id = 'ghBanner'; b.className = 'gh-banner';
  b.innerHTML = `<span>🔔 Доступна нова версія панелі <b>v${ver}</b>${notes ? ' — ' + esc(notes) : ''}. ` +
    `Щоб оновити, запустіть <code>deploy.sh</code> з комп'ютера у мережі комутатора.</span>` +
    `<a href="https://github.com/${GH_REPO}/releases" target="_blank" rel="noopener">GitHub</a>` +
    `<button class="x" title="Сховати">✕</button>`;
  b.querySelector('button').onclick = () => b.remove();
  document.body.insertBefore(b, document.body.firstChild);
}
checkGithubUpdate();
setInterval(checkGithubUpdate, 6 * 60 * 60 * 1000);   // раз на 6 годин


/* ---------- вкладки, тема, оновлення ---------- */
let TAB = 'overview';
$$('#tabs button').forEach(b => b.onclick = () => {
  TAB = b.dataset.tab;
  $$('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  $$('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + TAB));
  ({ vlans: loadVlans, mac: loadMac, log: loadLog, cables: drawCables, term: termInit, help: drawHelp,
     tools: () => { fillSpanSelects(); spanState().catch(() => {}); } }[TAB] || (() => {}))();
});
el('#btnPause').onclick = () => {
  paused = !paused;
  $('#btnPause').textContent = paused ? 'Відновити оновлення' : 'Пауза оновлення';
  toast(paused ? 'Автооновлення зупинено' : 'Автооновлення відновлено');
};
el('#btnTheme').onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : cur === 'light' ? '' : 'dark';
  next ? document.documentElement.setAttribute('data-theme', next) : document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem('theme', next); } catch (e) {}
  $('#btnTheme').textContent = next === 'dark' ? 'Темна' : next === 'light' ? 'Світла' : 'Як у системі';
};
try {
  const t = localStorage.getItem('theme');
  if (t) { document.documentElement.setAttribute('data-theme', t); $('#btnTheme').textContent = t === 'dark' ? 'Темна' : 'Світла'; }
} catch (e) {}

async function refresh(force) {
  if (busy && !force) return;
  // поки користувач друкує в будь-якому полі — не чіпати екран (щоб не стирати ввід)
  if (isAnyEditing() && !force) { $('#footTime').textContent = new Date().toLocaleTimeString('uk-UA') + ' (пауза — введення)'; return; }
  try {
    await loadPorts();
    if (tick % 4 === 0 || force) await loadOverview();
    checkLost();
    drawCards(); drawTables(); drawMonitor();
    drawPanel($('#panelFull'), false); drawPanel($('#panelMini'), true);
    if (TAB === 'mac') await loadMac();
    else if (tick % 3 === 0) { try { await loadMac(); } catch (e) {} }  // тримаємо MAC-таблицю свіжою для автовизначення IP
    if (TAB === 'cables') drawCables();
    if (SEL) renderDrawer();
    ensureIps().catch(() => {});   // фонове автовизначення IP нових пристроїв
    tick++;
    $('#footTime').textContent = new Date().toLocaleTimeString('uk-UA');
  } catch (e) { toast('Комутатор не відповідає', true); }
}
const idle = () => !busy && !paused && !document.hidden && !isAnyEditing();
(async () => {
  await loadLabels();
  await refresh(true);
  await loadSystem(); drawMonitor();
  await loadMac();
  ensureIps(true).catch(() => {});   // одразу знайти адреси при відкритті панелі
})();
setInterval(() => { if (idle()) loadTraffic().catch(() => {}); }, 5000);   // трафік — часто й дешево
setInterval(() => { if (idle()) refresh(); }, 15000);                      // порти, живлення, помилки
setInterval(() => { if (idle()) loadSystem().then(drawMonitor).catch(() => {}); }, 20000); // процесор, пам'ять, стан заліза

/* дозвіл на сповіщення питаємо один раз, після першого дотику до панелі */
document.addEventListener('click', function ask() {
  document.removeEventListener('click', ask);
  try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
}, { once: true });
