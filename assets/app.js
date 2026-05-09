














function phDecodeMapUrl(url) {
  try { return decodeURIComponent(String(url || "")); }
  catch (err) { return String(url || ""); }
}

function phExtractLatLngFromMapUrl(url) {
  const decoded = phDecodeMapUrl(url);
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|\/|\?|$)/i,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
    /[?&](?:q|ll|center|query)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i
  ];
  for (const re of patterns) {
    const m = decoded.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  return null;
}

function phExtractMapPlaceText(url) {
  const decoded = phDecodeMapUrl(url);
  const byPlace = decoded.match(/\/maps\/place\/([^\/@?]+)/i);
  if (byPlace) return byPlace[1].replace(/\+/g, " ").trim();
  const byQuery = decoded.match(/[?&](?:q|query)=([^&]+)/i);
  if (byQuery) return byQuery[1].replace(/\+/g, " ").trim();
  return "";
}

function phBuildMapQuery(p) {
  const parts = [p?.mapEmbedQuery, p?.address, p?.location, p?.project, p?.title, p?.zoneText, p?.province].filter(Boolean);
  const unique = [];
  for (const item of parts) {
    const text = String(item).replace(/[#💸📍🏠🛏🛋️🧭📝⛳️🏢📲⚡️⭐️*]+/g, " ").replace(/\s+/g, " ").trim();
    if (text && !unique.includes(text)) unique.push(text);
  }
  return unique.slice(0, 4).join(" ");
}

function phMapEmbedUrl(p) {
  if (!p || !p.mapUrl) return "";
  if (p.mapLat && p.mapLng) {
    const zoom = p.mapZoom || 17;
    return `https://www.google.com/maps?q=${encodeURIComponent(`${p.mapLat},${p.mapLng}`)}&z=${zoom}&output=embed`;
  }
  const refUrl = p.mapResolvedUrl || p.mapUrl;
  const coords = phExtractLatLngFromMapUrl(refUrl);
  if (coords) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${coords.lat},${coords.lng}`)}&z=17&output=embed`;
  }
  if (String(refUrl).includes("google.com/maps/embed")) return refUrl;
  if (String(refUrl).includes("maps.google.com")) {
    const sep = refUrl.includes("?") ? "&" : "?";
    return refUrl + sep + "output=embed";
  }
  const placeText = phExtractMapPlaceText(refUrl);
  const query = p.mapEmbedQuery || placeText || phBuildMapQuery(p) || p.mapUrl;
  return "https://www.google.com/maps?q=" + encodeURIComponent(query) + "&output=embed";
}

function phMapFrameOnly(p) {
  if (!p || !p.mapUrl) return "";
  return `
    <div class="map-frame-only-section">
      <h2>แผนที่บ้าน</h2>
      <div class="map-frame-only-wrap">
        <iframe src="${phMapEmbedUrl(p)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen title="แผนที่บ้าน"></iframe>
      </div>
    </div>`;
}

function phMapSideButton(p) {
  if (!p || !p.mapUrl) return "";
  return `<a class="btn btn-ghost btn-block" style="margin-top:10px" href="${p.mapUrl}" target="_blank" rel="noopener">📍 เปิด Google Maps</a>`;
}


function phLineQrCard() {
  return `
    <div class="line-qr-card">
      <div>
        <b>ติดต่อผ่าน LINE</b>
        <span>สแกน QR Code เพื่อสอบถามหรือนัดชมบ้าน</span>
      </div>
      <img src="assets/images/line-qr.png" alt="QR Code ติดต่อ LINE Perfect House" loading="lazy">
    </div>
  `;
}


function phSetMeta(name, content, attr = "name") {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
function phSetCanonical(url) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}
function phSiteUrl(path = "") {
  const base = "https://mrekarat40.github.io/PerfectHouse/";
  return new URL(path, base).href;
}

const PH = {
  props: [],
  currentPage: 1,
  perPage: 12,
  params(){ return new URLSearchParams(location.search); },
  async load(){
    if(this.props.length) return this.props;
    if(window.PH_PROPERTIES){ this.props = window.PH_PROPERTIES; return this.props; }
    const res = await fetch("data/properties.json");
    this.props = await res.json();
    return this.props;
  },
  storage(k){ try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return[]} },
  setStorage(k,v){ localStorage.setItem(k, JSON.stringify(v)); },
  toggleList(k,id){
    const list=this.storage(k); const i=list.indexOf(id);
    if(i>=0) list.splice(i,1);
    else { if(k==="ph_compare" && list.length>=5){alert("เลือกเปรียบเทียบได้สูงสุด 5 รายการ"); return false;} list.push(id); }
    this.setStorage(k,list); this.updateCounters(); return list.includes(id);
  },
  updateCounters(){
    document.querySelectorAll("[data-count='favorites']").forEach(e=>e.textContent=this.storage("ph_favorites").length);
    document.querySelectorAll("[data-count='compare']").forEach(e=>e.textContent=this.storage("ph_compare").length);
  },
  money(n){ return Number(n||0).toLocaleString("th-TH"); },
  houseImageById(id) {
    const text = String(id || "");
    const match = text.match(/\d+/);
    const n = match ? Number(match[0]) : 1;
    const index = ((n - 1) % 100) + 1;
    return `assets/images/house-${String(index).padStart(3, "0")}.png`;
  },
  img(src, id) {
    if (src && String(src).trim()) return src;
    return this.houseImageById(id);
  },
  safe(s){ return String(s||"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); },
  normalize(s){ return String(s||"").toLowerCase().replace(/\s+/g," ").trim(); },
  filterData(list, extra={}){
    const form=document.getElementById("filterForm"); const url=this.params();
    const get=(n)=>{const el=form?.querySelector(`[name="${n}"]`); return el?el.value:(url.get(n)||"");};

    const q=this.normalize(get("q") || extra.q || "");
    const type=get("type") || extra.type || "";
    const category=get("category") || extra.category || "";
    const zone=get("zone") || extra.zone || "";
    const province=get("province") || extra.province || "";
    const max=Number(get("max_price") || extra.max_price || 0);
    const min=Number(get("min_price") || extra.min_price || 0);
    const bed=Number(get("bedroom") || extra.bedroom || 0);

    const zoneAliases = {
      bangkruai: ["bangkruai", "บางกรวย", "นครอินทร์", "บางบำหรุ", "วัดชลอ", "ปลายบาง", "มหาสวัสดิ์"],
      bangyai: ["bangyai", "บางใหญ่", "เวสต์เกต", "คลองบางไผ่", "เสาธงหิน"],
      bangbuathong: ["bangbuathong", "บางบัวทอง", "บ้านกล้วย", "พิมลราช", "บางรักพัฒนา"],
      sainoi: ["sainoi", "ไทรน้อย", "ลาดปลาดุก"],
      pakkret: ["pakkret", "ปากเกร็ด", "แจ้งวัฒนะ", "เมืองทอง", "ติวานนท์"],
      "mueang-nonthaburi": ["mueang-nonthaburi", "เมืองนนทบุรี", "สนามบินน้ำ", "งามวงศ์วาน"],
      rattanathibet: ["rattanathibet", "รัตนาธิเบศร์", "ท่าอิฐ", "ไทรม้า"],
      rama2: ["rama2", "พระราม2", "พระราม 2", "ท่าข้าม", "บางขุนเทียน"],
      phetkasem: ["phetkasem", "เพชรเกษม", "หนองแขม", "บางแค"],
      pathumthani: ["pathumthani", "ปทุมธานี", "ลำลูกกา", "คลองหลวง", "ธัญบุรี"],
      samutprakan: ["samutprakan", "สมุทรปราการ", "บางพลี", "เทพารักษ์"],
      samutsakhon: ["samutsakhon", "สมุทรสาคร", "มหาชัย"],
      nonthaburi: ["nonthaburi", "นนทบุรี", "บางกรวย", "บางใหญ่", "บางบัวทอง", "ไทรน้อย", "ปากเกร็ด", "เมืองนนทบุรี", "รัตนาธิเบศร์"]
    };

    const typeAliases = {
      "single-house": ["single-house", "บ้านเดี่ยว"],
      townhome: ["townhome", "ทาวน์โฮม", "ทาวน์เฮ้าส์", "ทาวน์เฮาส์"],
      condo: ["condo", "คอนโด"],
      land: ["land", "ที่ดิน"],
      commercial: ["commercial", "อาคารพาณิชย์", "โฮมออฟฟิศ"]
    };

    return list.filter(p=>{
      const hay=this.normalize(`${p.id} ${p.title} ${p.priceText} ${p.type} ${p.typeText} ${p.category} ${p.zone} ${p.zoneText} ${p.province} ${p.address} ${p.location} ${p.description}`);

      const selectedType = type || category;
      const typeOk = !selectedType ||
        p.type === selectedType ||
        p.category === selectedType ||
        (typeAliases[selectedType] || [selectedType]).some(x => hay.includes(this.normalize(x)));

      const zoneOk = !zone ||
        p.zone === zone ||
        (zone === "nonthaburi" && p.province === "นนทบุรี") ||
        (zoneAliases[zone] || [zone]).some(x => hay.includes(this.normalize(x)));

      const provinceOk = !province || p.province === province || hay.includes(this.normalize(province));

      const price = Number(p.price || 0);

      return (!q || hay.includes(q)) &&
        typeOk &&
        zoneOk &&
        provinceOk &&
        (!max || price <= max) &&
        (!min || price >= min) &&
        (!bed || Number(p.bed||0) >= bed);
    });
  },
  sortData(list){
    const sort=document.querySelector("[name='sort']")?.value || this.params().get("sort") || "newest";
    if(sort==="price-asc") return list.sort((a,b)=>a.price-b.price);
    if(sort==="price-desc") return list.sort((a,b)=>b.price-a.price);
    if(sort==="area-desc") return list.sort((a,b)=>(b.area||0)-(a.area||0));
    return list.sort((a,b)=>(b.createdTime||0)-(a.createdTime||0));
  },
  card(p){
    const img=this.img(p.coverImage, p.id);
    return `<article class="property-card">
      <a class="property-image" href="property.html?id=${encodeURIComponent(p.id)}">
        <img src="${img}" alt="${this.safe(p.title)}" loading="lazy" onerror="this.src='assets/images/house-001.png'">
        <div class="badge-row"><span class="badge hot">${this.safe(p.status)}</span><button class="badge" type="button" data-fav="${p.id}">♡</button></div>
      </a>
      <div class="property-body">
        <div class="price">${this.safe(p.priceText)}</div>
        <h3><a href="property.html?id=${encodeURIComponent(p.id)}">${this.safe(p.title)}</a></h3>
        <div class="location">${this.safe(p.zoneText)}, ${this.safe(p.province)}</div>
        <div class="features">
          <div class="feature"><b>${p.bed||"-"}</b>นอน</div>
          <div class="feature"><b>${p.bath||"-"}</b>น้ำ</div>
          <div class="feature"><b>${p.parking||"-"}</b>จอด</div>
          <div class="feature"><b>${p.area||"-"}</b>ตร.ว.</div>
        </div>
        <div class="property-actions">
          <a class="btn btn-primary" href="property.html?id=${encodeURIComponent(p.id)}">ดูรายละเอียด</a>
          <button class="btn btn-ghost" type="button" data-compare="${p.id}">เปรียบเทียบ</button>
        </div>
      </div>
    </article>`;
  },
  bindButtons(){
    document.querySelectorAll("[data-fav]").forEach(btn=>{
      btn.onclick=(e)=>{e.preventDefault(); btn.textContent=this.toggleList("ph_favorites",btn.dataset.fav)?"♥":"♡";};
      if(this.storage("ph_favorites").includes(btn.dataset.fav)) btn.textContent="♥";
    });
    document.querySelectorAll("[data-compare]").forEach(btn=>{
      btn.onclick=()=>{btn.textContent=this.toggleList("ph_compare",btn.dataset.compare)?"เอาออก":"เปรียบเทียบ";};
      if(this.storage("ph_compare").includes(btn.dataset.compare)) btn.textContent="เอาออก";
    });
  },
  renderPagination(total,target,extra){
    const pager=document.getElementById("pagination"); if(!pager) return;
    const pages=Math.max(1,Math.ceil(total/this.perPage)); if(pages<=1){pager.innerHTML=""; return;}
    let h=""; for(let i=1;i<=pages;i++) h+=`<button class="${i===this.currentPage?'active':''}" data-page-no="${i}">${i}</button>`;
    pager.innerHTML=h; pager.querySelectorAll("button").forEach(b=>b.onclick=()=>{this.currentPage=Number(b.dataset.pageNo); this.renderListings(target,extra); scrollTo({top:0,behavior:"smooth"});});
  },
  async renderListings(target="propertyList", extra={}, opt={}){
    const el=document.getElementById(target); if(!el) return;
    let list=this.filterData(await this.load(), extra); this.sortData(list);
    const total=list.length; const c=document.getElementById("resultCount"); if(c)c.textContent=`${total} รายการ`;
    if(opt.limit) list=list.slice(0,opt.limit);
    else if(opt.paginate!==false){ const start=(this.currentPage-1)*this.perPage; this.renderPagination(total,target,extra); list=list.slice(start,start+this.perPage); }
    el.innerHTML=list.length?list.map(p=>this.card(p)).join(""):`<div class="empty">ไม่พบทรัพย์ที่ตรงกับเงื่อนไข กรุณาลองเปลี่ยนทำเล ประเภทบ้าน หรือช่วงราคา</div>`;
    this.bindButtons();
  },
  bindFilters(extra={}){
    const form=document.getElementById("filterForm"); if(!form) return;
    const url=this.params(); [...form.elements].forEach(el=>{ if(!el.name)return; const v=url.get(el.name); if(v!==null) el.value=v; el.addEventListener("input",()=>{this.currentPage=1; this.renderListings("propertyList",extra);}); el.addEventListener("change",()=>{this.currentPage=1; this.renderListings("propertyList",extra);}); });
    form.onsubmit=e=>{e.preventDefault();this.currentPage=1;this.renderListings("propertyList",extra);};
    const reset=document.getElementById("resetFilters"); if(reset) reset.onclick=()=>{form.reset(); history.replaceState(null,"",location.pathname); this.currentPage=1; this.renderListings("propertyList",extra);};
  },
  async renderDetail(){
    const el=document.getElementById("propertyDetail"); if(!el) return;
    const id=this.params().get("id")||"FB0001"; const data=await this.load(); const p=data.find(x=>x.id===id)||data[0];
    const detailUrl = phSiteUrl(`property.html?id=${encodeURIComponent(p.id)}`);
    const detailImage = phSiteUrl(p.coverImage || this.houseImageById(p.id));
    document.title = p.seoTitle || `${p.title} | Perfect House Property`;
    phSetMeta("description", p.seoDescription || `${p.title} ${p.zoneText || ""} ${p.province || ""} ${p.priceText || ""} ดูรูปบ้าน รายละเอียด และนัดชมบ้านกับ Perfect House Property`);
    phSetMeta("og:title", document.title, "property");
    phSetMeta("og:description", p.seoDescription || p.shortDescription || p.description, "property");
    phSetMeta("og:image", detailImage, "property");
    phSetMeta("og:url", detailUrl, "property");
    phSetMeta("og:type", "product", "property");
    phSetCanonical(detailUrl);
    const imgs=(p.images&&p.images.length?p.images:[p.coverImage||"assets/images/house-001.png"]);
    const related=data.filter(x=>x.id!==p.id && (x.zone===p.zone || x.type===p.type)).slice(0,6);
    const desc=this.safe(p.description).replace(/\n/g,"<br>");
    const nearby=(p.nearby||[]).map(n=>`<div class="value-item"><strong>${this.safe(n)}</strong></div>`).join("");
    el.innerHTML=`<section class="page-hero"><div class="container"><span class="eyebrow">บ้านมือสอง • ${this.safe(p.typeText)} • ${this.safe(p.zoneText)}</span><h1>${this.safe(p.title)}</h1><p>${this.safe(p.address || (p.zoneText+', '+p.province))}</p></div></section>
    <section><div class="container detail-grid">
      <div>
        <div class="gallery-main"><img id="mainPhoto" src="${this.img(imgs[0], p.id)}" alt="${this.safe(p.title)}" onerror="this.src='assets/images/house-001.png'"></div>
        <div class="thumbs">${imgs.slice(0,12).map((im,i)=>`<button class="thumb ${i===0?'active':''}" type="button" data-img="${this.safe(im)}"><img src="${this.safe(im)}" alt="รูปบ้าน ${i+1}" onerror="this.src='assets/images/house-001.png'"></button>`).join("")}</div>
        <div class="details-box" style="margin-top:22px"><h2>รายละเอียดประกาศ</h2><p>${desc}</p>${phMapFrameOnly(p)}</div>
      </div>
      <aside class="content-card">
        <div class="price">${this.safe(p.priceText)}</div>
        <div class="spec-grid">
          <div class="spec"><b>${p.bed||"-"}</b>ห้องนอน</div><div class="spec"><b>${p.bath||"-"}</b>ห้องน้ำ</div>
          <div class="spec"><b>${p.parking||"-"}</b>ที่จอดรถ</div><div class="spec"><b>${p.area||"-"}</b>ตร.ว.</div>
          <div class="spec"><b>${this.safe(p.facing||"-")}</b>ทิศหน้าบ้าน</div><div class="spec"><b>${this.safe(p.commonFee||"-")}</b>ค่าส่วนกลาง</div>
        </div>
        <div class="contact-list">
          <div class="contact-item"><div class="symbol">📍</div><div><b>ทำเล</b><span>${this.safe(p.zoneText)}, ${this.safe(p.province)}</span></div></div>
          <div class="contact-item"><div class="symbol">🏠</div><div><b>ประเภท</b><span>${this.safe(p.typeText)} มือสอง</span></div></div>
        </div>
        <a class="btn btn-primary btn-block" style="margin-top:16px" href="contact.html?property=${encodeURIComponent(p.id)}">นัดชมทรัพย์</a>
        <a class="btn btn-ghost btn-block" style="margin-top:10px" href="tel:0842628878">โทร 084-262-8878</a>
              
        <a class="btn btn-ghost btn-block" style="margin-top:10px" href="${this.safe(p.facebookUrl)}" target="_blank" rel="noopener">ดูโพสต์ Facebook</a>${phMapSideButton(p)}${phLineQrCard()}
        <button class="btn btn-ghost btn-block" style="margin-top:10px" data-fav="${p.id}">♡ เพิ่มรายการโปรด</button>
        <button class="btn btn-ghost btn-block" style="margin-top:10px" data-compare="${p.id}">เปรียบเทียบ</button>
      </aside>
    </div></section>
    <section class="soft-section"><div class="container"><div class="section-head"><div><h2>ทรัพย์ใกล้เคียงที่น่าสนใจ</h2><p>บ้านในทำเลหรือประเภทใกล้เคียงที่คุณอาจสนใจ</p></div><a class="btn btn-ghost" href="properties.html?zone=${p.zone}">ดูทำเลนี้ทั้งหมด</a></div><div class="property-grid">${related.map(x=>this.card(x)).join("")}</div></div></section>`;
    document.querySelectorAll('script[data-property-jsonld]').forEach(s=>s.remove());
    const jsonLd = document.createElement("script");
    jsonLd.type = "application/ld+json";
    jsonLd.dataset.propertyJsonld = "true";
    jsonLd.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      "name": p.title,
      "description": p.seoDescription || p.shortDescription || p.description,
      "url": detailUrl,
      "image": [detailImage],
      "offers": {"@type":"Offer", "priceCurrency":"THB", "price": p.price || undefined, "availability":"https://schema.org/InStock"},
      "address": {"@type":"PostalAddress", "addressLocality": p.zoneText || p.location, "addressRegion": p.province, "streetAddress": p.address}
    });
    document.head.appendChild(jsonLd);
    document.querySelectorAll(".thumb").forEach(t=>t.onclick=()=>{document.querySelectorAll(".thumb").forEach(x=>x.classList.remove("active"));t.classList.add("active");document.getElementById("mainPhoto").src=t.dataset.img;});
    this.bindButtons();
  },
  async renderSaved(key,target){
    const el=document.getElementById(target); if(!el) return;
    const ids=this.storage(key), data=await this.load(), list=data.filter(p=>ids.includes(p.id));
    el.innerHTML=list.length?list.map(p=>this.card(p)).join(""):`<div class="empty">ยังไม่มีรายการที่เลือกไว้</div>`; this.bindButtons();
  },
  bindForms(){
    document.querySelectorAll("[data-lead-form]").forEach(form=>form.onsubmit=e=>{e.preventDefault();const n=form.querySelector(".notice"); if(n){n.classList.add("show");n.textContent="ขอบคุณสำหรับข้อมูล ทีมงาน Perfect House จะติดต่อกลับโดยเร็วที่สุด";} form.reset();});
  }
};
function initMobileMenu(){
  const toggle=document.querySelector(".mobile-toggle"), menu=document.querySelector(".menu"); if(!toggle||!menu||document.querySelector(".mobile-drawer"))return;
  const backdrop=document.createElement("div"); backdrop.className="mobile-backdrop";
  const drawer=document.createElement("aside"); drawer.className="mobile-drawer";
  const brand=document.querySelector(".logo")?.innerHTML||"Perfect House";
  drawer.innerHTML=`<div class="mobile-drawer-head"><div class="logo">${brand}</div><button class="mobile-drawer-close">×</button></div><nav>${Array.from(menu.querySelectorAll("a")).map(a=>`<a href="${a.href}" class="${a.className||""}">${a.textContent}<span>›</span></a>`).join("")}</nav>`;
  document.body.append(backdrop,drawer); const close=()=>document.body.classList.remove("mobile-menu-open"); toggle.onclick=()=>document.body.classList.add("mobile-menu-open"); backdrop.onclick=close; drawer.querySelector(".mobile-drawer-close").onclick=close; drawer.querySelectorAll("a").forEach(a=>a.onclick=close);
}






