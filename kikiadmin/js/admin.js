/* ============================================================
   LUMÉ — Admin panel mantiq (js/admin.js)
   Dizayn: ovqat-dokoni admin. Funksiyalar: lume mobil ilova bilan
   AYNAN bir xil — Supabase app='lume' ostida ishlaydi.
   Kalitlar: lume_products, lume_categories, lume_banners,
             lume_orders, lume_chat, lume_settings
   ============================================================ */
'use strict';

/* Do'konning Supabase client kaliti — mobil ilovadagi kStoreClient bilan AYNAN bir xil.
   Admin shu kalit ostida yozadi, ilova esa aynan shundan o'qiydi. URL ?client=... yoki
   localStorage orqali boshqa do'konga ham ulanish mumkin. */
const STORE_CLIENT = 'CL-MT9YR2SB2ZLJ';

/* ===== yordamchi ===== */
const num = n => Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const som = n => num(n) + " so'm";
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = id => document.getElementById(id);

/* ===== rasm vektorlari (storefrontdan) ===== */
function art(k) {
  const B = {
    doubtless: `<rect x="47" y="4" width="26" height="32" rx="4" fill="#141414"/><rect x="49" y="36" width="22" height="12" rx="2" fill="#242424"/><rect x="33" y="54" width="54" height="68" rx="11" fill="#121212"/><rect x="37" y="64" width="46" height="46" rx="3" fill="url(#gdo)"/><rect x="37" y="98" width="46" height="12" fill="#7B3FA0" opacity=".85"/>`,
    found: `<rect x="47" y="6" width="26" height="36" rx="3" fill="url(#gred)"/><rect x="53" y="42" width="14" height="7" fill="#DCD3C8"/><rect x="33" y="49" width="54" height="73" rx="9" fill="#F4EDE4"/><rect x="42" y="70" width="36" height="4" rx="2" fill="#C8102E"/><rect x="46" y="82" width="28" height="2.6" rx="1.3" fill="#C8102E" opacity=".7"/>`,
    fixer: `<rect x="43" y="4" width="34" height="40" rx="3" fill="#7E0F1C" opacity=".8"/><rect x="53" y="14" width="7" height="24" rx="2" fill="#A81829"/><rect x="35" y="44" width="50" height="78" rx="11" fill="url(#gred)"/><rect x="44" y="74" width="32" height="4" rx="2" fill="#fff" opacity=".95"/>`,
    arencia: `<rect x="49" y="6" width="22" height="15" rx="3" fill="#C2CE44"/><path d="M42 21h36v84a4 4 0 01-4 4H46a4 4 0 01-4-4z" fill="url(#gyel)"/><rect x="42" y="109" width="36" height="9" rx="1.5" fill="#AEBB35"/><rect x="56" y="34" width="4" height="58" rx="2" fill="#3A3F14" opacity=".55"/>`
  }[k] || `<rect x="40" y="20" width="40" height="98" rx="12" fill="url(#gred)"/><rect x="52" y="6" width="16" height="16" rx="3" fill="#C8102E"/><rect x="49" y="60" width="22" height="4" rx="2" fill="#fff" opacity=".9"/>`;
  return `<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="gdo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7B733"/><stop offset="52%" stop-color="#E2622A"/><stop offset="100%" stop-color="#7B3FA0"/></linearGradient>
    <linearGradient id="gred" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E8323F"/><stop offset="55%" stop-color="#C8102E"/><stop offset="100%" stop-color="#8A0A1E"/></linearGradient>
    <linearGradient id="gyel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E8EE86"/><stop offset="55%" stop-color="#D2DC5C"/><stop offset="100%" stop-color="#AFBB33"/></linearGradient>
  </defs>${B}</svg>`;
}
function imgStyle(p) {
  const fit = (p && p.fit === 'cover') ? 'cover' : 'contain';
  const zoom = (p && p.zoom) || 1;
  const pos = (p && p.pos) || '50% 50%';
  return `width:100%;height:100%;object-fit:${fit};object-position:${pos};transform:scale(${zoom})`;
}
function pic(p) { return (p && p.img) ? `<img src="${p.img}" alt="" style="${imgStyle(p)}">` : art(p && p.k); }

/* ===== toifalar ===== */
const DEFAULT_CATS = [
  { id: 1, name: 'Pardoz', emo: '💄' }, { id: 2, name: 'Kremlar', emo: '🧴' },
  { id: 3, name: 'Parfyum', emo: '🌸' }, { id: 4, name: 'Fiksator', emo: '💧' }, { id: 5, name: 'SPF', emo: '☀️' }
];
let categories = [];
function catName(id) { const c = categories.find(x => x.id == id); return c ? c.name : ''; }
function catImgStyle(c) {
  const fit = (c && c.fit === 'cover') ? 'cover' : 'contain';
  const zoom = (c && c.zoom) || 1;
  const pos = (c && c.pos) || '50% 50%';
  return `width:100%;height:100%;object-fit:${fit};object-position:${pos};transform:scale(${zoom})`;
}
function catPic(c) {
  if (c && c.img) return `<img src="${c.img}" alt="" style="${catImgStyle(c)}">`;
  return `<span class="emo">${esc(c && c.emo ? c.emo : '🏷️')}</span>`;
}
const ART_KEYS = [['found', 'Tonal / found'], ['doubtless', 'Parfyum'], ['fixer', 'Fiksator'], ['arencia', 'Tuba / krem']];

const DEFAULT_PRODUCTS = [];

let products = [], orders = [], banners = [], settings = { brand: 'LUMÉ', phone: '+998 71 200 00 00', tg: '@lume_support', ship: 25000 };
let archivedOrders = [];  // arxivlangan (o'chirilgan) buyurtmalar — lume_orders_archive
let promos = [];          // chegirma bo'limlari — lume_promos
let commissions = [];     // pul o'tkazma komissiyalari — lume_commissions [{id,name,pct}]
let monthlyExpense = 0;   // oylik harajatlar (ijara, ish haqi va h.k.) — lume_expenses (son)
let users = [];           // ro'yxatdan o'tgan foydalanuvchilar — lume_users [{id,name,phone,addr,ts}]
let chatMsgs = [];
let editImg = null, editKey = 'found';
let editImgs = [];            // mahsulot rasmlari (10 tagacha). editImg = editImgs[0] (asosiy/karta rasmi)
const MAX_PROD_IMGS = 10;
let editFit = 'contain', editZoom = 1, editPosX = 50, editPosY = 50;
let editImgR = null, editFitR = 'contain', editZoomR = 1, editPosXR = 50, editPosYR = 50;
function editObj() { return { img: editImg, k: editKey, fit: editFit, zoom: editZoom, pos: editPosX + '% ' + editPosY + '%' }; }

/* ===== Cloud helpers ===== */
function cget(k, f) { try { return (window.Cloud && Cloud.get) ? Cloud.get(k, f) : f; } catch (e) { return f; } }
function cset(k, v) { try { if (window.Cloud && Cloud.set) Cloud.set(k, v); } catch (e) { } }

/* ===== toast (ovqat uslubi) ===== */
function toast(m, kind) {
  const zone = $('toastZone'); if (!zone) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || 'ok');
  el.innerHTML = `<span class="ico"></span>${esc(m)}`;
  zone.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; }, 1900);
  setTimeout(() => el.remove(), 2250);
}

/* ===== ikonalar ===== */
const ICONS = {
  dash: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
  stats: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 20V4M4 20h16"/><rect x="7.5" y="12" width="3" height="5" rx="1"/><rect x="12.5" y="8.5" width="3" height="8.5" rx="1"/><rect x="17.5" y="6" width="3" height="11" rx="1"/></svg>',
  prods: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7L12 3 4 7m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4"/></svg>',
  cats: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>',
  banner: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="10" r="1.6"/><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.5-4 3 2.5L15 11l5 5"/></svg>',
  orders: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="4.5" y="3.5" width="15" height="17" rx="3"/><path stroke-linecap="round" d="M8.8 8.6h6.4M8.8 12h6.4M8.8 15.4h3.6"/></svg>',
  chat: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10.5h8M8 14h5M21 12a8 8 0 01-11.5 7.2L3 21l1.8-6.5A8 8 0 1121 12z"/></svg>',
  users: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20v-1.5a3.5 3.5 0 00-3.5-3.5h-6A3.5 3.5 0 004 18.5V20"/><circle cx="10.5" cy="8" r="3.3"/><path stroke-linecap="round" stroke-linejoin="round" d="M20 20v-1.3a3 3 0 00-2.3-2.9M16 5.2a3 3 0 010 5.6"/></svg>',
  qr: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path stroke-linecap="round" d="M14 14h3M20 14v3M17 17v3.5M20.5 20.5H20M14 20.5h.5"/></svg>',
  settings: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2 2 2 0 11-4 0 1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0010 3.6 1.7 1.7 0 0011 2.1V2a2 2 0 114 0v.1A1.7 1.7 0 0016 3.6a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1H22a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  admins: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 20v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 18.5V20"/><circle cx="10" cy="8" r="3.2"/><path stroke-linecap="round" stroke-linejoin="round" d="M19 20v-1.2a3 3 0 00-2.2-2.9M15.5 5.2a3 3 0 010 5.6"/></svg>',
  bot: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.5 4.5L2.5 11.8c-1 .4-1 1.8.1 2.1l4.6 1.4 1.7 5.2c.3.9 1.4 1 2 .3l2.5-2.7 4.6 3.4c.7.5 1.7.1 1.9-.7l3.1-14.6c.2-1-.8-1.9-1.9-1.4z"/><path stroke-linecap="round" stroke-linejoin="round" d="M7.2 15.3L18 7.5l-8 8.5"/></svg>',
  notif: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg>',
  check: '<svg fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
  eye: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  star: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l2.7 5.5 6 .9-4.35 4.24 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.4l6-.9z"/></svg>',
  starFill: '<svg fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 3l2.7 5.5 6 .9-4.35 4.24 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.4l6-.9z"/></svg>',
  archive: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4.5" rx="1.5"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 8.5V18a2 2 0 002 2h10a2 2 0 002-2V8.5M10 12h4"/></svg>',
  edit: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
  del: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" d="M5 7h14M10 11v6M14 11v6"/><path stroke-linecap="round" stroke-linejoin="round" d="M6.5 7l.8 12a2 2 0 002 1.9h5.4a2 2 0 002-1.9l.8-12"/></svg>',
  up: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 15l-6-6-6 6"/></svg>',
  down: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>',
  upload: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>',
  download: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>',
  info: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 11v5M12 8h.01"/></svg>',
  arxiv: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4.5" rx="1.5"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 8.5V18a2 2 0 002 2h10a2 2 0 002-2V8.5M10 12h4"/></svg>',
  restore: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M4.6 9a8 8 0 11-1 5"/></svg>'
};

/* ===== ADMINLAR / AUTH ===== */
// Bosh admin — boshlang'ich (default) qiymatlar. O'chirib bo'lmaydi, barcha menyularni ko'radi.
// Login/parol/ism serverdagi lume_super kaliti orqali o'zgartirilishi mumkin.
const SUPER = { id: 'super', login: 'tiro', pass: 'tiro00', name: 'Bosh admin', role: 'super' };
let superCfg = {};      // serverdagi bosh admin sozlamalari (lume_super): {login,pass,name}
// Amaldagi (effektiv) bosh admin — default ustiga serverdagi o'zgarishlar qo'yiladi.
function superAcc() {
  return {
    id: 'super',
    role: 'super',
    login: (superCfg && superCfg.login) || SUPER.login,
    pass: (superCfg && superCfg.pass) || SUPER.pass,
    name: (superCfg && superCfg.name) || SUPER.name,
  };
}
let admins = [];        // qo'shimcha adminlar (lume_admins)
let currentAdmin = null; // hozir kirgan admin

/* ===== NAV ===== */
// [kalit, nom, tavsif] — 'admins' faqat bosh adminga ko'rinadi (ruxsatlar ro'yxatida chiqmaydi).
const NAV = [
  ['dash', 'Boshqaruv', 'Do\'kon holati bir qarashda'],
  ['stats', 'Statistika', 'Sotuv va foyda tahlili'],
  ['prods', 'Mahsulotlar', 'Katalogni boshqaring'],
  ['cats', 'Toifalar', 'Kategoriyalarni boshqaring'],
  ['banner', 'Baner', 'Bosh sahifa banerlari'],
  ['orders', 'Buyurtmalar', 'Kelgan buyurtmalar'],
  ['arxiv', 'Arxiv', 'O\'chirilgan buyurtmalar'],
  ['chat', 'Habarlar', 'Mijozlar bilan xabarlashuv'],
  ['notif', 'Bildirishnoma', 'Barcha mijozlarga push xabar'],
  ['users', 'Userlar', 'Ro\'yxatdan o\'tgan foydalanuvchilar'],
  ['bot', 'Telegram bot', 'Buyurtmalarni kanalga ulash'],
  ['settings', 'Sozlamalar', 'Do\'kon ma\'lumotlari'],
  ['admins', 'Adminlar', 'Adminlarni boshqarish']
];
// Yangi admin uchun belgilanadigan menyular (admins bundan tashqari — faqat bosh admin).
const PERM_KEYS = ['dash', 'stats', 'prods', 'cats', 'banner', 'orders', 'arxiv', 'chat', 'users', 'bot', 'settings'];
// Mobil tab-barda ko'rinishi mumkin bo'lgan bo'limlar (ruxsatga qarab filtr qilinadi).
const TAB_KEYS = ['dash', 'prods', 'orders', 'chat', 'settings'];

function isSuper() { return currentAdmin && currentAdmin.role === 'super'; }
// Berilgan bo'limdan foydalanish mumkinmi?
function allowed(s) {
  if (!currentAdmin) return false;
  if (isSuper()) return true;          // bosh admin — hammasi
  if (s === 'admins') return false;    // adminlar boshqaruvi — faqat bosh admin
  return (currentAdmin.perms || []).includes(s);
}
// Kirgan admin ko'ra oladigan birinchi bo'lim.
function firstAllowed() {
  const list = NAV.map(n => n[0]).filter(allowed);
  return list[0] || 'dash';
}

function buildNav() {
  const items = NAV.filter(([s]) => allowed(s));
  $('nav').innerHTML = items.map(([s, label]) => `
    <a class="nav-item" data-s="${s}" onclick="nav('${s}')">
      <span class="nic">${ICONS[s]}</span>${label}
      ${s === 'orders' ? '<span class="badge" id="navOrdBadge" style="display:none">0</span>' : ''}
    </a>`).join('');
  const tabs = TAB_KEYS.filter(allowed).slice(0, 5);
  $('tabbar').innerHTML = tabs.map(s => {
    const label = (NAV.find(n => n[0] === s) || [])[1] || s;
    return `<a class="mt-item" data-s="${s}" onclick="nav('${s}')">
      ${ICONS[s]}<span>${label}</span></a>`;
  }).join('');
}

function nav(s) {
  if (!allowed(s)) s = firstAllowed();  // ruxsatsiz bo'limga kirishni bloklaymiz
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.s === s));
  document.querySelectorAll('.mt-item').forEach(b => b.classList.toggle('is-active', b.dataset.s === s));
  document.querySelectorAll('.section').forEach(x => x.classList.remove('is-active'));
  const sec = $('sec-' + s); if (sec) sec.classList.add('is-active');
  const meta = NAV.find(n => n[0] === s) || ['', 'Boshqaruv paneli'];
  $('pageTitle').textContent = meta[1];
  if ($('sidebar')) $('sidebar').classList.remove('open');
  if ($('sidebarScrim')) $('sidebarScrim').classList.remove('show');
  if (s === 'dash') drawDash();
  if (s === 'stats') drawStats();
  if (s === 'prods') drawProds();
  if (s === 'cats') drawCats();
  if (s === 'banner') drawBanners();
  if (s === 'orders') drawOrders();
  if (s === 'arxiv') drawArxiv();
  if (s === 'chat') drawChat();
  if (s === 'users') drawUsers();
  if (s === 'bot') drawBot();
  if (s === 'settings') drawSettings();
  if (s === 'admins') drawAdmins();
  if (s === 'notif') drawNotif();
}

