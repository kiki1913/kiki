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
const SUPABASE_URL = "https://ctakvioxteagcwjlclnu.supabase.co";   // masalan: https://abcdefgh.supabase.co
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0YWt2aW94dGVhZ2N3amxjbG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2ODU1OTEsImV4cCI6MjA5NzI2MTU5MX0.fm8tVEvnWuvA6D2F9I7JqDvqDKgtalbKctqXSVHsCUQ";       // "anon public" kaliti (brauzerda ochiq turishi normal)

window.Cloud = (function () {
  // Sozlangan-sozlanmaganini aniqlaymiz. Placeholder yoki supabase kutubxonasi
  // yo'q bo'lsa — localStorage rejimiga o'tamiz (ilova baribir ishlaydi).
  const configured =
    typeof supabase !== "undefined" &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co/i.test(SUPABASE_URL) &&
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
          .then(({ error }) => { if (error) console.error("[Cloud] set:", error); });
      }
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
  };
})();