function phMapButton(p, variant = "block") {
  if (!p || !p.mapUrl) return "";
  const cls = variant === "inline" ? "btn btn-map" : "btn btn-map btn-block";
  return `<a class="${cls}" href="${p.mapUrl}" target="_blank" rel="noopener noreferrer">📍 เปิดแผนที่ Google Maps</a>`;
}
















































function phLocationFirstList(list) {
  return [...(list || [])].sort((a, b) => {
    const am = a && (a.mapUrl || (a.mapLat && a.mapLng)) ? 1 : 0;
    const bm = b && (b.mapUrl || (b.mapLat && b.mapLng)) ? 1 : 0;
    if (am !== bm) return bm - am;
    return Number(b.timestamp || 0) - Number(a.timestamp || 0);
  });
}

document.addEventListener("DOMContentLoaded", async()=>{
  initMobileMenu(); PH.updateCounters(); PH.bindForms();
  const page=document.body.dataset.page;
  const extra={ "single-house":{type:"single-house"},"townhome":{type:"townhome"},"condo":{type:"condo"},"land":{type:"land"},"nonthaburi":{province:"นนทบุรี"} }[page]||{};
  if(["properties","single-house","townhome","condo","land","locations","budget","nonthaburi"].includes(page)){ PH.bindFilters(extra); await PH.renderListings("propertyList", extra); }
  if(page==="home"){ await PH.renderListings("featuredList", {}, {limit:12,paginate:false}); await PH.renderListings("nonthaburiList", {province:"นนทบุรี"}, {limit:6,paginate:false}); await PH.renderListings("townhomeList", {type:"townhome"}, {limit:6,paginate:false}); }
  if(page==="property") await PH.renderDetail();
  if(page==="favorites") await PH.renderSaved("ph_favorites","savedList");
  if(page==="compare") await PH.renderSaved("ph_compare","savedList");
});


