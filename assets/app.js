
const PH = {
  props: [],
  currentPage: 1,
  perPage: 12,

  params() { return new URLSearchParams(location.search); },

  async load() {
    if (this.props.length) return this.props;
    if (window.PH_PROPERTIES && Array.isArray(window.PH_PROPERTIES)) {
      this.props = window.PH_PROPERTIES;
      return this.props;
    }
    try {
      const res = await fetch("data/properties.json");
      this.props = await res.json();
      return this.props;
    } catch (err) {
      console.error("Cannot load property data", err);
      this.props = [];
      return this.props;
    }
  },

  storage(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  },

  setStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  toggleList(key, id) {
    const list = this.storage(key);
    const i = list.indexOf(id);
    if (i >= 0) {
      list.splice(i, 1);
    } else {
      if (key === "ph_compare" && list.length >= 5) {
        alert("เลือกเปรียบเทียบได้สูงสุด 5 รายการ");
        return false;
      }
      list.push(id);
    }
    this.setStorage(key, list);
    this.updateCounters();
    return list.includes(id);
  },

  updateCounters() {
    document.querySelectorAll("[data-count='favorites']").forEach(el => el.textContent = this.storage("ph_favorites").length);
    document.querySelectorAll("[data-count='compare']").forEach(el => el.textContent = this.storage("ph_compare").length);
  },

  normalize(s) {
    return String(s || "").toLowerCase().trim();
  },

  filterData(list, extra = {}) {
    const form = document.getElementById("filterForm");
    const url = this.params();

    const get = (name) => {
      const el = form?.querySelector(`[name="${name}"]`);
      return el ? el.value : (url.get(name) || "");
    };

    const q = this.normalize(get("q") || extra.q);
    const type = get("type") || extra.type || "";
    const market = get("market") || extra.market || "";
    const zone = get("zone") || extra.zone || "";
    const maxPrice = Number(get("max_price") || extra.max_price || 0);
    const bedroom = Number(get("bedroom") || extra.bedroom || 0);
    const status = get("status") || extra.status || "";

    return list.filter(p => {
      const hay = this.normalize(`${p.id} ${p.title} ${p.typeText} ${p.marketText} ${p.status} ${p.location} ${p.province} ${p.zone} ${p.transit} ${p.priceText}`);
      return (!q || hay.includes(q))
        && (!type || p.type === type)
        && (!market || p.market === market)
        && (!zone || p.zone === zone)
        && (!status || p.status.includes(status))
        && (!maxPrice || p.price <= maxPrice)
        && (!bedroom || Number(p.bed || 0) >= bedroom);
    });
  },

  card(p) {
    return `
    <article class="property-card">
      <a class="property-image" style="background-image:linear-gradient(135deg,rgba(11,76,111,.12),rgba(215,155,52,.10)),url('${p.image}')" href="property.html?id=${encodeURIComponent(p.id)}" aria-label="${p.title}">
        <div class="badge-row">
          <span class="badge ${p.badge || ""}">${p.status}</span>
          <button class="badge" type="button" data-fav="${p.id}" aria-label="เพิ่มรายการโปรด">♡</button>
        </div>
      </a>
      <div class="property-body">
        <div class="price">${p.priceText}</div>
        <h3><a href="property.html?id=${encodeURIComponent(p.id)}">${p.title}</a></h3>
        <div class="location">${p.location}, ${p.province} • ${p.transit}</div>
        <div class="features">
          <div class="feature"><b>${p.bed || "-"}</b>นอน</div>
          <div class="feature"><b>${p.bath || "-"}</b>น้ำ</div>
          <div class="feature"><b>${p.usable || "-"}</b>ตร.ม.</div>
          <div class="feature"><b>${p.area || "-"}</b>ตร.ว.</div>
        </div>
        <div class="property-actions">
          <a class="btn btn-primary" href="property.html?id=${encodeURIComponent(p.id)}">ดูรายละเอียด</a>
          <button class="btn btn-ghost" type="button" data-compare="${p.id}">เปรียบเทียบ</button>
        </div>
      </div>
    </article>`;
  },

  bindButtons() {
    document.querySelectorAll("[data-fav]").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const active = PH.toggleList("ph_favorites", btn.dataset.fav);
        btn.textContent = active ? "♥" : "♡";
      };
      if (PH.storage("ph_favorites").includes(btn.dataset.fav)) btn.textContent = "♥";
    });

    document.querySelectorAll("[data-compare]").forEach(btn => {
      btn.onclick = () => {
        const active = PH.toggleList("ph_compare", btn.dataset.compare);
        btn.textContent = active ? "เอาออก" : "เปรียบเทียบ";
      };
      if (PH.storage("ph_compare").includes(btn.dataset.compare)) btn.textContent = "เอาออก";
    });
  },

  renderPagination(total, targetId, extra) {
    const pager = document.getElementById("pagination");
    if (!pager) return;
    const pages = Math.max(1, Math.ceil(total / this.perPage));
    if (pages <= 1) {
      pager.innerHTML = "";
      return;
    }
    let html = "";
    for (let i = 1; i <= pages; i++) {
      html += `<button type="button" class="${i === this.currentPage ? "active" : ""}" data-page-no="${i}">${i}</button>`;
    }
    pager.innerHTML = html;
    pager.querySelectorAll("[data-page-no]").forEach(btn => {
      btn.onclick = () => {
        PH.currentPage = Number(btn.dataset.pageNo);
        PH.renderListings(targetId, extra);
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    });
  },

  async renderListings(targetId = "propertyList", extra = {}, options = {}) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const data = await this.load();
    let list = this.filterData(data, extra);

    const sort = document.querySelector("[name='sort']")?.value || this.params().get("sort") || "";
    if (sort === "price-asc") list.sort((a,b) => a.price - b.price);
    if (sort === "price-desc") list.sort((a,b) => b.price - a.price);
    if (sort === "newest") list.sort((a,b) => b.id.localeCompare(a.id));

    const total = list.length;
    const count = document.getElementById("resultCount");
    if (count) count.textContent = `${total} รายการ`;

    if (options.limit) {
      list = list.slice(0, options.limit);
    } else if (options.paginate !== false) {
      const start = (this.currentPage - 1) * this.perPage;
      list = list.slice(start, start + this.perPage);
      this.renderPagination(total, targetId, extra);
    }

    target.innerHTML = list.length
      ? list.map(p => this.card(p)).join("")
      : `<div class="empty">ไม่พบทรัพย์ที่ตรงกับเงื่อนไข กรุณาลองเปลี่ยนทำเล ประเภททรัพย์ หรือช่วงราคา</div>`;
    this.bindButtons();
  },

  bindFilters(extra = {}) {
    const form = document.getElementById("filterForm");
    if (!form) return;
    const url = this.params();

    [...form.elements].forEach(el => {
      if (!el.name) return;
      const v = url.get(el.name);
      if (v !== null) el.value = v;
      el.addEventListener("input", () => { PH.currentPage = 1; PH.renderListings("propertyList", extra); });
      el.addEventListener("change", () => { PH.currentPage = 1; PH.renderListings("propertyList", extra); });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      PH.currentPage = 1;
      PH.renderListings("propertyList", extra);
    });

    const reset = document.getElementById("resetFilters");
    if (reset) reset.onclick = () => {
      form.reset();
      history.replaceState(null, "", location.pathname);
      PH.currentPage = 1;
      PH.renderListings("propertyList", extra);
    };
  },

  async renderDetail() {
    const el = document.getElementById("propertyDetail");
    if (!el) return;
    const id = this.params().get("id") || "p001";
    const data = await this.load();
    const p = data.find(x => x.id === id) || data[0];
    document.title = `${p.title} | Perfect House`;

    const related = data.filter(x => x.id !== p.id && (x.zone === p.zone || x.type === p.type || x.market === p.market)).slice(0, 6);

    el.innerHTML = `
      <section class="page-hero">
        <div class="container">
          <span class="eyebrow">${p.marketText} • ${p.typeText} • ${p.status}</span>
          <h1>${p.title}</h1>
          <p>${p.location}, ${p.province} • ${p.transit}</p>
        </div>
      </section>

      <section>
        <div class="container detail-grid">
          <div>
            <div class="detail-photo" style="background-image:linear-gradient(135deg,rgba(11,76,111,.12),rgba(215,155,52,.10)),url('${p.image}')"></div>
            <div class="seo-content" style="margin-top:22px">
              <h2>รายละเอียดทรัพย์</h2>
              <p>${p.description}</p>
              <div class="features">
                <div class="feature"><b>${p.bed || "-"}</b>ห้องนอน</div>
                <div class="feature"><b>${p.bath || "-"}</b>ห้องน้ำ</div>
                <div class="feature"><b>${p.parking || "-"}</b>ที่จอดรถ</div>
                <div class="feature"><b>${p.usable || "-"}</b>ตร.ม.</div>
              </div>
              <h2 style="margin-top:24px">สถานที่ใกล้เคียง</h2>
              <div class="value-list">${p.nearby.map(n => `<div class="value-item"><strong>${n}</strong><span>เดินทางสะดวกจากตัวบ้าน</span></div>`).join("")}</div>
            </div>
          </div>

          <aside class="content-card">
            <div class="price">${p.priceText}</div>
            <div class="contact-list">
              <div class="contact-item"><div class="symbol">🏠</div><div><b>ประเภท</b><span>${p.typeText}</span></div></div>
              <div class="contact-item"><div class="symbol">📍</div><div><b>ทำเล</b><span>${p.location}, ${p.province}</span></div></div>
              <div class="contact-item"><div class="symbol">📐</div><div><b>พื้นที่</b><span>${p.area || "-"} ตร.ว. / ${p.usable || "-"} ตร.ม.</span></div></div>
              <div class="contact-item"><div class="symbol">🚆</div><div><b>การเดินทาง</b><span>${p.transit}</span></div></div>
            </div>
            <a class="btn btn-primary btn-block" style="margin-top:16px" href="contact.html?property=${encodeURIComponent(p.id)}">นัดชมทรัพย์</a>
            <a class="btn btn-ghost btn-block" style="margin-top:10px" href="tel:0000000000">โทรสอบถาม</a>
            <button class="btn btn-ghost btn-block" style="margin-top:10px" data-fav="${p.id}">♡ เพิ่มรายการโปรด</button>
            <button class="btn btn-ghost btn-block" style="margin-top:10px" data-compare="${p.id}">เปรียบเทียบ</button>
          </aside>
        </div>
      </section>

      <section class="soft-section">
        <div class="container">
          <div class="section-head"><div><h2>ทรัพย์ใกล้เคียงที่น่าสนใจ</h2><p>บ้านและทรัพย์ในทำเลหรือประเภทใกล้เคียงที่คุณอาจสนใจ</p></div><a class="btn btn-ghost" href="properties.html?zone=${p.zone}">ดูทำเลนี้ทั้งหมด</a></div>
          <div class="property-grid">${related.map(x => this.card(x)).join("")}</div>
        </div>
      </section>`;
    this.bindButtons();
  },

  async renderSaved(key, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const ids = this.storage(key);
    const data = await this.load();
    const list = data.filter(p => ids.includes(p.id));
    target.innerHTML = list.length ? list.map(p => this.card(p)).join("") : `<div class="empty">ยังไม่มีรายการที่เลือกไว้</div>`;
    this.bindButtons();
  },

  bindForms() {
    document.querySelectorAll("[data-lead-form]").forEach(form => {
      form.addEventListener("submit", e => {
        e.preventDefault();
        const notice = form.querySelector(".notice") || document.querySelector(form.dataset.notice || "");
        if (notice) {
          notice.classList.add("show");
          notice.textContent = "ขอบคุณสำหรับข้อมูล ทีมงาน Perfect House จะติดต่อกลับโดยเร็วที่สุด";
        }
        form.reset();
      });
    });
  }
};


