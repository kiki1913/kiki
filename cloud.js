/* ============================================================
   cloud.js — Supabase KV (kalit-qiymat) qatlami
   localStorage o'rnini bosadi, ammo ma'lumot SERVERDA saqlanadi
   va barcha qurilmalarda ko'rinadi.

   ISHLASH:
   - Ilova boshida BIR MARTA `await Cloud.init(app, client)` chaqiriladi:
     serverdagi shu (app, client) ma'lumotini yuklab xotirada keshlaydi.
   - Cloud.get(key)  — SINXRON (keshdan o'qiydi)
   - Cloud.set(key,v) — keshni yangilab, fonda serverga yozadi
   - Cloud.remove(key)

   SOZLAMA: pastdagi ikki qiymatni Supabase loyihangizdan to'ldiring
   (Settings → API). To'ldirilmasa — ilova localStorage rejimida ishlayveradi
   (faqat o'sha qurilmada; server sinxronizatsiyasi bo'lmaydi).
   ============================================================ */

// >>> Supabase Settings → API dan oling <<<
const SUPABASE_URL = "https://kikiapp.uz";   // KIKI o'z serveri (Uztelecom)
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MzA3MjAwLCJleHAiOjIxMDM2NjcyMDB9.WFI2O4v_7uJ2MsadVgl2PlI-42y-SQfTf_rQ6ZcjweI";