// Runtime responsive guard for Facebook images/gallery
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.style.overflowX = "hidden";
  document.body.style.overflowX = "hidden";

  const fixMedia = () => {
    document.querySelectorAll("img").forEach(img => {
      img.loading = img.loading || "lazy";
      img.style.maxWidth = "100%";
      img.style.height = img.classList.contains("property-card-img") ? img.style.height : "auto";
    });
    document.querySelectorAll(".detail-grid, .content-grid, .property-layout, .seo-content, .content-card").forEach(el => {
      el.style.minWidth = "0";
      el.style.maxWidth = "100%";
    });
  };

  fixMedia();
  setTimeout(fixMedia, 500);
  setTimeout(fixMedia, 1500);
});



// Final UI audit guard: prevent clipped cards and mobile overflow after dynamic render
(function () {
  function auditLayout() {
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";

    document.querySelectorAll(".property-card").forEach(card => {
      card.style.height = "auto";
      card.style.overflow = "hidden";
      card.style.display = "flex";
      card.style.flexDirection = "column";
    });

    document.querySelectorAll(".property-body").forEach(body => {
      body.style.overflow = "visible";
      body.style.display = "flex";
      body.style.flexDirection = "column";
    });

    document.querySelectorAll("img").forEach(img => {
      if (!img.getAttribute("loading")) img.setAttribute("loading", "lazy");
      img.style.maxWidth = "100%";
    });

    document.querySelectorAll(".detail-grid, .property-layout, .content-grid, .split, .seo-content, .content-card").forEach(el => {
      el.style.minWidth = "0";
      el.style.maxWidth = "100%";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("propertyDetail")) {
      document.body.classList.add("property-detail-page");
    }

    auditLayout();
    setTimeout(auditLayout, 300);
    setTimeout(auditLayout, 900);
    setTimeout(auditLayout, 1800);
  });

  window.addEventListener("resize", auditLayout);
})();