/* ===== BILDIRISHNOMA (push) ===== */
// MUHIM: bu "admin bilan chat" (sendAdminChat / lume_chat) dan alohida.
// Bu yerda xabar notifications jadvaliga yoziladi va worker push yuboradi.
function drawNotif() {
  const t = $('notifTitle'), b = $('notifBody');
  if (t) t.value = '';
  if (b) b.value = '';
  loadNotifHistory();
}

async function loadNotifHistory() {
  const box = $('notifHistory');
  if (!box) return;
  box.innerHTML = '<div class="muted" style="padding:8px 0">Yuklanmoqda...</div>';
  let list = [];
  try { list = await Cloud.listNotifications(20); }
  catch (e) { console.error('[notif] history:', e); }
  if (!list.length) {
    box.innerHTML = '<div class="muted" style="padding:8px 0">Hali yuborilgan bildirishnoma yo\'q.</div>';
    return;
  }
  box.innerHTML = list.map(n => {
    const dt = n.created_at ? new Date(n.created_at).toLocaleString('uz-UZ') : '';
    const sent = n.processed ? 'Yuborildi' : 'Navbatda';
    return `<div class="card card-pad" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
        <b>${esc(n.title || '')}</b>
        <span class="muted" style="font-size:12px;white-space:nowrap">${esc(dt)}</span>
      </div>
      ${n.body ? `<div style="margin-top:4px">${esc(n.body)}</div>` : ''}
      <div class="muted" style="font-size:12px;margin-top:6px">${sent}</div>
    </div>`;
  }).join('');
}

async function sendNotification() {
  const title = ($('notifTitle') && $('notifTitle').value || '').trim();
  const body = ($('notifBody') && $('notifBody').value || '').trim();
  if (!title) { toast('Sarlavhani kiriting'); return; }
  const btn = $('notifSendBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Yuborilmoqda...'; }
  try {
    await Cloud.sendNotification(title, body);
    toast('Bildirishnoma yuborildi — barcha mijozlarga push ketadi');
    if ($('notifTitle')) $('notifTitle').value = '';
    if ($('notifBody')) $('notifBody').value = '';
    loadNotifHistory();
  } catch (e) {
    console.error('[notif] sendNotification:', e);
    toast('Xatolik: yuborib bo\'lmadi');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Yuborish'; }
  }
}

/* ===== MODAL (ovqat uslubi) ===== */
function openModal(title, bodyHtml, footHtml) {
  $('modal').innerHTML = `
    <div class="modal-head"><h3>${esc(title)}</h3>
      <button class="modal-x" onclick="closeModal()" aria-label="Yopish">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="modal-body">${bodyHtml}</div>
    ${footHtml ? `<div class="modal-foot">${footHtml}</div>` : ''}`;
  $('modalBack').classList.add('open');
}
function closeModal() { $('modalBack').classList.remove('open'); }

/* ===== BANER ===== */
function drawBanners() {
  drawPromos();
  $('bannerCount').textContent = banners.length;
  const wrap = $('bannerList');
  wrap.innerHTML = banners.length ? banners.map((b, i) => `
    <div class="ban-item">
      <div class="ban-ord">
        <button class="iact" ${i === 0 ? 'disabled' : ''} onclick="moveBanner(${i},-1)" aria-label="Yuqoriga">${ICONS.up}</button>
        <button class="iact" ${i === banners.length - 1 ? 'disabled' : ''} onclick="moveBanner(${i},1)" aria-label="Pastga">${ICONS.down}</button>
      </div>
      <div class="ban-thumb"><img src="${b.img}" alt=""></div>
      <div class="ban-sp">Ilovadagi ko'rinish — tik (4:5)</div>
      <button class="iact danger" onclick="delBanner(${i})" aria-label="O'chirish">${ICONS.del}</button>
    </div>`).join('')
    : `<div class="empty"><div class="e-emo">🖼️</div><h4>Baner yo'q</h4><p class="muted">"Rasm qo'shish" tugmasi orqali yuklang.</p></div>`;
}
function compressBanner(file, cb) {
  if (!/^image\//.test(file.type)) { toast('Faqat rasm faylini tanlang', 'err'); return; }
  const r = new FileReader();
  r.onload = () => {
    const im = new Image(); im.onload = () => {
      const MW = 1200, MH = 1600; let w = im.width, h = im.height;
      const s = Math.min(1, MW / w, MH / h); w = Math.round(w * s); h = Math.round(h * s);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d');
      cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
      let out; try { out = cv.toDataURL('image/jpeg', 0.82) } catch (e) { out = r.result } cb(out);
    }; im.onerror = () => toast('Rasmni o\'qib bo\'lmadi', 'err'); im.src = r.result;
  };
  r.onerror = () => toast('Faylni o\'qib bo\'lmadi', 'err');
  r.readAsDataURL(file);
}
function onBannerFiles(e) {
  const files = [...(e.target.files || [])]; e.target.value = '';
  if (!files.length) return;
  let pending = files.length;
  files.forEach(f => compressBanner(f, out => {
    banners.push({ id: Date.now() + Math.floor(Math.random() * 100000), img: out });
    if (--pending === 0) { cset('lume_banners', banners); drawBanners(); toast('Baner qo\'shildi'); }
  }));
}
function moveBanner(i, dir) {
  const j = i + dir; if (j < 0 || j >= banners.length) return;
  const t = banners[i]; banners[i] = banners[j]; banners[j] = t;
  cset('lume_banners', banners); drawBanners();
}
function delBanner(i) {
  if (!confirm('Baner rasmi o\'chirilsinmi?')) return;
  banners.splice(i, 1); cset('lume_banners', banners); drawBanners(); toast('O\'chirildi');
}

/* ===== CHEGIRMA BO'LIMLARI ===== */
let _promoSel = new Set();
let _promoStyle = 'white';
// Baner fon ranglari (ilovadagi kalitlar bilan bir xil). 'white' = oddiy (rangsiz).
const PROMO_COLORS = [
  ['white', 'Oq (oddiy)', '#ffffff'],
  ['pink', 'Pushti', '#e81e8c'],
  ['purple', 'Binafsha', '#8b3dff'],
  ['blue', 'Ko\'k', '#2563eb'],
  ['green', 'Yashil', '#16a34a'],
  ['orange', 'To\'q sariq', '#f97316'],
  ['red', 'Qizil', '#ef4444'],
  ['teal', 'Moviy', '#0d9488'],
  ['gold', 'Oltin', '#f59e0b'],
];
// Eski 'plain' -> 'white'; noma'lum -> 'white'.
function promoStyleKey(st) {
  if (st === 'plain' || !st) return 'white';
  return PROMO_COLORS.some(c => c[0] === st) ? st : 'white';
}
function promoColorInfo(st) {
  const k = promoStyleKey(st);
  return PROMO_COLORS.find(c => c[0] === k) || PROMO_COLORS[0];
}
function drawPromos() {
  const el = $('promoList'); if (!el) return;
  const pc = $('promoCount'); if (pc) pc.textContent = promos.length;
  el.innerHTML = promos.length ? promos.map((s, i) => `
    <div class="ban-item">
      <div class="ban-ord">
        <button class="iact" ${i === 0 ? 'disabled' : ''} onclick="movePromo(${i},-1)" aria-label="Yuqoriga">${ICONS.up}</button>
        <button class="iact" ${i === promos.length - 1 ? 'disabled' : ''} onclick="movePromo(${i},1)" aria-label="Pastga">${ICONS.down}</button>
      </div>
      <div style="flex:1;min-width:0">
        <b style="font-size:14px">${esc(s.title) || '—'}</b>
        <div style="font-size:12px;margin-top:4px;display:flex;align-items:center;gap:6px">
          <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:13px;height:13px;border-radius:50%;background:${promoColorInfo(s.style)[2]};border:1px solid var(--border-2);display:inline-block"></span>${promoColorInfo(s.style)[1]}</span>
          <span class="muted">· ${(s.items || []).length} ta mahsulot</span>
        </div>
      </div>
      <button class="iact" onclick="openPromo('${s.id}')" title="Tahrir" aria-label="Tahrir">${ICONS.edit}</button>
      <button class="iact danger" onclick="delPromo('${s.id}')" title="O'chirish" aria-label="O'chirish">${ICONS.del}</button>
    </div>`).join('')
    : `<div class="empty"><div class="e-emo">🏷️</div><h4>Chegirma bo'limi yo'q</h4><p class="muted">"Yangi bo'lim" tugmasini bosing.</p></div>`;
}
function openPromo(id) {
  const s = id ? promos.find(x => x.id === id) : null;
  _promoSel = new Set(s ? (s.items || []) : []);
  _promoStyle = s ? promoStyleKey(s.style) : 'white';
  const body = `
    <div class="field"><label>Sarlavha *</label>
      <input class="input" id="pr-title" value="${esc(s ? s.title : '')}" placeholder="Masalan: Geltek -25% yoki Xitlar"></div>
    <div class="field" style="margin-top:12px"><label>Baner fon rangi</label>
      <div class="promo-swatches" id="pr-style">
        ${PROMO_COLORS.map(([k, label, col]) => `
          <button type="button" class="promo-swatch ${_promoStyle === k ? 'on' : ''}" data-st="${k}" title="${label}" onclick="setPromoStyle('${k}')" style="--sw:${col}"></button>`).join('')}
      </div>
      <p class="bot-hint" id="pr-style-lbl">${promoColorInfo(_promoStyle)[1]}${_promoStyle === 'white' ? ' — rangli fon yo\'q' : ' — kartalar shaffof (frosted) bo\'ladi'}</p>
    </div>
    <div class="cat-sec-t" style="margin-top:16px">Mahsulotlar (<span id="pr-cnt">${_promoSel.size}</span>)</div>
    <div class="promo-picker" id="pr-list">
      ${products.length ? products.map(p => `
        <div class="promo-pick ${_promoSel.has(p.id) ? 'on' : ''}" data-id="${p.id}" onclick="togglePromoProd(${p.id})">
          <div class="pchk">${ICONS.check}</div>
          <div class="promo-thumb">${pic(p)}</div>
          <div style="flex:1;min-width:0">
            <b style="font-size:13px;display:block">${esc(p.n)}</b>
            <small class="muted">${som(p.p)}${(p.old > p.p) ? ` · <span style="color:var(--red)">-${Math.round((1 - p.p / p.old) * 100)}%</span>` : ''}</small>
          </div>
        </div>`).join('') : '<div class="muted" style="padding:10px 0">Avval mahsulot qo\'shing</div>'}
    </div>`;
  const foot = `
    <button class="btn btn--ghost" onclick="closeModal()">Bekor</button>
    <button class="btn btn--primary" onclick="savePromo(${s ? `'${s.id}'` : 'null'})">Saqlash</button>`;
  openModal(s ? 'Bo\'limni tahrirlash' : 'Yangi chegirma bo\'limi', body, foot);
}
function setPromoStyle(st) {
  _promoStyle = st;
  document.querySelectorAll('#pr-style button').forEach(b => b.classList.toggle('on', b.dataset.st === st));
  const lbl = $('pr-style-lbl');
  if (lbl) lbl.textContent = promoColorInfo(st)[1] + (st === 'white' ? ' — rangli fon yo\'q' : ' — kartalar shaffof (frosted) bo\'ladi');
}
function togglePromoProd(id) {
  if (_promoSel.has(id)) _promoSel.delete(id); else _promoSel.add(id);
  const el = document.querySelector(`.promo-pick[data-id="${id}"]`);
  if (el) el.classList.toggle('on', _promoSel.has(id));
  const c = $('pr-cnt'); if (c) c.textContent = _promoSel.size;
}
function savePromo(id) {
  const title = $('pr-title').value.trim();
  if (!title) { toast('Sarlavha kiriting', 'err'); return; }
  const items = products.filter(p => _promoSel.has(p.id)).map(p => p.id);
  if (!items.length) { toast('Kamida bitta mahsulot tanlang', 'err'); return; }
  const obj = { title, style: _promoStyle, items };
  if (id) { const i = promos.findIndex(x => x.id === id); if (i >= 0) promos[i] = Object.assign({}, promos[i], obj); }
  else { obj.id = 'pr' + Date.now().toString(36) + Math.floor(Math.random() * 100); promos.push(obj); }
  cset('lume_promos', promos);
  closeModal(); drawPromos(); toast('Saqlandi');
}
function delPromo(id) {
  const s = promos.find(x => x.id === id); if (!s) return;
  if (!confirm(`"${s.title}" bo'limi o'chirilsinmi?`)) return;
  promos = promos.filter(x => x.id !== id);
  cset('lume_promos', promos); drawPromos(); toast('O\'chirildi');
}
function movePromo(i, dir) {
  const j = i + dir; if (j < 0 || j >= promos.length) return;
  const t = promos[i]; promos[i] = promos[j]; promos[j] = t;
  cset('lume_promos', promos); drawPromos();
}

/* ===== QR / HAVOLA ===== */
function shopUrl() {
  const u = new URL('index.html', location.href); u.search = '';
  const cid = window.__LUME_CLIENT || 'shop';
  if (cid && cid !== 'shop') u.searchParams.set('client', cid);
  return u.href;
}
function qrApiSrc(url, size) {
  return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&margin=10&qzone=1&data=' + encodeURIComponent(url);
}
function drawQr() {
  const url = shopUrl();
  const inp = $('qrUrlInput'); if (inp) inp.value = url;
  const img = $('qrCodeImg'); if (img) img.src = qrApiSrc(url, 440);
  const nm = $('qrStoreName'); if (nm) nm.textContent = settings.brand || 'LUMÉ';
}
function setupQr() {
  const by = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  by('qrCopyBtn', () => {
    const url = shopUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => toast('Havola nusxalandi')).catch(() => fallbackCopy(url));
    } else fallbackCopy(url);
  });
  by('qrOpenBtn', () => window.open(shopUrl(), '_blank'));
  by('qrDownloadBtn', async () => {
    const url = shopUrl();
    try {
      const res = await fetch(qrApiSrc(url, 600)); const blob = await res.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lume-qr.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast('QR kod yuklab olindi');
    } catch (e) { window.open(qrApiSrc(url, 600), '_blank'); }
  });
}
function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Havola nusxalandi');
  } catch (e) { toast('Nusxalab bo\'lmadi', 'err'); }
}

/* ===== theme ===== */
const sunI = '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>';
const moonI = '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/></svg>';
function flip() {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('lume_admin_theme', dark ? 'light' : 'dark') } catch (e) { }
  syncTheme();
}
function syncTheme() {
  const b = $('themeBtn'); if (b) b.innerHTML = document.documentElement.dataset.theme === 'dark' ? moonI : sunI;
}

/* ===== DASHBOARD ===== */
function drawDash() {
  const revenue = orders.reduce((s, o) => s + (o.status !== 'cancel' ? (+o.total || 0) : 0), 0);
  const pending = orders.filter(o => o.status === 'wait' || o.status === 'collecting').length;
  const cards = [
    { bg: 'rgba(34,197,94,.15)', c: 'var(--green)', emo: '📦', v: products.length, l: 'Mahsulot' },
    { bg: 'rgba(59,130,246,.15)', c: 'var(--blue)', emo: '🧾', v: orders.length, l: 'Buyurtma' },
    { bg: 'rgba(245,158,11,.15)', c: 'var(--amber)', emo: '⏳', v: pending, l: 'Kutilmoqda' },
    { bg: 'rgba(139,92,246,.15)', c: 'var(--violet)', emo: '💰', v: num(revenue), l: 'Tushum, so\'m' }
  ];
  $('kpiGrid').innerHTML = cards.map(c => `
    <div class="kpi">
      <div class="kic" style="background:${c.bg}">${c.emo}</div>
      <div class="klabel">${c.l}</div>
      <div class="kval">${c.v}</div>
    </div>`).join('');
  const recent = orders.slice(0, 5);
  $('recentOrders').innerHTML = recent.length
    ? `<table class="tbl"><tbody>${recent.map(orderRow).join('')}</tbody></table>`
    : `<div class="empty"><div class="e-emo">🧾</div><h4>Hozircha buyurtma yo'q</h4><p class="muted">Do'kondan buyurtma bering — bu yerda paydo bo'ladi.</p></div>`;
  // nav badge
  const ob = $('navOrdBadge'); if (ob) { ob.style.display = pending ? '' : 'none'; ob.textContent = pending; }
}