function initMobileMenu(){
  const toggle = document.querySelector(".mobile-toggle");
  const menu = document.querySelector(".menu");
  if(!toggle || !menu || document.querySelector(".mobile-drawer")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "mobile-backdrop";

  const drawer = document.createElement("aside");
  drawer.className = "mobile-drawer";
  drawer.setAttribute("aria-label", "เมนูมือถือ");

  const brand = document.querySelector(".logo")?.innerHTML || "Perfect House";
  drawer.innerHTML = `
    <div class="mobile-drawer-head">
      <div class="logo">${brand}</div>
      <button class="mobile-drawer-close" type="button" aria-label="ปิดเมนู">×</button>
    </div>
    <nav>${Array.from(menu.querySelectorAll("a")).map(a => `<a href="${a.getAttribute("href")}" class="${a.className || ""}">${a.textContent.trim()} <span>›</span></a>`).join("")}</nav>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  const close = () => document.body.classList.remove("mobile-menu-open");
  const open = () => document.body.classList.add("mobile-menu-open");

  toggle.addEventListener("click", open);
  backdrop.addEventListener("click", close);
  drawer.querySelector(".mobile-drawer-close").addEventListener("click", close);
  drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") close();
  });
}


document.addEventListener("DOMContentLoaded", async () => {
  initMobileMenu();
  PH.updateCounters();
  PH.bindForms();

  const page = document.body.dataset.page;
  const extra = {
    "new-house": { market: "new-house" },
    "second-hand": { market: "second-hand" },
    "renovated": { status: "รีโนเวท" },
    "single-house": { type: "single-house" },
    "townhome": { type: "townhome" },
    "condo": { type: "condo" },
    "land": { type: "land" }
  }[page] || {};

  if (["properties","new-house","second-hand","renovated","single-house","townhome","condo","land"].includes(page)) {
    PH.bindFilters(extra);
    await PH.renderListings("propertyList", extra);
  }

  if (page === "home") {
    await PH.renderListings("featuredList", {}, { limit: 12, paginate: false });
    await PH.renderListings("newHomeList", { market: "new-house" }, { limit: 6, paginate: false });
    await PH.renderListings("secondHomeList", { market: "second-hand" }, { limit: 6, paginate: false });
    await PH.renderListings("renovatedHomeList", { status: "รีโนเวท" }, { limit: 6, paginate: false });
  }

  if (page === "locations" || page === "budget") {
    PH.bindFilters({});
    await PH.renderListings("propertyList", {});
  }

  if (page === "property") await PH.renderDetail();
  if (page === "favorites") await PH.renderSaved("ph_favorites", "savedList");
  if (page === "compare") await PH.renderSaved("ph_compare", "savedList");
});