window.Cloud = (function () {
  // Sozlangan-sozlanmaganini aniqlaymiz. Placeholder yoki supabase kutubxonasi
  // yo'q bo'lsa — localStorage rejimiga o'tamiz (ilova baribir ishlaydi).
  const configured =
    typeof supabase !== "undefined" &&
    /^https:\/\//i.test(SUPABASE_URL) &&
    typeof SUPABASE_KEY === "string" && SUPABASE_KEY.length > 30;

  let _sb = null;
  if (configured) {
    try { _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
    catch (e) { console.error("[Cloud] createClient:", e); }
  }

  return {
    app: "app",
    client: "demo",
    mode: _sb ? "cloud" : "local",   // 'cloud' = Supabase; 'local' = localStorage fallback
    _cache: {},
    _dirty: {},   // shu sessiyada foydalanuvchi yozgan qiymatlar — kech kelgan server javobi ularni bosib ketmasin

    _lsKey(key) { return "cloud__" + this.app + "__" + this.client + "__" + key; },

    // Ilova boshida BIR MARTA chaqiriladi (await bilan).
    async init(app, client) {
      this.app = app || "app";
      this.client = client || "demo";
      this._cache = {};
      this._dirty = {};
      if (this.mode !== "cloud") {
        if (!_sb) console.warn("[Cloud] Supabase sozlanmagan — localStorage rejimida ishlayapti.");
        return;
      }
      // Supabase so'rovi (thenable — Promise.race chaqirilganda ishga tushadi)
      const query = _sb
        .from("app_state").select("key,value")
        .eq("app", this.app).eq("client_id", this.client);
      try {
        // MUHIM: tarmoq sekin yoki uzilgan bo'lsa sahifa QOTIB qolmasin. So'rovni qisqa
        // timeout bilan poygaga qo'yamiz — javob kelmasa localStorage rejimiga o'tib davom etamiz.
        // (Oldin 6000ms edi — sahifa har ochilishda sezilarli "qotib qolish" hissi berardi.)
        const timeout = new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), 2500));
        const res = await Promise.race([query, timeout]);
        if (res && res.__timeout) {
          console.warn("[Cloud] init: server 2.5s ichida javob bermadi — localStorage rejimida davom etamiz.");
          this.mode = "local";
          // MUHIM: so'rovni tashlab yubormaymiz. QR skaner qilgan YANGI mijoz qurilmasida
          // hali hech qanday keshlangan ma'lumot yo'q — server sekin javob bersa (2.5s dan
          // ko'p), haqiqiy katalog butunlay yo'qolib, do'kon doim bo'sh ko'rinardi. Endi kech
          // kelgan javobni ham qo'llab, "cloud:updated" orqali sahifani yangilaymiz.
          query.then(({ data, error }) => {
            if (error || !data) return;
            const merged = {};
            data.forEach((r) => { merged[r.key] = r.value; });
            // Foydalanuvchi shu sessiyada yozgan qiymatlar ustun turadi (o'chirilgan/qo'shilgan tiklanmasin)
            Object.keys(this._dirty).forEach((k) => { merged[k] = this._dirty[k]; });
            this._cache = merged;
            this.mode = "cloud";
            try { window.dispatchEvent(new CustomEvent("cloud:updated")); } catch (e2) {}
          }).catch((e2) => console.error("[Cloud] init (late):", e2));
          return;
        }
        const { data, error } = res;
        if (error) { console.error("[Cloud] init:", error); this.mode = "local"; return; }
        (data || []).forEach((r) => { this._cache[r.key] = r.value; });
      } catch (e) {
        console.error("[Cloud] init (network):", e);
        this.mode = "local";   // server ulanmasa — localStorage'ga qaytamiz
      }
    },

    // Serverdan barcha kalitlarni qayta yuklaydi va _cache ni yangilaydi.
    // init()dan FARQI: _dirty ni TOZALAMAYDI — shu sessiyada yozilgan, ammo server
    // hali TASDIQLAMAGAN qiymatlar ustun qoladi (set() server javobidan keyin _dirty'ni
    // tozalaydi, shuning uchun bu yerda faqat haqiqatan kutilayotgan yozuvlar qoladi).
    // "refresh → merge → write" naqshi uchun ishlatiladi: yozishdan oldin serverdagi
    // eng yangi ro'yxatni (boshqa mijoz/qurilma qo'shgan yozuvlar bilan) olish uchun.
    // Qaytaradi: muvaffaqiyatda true, aks holda false.
    async refresh() {
      if (!_sb) return false; // localStorage rejimi — server yo'q
      try {
        const { data, error } = await _sb
          .from("app_state").select("key,value")
          .eq("app", this.app).eq("client_id", this.client);
        if (error) { console.error("[Cloud] refresh:", error); return false; }
        const merged = {};
        (data || []).forEach((r) => { merged[r.key] = r.value; });
        // Hali serverga yetib bormagan (tasdiqlanmagan) yozuvlar ustun turadi.
        Object.keys(this._dirty).forEach((k) => { merged[k] = this._dirty[k]; });
        this._cache = merged;
        this.mode = "cloud";
        return true;
      } catch (e) {
        console.error("[Cloud] refresh (network):", e);
        return false;
      }
    },

    // SINXRON o'qish (localStorage.getItem o'rnida)
    get(key, fallback = null) {
      if (this.mode === "cloud") {
        return (key in this._cache) ? this._cache[key] : fallback;
      }
      try {
        const v = localStorage.getItem(this._lsKey(key));
        return v !== null ? JSON.parse(v) : fallback;
      } catch (e) { return fallback; }
    },

    // Yozish (localStorage.setItem o'rnida) — keshni yangilab, HAR DOIM serverga ham yuboradi.
    // MUHIM: Supabase sozlangan bo'lsa (_sb bor), init sekin bo'lib "local" rejimga o'tgan
    // bo'lsa ham yozuvni serverga yuboramiz — aks holda qo'shilgan rasm / o'chirish yo'qolib qolardi.
    set(key, value) {
      this._cache[key] = value;
      this._dirty[key] = value;
      try { localStorage.setItem(this._lsKey(key), JSON.stringify(value)); }
      catch (e) { console.warn("[Cloud] set (local):", e); }
      if (_sb) {
        _sb.from("app_state")
          .upsert(
            { app: this.app, client_id: this.client, key, value, updated_at: new Date().toISOString() },
            { onConflict: "app,client_id,key" }
          )
          .then(({ error }) => {
            if (error) { console.error("[Cloud] set:", error); return; }
            // Server tasdiqladi — bu kalitni _dirty'dan olib tashlaymiz, shunda keyingi
            // refresh() serverdagi (boshqalar ham yozgan) eng yangi qiymatni oladi.
            if (this._dirty[key] === value) delete this._dirty[key];
          });
      }
    },

    // ---- DO'KON BO'YICHA UMUMIY (shared) sozlamalar ----
    // Bot kabi sozlamalar sessiya client_id'sidan QAT'I NAZAR bitta joyda (kanonik
    // do'kon client'i ostida) saqlanadi — shunda BARCHA adminlar va mobil ilova
    // AYNAN bir xil qiymatni o'qiydi. (Aks holda har admin/qurilma o'z partitiyasiga
    // yozib, boshqalar ko'rmay qolardi.)
    _sharedClient() {
      return (typeof STORE_CLIENT !== "undefined" && STORE_CLIENT) ? STORE_CLIENT : "CL-MT9YR2SB2ZLJ";
    },
    async getShared(key, fallback = null) {
      if (!_sb) return fallback;
      try {
        const { data, error } = await _sb.from("app_state").select("value")
          .eq("app", this.app).eq("client_id", this._sharedClient()).eq("key", key)
          .maybeSingle();
        if (error) { console.error("[Cloud] getShared:", error); return fallback; }
        return (data && data.value != null) ? data.value : fallback;
      } catch (e) { console.error("[Cloud] getShared(net):", e); return fallback; }
    },
    async setShared(key, value) {
      if (!_sb) throw new Error("Supabase sozlanmagan");
      const { error } = await _sb.from("app_state").upsert(
        { app: this.app, client_id: this._sharedClient(), key, value, updated_at: new Date().toISOString() },
        { onConflict: "app,client_id,key" }
      );
      if (error) throw error;
      return true;
    },

    // O'chirish (localStorage.removeItem o'rnida) — HAR DOIM serverdan ham o'chiradi
    remove(key) {
      delete this._cache[key];
      delete this._dirty[key];
      try { localStorage.removeItem(this._lsKey(key)); } catch (e) {}
      if (_sb) {
        _sb.from("app_state").delete()
          .eq("app", this.app).eq("client_id", this.client).eq("key", key)
          .then(({ error }) => { if (error) console.error("[Cloud] remove:", error); });
      }
    },

    // Push bildirishnoma yuborish — `notifications` jadvaliga INSERT qiladi.
    // Worker (VPS) buni LISTEN/NOTIFY orqali ushlab, BARCHA qurilmalarga push
    // yuboradi (target_user_id = NULL => broadcast). Bu "admin bilan chat"dan
    // MUTLAQO alohida — chat lume_chat KV'da qoladi.
    async sendNotification(title, body, { imageUrl = null, productIds = [] } = {}) {
      if (!_sb) throw new Error("Supabase sozlanmagan — bildirishnoma yuborib bo'lmaydi");
      const { error } = await _sb.from("notifications").insert({
        title: title,
        body: body || "",
        type: "admin_broadcast",
        target_user_id: null,   // NULL = barcha foydalanuvchilarga
        image_url: imageUrl || null,
        product_ids: (productIds && productIds.length) ? productIds : null,
      });
      if (error) throw error;
      return true;
    },

    // Yuborilgan admin bildirishnomalari tarixi (yangi birinchi).
    async listNotifications(limit = 20) {
      if (!_sb) return [];
      const { data, error } = await _sb
        .from("notifications")
        .select("id,title,body,type,created_at,processed,image_url,product_ids")
        .in("type", ["admin_broadcast", "broadcast"])
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) { console.error("[Cloud] listNotifications:", error); return []; }
      return data || [];
    },
  };
})();