/* ===== STATISTIKA ===== */
// Davr chiplari — bucket granularligini ham, KPI oynasini ham belgilaydi.
let statsPeriod = 'day';   // day | week | month | year
const STATS_CFG = {
  day: { count: 7, gran: 'day', label: "So'nggi 7 kun" },
  week: { count: 8, gran: 'week', label: "So'nggi 8 hafta" },
  month: { count: 6, gran: 'month', label: "So'nggi 6 oy" },
  year: { count: 12, gran: 'month', label: "So'nggi 12 oy" }
};
const MON_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

// Hisobga olinadigan buyurtmalar — bekor qilinmaganlar (dashboard bilan bir xil mantiq).
function saleOrders() { return orders.filter(o => o && o.status !== 'cancel' && o.ts); }

// Qisqa son formati (chart yorliqlari uchun): 1 500 000 -> 1.5M
function shortNum(n) {
  n = +n || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(Math.round(n));
}

// Umumiy komissiya foizi (barcha komissiyalar yig'indisi).
function totalPct() { return commissions.reduce((s, c) => s + (+c.pct || 0), 0); }

// Tanlangan davr uchun vaqt bo'laklari (chartda ustunlar, KPI uchun oyna).
function statsBuckets() {
  const cfg = STATS_CFG[statsPeriod];
  const now = new Date();
  const buckets = [];
  if (cfg.gran === 'day') {
    for (let i = cfg.count - 1; i >= 0; i--) {
      const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const start = d.getTime();
      buckets.push({ start, end: start + 864e5, label: d.getDate() + '/' + (d.getMonth() + 1), rev: 0, cnt: 0 });
    }
  } else if (cfg.gran === 'week') {
    for (let i = cfg.count - 1; i >= 0; i--) {
      const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i * 7);
      const end = d.getTime() + 864e5;
      const start = end - 7 * 864e5;
      const sd = new Date(start);
      buckets.push({ start, end, label: sd.getDate() + '/' + (sd.getMonth() + 1), rev: 0, cnt: 0 });
    }
  } else { // month
    for (let i = cfg.count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.getTime();
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
      buckets.push({ start, end, label: MON_SHORT[d.getMonth()], rev: 0, cnt: 0 });
    }
  }
  for (const o of saleOrders()) {
    const t = +o.ts;
    for (const b of buckets) {
      if (t >= b.start && t < b.end) { b.rev += (+o.total || 0); b.cnt++; break; }
    }
  }
  return buckets;
}

// Ustunni yumaloq tepali qilib chizadigan yo'l (path).
function barPath(x, y, w, h, r) {
  const base = y + h;
  r = Math.max(0, Math.min(r, w / 2, h));
  return `M${x} ${base} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} `
    + `L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${base} Z`;
}