/* =========================================================
   CATEGORY ROUTING FIX
   ทำให้เมนูบน header และหน้า category แยกหมวดจริง
   ========================================================= */
(function(){
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  const pageExtraMap = {
    "single-house.html": { type: "single-house" },
    "townhome.html": { type: "townhome" },
    "condo.html": { type: "condo" },
    "land.html": { type: "land" },
    "nonthaburi.html": { province: "นนทบุรี" },
    "second-hand.html": { market: "second-hand" }
  };

  const budgetMap = {
    "budget.html": {}
  };

  function applyHeaderActive(){
    document.querySelectorAll(".menu a, .nav a, header a").forEach(a=>{
      try {
        const href = (a.getAttribute("href") || "").split("?")[0].toLowerCase();
        if (href && href === page) a.classList.add("active");
      } catch {}
    });
  }

  async function rerenderCategoryIfNeeded(){
    if (!window.PH) return;
    const target = document.getElementById("propertyList");
    if (!target) return;

    const extra = pageExtraMap[page];
    if (extra) {
      PH.currentPage = 1;
      await PH.renderListings("propertyList", extra);
      PH.bindFilters(extra);
      return;
    }

    // properties.html uses query params only; keep normal behavior.
    if (page === "properties.html") {
      PH.currentPage = 1;
      await PH.renderListings("propertyList", {});
      PH.bindFilters({});
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyHeaderActive();
    setTimeout(rerenderCategoryIfNeeded, 0);
  });
})();