// Chiroyli yaxlit maksimum (o'q shkalasi uchun): 1..2..2.5..5..10 * 10^k
function niceCeil(v) {
  v = +v || 0;
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

// Ustunli diagramma (mustaqil SVG — tashqi kutubxonasiz).
// Zamonaviy: yumshoq to'r chiziqlari, yumaloq tepali gradient ustunlar,
// joriy davr ustuni ajratilgan, o'q/qiymat yorliqlari va silliq animatsiya.
function statsChartSVG(buckets) {
  const n = buckets.length;
  const max = Math.max(1, ...buckets.map(b => b.rev));
  const niceMax = niceCeil(max);
  const slot = 46, padL = 36, padR = 12, padTop = 18, chartH = 150, padBot = 24;
  const bw = Math.min(16, slot - 26); // nozik ustunlar
  const W = padL + padR + n * slot, H = padTop + chartH + padBot;
  const baseY = padTop + chartH;

  // To'r chiziqlari + Y o'q yorliqlari
  const LEVELS = 4;
  let grid = '';
  for (let i = 0; i <= LEVELS; i++) {
    const gy = padTop + chartH * (i / LEVELS);
    const val = niceMax * (1 - i / LEVELS);
    grid += `<line class="bc-grid${i === LEVELS ? ' base' : ''}" x1="${padL}" y1="${gy.toFixed(1)}" x2="${W - padR}" y2="${gy.toFixed(1)}"/>`;
    grid += `<text class="bc-ylab" x="${padL - 9}" y="${(gy + 3.5).toFixed(1)}" text-anchor="end">${shortNum(val)}</text>`;
  }

  let bars = '';
  buckets.forEach((b, i) => {
    const cx = padL + i * slot + slot / 2;
    const x = cx - bw / 2;
    const h = Math.max(3, chartH * (b.rev / niceMax));
    const y = baseY - h;
    const isCur = i === n - 1; // oxirgi (joriy) davr — ajratib ko'rsatamiz
    bars += `<g class="bc-col" style="--d:${(i * 0.05).toFixed(2)}s">
      <title>${esc(b.label)}: ${som(b.rev)} — ${b.cnt} buyurtma</title>
      <path class="bc-bar${isCur ? ' is-cur' : ''}" d="${barPath(x, y, bw, h, 7)}" fill="url(#${isCur ? 'bcg2' : 'bcg'})"/>
      ${b.rev ? `<text class="bc-val" x="${cx}" y="${(y - 8).toFixed(1)}" text-anchor="middle">${shortNum(b.rev)}</text>` : ''}
      <text class="bc-xlab" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(b.label)}</text>
    </g>`;
  });

  return `<div class="chart-wrap"><svg class="bar-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Tushum dinamikasi">
    <defs>
      <linearGradient id="bcg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--green)"/><stop offset="1" stop-color="var(--green-700)"/>
      </linearGradient>
      <linearGradient id="bcg2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="var(--green-600)"/>
      </linearGradient>
    </defs>
    ${grid}${bars}
  </svg></div>`;
}

// Berilgan oynada mahsulot bo'yicha sotuv (nomi -> {name, qty, rev}).
function productSales(rangeStart, rangeEnd) {
  const map = new Map();
  for (const o of saleOrders()) {
    const t = +o.ts;
    if (t < rangeStart || t >= rangeEnd) continue;
    for (const it of (o.items || [])) {
      const key = String(it && it.n != null ? it.n : '').trim() || '—';
      const m = map.get(key) || { name: key, qty: 0, rev: 0 };
      m.qty += (+it.q || 0);
      m.rev += (+it.p || 0) * (+it.q || 0);
      map.set(key, m);
    }
  }
  return map;
}

function prodRankRow(rank, name, qty, rev, ratio, low) {
  const p = products.find(x => String(x.n || '').trim() === String(name).trim());
  const emo = p ? pic(p) : '<span style="font-size:20px">🛍️</span>';
  const w = low ? Math.max(6, Math.round(ratio * 100)) : Math.round(ratio * 100);
  return `<div class="pr-row">
    <div class="pr-rank">${rank}</div>
    <div class="pr-emo">${emo}</div>
    <div class="pr-main">
      <div class="pr-name">${esc(name)}</div>
      <div class="pr-bar ${low ? 'low' : ''}"><i style="width:${w}%"></i></div>
    </div>
    <div class="pr-qty">${qty} <small>dona</small>${rev ? `<br><small style="font-weight:600">${som(rev)}</small>` : ''}</div>
  </div>`;
}

const STATS_EMPTY = (emo, t) => `<div class="empty" style="padding:30px 16px"><div class="e-emo">${emo}</div><h4>${t}</h4></div>`;

function drawStats() {
  const cfg = STATS_CFG[statsPeriod];
  const buckets = statsBuckets();
  const revenue = buckets.reduce((s, b) => s + b.rev, 0);
  const ordCnt = buckets.reduce((s, b) => s + b.cnt, 0);
  const pct = totalPct();
  const commAmt = revenue * pct / 100;

  // Davr oynasi — tan narxi va oylik harajatlarni hisoblash uchun.
  const rStart = buckets.length ? buckets[0].start : 0;
  const rEnd = buckets.length ? buckets[buckets.length - 1].end : Date.now();
  const costTotal = periodCost(rStart, rEnd);                 // sotilgan mahsulotlar tan narxi
  const periodDays = Math.max(1, Math.round((rEnd - rStart) / 864e5));
  const expenses = Math.round(monthlyExpense * periodDays / 30); // oylik harajat — davr ulushi
  const realProfit = revenue - commAmt - costTotal - expenses;   // REAL daromad

  // Sarlavha + davr chiplari
  const sub = $('statsSub'); if (sub) sub.textContent = cfg.label + ' bo\'yicha';
  $('statsFilters').innerHTML =
    `<div class="ord-filter-grp"><span class="ord-filter-lbl">Davr</span><div class="chips">${[['day', 'Kunlik'], ['week', 'Haftalik'], ['month', 'Oylik'], ['year', 'Yillik']]
      .map(([k, l]) => `<button class="chip ${statsPeriod === k ? 'is-active' : ''}" onclick="setStatsPeriod('${k}')">${l}</button>`).join('')}</div></div>`;

  // KPI kartalari
  const cards = [
    { bg: 'rgba(139,92,246,.15)', emo: '💰', v: num(revenue), l: "Tushum, so'm" },
    { bg: 'rgba(59,130,246,.15)', emo: '🧾', v: ordCnt, l: 'Buyurtma' },
    { bg: 'rgba(245,158,11,.15)', emo: '📉', v: num(Math.round(commAmt)), l: `Komissiya (${(+pct.toFixed(2))}%)` },
    { bg: 'rgba(34,197,94,.15)', emo: '💵', v: num(Math.round(realProfit)), l: "Real daromad, so'm" }
  ];
  $('statsKpi').innerHTML = cards.map(c => `
    <div class="kpi">
      <div class="kic" style="background:${c.bg}">${c.emo}</div>
      <div class="klabel">${c.l}</div>
      <div class="kval">${c.v}</div>
    </div>`).join('');

  // Chart — TUSHUM (mahsulot sotilgan narxlari). Diagramma foyda emas, tushumni ko'rsatadi.
  const ct = $('statsChartTitle'); if (ct) ct.textContent = 'Tushum dinamikasi';
  const cs = $('statsChartSub'); if (cs) cs.textContent = cfg.label + ' · sotuv summasi';
  $('statsChart').innerHTML = ordCnt ? statsChartSVG(buckets) : STATS_EMPTY('📊', 'Bu davrda ma\'lumot yo\'q');

  // Real daromad ramkasi + oylik harajat kiritish
  drawProfit(revenue, costTotal, commAmt, expenses, realProfit, periodDays);

  // Mahsulot tahlili (shu oyna ichida)
  const map = productSales(rStart, rEnd);
  const sold = [...map.values()].filter(m => m.name !== '—');
  const best = sold.slice().sort((a, b) => b.qty - a.qty).slice(0, 6);
  const maxQty = best.length ? Math.max(1, best[0].qty) : 1;
  $('statsBest').innerHTML = best.length
    ? best.map((m, i) => prodRankRow(i + 1, m.name, m.qty, m.rev, m.qty / maxQty, false)).join('')
    : STATS_EMPTY('🏆', 'Bu davrda sotuv yo\'q');

  // Yaxshi sotilmagan: katalogdagi mahsulotlarni sotuvga bog'lab, eng pastlari (0 ham).
  let worst;
  if (products.length) {
    worst = products.map(p => {
      const m = map.get(String(p.n || '').trim());
      return { name: p.n || '—', qty: m ? m.qty : 0, rev: m ? m.rev : 0 };
    }).sort((a, b) => a.qty - b.qty).slice(0, 6);
  } else {
    worst = sold.slice().sort((a, b) => a.qty - b.qty).slice(0, 6);
  }
  $('statsWorst').innerHTML = worst.length
    ? worst.map((m, i) => prodRankRow(i + 1, m.name, m.qty, m.rev, maxQty ? m.qty / maxQty : 0, true)).join('')
    : STATS_EMPTY('📉', 'Mahsulot yo\'q');

  // Komissiya boshqaruvi
  drawCommission(revenue);
}

function drawCommission(revenue) {
  const pct = totalPct();
  const commAmt = revenue * pct / 100, net = revenue - commAmt;
  const list = commissions.length
    ? commissions.map(c => `
      <div class="comm-item">
        <div class="ci-name">${esc(c.name)}</div>
        <div class="ci-pct">${(+(+c.pct).toFixed(2))}%</div>
        <button class="iact danger" onclick="delCommission(${c.id})" aria-label="O'chirish">${ICONS.del}</button>
      </div>`).join('')
    : `<div class="muted" style="font-size:13px;padding:4px 2px">Hozircha komissiya yo'q. Pastdan nom va foiz kiriting.</div>`;
  $('statsCommission').innerHTML = `
    <div class="card-head" style="padding:0 0 14px;margin-bottom:14px">
      <div><h3>Komissiyalar</h3><div class="sub">Pul o'tkazmalaridan ushlanadigan foizlar — real foyda shu asosda hisoblanadi</div></div>
    </div>
    <div class="comm-list">${list}</div>
    <div class="comm-add">
      <div class="field" style="flex:1;min-width:150px"><label>Komissiya nomi</label><input class="input" id="commName" placeholder="Masalan: Click / Payme" onkeydown="if(event.key==='Enter')addCommission()"></div>
      <div class="field" style="width:120px"><label>Foiz (%)</label><input class="input" id="commPct" inputmode="decimal" placeholder="1.5" onkeydown="if(event.key==='Enter')addCommission()"></div>
      <button class="btn btn--primary" onclick="addCommission()" style="height:44px">Qo'shish</button>
    </div>
    <div class="comm-total">
      Umumiy komissiya: <b style="color:var(--amber)">${(+pct.toFixed(2))}%</b> — davr tushumidan <b style="color:var(--amber)">${som(Math.round(commAmt))}</b> ushlanadi.
    </div>`;
}

// Sotilgan mahsulotlarning tan narxi (davr oynasida) — sof foyda uchun.
function periodCost(rStart, rEnd) {
  let cost = 0;
  for (const o of saleOrders()) {
    const t = +o.ts; if (t < rStart || t >= rEnd) continue;
    for (const it of (o.items || [])) {
      const p = products.find(x => String(x.n || '').trim() === String(it && it.n || '').trim());
      const c = p ? (+p.cost || 0) : 0;
      cost += c * (+it.q || 0);
    }
  }
  return cost;
}

// Real daromad ramkasi: tushum − tan narxi − komissiya − oylik harajat = real daromad.
function drawProfit(revenue, costTotal, commAmt, expenses, realProfit, periodDays) {
  const el = $('statsProfit'); if (!el) return;
  const row = (label, val, neg, strong) => `
    <div class="pf-row${strong ? ' pf-total' : ''}">
      <span>${label}</span>
      <b style="color:${strong ? (realProfit >= 0 ? 'var(--green)' : 'var(--red)') : (neg ? 'var(--red)' : 'var(--text)')}">${neg && val ? '− ' : ''}${som(Math.round(val))}</b>
    </div>`;
  el.innerHTML = `
    <div class="card-head" style="padding:0 0 14px;margin-bottom:14px">
      <div><h3>Real daromad</h3><div class="sub">Komissiya, mahsulot tan narxi va oylik harajatlar ayirilgan sof daromad</div></div>
    </div>
    <div class="pf-list">
      ${row('Tushum (sotuvlar)', revenue, false, false)}
      ${row('Mahsulot tan narxi', costTotal, true, false)}
      ${row('Komissiya', commAmt, true, false)}
      ${row(`Oylik harajatlar (${periodDays} kun ulushi)`, expenses, true, false)}
      ${row('Real daromad', realProfit, false, true)}
    </div>
    <div class="comm-add" style="margin-top:16px">
      <div class="field" style="flex:1;min-width:180px"><label>Oylik harajatlar (so'm)</label>
        <input class="input" id="expInput" inputmode="numeric" placeholder="Masalan: 3000000" value="${monthlyExpense || ''}" onkeydown="if(event.key==='Enter')saveExpenses()"></div>
      <button class="btn btn--primary" onclick="saveExpenses()" style="height:44px">Saqlash</button>
    </div>
    <div class="muted" style="font-size:12px;margin-top:10px;line-height:1.5">Oylik harajatlar (ijara, ish haqi, reklama va h.k.) bir marta kiritiladi va serverda saqlanadi. Tanlangan davr uchun kunlar ulushi bo'yicha hisoblanadi.</div>`;
}

function saveExpenses() {
  const v = +String($('expInput').value || '').replace(/\D/g, '') || 0;
  monthlyExpense = v;
  cset('lume_expenses', v);
  drawStats();
  toast('Oylik harajatlar saqlandi');
}

function setStatsPeriod(p) { if (STATS_CFG[p]) { statsPeriod = p; drawStats(); } }

function addCommission() {
  const name = ($('commName').value || '').trim();
  const pct = +String($('commPct').value || '').replace(',', '.').replace(/[^\d.]/g, '');
  if (!name) { toast('Komissiya nomini kiriting', 'err'); return; }
  if (!(pct > 0)) { toast("Foizni to'g'ri kiriting", 'err'); return; }
  if (pct >= 100) { toast('Foiz 100 dan kichik bo\'lishi kerak', 'err'); return; }
  commissions.push({ id: Date.now(), name, pct });
  cset('lume_commissions', commissions);
  drawStats();
  toast('Komissiya qo\'shildi');
}
function delCommission(id) {
  commissions = commissions.filter(c => c.id !== id);
  cset('lume_commissions', commissions);
  drawStats();
  toast('O\'chirildi');
}

/* ===== PRODUCTS ===== */
function drawProds() {
  $('prodCount').textContent = products.length;
  $('prodBody').innerHTML = products.length
    ? products.map(p => `
    <tr>
      <td><div class="cell-prod"><div class="emo">${pic(p)}</div><div><b>${esc(p.n)}</b><br><small class="muted">${esc(p.br || '')}</small></div></div></td>
      <td><span class="pill">${esc(catName(p.c)) || '—'}</span></td>
      <td><span class="num">${som(p.p)}</span></td>
      <td>${(p.old > p.p) ? `<span class="pill cancel">-${Math.round((1 - p.p / p.old) * 100)}%</span>` : '<span class="muted">—</span>'}</td>
      <td><div class="act-btns" style="justify-content:flex-end">
        <button class="iact" onclick="openProd(${p.id})" aria-label="Tahrir">${ICONS.edit}</button>
        <button class="iact danger" onclick="delProd(${p.id})" aria-label="O'chirish">${ICONS.del}</button>
      </div></td>
    </tr>`).join('')
    : `<tr><td colspan="5"><div class="empty"><div class="e-emo">📦</div><h4>Mahsulot yo'q</h4><p class="muted">"Yangi mahsulot" tugmasini bosing.</p></div></td></tr>`;
}
function openProd(id) {
  const p = id ? products.find(x => x.id === id) : null;
  // Rasmlar: yangi imgs massivi bo'lsa undan, aks holda eski yagona img'dan.
  editImgs = p ? (Array.isArray(p.imgs) && p.imgs.length ? p.imgs.slice(0, MAX_PROD_IMGS) : (p.img ? [p.img] : [])) : [];
  editImg = editImgs[0] || null;
  editKey = p ? (p.k || 'found') : 'found';
  editFit = p && p.fit === 'cover' ? 'cover' : 'contain';
  editZoom = p && p.zoom ? +p.zoom : 1;
  editPosX = 50; editPosY = 50;
  if (p && p.pos) { const m = String(p.pos).match(/(-?\d+)%\s+(-?\d+)%/); if (m) { editPosX = +m[1]; editPosY = +m[2]; } }
  const body = `
    <p class="muted" style="font-size:12.5px;margin-bottom:16px">Do'kon katalogida ko'rinadi.</p>
    <div class="img-pick">
      <div class="img-prev" id="img-prev">${pic(editObj())}<span class="pv-tag">Karta rasmi</span></div>
      <div style="flex:1">
        <div class="field"><label>Mahsulot rasmlari (<span id="p-imgs-count">${editImgs.length}</span>/${MAX_PROD_IMGS})</label>
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">
            <label class="up-btn" id="p-img-btn">${ICONS.upload}<span>Rasm qo'shish</span>
              <input type="file" accept="image/*" id="p-img" multiple onchange="onImg(event)"></label>
          </div>
          <div class="up-hint">Birinchi rasm — karta rasmi. 10 tagacha rasm qo'shishingiz mumkin (avtomatik siqiladi).</div>
        </div>
      </div>
    </div>
    <div class="p-imgs-strip" id="p-imgs-strip"></div>
    <div class="fit-ctl ${editImg ? '' : 'dim'}" id="fit-ctl">
      <div class="fitpills">
        <button type="button" id="fit-contain" class="${editFit === 'contain' ? 'on' : ''}" onclick="setFit('contain')">Butun rasm</button>
        <button type="button" id="fit-cover" class="${editFit === 'cover' ? 'on' : ''}" onclick="setFit('cover')">Kartani to'ldir</button>
      </div>
      <div class="sld"><label><span>Kattalashtirish / kichiklashtirish</span><span id="zoom-v">${Math.round(editZoom * 100)}%</span></label>
        <input type="range" min="50" max="250" step="5" value="${Math.round(editZoom * 100)}" oninput="editZoom=this.value/100;document.getElementById('zoom-v').textContent=this.value+'%';refreshPrev()"></div>
    </div>
    <div class="form-grid">
      <div class="field span2"><label>Nomi *</label><input class="input" id="p-n" value="${esc(p ? p.n : '')}" placeholder="Mahsulot nomi"></div>
      <div class="field"><label>Brend</label><input class="input" id="p-br" value="${esc(p ? p.br : '')}" placeholder="TIRTIR"></div>
      <div class="field"><label>Kategoriya</label><select class="input" id="p-c">${categories.length ? categories.map(c => `<option value="${c.id}" ${p && p.c == c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('') : '<option value="">— toifa yo\'q —</option>'}</select></div>
      <div class="field"><label>Narx (so'm) *</label><input class="input" id="p-p" inputmode="numeric" value="${p ? p.p : ''}" placeholder="250000"></div>
      <div class="field"><label>Eski narx (chegirma)</label><input class="input" id="p-old" inputmode="numeric" value="${p && p.old ? p.old : ''}" placeholder="0 = yo'q"></div>
      <div class="field"><label>Tan narxi (asil narx)</label><input class="input" id="p-cost" inputmode="numeric" value="${p && p.cost ? p.cost : ''}" placeholder="Sof foyda uchun"></div>
      <div class="field span2"><label>Hajm (vergul bilan)</label><input class="input" id="p-sz" value="${esc(p && p.sz ? p.sz.join(', ') : '')}" placeholder="30ml, 50ml"></div>
      <div class="field span2"><label>Tavsif (o'zbekcha)</label><textarea class="input" id="p-d">${esc(p && p.d ? (p.d.uz || '') : '')}</textarea></div>
    </div>`;
  const foot = `
    <button class="btn btn--ghost" onclick="closeModal()">Bekor</button>
    <button class="btn btn--primary" onclick="saveProd(${p ? p.id : 'null'})">Saqlash</button>`;
  openModal(p ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot', body, foot);
  renderProdImgs();
}
// Rasmlar tasmasini (thumbnails) chizadi — har birida "asosiy qilish" va "o'chirish".
function renderProdImgs() {
  const strip = $('p-imgs-strip'); if (!strip) return;
  strip.innerHTML = editImgs.map((src, i) => `
    <div class="p-imgs-thumb${i === 0 ? ' is-main' : ''}">
      <img src="${src}" alt="">
      ${i === 0 ? '<span class="p-imgs-badge">Asosiy</span>' : `<button type="button" class="p-imgs-star" title="Asosiy qilish" onclick="makeMainImg(${i})">★</button>`}
      <button type="button" class="p-imgs-del" title="O'chirish" onclick="removeImgAt(${i})">✕</button>
    </div>`).join('');
  const cnt = $('p-imgs-count'); if (cnt) cnt.textContent = editImgs.length;
  const btn = $('p-img-btn'); if (btn) btn.style.display = editImgs.length >= MAX_PROD_IMGS ? 'none' : '';
}
function refreshPrev() {
  $('img-prev').innerHTML = pic(editObj()) + '<span class="pv-tag">Karta ko\'rinishi</span>';
  const rm = $('up-rm'); if (rm) rm.style.display = editImg ? '' : 'none';
  const fc = $('fit-ctl'); if (fc) fc.classList.toggle('dim', !editImg);
}
function setFit(v) {
  editFit = v;
  $('fit-contain').classList.toggle('on', v === 'contain');
  $('fit-cover').classList.toggle('on', v === 'cover');
  refreshPrev();
}
// Bitta rasm faylini siqib, data:URL qaytaradi (Promise).
function compressImage(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const MAX = 900;
        let { width: w, height: h } = im;
        if (w > MAX || h > MAX) { const s = Math.min(MAX / w, MAX / h); w = Math.round(w * s); h = Math.round(h * s); }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d');
        cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h);
        cx.drawImage(im, 0, 0, w, h);
        try { resolve(cv.toDataURL('image/jpeg', 0.82)); } catch (err) { resolve(r.result); }
      };
      im.onerror = () => reject(new Error('image'));
      im.src = r.result;
    };
    r.onerror = () => reject(new Error('file'));
    r.readAsDataURL(f);
  });
}
// Bir yoki bir nechta rasm tanlanganda — 10 tagacha qo'shadi.
async function onImg(e) {
  const files = Array.from(e.target.files || []).filter(f => /^image\//.test(f.type));
  e.target.value = '';
  if (!files.length) { toast('Faqat rasm faylini tanlang', 'err'); return; }
  const room = MAX_PROD_IMGS - editImgs.length;
  if (room <= 0) { toast(`Ko'pi bilan ${MAX_PROD_IMGS} ta rasm`, 'err'); return; }
  const take = files.slice(0, room);
  let added = 0;
  for (const f of take) {
    try { editImgs.push(await compressImage(f)); added++; } catch (err) { /* jimgina o'tamiz */ }
  }
  editImg = editImgs[0] || null;
  refreshPrev();
  renderProdImgs();
  if (added) toast(added > 1 ? `${added} ta rasm qo'shildi` : 'Rasm qo\'shildi');
  if (files.length > room) toast(`Faqat ${room} ta rasm qo'shildi (limit ${MAX_PROD_IMGS})`, 'err');
}
// Rasmni o'chirish (indeks bo'yicha).
function removeImgAt(i) {
  if (i < 0 || i >= editImgs.length) return;
  editImgs.splice(i, 1);
  editImg = editImgs[0] || null;
  refreshPrev();
  renderProdImgs();
}
// Rasmni "asosiy" (birinchi/karta rasmi) qilib oldinga ko'chiradi.
function makeMainImg(i) {
  if (i <= 0 || i >= editImgs.length) return;
  const [im] = editImgs.splice(i, 1);
  editImgs.unshift(im);
  editImg = editImgs[0] || null;
  refreshPrev();
  renderProdImgs();
}
function saveProd(id) {
  const n = $('p-n').value.trim();
  const p = +$('p-p').value.replace(/\D/g, '');
  if (!n) { toast('Nomini kiriting', 'err'); return }
  if (!p) { toast('Narxini kiriting', 'err'); return }
  const obj = {
    n, br: $('p-br').value.trim(),
    c: +$('p-c').value,
    p, old: +$('p-old').value.replace(/\D/g, '') || 0,
    cost: +$('p-cost').value.replace(/\D/g, '') || 0,
    sz: $('p-sz').value.split(',').map(s => s.trim()).filter(Boolean),
    k: editKey,
    imgs: editImgs.slice(0, MAX_PROD_IMGS),
    img: editImgs[0] || null,  // birinchi rasm — karta rasmi (eski moslik uchun)
    fit: editFit, zoom: editZoom, pos: editPosX + '% ' + editPosY + '%',
    d: { uz: $('p-d').value.trim() }
  };
  if (id) { const i = products.findIndex(x => x.id === id); if (i >= 0) products[i] = Object.assign({}, products[i], obj); }
  else { obj.id = (products.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1; products.push(obj); }
  cset('lume_products', products);
  closeModal(); drawProds(); drawDash(); toast('Saqlandi');
}
function delProd(id) {
  if (!confirm('Mahsulot o\'chirilsinmi?')) return;
  products = products.filter(x => x.id !== id);
  cset('lume_products', products); drawProds(); drawDash(); toast('O\'chirildi');
}

/* ===== TOIFALAR ===== */
function drawCats() {
  $('catCount').textContent = categories.length;
  const wrap = $('catGrid');
  wrap.innerHTML = categories.length ? categories.map(c => `
    <div class="cat-card">
      <div class="cat-frame">${catPic(c)}</div>
      <b>${esc(c.name)}</b>
      <div class="cc-act">
        <button class="iact" onclick="openCat(${c.id})" aria-label="Tahrir">${ICONS.edit}</button>
        <button class="iact danger" onclick="delCat(${c.id})" aria-label="O'chirish">${ICONS.del}</button>
      </div>
    </div>`).join('')
    : `<div class="empty" style="grid-column:1/-1"><div class="e-emo">🏷️</div><h4>Toifa yo'q</h4><p class="muted">"Yangi toifa" tugmasini bosing.</p></div>`;
}
function catEditObj() {
  const emoEl = $('c-emo');
  return { img: editImg, emo: emoEl ? emoEl.value : '', fit: editFit, zoom: editZoom, pos: editPosX + '% ' + editPosY + '%' };
}
function catEditObjR() {
  const emoEl = $('c-emo');
  return { img: editImgR, emo: emoEl ? emoEl.value : '', fit: editFitR, zoom: editZoomR, pos: editPosXR + '% ' + editPosYR + '%' };
}
function refreshCatPrev() {
  const prev = $('cat-prev'); if (!prev) return;
  prev.innerHTML = catPic(catEditObj()) + '<span class="pv-tag">Ramka ko\'rinishi</span>';
  const rm = $('c-rm'); if (rm) rm.style.display = editImg ? '' : 'none';
  const fc = $('cat-fit-ctl'); if (fc) fc.classList.toggle('dim', !editImg);
}
function refreshCatPrevR() {
  const prev = $('cat-prev-r'); if (!prev) return;
  prev.innerHTML = catPic(catEditObjR()) + '<span class="pv-tag">Shar ko\'rinishi</span>';
  const rm = $('c-rm-r'); if (rm) rm.style.display = editImgR ? '' : 'none';
  const fc = $('cat-fit-ctl-r'); if (fc) fc.classList.toggle('dim', !editImgR);
}
function setCatFit(v) {
  editFit = v;
  $('cfit-contain').classList.toggle('on', v === 'contain');
  $('cfit-cover').classList.toggle('on', v === 'cover');
  refreshCatPrev();
}
function setCatFitR(v) {
  editFitR = v;
  $('cfitr-contain').classList.toggle('on', v === 'contain');
  $('cfitr-cover').classList.toggle('on', v === 'cover');
  refreshCatPrevR();
}
function readCatImg(e, onOk) {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  if (!/^image\//.test(f.type)) { toast('Faqat rasm faylini tanlang', 'err'); e.target.value = ''; return }
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const MAX = 700; let { width: w, height: h } = im;
      if (w > MAX || h > MAX) { const s = Math.min(MAX / w, MAX / h); w = Math.round(w * s); h = Math.round(h * s); }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, w, h);
      let out; try { out = cv.toDataURL('image/png'); } catch (err) { out = r.result; }
      onOk(out); e.target.value = ''; toast('Rasm yuklandi');
    };
    im.onerror = () => toast('Rasmni o\'qib bo\'lmadi', 'err');
    im.src = r.result;
  };
  r.onerror = () => toast('Faylni o\'qib bo\'lmadi', 'err');
  r.readAsDataURL(f);
}
function onCatImg(e) { readCatImg(e, v => { editImg = v; refreshCatPrev(); }); }
function onCatImgR(e) { readCatImg(e, v => { editImgR = v; refreshCatPrevR(); }); }
function removeCatImg() { editImg = null; const fi = $('c-img'); if (fi) fi.value = ''; refreshCatPrev(); }
function removeCatImgR() { editImgR = null; const fi = $('c-img-r'); if (fi) fi.value = ''; refreshCatPrevR(); }
function openCat(id) {
  const c = id ? categories.find(x => x.id === id) : null;
  editImg = c ? c.img || null : null;
  editFit = c && c.fit === 'cover' ? 'cover' : 'contain';
  editZoom = c && c.zoom ? +c.zoom : 1;
  editPosX = 50; editPosY = 50;
  if (c && c.pos) { const m = String(c.pos).match(/(-?\d+)%\s+(-?\d+)%/); if (m) { editPosX = +m[1]; editPosY = +m[2]; } }
  editImgR = c ? c.imgR || null : null;
  editFitR = c ? (c.fitR === 'cover' ? 'cover' : 'contain') : 'cover';
  editZoomR = c && c.zoomR ? +c.zoomR : 1;
  editPosXR = 50; editPosYR = 50;
  if (c && c.posR) { const m = String(c.posR).match(/(-?\d+)%\s+(-?\d+)%/); if (m) { editPosXR = +m[1]; editPosYR = +m[2]; } }
  const emo = c && c.emo ? c.emo : '';
  const body = `
    <p class="muted" style="font-size:12.5px;margin-bottom:8px">Har bir ko'rinish uchun alohida rasm: bosh sahifada ramka, qidiruvda dumaloq shar.</p>
    <div class="cat-sec-t">Bosh sahifa — ramka rasmi</div>
    <div class="img-pick">
      <div style="width:120px;flex:none"><div class="cat-prev" id="cat-prev"></div></div>
      <div style="flex:1">
        <div class="field"><label>Ramka rasmi</label>
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">
            <label class="up-btn">${ICONS.upload}<span>Rasm yuklash</span>
              <input type="file" accept="image/*" id="c-img" onchange="onCatImg(event)"></label>
            <button type="button" class="up-rm" id="c-rm" onclick="removeCatImg()" style="${editImg ? '' : 'display:none'}">Olib tashlash</button>
          </div>
          <div class="up-hint">JPG / PNG — istalgan o'lcham (avtomatik siqiladi)</div>
        </div>
      </div>
    </div>
    <div class="fit-ctl ${editImg ? '' : 'dim'}" id="cat-fit-ctl">
      <div class="fitpills">
        <button type="button" id="cfit-contain" class="${editFit === 'contain' ? 'on' : ''}" onclick="setCatFit('contain')">Butun rasm</button>
        <button type="button" id="cfit-cover" class="${editFit === 'cover' ? 'on' : ''}" onclick="setCatFit('cover')">Ramkani to'ldir</button>
      </div>
      <div class="sld"><label><span>Kattalashtirish / kichiklashtirish</span><span id="czoom-v">${Math.round(editZoom * 100)}%</span></label>
        <input type="range" min="50" max="300" step="5" value="${Math.round(editZoom * 100)}" oninput="editZoom=this.value/100;document.getElementById('czoom-v').textContent=this.value+'%';refreshCatPrev()"></div>
      <div class="sld"><label><span>Chapga / o'ngga</span><span id="cpx-v">${editPosX}%</span></label>
        <input type="range" min="0" max="100" step="5" value="${editPosX}" oninput="editPosX=+this.value;document.getElementById('cpx-v').textContent=this.value+'%';refreshCatPrev()"></div>
      <div class="sld"><label><span>Yuqoriga / pastga</span><span id="cpy-v">${editPosY}%</span></label>
        <input type="range" min="0" max="100" step="5" value="${editPosY}" oninput="editPosY=+this.value;document.getElementById('cpy-v').textContent=this.value+'%';refreshCatPrev()"></div>
    </div>

    <div class="cat-sec-t b">Qidiruv — dumaloq shar rasmi</div>
    <div class="img-pick">
      <div style="width:120px;flex:none"><div class="cat-prev round" id="cat-prev-r"></div></div>
      <div style="flex:1">
        <div class="field"><label>Shar rasmi</label>
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">
            <label class="up-btn">${ICONS.upload}<span>Rasm yuklash</span>
              <input type="file" accept="image/*" id="c-img-r" onchange="onCatImgR(event)"></label>
            <button type="button" class="up-rm" id="c-rm-r" onclick="removeCatImgR()" style="${editImgR ? '' : 'display:none'}">Olib tashlash</button>
          </div>
          <div class="up-hint">Format: 1:1 (kvadrat) rasm tavsiya etiladi. Bo'sh qoldirilsa, ramka rasmi ishlatiladi.</div>
        </div>
      </div>
    </div>
    <div class="fit-ctl ${editImgR ? '' : 'dim'}" id="cat-fit-ctl-r">
      <div class="fitpills">
        <button type="button" id="cfitr-contain" class="${editFitR === 'contain' ? 'on' : ''}" onclick="setCatFitR('contain')">Butun rasm</button>
        <button type="button" id="cfitr-cover" class="${editFitR === 'cover' ? 'on' : ''}" onclick="setCatFitR('cover')">Sharni to'ldir</button>
      </div>
      <div class="sld"><label><span>Kattalashtirish / kichiklashtirish</span><span id="czoomr-v">${Math.round(editZoomR * 100)}%</span></label>
        <input type="range" min="50" max="300" step="5" value="${Math.round(editZoomR * 100)}" oninput="editZoomR=this.value/100;document.getElementById('czoomr-v').textContent=this.value+'%';refreshCatPrevR()"></div>
      <div class="sld"><label><span>Chapga / o'ngga</span><span id="cpxr-v">${editPosXR}%</span></label>
        <input type="range" min="0" max="100" step="5" value="${editPosXR}" oninput="editPosXR=+this.value;document.getElementById('cpxr-v').textContent=this.value+'%';refreshCatPrevR()"></div>
      <div class="sld"><label><span>Yuqoriga / pastga</span><span id="cpyr-v">${editPosYR}%</span></label>
        <input type="range" min="0" max="100" step="5" value="${editPosYR}" oninput="editPosYR=+this.value;document.getElementById('cpyr-v').textContent=this.value+'%';refreshCatPrevR()"></div>
    </div>

    <div class="form-grid">
      <div class="field span2"><label>Toifa nomi *</label><input class="input" id="c-n" value="${esc(c ? c.name : '')}" placeholder="Masalan: Soch parvarishi"></div>
      <div class="field span2"><label>Emoji (rasm bo'lmaganda ko'rsatiladi)</label><input class="input" id="c-emo" value="${esc(emo)}" placeholder="🧴" maxlength="6" oninput="refreshCatPrev();refreshCatPrevR()"></div>
    </div>`;
  const foot = `
    <button class="btn btn--ghost" onclick="closeModal()">Bekor</button>
    <button class="btn btn--primary" onclick="saveCat(${c ? c.id : 'null'})">Saqlash</button>`;
  openModal(c ? 'Toifani tahrirlash' : 'Yangi toifa', body, foot);
  refreshCatPrev();
  refreshCatPrevR();
}
function saveCat(id) {
  const n = $('c-n').value.trim();
  if (!n) { toast('Toifa nomini kiriting', 'err'); return }
  const emo = $('c-emo').value.trim();
  const obj = {
    name: n, emo: emo,
    img: editImg || null, fit: editFit, zoom: editZoom, pos: editPosX + '% ' + editPosY + '%',
    imgR: editImgR || null, fitR: editFitR, zoomR: editZoomR, posR: editPosXR + '% ' + editPosYR + '%'
  };
  if (id) { const i = categories.findIndex(x => x.id === id); if (i >= 0) categories[i] = Object.assign({}, categories[i], obj); }
  else { obj.id = (categories.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1; categories.push(obj); }
  cset('lume_categories', categories);
  closeModal(); drawCats(); toast('Saqlandi');
}
function delCat(id) {
  const used = products.filter(p => p.c == id).length;
  const msg = used ? `${used} ta mahsulot shu toifada. Baribir o'chirilsinmi?` : 'Toifa o\'chirilsinmi?';
  if (!confirm(msg)) return;
  categories = categories.filter(x => x.id !== id);
  cset('lume_categories', categories);
  drawCats();
  toast('O\'chirildi');
}

/* ===== ORDERS ===== */
const OSTAT = {
  collecting: ['Yig\'ilmoqda', 'pending'], plane: ['Samalyotda', 'ontheway'],
  arrived: ['Toshkentga yetib keldi', 'ontheway'], way: ['Yo\'lda', 'ontheway'],
  done: ['Yetkazib berildi', 'done'], cancel: ['Bekor', 'cancel']
};
function orderRow(o) {
  const items = (o.items || []).map(it => `${esc(it.n)} ×${it.q}`).join(', ');
  const st = OSTAT[o.status] || ['—', 'pending'];
  return `<tr>
    <td><b>${esc(o.id || '')}</b><br><small class="muted">${o.ts ? new Date(o.ts).toLocaleString('ru-RU') : ''}</small></td>
    <td style="max-width:220px"><small>${esc(items) || ('—')}</small>${avgRating(o) > 0 ? `<br><small style="color:#f59e0b;letter-spacing:1px">${'★'.repeat(Math.round(avgRating(o)))}</small></td>` : '</td>'}
    <td style="max-width:180px"><small class="muted">${esc(o.addr || '')}</small></td>
    <td><span class="num">${som(o.total)}</span></td>
    <td>
      <div style="display:flex;flex-direction:column;gap:7px;align-items:flex-start">
        <span class="pill ${st[1]}"><span class="pdot"></span>${st[0]}</span>
        <button class="btn btn--ghost" style="height:32px;padding:0 14px;font-size:12.5px" onclick="openOrder('${o.id}')">${ICONS.info}Tafsilot</button>
      </div>
    </td>
    <td><div class="act-btns" style="justify-content:flex-end"><button class="iact danger" onclick="delOrder('${o.id}')" aria-label="O'chirish">${ICONS.del}</button></div></td>
  </tr>`;
}
// Buyurtma filtrlari: vaqt (kunlik/haftalik/oylik) + holat.
let ordTimeFilter = 'all';    // all | day | week | month
let ordStatusFilter = 'all';  // all | <OSTAT kaliti>
function buildOrderFilters() {
  const el = $('ordFilters'); if (!el) return;
  const chip = (grp, k, label, active) =>
    `<button class="chip ${active ? 'is-active' : ''}" onclick="setOrdFilter('${grp}','${k}')">${label}</button>`;
  const timeRow = [['all', 'Barchasi'], ['day', 'Kunlik'], ['week', 'Haftalik'], ['month', 'Oylik']]
    .map(([k, l]) => chip('time', k, l, ordTimeFilter === k)).join('');
  const statusRow = [['all', 'Barcha holat']].concat(Object.entries(OSTAT).map(([v, l]) => [v, l[0]]))
    .map(([k, l]) => chip('status', k, l, ordStatusFilter === k)).join('');
  el.innerHTML =
    `<div class="ord-filter-grp"><span class="ord-filter-lbl">Davr</span><div class="chips">${timeRow}</div></div>` +
    `<div class="ord-filter-grp"><span class="ord-filter-lbl">Holat</span><div class="chips">${statusRow}</div></div>`;
}
function setOrdFilter(grp, k) {
  if (grp === 'time') ordTimeFilter = k; else ordStatusFilter = k;
  drawOrders();
}
function filteredOrders() {
  const span = { day: 864e5, week: 7 * 864e5, month: 30 * 864e5 }[ordTimeFilter];
  const now = Date.now();
  return orders.filter(o =>
    (ordStatusFilter === 'all' || o.status === ordStatusFilter) &&
    (!span || (o.ts && (now - o.ts) <= span))
  );
}
function drawOrders() {
  buildOrderFilters();
  $('ordCount').textContent = orders.length;
  const list = filteredOrders();
  $('ordBody').innerHTML = list.length
    ? list.map(orderRow).join('')
    : `<tr><td colspan="6"><div class="empty"><div class="e-emo">🧾</div><h4>${orders.length ? 'Bu filtrga mos buyurtma yo\'q' : 'Buyurtma yo\'q'}</h4></div></td></tr>`;
}

/* ===== ARXIV (o'chirilgan buyurtmalar) ===== */
function drawArxiv() {
  $('arxivCount').textContent = archivedOrders.length;
  $('arxivBody').innerHTML = archivedOrders.length
    ? archivedOrders.map(arxivRow).join('')
    : `<tr><td colspan="6"><div class="empty"><div class="e-emo">🗑️</div><h4>Arxiv bo'sh</h4><p class="muted">O'chirilgan buyurtmalar shu yerda saqlanadi.</p></div></td></tr>`;
}
function arxivRow(o) {
  const items = (o.items || []).map(it => `${esc(it.n)} ×${it.q}`).join(', ');
  const st = OSTAT[o.status] || ['—', 'pending'];
  return `<tr>
    <td><b>${esc(o.id || '')}</b><br><small class="muted">${o.ts ? new Date(o.ts).toLocaleString('ru-RU') : ''}</small></td>
    <td style="max-width:220px"><small>${esc(items) || ('—')}</small></td>
    <td style="max-width:180px"><small class="muted">${esc(o.addr || '')}</small></td>
    <td><span class="num">${som(o.total)}</span></td>
    <td><span class="pill ${st[1]}"><span class="pdot"></span>${st[0]}</span></td>
    <td><div class="act-btns" style="justify-content:flex-end">
      <button class="iact ok" onclick="restoreOrder('${o.id}')" title="Tiklash" aria-label="Tiklash">${ICONS.restore}</button>
      <button class="iact danger" onclick="delArxiv('${o.id}')" title="Butunlay o'chirish" aria-label="O'chirish">${ICONS.del}</button>
    </div></td>
  </tr>`;
}
async function restoreOrder(id) {
  await Cloud.refresh();
  orders = cget('lume_orders', []) || [];
  archivedOrders = cget('lume_orders_archive', []) || [];
  const i = archivedOrders.findIndex(x => x.id === id);
  if (i < 0) { drawArxiv(); return; }
  const o = archivedOrders.splice(i, 1)[0];
  orders.unshift(o);
  orders.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  cset('lume_orders', orders); cset('lume_orders_archive', archivedOrders);
  drawArxiv(); drawDash(); toast('Buyurtma tiklandi');
}
async function delArxiv(id) {
  if (!confirm('Buyurtma butunlay o\'chirilsinmi? Buni tiklab bo\'lmaydi.')) return;
  await Cloud.refresh();
  archivedOrders = cget('lume_orders_archive', []) || [];
  archivedOrders = archivedOrders.filter(x => x.id !== id);
  cset('lume_orders_archive', archivedOrders);
  drawArxiv(); toast('Butunlay o\'chirildi');
}
async function clearArxiv() {
  if (!archivedOrders.length) return;
  if (!confirm('Arxivdagi BARCHA buyurtmalar butunlay o\'chirilsinmi?')) return;
  await Cloud.refresh();
  archivedOrders = [];
  cset('lume_orders_archive', archivedOrders);
  drawArxiv(); toast('Arxiv tozalandi');
}
async function setStatus(id, st) {
  // refresh → merge → write: serverdan eng yangi ro'yxatni olamiz (admin ochiq
  // turганda mijoz qo'shgan yangi buyurtmalar ham), so'ng shu buyurtma holatini
  // o'zgartirib qayta yozamiz — aks holda yangi buyurtmalar o'chib ketardi.
  await Cloud.refresh();
  orders = cget('lume_orders', []) || [];
  const o = orders.find(x => x.id === id);
  if (!o) { drawOrders(); return; }
  o.status = st;
  cset('lume_orders', orders);
  drawOrders(); drawDash(); toast('Holat yangilandi');
}

// To'lov turi yorlig'i (ilova bilan bir xil)
function payLabel(p) { return ({ card: 'Karta (Uzcard / Humo)', payme: 'Payme', click: 'Click', cash: 'Naqd' })[p] || 'Naqd'; }

// Yulduzlar (mijoz bahosi)
function starRow(n) {
  n = +n || 0;
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span style="color:${i <= n ? '#f59e0b' : 'var(--text-3)'}">${i <= n ? '★' : '☆'}</span>`;
  return `<span style="font-size:16px;letter-spacing:2px">${s}</span>`;
}
// Buyurtmadagi mahsulot baholarining o'rtachasi.
function avgRating(o) {
  if (!o || !o.reviews) return 0;
  const vals = Object.values(o.reviews).map(r => +r.r || 0).filter(v => v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

// Buyurtma tafsiloti — rasmli mahsulotlar, mijoz ma'lumoti, chek yuklab olish.
function openOrder(id) {
  const o = orders.find(x => x.id === id); if (!o) return;
  const st = OSTAT[o.status] || ['—', 'pending'];
  const itemsSum = (o.items || []).reduce((s, it) => s + (+it.p || 0) * (+it.q || 1), 0);
  const ship = Math.max(0, (+o.total || 0) - itemsSum);
  const itemsHtml = (o.items || []).map(it => {
    const p = products.find(x => x.n === it.n);
    const img = p ? pic(p) : art();
    return `<div class="ord-item">
      <div class="ord-item-img">${img}</div>
      <div class="ord-item-info"><b>${esc(it.n)}</b><small class="muted">${som(it.p)} × ${it.q}</small></div>
      <div class="ord-item-sum num">${som((+it.p || 0) * (+it.q || 1))}</div>
    </div>`;
  }).join('') || '<div class="muted" style="padding:8px 0">Mahsulot yo\'q</div>';
  const body = `
    <div class="field"><label>Buyurtma holati</label>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="pill ${st[1]}"><span class="pdot"></span>${st[0]}</span>
        <select class="input" style="max-width:230px" onchange="setStatus('${o.id}',this.value);openOrder('${o.id}')">
          ${Object.entries(OSTAT).map(([v, l]) => `<option value="${v}" ${o.status === v ? 'selected' : ''}>${l[0]}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="cat-sec-t" style="margin-top:18px">Mahsulotlar</div>
    <div class="ord-items">${itemsHtml}</div>
    <div class="ord-tot">
      <div class="ord-tot-row"><span class="muted">Mahsulotlar</span><span class="num">${som(itemsSum)}</span></div>
      <div class="ord-tot-row"><span class="muted">Yetkazib berish</span><span class="num">${som(ship)}</span></div>
      <div class="ord-tot-row total"><b>Jami</b><b class="num">${som(o.total)}</b></div>
    </div>

    <div class="cat-sec-t b" style="margin-top:18px">Mijoz ma'lumotlari</div>
    <div class="ord-info">
      <div class="ord-info-row"><span>📍</span><span>${esc(o.addr || '—')}</span></div>
      <div class="ord-info-row"><span>📞</span><span>${esc(o.phone || '—')}</span></div>
      <div class="ord-info-row"><span>💳</span><span>${esc(payLabel(o.pay))}</span></div>
      <div class="ord-info-row"><span>🕒</span><span>${o.ts ? new Date(o.ts).toLocaleString('ru-RU') : '—'}</span></div>
    </div>${(o.reviews && Object.keys(o.reviews).length) ? `
    <div class="cat-sec-t" style="margin-top:18px">Mijoz baholari</div>
    <div class="ord-info">
      ${Object.entries(o.reviews).map(([name, rv]) => `
        <div class="ord-info-row" style="flex-direction:column;align-items:stretch;gap:5px">
          <div style="display:flex;align-items:center;gap:8px">
            <b style="flex:1;min-width:0">${esc(name)}</b>
            <span>${starRow(rv.r)}</span><span class="muted" style="font-size:12px">${rv.r}/5</span>
          </div>
          ${rv.c ? `<span class="muted">💬 ${esc(rv.c)}</span>` : ''}
        </div>`).join('')}
    </div>` : ''}`;
  const foot = `
    <button class="btn btn--ghost" onclick="closeModal()">Yopish</button>
    <button class="btn btn--primary" onclick="downloadReceipt('${o.id}')">${ICONS.download}Chekni yuklab olish</button>`;
  openModal('Buyurtma ' + (o.id || ''), body, foot);
}

// Chekni HTML fayl sifatida yuklab olish (rasmsiz — sof matn/jadval chek).
function downloadReceipt(id) {
  const o = orders.find(x => x.id === id); if (!o) return;
  const st = OSTAT[o.status] || ['—'];
  const itemsSum = (o.items || []).reduce((s, it) => s + (+it.p || 0) * (+it.q || 1), 0);
  const ship = Math.max(0, (+o.total || 0) - itemsSum);
  const brand = esc(settings.brand || 'LUMÉ');
  const rows = (o.items || []).map(it =>
    `<tr><td>${esc(it.n)}</td><td class="c">${it.q}</td><td class="r">${som(it.p)}</td><td class="r">${som((+it.p || 0) * (+it.q || 1))}</td></tr>`).join('');
  const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chek ${esc(o.id)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;max-width:440px;margin:24px auto;color:#111;padding:0 18px}
  h1{font-size:23px;text-align:center;margin:0 0 2px;letter-spacing:.5px}
  .sub{text-align:center;color:#777;font-size:12px;margin-bottom:18px}
  .row{display:flex;justify-content:space-between;font-size:13.5px;margin:4px 0}
  .muted{color:#777}
  table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
  th{text-align:left;color:#888;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;padding:6px 4px;border-bottom:1px solid #ddd}
  td{padding:8px 4px;border-bottom:1px solid #eee}
  td.c,th.c{text-align:center}td.r,th.r{text-align:right}
  .tot{font-size:16px;font-weight:700;border-top:2px solid #111;padding-top:9px;margin-top:8px}
  .box{border:1px dashed #bbb;border-radius:10px;padding:11px 13px;margin:14px 0;font-size:13px;line-height:1.7}
  .thanks{text-align:center;color:#777;font-size:12.5px;margin-top:18px}
  @media print{body{margin:0}}
</style></head>
<body>
  <h1>${brand}</h1>
  <div class="sub">Chek · ${esc(o.id)}</div>
  <div class="row"><span class="muted">Sana</span><span>${o.ts ? new Date(o.ts).toLocaleString('ru-RU') : ''}</span></div>
  <div class="row"><span class="muted">Holat</span><span>${esc(st[0])}</span></div>
  <div class="row"><span class="muted">To'lov</span><span>${esc(payLabel(o.pay))}</span></div>
  <table><thead><tr><th>Mahsulot</th><th class="c">Soni</th><th class="r">Narx</th><th class="r">Summa</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="row"><span class="muted">Mahsulotlar</span><span>${som(itemsSum)}</span></div>
  <div class="row"><span class="muted">Yetkazib berish</span><span>${som(ship)}</span></div>
  <div class="row tot"><span>Jami</span><span>${som(o.total)}</span></div>
  <div class="box"><b>Manzil:</b> ${esc(o.addr || '—')}<br><b>Telefon:</b> ${esc(o.phone || '—')}</div>
  <div class="thanks">Xaridingiz uchun rahmat!</div>
</body></html>`;
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chek-' + String(o.id).replace(/[^\dA-Za-z]/g, '') + '.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Chek yuklab olindi');
  } catch (e) { toast('Chekni yuklab bo\'lmadi', 'err'); }
}
// O'chirish endi arxivга ko'chiradi (butunlay yo'q qilmaydi).
async function delOrder(id) {
  await Cloud.refresh();
  orders = cget('lume_orders', []) || [];
  archivedOrders = cget('lume_orders_archive', []) || [];
  const i = orders.findIndex(x => x.id === id);
  if (i < 0) { closeModal(); drawOrders(); return; }
  const o = orders.splice(i, 1)[0];
  archivedOrders.unshift(o);
  cset('lume_orders', orders); cset('lume_orders_archive', archivedOrders);
  closeModal(); drawOrders(); drawDash(); toast('Arxivga ko\'chirildi');
}
async function clearOrders() {
  if (!orders.length) return;
  if (!confirm('Barcha buyurtmalar arxivga ko\'chirilsinmi?')) return;
  await Cloud.refresh();
  orders = cget('lume_orders', []) || [];
  archivedOrders = cget('lume_orders_archive', []) || [];
  archivedOrders = orders.concat(archivedOrders);
  orders = [];
  cset('lume_orders', orders); cset('lume_orders_archive', archivedOrders);
  drawOrders(); drawDash(); toast('Hammasi arxivlandi');
}

// Buyurtmalarni serverdan qayta yuklaydi (qo'lda tugma va avtomatik interval uchun).
async function refreshOrders(showToast) {
  await Cloud.refresh();
  orders = cget('lume_orders', []) || [];
  archivedOrders = cget('lume_orders_archive', []) || [];
  _ordersSig = _ordersSignature(orders);
  drawOrders(); drawDash();
  if (showToast) toast('Buyurtmalar yangilandi');
}
function _ordersSignature(arr) {
  return arr.length + ':' + arr.reduce((s, o) => Math.max(s, o.ts || 0), 0)
    + ':' + arr.map(o => o.status || '').join(',');
}
// Buyurtmalar bo'limi ochiq bo'lsa — har 10 soniyada serverdan yangilaymiz.
// cget faqat keshdan o'qigani uchun avval refresh() qilamiz. Ma'lumot
// o'zgargandagina qayta chizamiz (_usersSig uslubidagi taqqoslash).
let _ordersSig = '';
setInterval(async () => {
  const sec = $('sec-orders');
  if (!sec || !sec.classList.contains('is-active')) return;
  await Cloud.refresh();
  const arr = cget('lume_orders', []) || [];
  const sig = _ordersSignature(arr);
  if (sig === _ordersSig) return;
  _ordersSig = sig;
  orders = arr;
  archivedOrders = cget('lume_orders_archive', []) || [];
  drawOrders(); drawDash();
}, 10000);

/* ===== XABARLAR (chat) — ikki ustunli ===== */
let chatFilter = 'all';   // all | day | week | month | muhim | arxiv
let chatSelected = null;  // tanlangan suhbat (mijoz nomi)
let _chatConvs = [];      // joriy filtrlangan suhbatlar (indeks bo'yicha tanlash uchun)
// Muhim (yulduzli) va arxivlangan suhbatlar — lume_chat_meta kalitida saqlanadi.
let chatMeta = { starred: [], archived: [] };
function isStarred(n) { return chatMeta.starred.includes(n); }
function isArchived(n) { return chatMeta.archived.includes(n); }
function msgName(m) { const n = ((m && m.name) || '').toString().trim(); return n || 'Mijoz'; }

// Xabarlarni mijoz nomi bo'yicha suhbatlarga guruhlaydi.
function chatConversations() {
  const map = new Map();
  chatMsgs.forEach(m => { const k = msgName(m); if (!map.has(k)) map.set(k, []); map.get(k).push(m); });
  const convs = [];
  map.forEach((msgs, name) => {
    msgs.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const last = msgs[msgs.length - 1] || {};
    let lastAdminTs = 0;
    msgs.forEach(m => { if (m.who === 'admin') lastAdminTs = Math.max(lastAdminTs, m.ts || 0); });
    const unread = msgs.filter(m => m.who !== 'admin' && (m.ts || 0) > lastAdminTs).length;
    convs.push({ name, msgs, last, ts: last.ts || 0, unread });
  });
  convs.sort((a, b) => b.ts - a.ts);
  return convs;
}
function applyChatFilter(convs) {
  if (chatFilter === 'arxiv') return convs.filter(c => isArchived(c.name));
  convs = convs.filter(c => !isArchived(c.name));   // arxivlanganlar boshqa filtrlarda ko'rinmaydi
  if (chatFilter === 'muhim') return convs.filter(c => isStarred(c.name));
  const span = { day: 864e5, week: 7 * 864e5, month: 30 * 864e5 }[chatFilter];
  if (span) { const now = Date.now(); return convs.filter(c => c.ts && (now - c.ts) <= span); }
  return convs;  // all
}
// Filtrlar 2 qatorda — 1-rasmdagi joylashuv (Muhim yulduzcha, Arxiv ikonka bilan).
function buildChatFilters() {
  const el = $('chatFilters'); if (!el) return;
  const chip = (k, label, icon) =>
    `<button class="chip ${chatFilter === k ? 'is-active' : ''}" onclick="setChatFilter('${k}')">${icon ? `<span class="nic">${icon}</span>` : ''}${label}</button>`;
  el.innerHTML =
    `<div class="chips">${chip('all', 'Barchasi')}${chip('day', 'Kunlik')}${chip('week', 'Haftalik')}${chip('month', 'Oylik')}</div>` +
    `<div class="chips msg-filter-row2">${chip('muhim', 'Muhim', ICONS.star)}${chip('arxiv', 'Arxiv', ICONS.archive)}</div>`;
}
function setChatFilter(k) { chatFilter = k; drawChat(); }
function toggleStar(i) {
  const c = _chatConvs[i]; if (!c) return;
  const s = new Set(chatMeta.starred);
  s.has(c.name) ? s.delete(c.name) : s.add(c.name);
  chatMeta.starred = [...s]; cset('lume_chat_meta', chatMeta); drawChat();
}
function toggleArchive(i) {
  const c = _chatConvs[i]; if (!c) return;
  const s = new Set(chatMeta.archived);
  const willArchive = !s.has(c.name);
  willArchive ? s.add(c.name) : s.delete(c.name);
  chatMeta.archived = [...s]; cset('lume_chat_meta', chatMeta);
  if (willArchive && chatSelected === c.name) chatSelected = null;
  drawChat(); toast(willArchive ? 'Arxivlandi' : 'Arxivdan chiqarildi');
}
function chatRelTime(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}
function chatAv(name) { return ((name || 'M').trim().charAt(0) || 'M').toUpperCase(); }

function drawChat() {
  buildChatFilters();
  const list = $('chatList'), conv = $('chatConv'), grid = document.querySelector('.msg-grid');
  if (!list || !conv) return;
  _chatConvs = applyChatFilter(chatConversations());

  list.innerHTML = _chatConvs.length ? _chatConvs.map((c, i) => `
    <div class="chat-li ${chatSelected === c.name ? 'is-active' : ''}" onclick="selectConv(${i})">
      <div class="u-av">${esc(chatAv(c.name))}</div>
      <div class="cl-mid">
        <div class="cl-name">${esc(c.name)}<small>${chatRelTime(c.ts)}</small></div>
        <div class="cl-last">${esc((c.last.text || '').slice(0, 42)) || '—'}</div>
      </div>
      ${c.unread ? `<span class="unread">${c.unread}</span>` : ''}
      <div class="cl-actions">
        <button class="chat-act star ${isStarred(c.name) ? 'on' : ''}" onclick="event.stopPropagation();toggleStar(${i})" title="Muhim" aria-label="Muhim">${isStarred(c.name) ? ICONS.starFill : ICONS.star}</button>
        <button class="chat-act arch ${isArchived(c.name) ? 'on' : ''}" onclick="event.stopPropagation();toggleArchive(${i})" title="Arxiv" aria-label="Arxiv">${ICONS.archive}</button>
      </div>
    </div>`).join('')
    : `<div class="empty" style="padding:40px 16px"><h4 class="muted">Hali suhbatlar yo'q</h4></div>`;

  let sel = chatConversations().find(c => c.name === chatSelected);
  // Userlar bo'limidan "Xabar yuborish" bosilganda suhbat hali bo'lmasligi mumkin —
  // shunda bo'sh suhbat ochamiz (birinchi xabar shu yerdan yoziladi).
  if (!sel && chatSelected) sel = { name: chatSelected, msgs: [] };
  if (!sel) {
    if (grid) grid.classList.remove('show-conv');
    conv.innerHTML = `<div class="conv-empty">Chapdan suhbatni tanlang yoki bozordan "Sotuvchi bilan xabarlashish" orqali boshlang.</div>`;
    return;
  }
  if (grid) grid.classList.add('show-conv');
  // Yozilayotgan matn va fokusni saqlaymiz (yangilash uni o'chirmasin).
  const prevInput = $('chatMsg');
  const draft = prevInput ? prevInput.value : '';
  const wasFocused = prevInput && document.activeElement === prevInput;
  const bubbles = sel.msgs.map(m => {
    const me = m.who === 'admin';
    return `<div class="bubble ${me ? 'me' : 'them'}">${esc(m.text || '')}<small>${chatRelTime(m.ts)}</small></div>`;
  }).join('');
  conv.innerHTML = `
    <div class="conv-head">
      <button class="back-chat" onclick="backChat()"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6"/></svg></button>
      <div class="u-av">${esc(chatAv(sel.name))}</div>
      <div><div class="ch-name">${esc(sel.name)}</div><div class="ch-stat">Suhbat</div></div>
    </div>
    <div class="conv-body" id="convBody">${bubbles}</div>
    <div class="conv-foot">
      <input id="chatMsg" placeholder="Mijozga javob yozing..." onkeydown="if(event.key==='Enter')sendAdminChat()">
      <button class="send-btn" onclick="sendAdminChat()" aria-label="Yuborish">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      </button>
    </div>`;
  const cb = $('convBody'); if (cb) cb.scrollTop = cb.scrollHeight;
  const newInput = $('chatMsg');
  if (newInput && draft) { newInput.value = draft; }
  if (newInput && wasFocused) { newInput.focus(); newInput.selectionStart = newInput.selectionEnd = newInput.value.length; }
}
function selectConv(i) { const c = _chatConvs[i]; if (!c) return; chatSelected = c.name; drawChat(); const inp = $('chatMsg'); if (inp) inp.focus(); }
function backChat() { chatSelected = null; drawChat(); }
function sendAdminChat() {
  const inp = $('chatMsg'); if (!inp) return;
  const t = inp.value.trim(); if (!t) return;
  chatMsgs.push({ who: 'admin', text: t, ts: Date.now(), name: chatSelected || 'Mijoz' });
  cset('lume_chat', chatMsgs);
  inp.value = ''; drawChat();
}
let _chatSig = '';
async function refreshChat() {
  // MUHIM: Cloud.init() _cache va _dirty ni TOZALAYDI (yozilib ulgurmagan
  // o'zgarishlarni yo'qotishi mumkin). Shuning uchun refresh() ishlatamiz.
  try { await Cloud.refresh(); } catch (e) { }
  const cch = cget('lume_chat', []); chatMsgs = Array.isArray(cch) ? cch : [];
  // Xabarlar o'zgarmagan bo'lsa qayta chizmaymiz — yozilayotgan javob saqlanadi.
  const sig = chatMsgs.length + ':' + chatMsgs.reduce((s, m) => Math.max(s, m.ts || 0), 0);
  if (sig === _chatSig) return;
  _chatSig = sig;
  drawChat();
}
setInterval(() => {
  const sec = $('sec-chat');
  if (sec && sec.classList.contains('is-active')) refreshChat();
}, 6000);

/* ===== USERLAR (ro'yxatdan o'tgan foydalanuvchilar) ===== */
let _usersSig = '';
function userById(id) { return users.find(u => String(u.id) === String(id)); }

function drawUsers() {
  const cnt = $('userCount'); if (cnt) cnt.textContent = users.length;
  const body = $('userBody'); if (!body) return;
  const list = users.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)); // yangilari tepada
  body.innerHTML = list.length
    ? list.map(u => `
      <tr>
        <td><div class="cell-prod"><div class="emo">👤</div><div><b>${esc(u.name || '—')}</b><br><small class="muted">${u.ts ? new Date(u.ts).toLocaleDateString('ru-RU') : ''}</small></div></div></td>
        <td><span class="num">${esc(u.phone || '—')}</span></td>
        <td><div class="act-btns" style="justify-content:flex-end;flex-wrap:wrap;gap:6px">
          <button class="btn btn--ghost" style="height:32px;padding:0 12px;font-size:12.5px" onclick="userInfo('${esc(u.id)}')">${ICONS.info}User haqida</button>
          <button class="iact" onclick="messageUser('${esc(u.id)}')" title="Xabar yuborish" aria-label="Xabar">${ICONS.chat}</button>
          <button class="iact danger" onclick="delUser('${esc(u.id)}')" title="O'chirish" aria-label="O'chirish">${ICONS.del}</button>
        </div></td>
      </tr>`).join('')
    : `<tr><td colspan="3"><div class="empty"><div class="e-emo">👤</div><h4>Hali foydalanuvchi yo'q</h4><p class="muted">Mobil ilovada ro'yxatdan o'tgan foydalanuvchilar shu yerda ko'rinadi.</p></div></td></tr>`;
}

function userInfo(id) {
  const u = userById(id); if (!u) return;
  const row = (label, val) => `<div class="field span2"><label>${label}</label>
    <div style="padding:11px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;font-weight:600;font-size:14px">${esc(val || '—')}</div></div>`;
  const body = `<div class="form-grid">
      ${row('Ism', u.name)}
      ${row('Telefon raqami', u.phone)}
      ${row('Manzil', u.addr)}
    </div>
    <p class="muted" style="font-size:12px;margin-top:14px">Ro'yxatdan o'tgan: ${u.ts ? new Date(u.ts).toLocaleString('ru-RU') : '—'}</p>`;
  const foot = `<button class="btn btn--ghost" onclick="closeModal()">Yopish</button>
    <button class="btn btn--primary" onclick="closeModal();messageUser('${esc(u.id)}')">Xabar yuborish</button>`;
  openModal('User haqida', body, foot);
}

function messageUser(id) {
  const u = userById(id); if (!u) return;
  chatSelected = (u.name || '').trim() || 'Mijoz';
  nav('chat'); // habarlar menyusi ochiladi, shu user tanlangan holda
}

async function delUser(id) {
  const u = userById(id); if (!u) return;
  if (!confirm(`"${u.name || 'Foydalanuvchi'}"ni o'chirmoqchimisiz?\n\nHaqiqatan ham ishonchingiz komilmi?`)) return;
  // refresh → merge → write: serverdagi eng yangi ro'yxatni olib, undan o'chiramiz
  // (boshqa yangi ro'yxatdan o'tganlarni yo'qotmaslik uchun).
  await Cloud.refresh();
  const cur = cget('lume_users', []); users = Array.isArray(cur) ? cur : [];
  users = users.filter(x => String(x.id) !== String(id));
  cset('lume_users', users);
  drawUsers();
  toast('Foydalanuvchi o\'chirildi');
}

// Userlar bo'limi ochiq bo'lsa — fonda yangilab turamiz.
// MUHIM: cget faqat XOTIRADAGI keshdan o'qiydi — avval serverdan refresh() qilamiz,
// aks holda yangi ro'yxatdan o'tganlar (Chat bo'limi ochilmasa) umuman ko'rinmaydi.
setInterval(async () => {
  const sec = $('sec-users');
  if (!sec || !sec.classList.contains('is-active')) return;
  await Cloud.refresh();
  const cu = cget('lume_users', null);
  const arr = Array.isArray(cu) ? cu.filter(x => x && x.id) : [];
  const sig = arr.length + ':' + arr.reduce((s, u) => Math.max(s, u.ts || 0), 0);
  if (sig === _usersSig) return;
  _usersSig = sig; users = arr; drawUsers();
}, 8000);

/* ===== SETTINGS ===== */
function drawSettings() {
  $('setBrand').value = settings.brand || '';
  $('setShip').value = settings.ship || '';
  $('setPhone').value = settings.phone || '';
  $('setTg').value = settings.tg || '';
  $('clientLabel').textContent = window.__LUME_CLIENT || 'shop';
  // Bosh admin hisobi karti — faqat bosh adminga ko'rinadi, maydonlar to'ldiriladi.
  const sc = $('superCard');
  if (sc) sc.style.display = isSuper() ? '' : 'none';
  const sa = superAcc();
  if ($('supName')) $('supName').value = sa.name || '';
  if ($('supLogin')) $('supLogin').value = sa.login || '';
  if ($('supPassCur')) $('supPassCur').value = '';
  if ($('supPassNew')) $('supPassNew').value = '';
  if ($('supPassNew2')) $('supPassNew2').value = '';
}
function saveSettings() {
  settings = {
    brand: $('setBrand').value.trim() || 'LUMÉ',
    ship: +$('setShip').value.replace(/\D/g, '') || 0,
    phone: $('setPhone').value.trim(),
    tg: $('setTg').value.trim()
  };
  cset('lume_settings', settings); toast('Sozlamalar saqlandi');
}

// Bosh admin login / parol / ismini o'zgartirish (joriy parol bilan tasdiqlanadi).
async function saveSuper() {
  if (!isSuper()) { toast('Faqat bosh admin o\'zgartira oladi', 'err'); return; }
  const name = ($('supName').value || '').trim();
  const login = ($('supLogin').value || '').trim();
  const cur = $('supPassCur').value || '';
  const np = $('supPassNew').value || '';
  const np2 = $('supPassNew2').value || '';
  const sup = superAcc();
  if (!login) { toast('Login bo\'sh bo\'lmasin', 'err'); return; }
  if (cur !== sup.pass) { toast('Joriy parol noto\'g\'ri', 'err'); return; }
  // Login boshqa admin bilan to'qnashmasin
  if (admins.some(a => (a.login || '').toLowerCase() === login.toLowerCase())) {
    toast('Bu login boshqa adminda band', 'err'); return;
  }
  let newPass = sup.pass;
  if (np || np2) {
    if (np.length < 4) { toast('Yangi parol kamida 4 belgi bo\'lsin', 'err'); return; }
    if (np !== np2) { toast('Yangi parollar mos kelmadi', 'err'); return; }
    newPass = np;
  }
  // refresh → merge → write
  await Cloud.refresh();
  superCfg = { login, pass: newPass, name: name || sup.name };
  cset('lume_super', superCfg);
  // Joriy sessiyani yangilaymiz (login o'zgargan bo'lsa ham qayta kirish shart bo'lmaydi).
  if (currentAdmin && currentAdmin.role === 'super') {
    currentAdmin = superAcc();
    setSession(currentAdmin);
    const pn = $('profName'); if (pn) pn.textContent = currentAdmin.name || currentAdmin.login;
  }
  $('supPassCur').value = ''; $('supPassNew').value = ''; $('supPassNew2').value = '';
  toast('Bosh admin ma\'lumotlari saqlandi');
  const sec = $('sec-admins'); if (sec && sec.classList.contains('is-active')) drawAdmins();
}

/* ===== TELEGRAM BOT ===== */
// Konfiguratsiya lume_bot kalitida saqlanadi. Mobil ilova ham AYNAN shu kalitni
// o'qib, buyurtmani to'g'ridan-to'g'ri Telegram Bot API orqali kanalga yuboradi.
let botCfg = { token: '', channel: '', username: '', enabled: false };
let botTokenShown = false;

// @kanal ko'rinishiga keltirish (bo'sh bo'lmasa @ bilan)
function normChannel(c) {
  c = String(c || '').trim();
  if (!c) return '';
  if (c.startsWith('https://t.me/')) c = '@' + c.slice('https://t.me/'.length);
  else if (c.startsWith('t.me/')) c = '@' + c.slice('t.me/'.length);
  if (!c.startsWith('@')) c = '@' + c;
  return c.replace(/\s+/g, '');
}
async function tgApi(token, method, params) {
  const res = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.description || ('HTTP ' + res.status));
  return data.result;
}
// Buyurtmani chiroyli HTML xabarga aylantirish (ilovadagi format bilan bir xil)
function formatOrderMsg(o) {
  const lines = (o.items || []).map(it => `• ${esc(it.n)} × ${it.q} — ${som((it.p || 0) * (it.q || 1))}`).join('\n');
  const pay = ({ card: 'Karta (Uzcard / Humo)', payme: 'Payme', click: 'Click', cash: 'Naqd' })[o.pay] || 'Naqd';
  return `🛒 <b>Yangi buyurtma</b>  ${esc(o.id || '')}\n` +
    `🏬 <b>${esc(settings.brand || 'LUMÉ')}</b>\n\n` +
    `${lines || '—'}\n\n` +
    `💰 Jami: <b>${som(o.total)}</b>\n` +
    `💳 To'lov: ${pay}\n` +
    (o.phone ? `📞 ${esc(o.phone)}\n` : '') +
    (o.addr ? `📍 ${esc(o.addr)}\n` : '') +
    (o.ts ? `🕒 ${new Date(o.ts).toLocaleString('ru-RU')}` : '');
}
function drawBot() {
  const connected = !!(botCfg.enabled && botCfg.token && botCfg.channel);
  const p = $('botPanel');
  p.innerHTML = `
    <div class="bot-wrap">
      <div class="bot-topbar">
        <div class="bot-status ${connected ? 'on' : 'off'}">
          <span class="bdot"></span>${connected ? 'Faol — buyurtmalar kanalga yuboriladi' : 'O\'chiq — sozlang'}
        </div>
        ${botCfg.username ? `<div class="bot-stat"><span class="bi">${ICONS.bot}</span><b>@${esc(botCfg.username)}</b></div>` : ''}
      </div>

      <div class="bot-grid">
        <div class="card card-pad">
          <div class="card-head" style="padding:0 0 14px;margin-bottom:14px"><h3>1 · Bot tokeni</h3></div>
          <div class="field"><label>Bot token</label>
            <div class="bot-token">
              <input class="input" id="botToken" type="${botTokenShown ? 'text' : 'password'}" placeholder="123456789:AAE-..." value="${esc(botCfg.token)}">
              <button class="bot-eye" id="botEye" type="button" aria-label="Ko'rsatish">${ICONS.eye}</button>
            </div>
            <p class="bot-hint">@BotFather → <code>/newbot</code> → tokenni nusxalab joylang</p>
          </div>
          <div class="field" style="margin-top:12px"><label>2 · Kanal username</label>
            <input class="input" id="botChannel" placeholder="@kanal_nomi" value="${esc(botCfg.channel)}">
            <p class="bot-hint">Botni kanalga <b>admin</b> qiling, so'ng shu yerga username yozing</p>
          </div>
          <div class="bot-actions">
            <button class="btn btn--primary" onclick="botSaveTest()">Saqlash va tekshirish</button>
            ${connected ? '<button class="btn btn--ghost" onclick="botTestOrder()">Test buyurtma</button>' : ''}
            ${botCfg.token || botCfg.channel ? '<button class="btn btn--danger" onclick="botDisconnect()">O\'chirish</button>' : ''}
          </div>
          <div class="bot-chan-state ${connected ? 'on' : ''}" style="margin-top:14px">
            ${connected ? '🟢 Ulangan: ' + esc(botCfg.channel) : '⚪ Hali ulanmagan'}
          </div>
        </div>

        <div class="card bot-help"><div class="card-pad">
          <h4>Qanday ulanadi?</h4>
          <ol class="bot-steps">
            <li>Telegramda <b>@BotFather</b> ni oching → <code>/newbot</code> → bot yarating va <b>tokenni</b> oling.</li>
            <li>Yangi Telegram <b>kanal</b> oching (yoki mavjudini oling).</li>
            <li>Botni kanalga <b>administrator</b> qilib qo'shing (xabar yuborish huquqi bilan).</li>
            <li>Bu yerga <b>token</b> va kanal <b>@username</b> ini kiriting → <b>Saqlash va tekshirish</b>.</li>
            <li>Endi mijoz ilovadan buyurtma bersa — u avtomatik kanalingizga tushadi.</li>
          </ol>
          <p class="bot-note">Eslatma: token bu qurilma va serverda ochiq saqlanadi — uni faqat ishonchli odamlarga bering. Token o'g'irlansa, @BotFather → <code>/revoke</code> orqali yangilang.</p>
        </div></div>
      </div>
    </div>`;
  const eye = $('botEye');
  if (eye) eye.onclick = () => { botTokenShown = !botTokenShown; const i = $('botToken'); i.type = botTokenShown ? 'text' : 'password'; };
}
async function botSaveTest() {
  const token = ($('botToken').value || '').trim();
  const channel = normChannel($('botChannel').value);
  if (!token) { toast('Bot tokenini kiriting', 'err'); return; }
  if (!channel) { toast('Kanal username kiriting', 'err'); return; }
  toast('Tekshirilmoqda...', 'info');
  try {
    const me = await tgApi(token, 'getMe', {});   // token to'g'riligini tekshiradi
    // kanalga test xabar — kanal ulanишi va huquq tekshiriladi
    await tgApi(token, 'sendMessage', {
      chat_id: channel,
      parse_mode: 'HTML',
      text: `✅ <b>${esc(settings.brand || 'LUMÉ')}</b> — bot ulandi!\nEndi buyurtmalar shu kanalga tushadi.`
    });
    botCfg = { token, channel, username: me.username || '', enabled: true };
    cset('lume_bot', botCfg);
    drawBot();
    toast('Ulandi — kanalga test xabar yuborildi');
  } catch (e) {
    const msg = /chat not found/i.test(e.message) ? 'Kanal topilmadi — username va bot admin ekanini tekshiring'
      : /not enough rights|administrator/i.test(e.message) ? 'Botga kanalда admin huquqi bering'
      : /unauthorized|not found/i.test(e.message) ? 'Token noto\'g\'ri'
      : e.message;
    toast('Xato: ' + msg, 'err');
  }
}
async function botTestOrder() {
  if (!botCfg.enabled) { toast('Avval botni ulang', 'err'); return; }
  const demo = {
    id: '#TEST', ts: Date.now(), pay: 'cash', total: 350000, phone: '+998 90 123 45 67',
    addr: 'Toshkent, Chilonzor 12', items: [{ n: 'Namuna mahsulot', q: 2, p: 150000 }, { n: 'Test krem', q: 1, p: 50000 }]
  };
  try {
    await tgApi(botCfg.token, 'sendMessage', { chat_id: botCfg.channel, parse_mode: 'HTML', text: formatOrderMsg(demo) });
    toast('Test buyurtma kanalga yuborildi');
  } catch (e) { toast('Xato: ' + e.message, 'err'); }
}
function botDisconnect() {
  if (!confirm('Bot o\'chirilsinmi? Buyurtmalar kanalga yuborilmay qoladi.')) return;
  botCfg = { token: '', channel: '', username: '', enabled: false };
  cset('lume_bot', botCfg);
  drawBot();
  toast('O\'chirildi');
}

/* ===== ADMINLAR boshqaruvi ===== */
function permLabel(s) { const n = NAV.find(x => x[0] === s); return n ? n[1] : s; }
function drawAdmins() {
  $('adminCount').textContent = admins.length + 1; // +1 = bosh admin
  const sup = superAcc();
  const rowSuper = `
    <tr>
      <td><div class="cell-prod"><div class="emo">👑</div><div><b>${esc(sup.name)}</b><br><small class="muted">Barcha menyular</small></div></div></td>
      <td><span class="num">${esc(sup.login)}</span></td>
      <td><span class="pill done">Barchasi</span></td>
      <td><span class="pill faol">Bosh admin</span></td>
      <td></td>
    </tr>`;
  const rows = admins.map(a => {
    const perms = (a.perms || []);
    const permTxt = perms.length ? perms.map(permLabel).join(', ') : '—';
    return `<tr>
      <td><div class="cell-prod"><div class="emo">👤</div><div><b>${esc(a.name || a.login)}</b><br><small class="muted">${perms.length} ta menyu</small></div></div></td>
      <td><span class="num">${esc(a.login)}</span></td>
      <td style="max-width:240px"><small class="muted">${esc(permTxt)}</small></td>
      <td><span class="pill">Admin</span></td>
      <td><div class="act-btns" style="justify-content:flex-end">
        <button class="iact" onclick="openAdmin('${a.id}')" aria-label="Tahrir">${ICONS.edit}</button>
        <button class="iact danger" onclick="delAdmin('${a.id}')" aria-label="O'chirish">${ICONS.del}</button>
      </div></td>
    </tr>`;
  }).join('');
  $('adminBody').innerHTML = rowSuper + rows;
}
function openAdmin(id) {
  const a = id ? admins.find(x => x.id === id) : null;
  const perms = a ? (a.perms || []) : ['dash'];
  const body = `
    <p class="muted" style="font-size:12.5px;margin-bottom:16px">Login va parol bilan kiradi. Faqat belgilangan menyularni ko'radi.</p>
    <div class="form-grid">
      <div class="field"><label>Ism</label><input class="input" id="a-name" value="${esc(a ? a.name : '')}" placeholder="Masalan: Aziz"></div>
      <div class="field"><label>Login *</label><input class="input" id="a-login" value="${esc(a ? a.login : '')}" placeholder="login" autocomplete="off"></div>
      <div class="field span2"><label>Parol *</label><input class="input" id="a-pass" value="${esc(a ? a.pass : '')}" placeholder="parol" autocomplete="new-password"></div>
    </div>
    <div class="cat-sec-t" style="margin-top:16px">Ruxsat etilgan menyular</div>
    <div class="perm-list" id="permList">
      ${PERM_KEYS.map(s => `
        <div class="perm-item ${perms.includes(s) ? 'on' : ''}" data-p="${s}" onclick="togglePerm(this)">
          <span class="pchk">${ICONS.check}</span>
          <span class="nic">${ICONS[s]}</span>${permLabel(s)}
        </div>`).join('')}
    </div>`;
  const foot = `
    <button class="btn btn--ghost" onclick="closeModal()">Bekor</button>
    <button class="btn btn--primary" onclick="saveAdmin(${a ? `'${a.id}'` : 'null'})">Saqlash</button>`;
  openModal(a ? 'Adminni tahrirlash' : 'Yangi admin', body, foot);
}
function togglePerm(el) { el.classList.toggle('on'); }
function saveAdmin(id) {
  const name = $('a-name').value.trim();
  const login = $('a-login').value.trim();
  const pass = $('a-pass').value;
  if (!login) { toast('Login kiriting', 'err'); return; }
  if (!pass) { toast('Parol kiriting', 'err'); return; }
  if (login.toLowerCase() === superAcc().login.toLowerCase()) { toast('Bu login band (bosh admin)', 'err'); return; }
  const dup = admins.find(x => x.login.toLowerCase() === login.toLowerCase() && x.id !== id);
  if (dup) { toast('Bu login allaqachon mavjud', 'err'); return; }
  const perms = [...document.querySelectorAll('#permList .perm-item.on')].map(el => el.dataset.p);
  if (!perms.length) { toast('Kamida bitta menyu belgilang', 'err'); return; }
  const obj = { name: name || login, login, pass, perms };
  if (id) { const i = admins.findIndex(x => x.id === id); if (i >= 0) admins[i] = Object.assign({}, admins[i], obj); }
  else { obj.id = 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1000); admins.push(obj); }
  cset('lume_admins', admins);
  closeModal(); drawAdmins(); toast('Saqlandi');
}
function delAdmin(id) {
  const a = admins.find(x => x.id === id); if (!a) return;
  if (!confirm(`"${a.name || a.login}" admini o'chirilsinmi?`)) return;
  admins = admins.filter(x => x.id !== id);
  cset('lume_admins', admins); drawAdmins(); toast('O\'chirildi');
}

/* ===== AUTH (kirish / chiqish) ===== */
const SESSION_KEY = 'lume_admin_session';
function resolveAdmin(login) {
  if (!login) return null;
  const sup = superAcc();
  if (login.toLowerCase() === sup.login.toLowerCase()) return sup;
  return admins.find(x => x.login.toLowerCase() === login.toLowerCase()) || null;
}
function tryLogin(login, pass) {
  login = (login || '').trim();
  const sup = superAcc();
  if (login.toLowerCase() === sup.login.toLowerCase()) return pass === sup.pass ? sup : null;
  const a = admins.find(x => x.login.toLowerCase() === login.toLowerCase());
  return (a && a.pass === pass) ? a : null;
}
function setSession(a) {
  currentAdmin = a;
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ login: a.login, ts: Date.now() })); } catch (e) { }
}
function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { }
  currentAdmin = null;
  document.body.classList.remove('authed');
  const p = $('loginPass'); if (p) p.value = '';
  const err = $('loginErr'); if (err) err.textContent = '';
}
function enterPanel() {
  document.body.classList.add('authed');
  // profil
  const pn = $('profName'); if (pn) pn.textContent = currentAdmin.name || currentAdmin.login;
  const pr = $('profRole'); if (pr) pr.textContent = isSuper() ? 'Bosh admin' : 'Admin';
  buildNav();
  nav(firstAllowed());
}
function restoreSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (s && s.login) { const a = resolveAdmin(s.login); if (a) { currentAdmin = a; return true; } }
  } catch (e) { }
  return false;
}

/* ===== BOOT ===== */
function loadData() {
  const ca = cget('lume_admins', null);
  admins = Array.isArray(ca) ? ca.filter(a => a && a.login && a.id) : [];
  const csup = cget('lume_super', null);
  superCfg = (csup && typeof csup === 'object') ? csup : {};
  const cbot = cget('lume_bot', null);
  if (cbot && typeof cbot === 'object') botCfg = Object.assign({ token: '', channel: '', username: '', enabled: false }, cbot);
  const cmeta = cget('lume_chat_meta', null);
  if (cmeta && typeof cmeta === 'object') chatMeta = Object.assign({ starred: [], archived: [] }, cmeta);
  if (!Array.isArray(chatMeta.starred)) chatMeta.starred = [];
  if (!Array.isArray(chatMeta.archived)) chatMeta.archived = [];
  const cp = cget('lume_products', null);
  if (Array.isArray(cp)) {
    products = cp.map((p, i) => Object.assign({ id: p.id || i + 1 }, p));
  } else {
    products = [];
  }
  const cc = cget('lume_categories', null);
  if (Array.isArray(cc)) {
    categories = cc.map((c, i) => Object.assign({ id: c.id || i + 1 }, c));
  } else {
    categories = DEFAULT_CATS.map(c => Object.assign({}, c));
  }
  orders = cget('lume_orders', []) || [];
  const carc = cget('lume_orders_archive', null);
  archivedOrders = Array.isArray(carc) ? carc : [];
  const cch = cget('lume_chat', []); chatMsgs = Array.isArray(cch) ? cch : [];
  const cb = cget('lume_banners', null);
  banners = Array.isArray(cb) ? cb.filter(b => b && b.img) : [];
  const cpr = cget('lume_promos', null);
  promos = Array.isArray(cpr) ? cpr.filter(x => x && x.id) : [];
  const cs = cget('lume_settings', null);
  if (cs && typeof cs === 'object') settings = Object.assign(settings, cs);
  const ccm = cget('lume_commissions', null);
  commissions = Array.isArray(ccm) ? ccm.filter(x => x && x.id && x.name) : [];
  const cexp = cget('lume_expenses', null);
  monthlyExpense = +cexp || 0;
  const cu = cget('lume_users', null);
  users = Array.isArray(cu) ? cu.filter(x => x && x.id) : [];
}

function fmtDate() {
  try {
    const d = new Date();
    const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    return d.getDate() + '-' + months[d.getMonth()] + ', ' + d.getFullYear();
  } catch (e) { return ''; }
}

(async () => {
  // theme
  try { const th = localStorage.getItem('lume_admin_theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) { }
  syncTheme();
  $('themeBtn').onclick = flip;
  // Mobil menyu (drawer) — burger ochadi/yopadi, orqa fon bosilsa yopiladi.
  function toggleDrawer(open) {
    const sb = $('sidebar'), sc = $('sidebarScrim');
    const willOpen = open === undefined ? !sb.classList.contains('open') : open;
    sb.classList.toggle('open', willOpen);
    if (sc) sc.classList.toggle('show', willOpen);
  }
  $('burger').onclick = () => toggleDrawer();
  const _scrim = $('sidebarScrim');
  if (_scrim) _scrim.onclick = () => toggleDrawer(false);
  const td = $('topDate'); if (td) td.textContent = fmtDate();

  buildNav();

  // client id
  const _urlClient = new URLSearchParams(location.search).get('client');
  if (_urlClient) { try { localStorage.setItem('lume_last_client', _urlClient) } catch (e) { } }
  const CLIENT_ID = _urlClient
    || (function () { try { return JSON.parse(localStorage.getItem('bo_session') || '{}').clientId } catch (e) { return null } })()
    || (function () { try { return localStorage.getItem('lume_last_client') } catch (e) { return null } })()
    || STORE_CLIENT;
  window.__LUME_CLIENT = CLIENT_ID;

  try { await Cloud.init('lume', CLIENT_ID) } catch (e) { console.error('[admin] Cloud.init:', e) }

  // sinxron holati
  const pill = $('modePill');
  if (window.Cloud && Cloud.mode === 'cloud') {
    if (pill) { pill.style.display = ''; pill.textContent = '● Sinxron (bulut)'; pill.classList.add('cloud'); }
    const sn = $('syncNote'); if (sn) sn.textContent = 'Ma\'lumotlar serverda saqlanadi va barcha qurilmalarda ko\'rinadi.';
  } else {
    if (pill) { pill.style.display = ''; pill.textContent = '○ Faqat shu qurilma'; }
    const sn = $('syncNote'); if (sn) sn.textContent = 'Bulut sozlanmagan — ma\'lumotlar faqat shu brauzerda saqlanadi.';
  }

  loadData();
  setupQr();

  // Kirish formasi
  $('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const a = tryLogin($('loginUser').value, $('loginPass').value);
    if (!a) { $('loginErr').textContent = 'Login yoki parol xato'; return; }
    $('loginErr').textContent = '';
    setSession(a);
    enterPanel();
    toast('Xush kelibsiz, ' + (a.name || a.login));
  });
  $('logoutBtn').onclick = () => { logout(); };

  // Saqlangan sessiya bo'lsa — to'g'ridan-to'g'ri panelga kiramiz
  if (restoreSession()) { enterPanel(); }
  else { const u = $('loginUser'); if (u) u.focus(); }

  window.addEventListener('cloud:updated', () => {
    loadData();
    if (!currentAdmin) return;                 // hali kirmagan — panelni ochmaymiz
    currentAdmin = resolveAdmin(currentAdmin.login) || currentAdmin; // ruxsatlar yangilangan bo'lishi mumkin
    if (!currentAdmin) { logout(); return; }   // admin o'chirilgan bo'lsa — chiqaramiz
    buildNav();
    const cur = document.querySelector('.nav-item.is-active');
    nav(cur ? cur.dataset.s : firstAllowed());
  });
})();

// global (onclick uchun)
Object.assign(window, {
  nav, drawStats, setStatsPeriod, addCommission, delCommission, saveExpenses,
  openProd, saveProd, delProd, refreshPrev, setFit, onImg, removeImgAt, makeMainImg, renderProdImgs,
  openCat, saveCat, delCat, onCatImg, onCatImgR, removeCatImg, removeCatImgR, setCatFit, setCatFitR, refreshCatPrev, refreshCatPrevR,
  onBannerFiles, moveBanner, delBanner, setStatus, delOrder, clearOrders, refreshOrders, openOrder, downloadReceipt,
  drawPromos, openPromo, setPromoStyle, togglePromoProd, savePromo, delPromo, movePromo,
  setOrdFilter, drawArxiv, restoreOrder, delArxiv, clearArxiv,
  drawChat, sendAdminChat, refreshChat, setChatFilter, selectConv, backChat, toggleStar, toggleArchive, saveSettings, saveSuper, flip, closeModal,
  drawUsers, userInfo, messageUser, delUser,
  openAdmin, saveAdmin, delAdmin, togglePerm, logout,
  drawBot, botSaveTest, botTestOrder, botDisconnect
});
