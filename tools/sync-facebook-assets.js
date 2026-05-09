const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const IMPORT_DIR = path.join(ROOT, "imports");
const OUT_DATA_JSON = path.join(ROOT, "data", "properties.json");
const OUT_DATA_JS = path.join(ROOT, "data", "properties.js");
const IMG_DIR = path.join(ROOT, "assets", "images", "facebook");
const REPORT_FILE = path.join(ROOT, "data", "facebook-sync-report.json");
const MAX_IMAGES_PER_POST = Number(process.env.MAX_IMAGES_PER_POST || 12);

const POST_CANDIDATES = [
  path.join(IMPORT_DIR, "facebook-posts-partial.json"),
  path.join(ROOT, "facebook-posts-partial.json"),
  path.join(ROOT, "facebook-posts-partial(2).json"),
  path.join(ROOT, "facebook-posts-partial(1).json")
];

const COMMENT_CANDIDATES = [
  path.join(IMPORT_DIR, "facebook-comments-all.json"),
  path.join(ROOT, "facebook-comments-all.json"),
  path.join(ROOT, "facebook-comments-all(1).json")
];

function findExisting(candidates) {
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanText(s) {
  return String(s || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (String(v || "").trim()) return String(v).trim();
  }
  return "";
}

function parsePrice(msg) {
  const m = String(msg || "").match(/ราคา\s*([\d,]+)\s*บาท/i);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}

function parseBedBathParking(msg) {
  const txt = String(msg || "");
  const pick = (re) => {
    const m = txt.match(re);
    return m ? Number(m[1]) : 0;
  };
  return {
    bed: pick(/(\d+)\s*ห้องนอน/i),
    bath: pick(/(\d+)\s*ห้องน้ำ/i),
    parking: pick(/(\d+)\s*ที่จอดรถ/i)
  };
}

function parseArea(msg) {
  const txt = String(msg || "");
  const rules = [
    /พื้นที่\s*([\d.]+)\s*ตารางวา/i,
    /เนื้อที่\s*([\d.]+)\s*ตารางวา/i,
    /ขนาด\s*([\d.]+)\s*ตารางวา/i
  ];
  for (const re of rules) {
    const m = txt.match(re);
    if (m) return Number(m[1]);
  }
  return 0;
}

function parseUsable(msg) {
  const txt = String(msg || "");
  const rules = [
    /พื้นที่ใช้สอย\s*([\d,]+)\s*ตารางเมตร/i,
    /พื้นที่ใช้สอย\s*([\d,]+)\s*ตร\.?ม\.?/i
  ];
  for (const re of rules) {
    const m = txt.match(re);
    if (m) return Number(m[1].replace(/,/g, ""));
  }
  return 0;
}

function parseTitle(msg) {
  const lines = String(msg || "").split("\n").map(x => x.trim()).filter(Boolean);
  if (!lines.length) return "บ้านมือสองพร้อมอยู่";
  let first = lines[0];
  if (first.startsWith("#")) {
    first = first.replace(/#/g, " ").replace(/- /g, " - ").replace(/-\s*#/g, "- ");
    first = first.replace(/\s+/g, " ").trim();
  }
  return first;
}

function parseType(msg, title) {
  const blob = `${title}\n${msg}`;
  const rules = [
    ["townhome", "ทาวน์โฮม", [/ทาวน์โฮม/i, /ทาวน์เฮ้าส์/i, /ทาวน์เฮาส์/i]],
    ["single-house", "บ้านเดี่ยว", [/บ้านเดี่ยว/i]],
    ["semi-detached", "บ้านแฝด", [/บ้านแฝด/i]],
    ["condo", "คอนโด", [/คอนโด/i]],
    ["land", "ที่ดิน", [/ที่ดิน/i]],
    ["commercial", "อาคารพาณิชย์", [/อาคารพาณิชย์/i, /โฮมออฟฟิศ/i]]
  ];
  for (const [slug, text, patterns] of rules) {
    if (patterns.some(re => re.test(blob))) return { slug, text };
  }
  return { slug: "house", text: "บ้าน" };
}

function parseZoneProvince(msg, title) {
  const blob = `${title}\n${msg}`;
  const rules = [
    ["bangyai", "บางใหญ่", "นนทบุรี", ["บางใหญ่"]],
    ["bangbuathong", "บางบัวทอง", "นนทบุรี", ["บางบัวทอง"]],
    ["bangkruai", "บางกรวย", "นนทบุรี", ["บางกรวย"]],
    ["pakkret", "ปากเกร็ด", "นนทบุรี", ["ปากเกร็ด"]],
    ["sainoi", "ไทรน้อย", "นนทบุรี", ["ไทรน้อย"]],
    ["nonthaburi", "นนทบุรี", "นนทบุรี", ["นนทบุรี", "รัตนาธิเบศร์", "ชัยพฤกษ์", "ราชพฤกษ์", "งามวงศ์วาน", "สนามบินน้ำ"]],
    ["rama2", "พระราม 2", "กรุงเทพมหานคร", ["พระราม2", "พระราม 2", "ท่าข้าม", "บางขุนเทียน"]],
    ["phetkasem", "เพชรเกษม", "กรุงเทพมหานคร", ["เพชรเกษม", "หนองแขม", "บางแค"]],
    ["pathumthani", "ปทุมธานี", "ปทุมธานี", ["ปทุมธานี", "ลำลูกกา", "คลองหลวง", "ธัญบุรี"]],
    ["samutprakan", "สมุทรปราการ", "สมุทรปราการ", ["สมุทรปราการ", "บางพลี", "เทพารักษ์", "บางบ่อ"]],
    ["samutsakhon", "สมุทรสาคร", "สมุทรสาคร", ["สมุทรสาคร", "มหาชัย"]]
  ];
  for (const [slug, zoneText, province, keys] of rules) {
    if (keys.some(k => blob.includes(k))) return { slug, zoneText, province };
  }
  return { slug: "nonthaburi", zoneText: "นนทบุรี", province: "นนทบุรี" };
}

function parseAddress(msg) {
  const txt = String(msg || "");
  const rules = [
    /ที่ตั้งโครงการ[:：]?\s*(.+)/i,
    /ที่ตั้ง[:：]?\s*(.+)/i,
    /📍\s*Location[:：]?\s*(.+)/i
  ];
  for (const re of rules) {
    const m = txt.match(re);
    if (m) return cleanText(m[1]).split("\n")[0];
  }
  return "";
}

function extractNearby(msg) {
  const lines = String(msg || "").split("\n").map(x => x.trim().replace(/^[•\-–\s]+/, ""));
  const out = [];
  for (const line of lines) {
    if (!line || line.length < 6) continue;
    if (/(เซ็นทรัล|รถไฟฟ้า|โรงเรียน|โรงพยาบาล|โลตัส|บิ๊กซี|ตลาด|ทางด่วน|MRT|BTS|มหาวิทยาลัย)/i.test(line)) {
      if (!out.includes(line)) out.push(line);
    }
  }
  return out.slice(0, 8);
}

function buildHighlights(msg) {
  const lines = String(msg || "").split("\n").map(x => x.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    if (/(บ้าน|ทำเล|เดินทาง|ใกล้|พร้อม|ต่อเติม|รีโนเวท|สวย|สถานที่)/i.test(line)) {
      if (!out.includes(line)) out.push(line);
    }
  }
  return out.slice(0, 8).join(" • ");
}

function collectRemoteImages(post) {
  const urls = [];
  if (post.image && typeof post.image === "object") {
    if (post.image.uri) urls.push(post.image.uri);
    if (post.image.image_file_uri) urls.push(post.image.image_file_uri);
  }
  if (post.video_thumbnail) urls.push(post.video_thumbnail);
  const album = Array.isArray(post.album_preview) ? post.album_preview : [];
  for (const item of album) {
    if (!item || typeof item !== "object") continue;
    if (item.image_file_uri) urls.push(item.image_file_uri);
    if (item.image && item.image.uri) urls.push(item.image.uri);
    if (item.url && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(item.url)) urls.push(item.url);
  }
  return [...new Set(urls.filter(Boolean))].slice(0, MAX_IMAGES_PER_POST);
}

function commentMapUrlMap(commentJson) {
  const map = {};
  const posts = Array.isArray(commentJson?.results) ? commentJson.results : [];
  const re = /(https?:\/\/[^\s<>"']+|maps\.app\.goo\.gl\/[^\s<>"']+|goo\.gl\/maps\/[^\s<>"']+)/i;
  for (const item of posts) {
    const pid = String(item.post_id || "");
    if (!pid) continue;
    for (const c of (item.comments || [])) {
      const txt = ["text", "message", "body", "comment"].map(k => String(c?.[k] || "")).join(" ");
      const m = txt.match(re);
      if (m) {
        let url = m[1].trim().replace(/[.,]+$/, "");
        if (url.startsWith("maps.app.goo.gl/")) url = "https://" + url;
        if (url.startsWith("goo.gl/maps/")) url = "https://" + url;
        map[pid] = url;
        break;
      }
    }
  }
  return map;
}

function extractLatLng(url) {
  const decoded = (() => {
    try { return decodeURIComponent(String(url || "")); }
    catch { return String(url || ""); }
  })();
  const rules = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|\/|\?|$)/i,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
    /[?&](?:q|ll|center|query)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i
  ];
  for (const re of rules) {
    const m = decoded.match(re);
    if (m) {
      return { lat: Number(m[1]), lng: Number(m[2]) };
    }
  }
  return null;
}

function extractPlaceText(url) {
  const decoded = (() => {
    try { return decodeURIComponent(String(url || "")); }
    catch { return String(url || ""); }
  })();
  const m1 = decoded.match(/\/maps\/place\/([^\/@?]+)/i);
  if (m1) return m1[1].replace(/\+/g, " ").trim();
  const m2 = decoded.match(/[?&](?:q|query)=([^&]+)/i);
  if (m2) return m2[1].replace(/\+/g, " ").trim();
  return "";
}

async function fetchWithRedirect(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    await res.arrayBuffer(); // consume
    return { ok: res.ok, finalUrl: res.url || url, status: res.status };
  } catch (err) {
    return { ok: false, finalUrl: url, error: err.message };
  }
}

async function downloadBinary(url, filePath) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": "https://www.facebook.com/"
      }
    });
    if (!res.ok) return { ok: false, status: res.status, finalUrl: res.url || url };
    const ab = await res.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(ab));
    return { ok: true, status: res.status, finalUrl: res.url || url };
  } catch (err) {
    return { ok: false, error: err.message, finalUrl: url };
  }
}

function pickExt(url, fallback = ".jpg") {
  const clean = String(url || "").split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return ".png";
  if (clean.endsWith(".webp")) return ".webp";
  if (clean.endsWith(".jpeg")) return ".jpeg";
  if (clean.endsWith(".jpg")) return ".jpg";
  return fallback;
}

function placeholder(index) {
  const n = ((index - 1) % 100) + 1;
  return { path: `assets/images/house-${String(n).padStart(3, "0")}.png`, n };
}


function isSaleHousePost(post) {
  const msg = String(post?.message_rich || post?.message || "").trim();
  if (!msg) return false;

  const hasPrice =
    /ราคา\s*[\d,]+\s*บาท/i.test(msg) ||
    /💸\s*ราคา/i.test(msg);

  const hasArea =
    /พื้นที่\s*[\d.]+\s*ตารางวา/i.test(msg) ||
    /เนื้อที่\s*[\d.]+\s*ตารางวา/i.test(msg) ||
    /ขนาด\s*[\d.]+\s*ตารางวา/i.test(msg) ||
    /ตารางวา/i.test(msg);

  const hasRoom =
    /ห้องนอน/i.test(msg) ||
    /ห้องน้ำ/i.test(msg) ||
    /ที่จอดรถ/i.test(msg);

  const hasLocation =
    /ที่ตั้งโครงการ/i.test(msg) ||
    /ทำเล/i.test(msg) ||
    /เดินทาง/i.test(msg);

  const propertyKeyword =
    /หมู่บ้าน|บ้านเดี่ยว|บ้านแฝด|ทาวน์โฮม|ทาวน์เฮ้าส์|ทาวน์เฮาส์|คอนโด|อาคารพาณิชย์|โฮมออฟฟิศ|ที่ดิน|เพชรเกษม|พระราม|นนทบุรี|บางใหญ่|บางบัวทอง|บางกรวย|ไทรน้อย|ปากเกร็ด|รัตนาธิเบศร์|ชัยพฤกษ์|ราชพฤกษ์/i.test(msg);

  // ตัดโพสต์โปรโมตทั่วไปที่ไม่มีรายละเอียดทรัพย์
  const promoOnly =
    /อยากขายบ้าน|ซื้อบ้าน|คิดถึงเรา|สนใจหลังไหน|รีบมาจอง|เพอร์เฟคเฮ้าส์|Perfect House/i.test(msg) &&
    !hasPrice &&
    !hasArea &&
    !hasRoom;

  // ตัดโพสต์ประกาศจอง/ขายแล้วที่ไม่ใช่ประกาศขายเต็ม
  const soldOrReservedOnly =
    /จองแล้ว|ขายแล้ว|ปิดจอง|ติดจอง|sold\s*out/i.test(msg) &&
    (!hasPrice || (!hasArea && !hasRoom));

  // ตัดโพสต์ที่เป็นรูป/วิดีโอทั่วไป ไม่มีราคาและรายละเอียดบ้าน
  if (promoOnly) return false;
  if (soldOrReservedOnly) return false;

  // โพสต์ขายจริงต้องมีราคา และมีอย่างน้อยข้อมูลพื้นที่/ห้อง/ทำเล พร้อม keyword อสังหา
  return hasPrice && propertyKeyword && (hasArea || hasRoom || hasLocation);
}

async function main() {
  const postFile = findExisting(POST_CANDIDATES);
  const commentFile = findExisting(COMMENT_CANDIDATES);
  if (!postFile) throw new Error("Posts JSON not found");
  if (!commentFile) throw new Error("Comments JSON not found");

  const postJson = readJson(postFile);
  const commentJson = readJson(commentFile);
  const allPosts = Array.isArray(postJson?.results) ? postJson.results : (Array.isArray(postJson) ? postJson : []);
  const posts = allPosts.filter(isSaleHousePost);

  console.log(`All posts: ${allPosts.length}`);
  console.log(`Sale house posts: ${posts.length}`);
  const mapByPostId = commentMapUrlMap(commentJson);

  ensureDir(IMG_DIR);

  const report = {
    posts_file: postFile,
    comments_file: commentFile,
    total_posts_before_filter: allPosts.length,
    total_sale_house_posts: posts.length,
    posts_with_map_comment: Object.keys(mapByPostId).length,
    downloaded_images: 0,
    failed_images: 0,
    resolved_map_links: 0,
    unresolved_map_links: 0,
    items: []
  };

  const properties = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const msg = cleanText(firstNonEmpty(post.message_rich, post.message));
    const titleCore = parseTitle(msg);
    const price = parsePrice(msg);
    const parsed = parseBedBathParking(msg);
    const area = parseArea(msg);
    const usable = parseUsable(msg);
    const type = parseType(msg, titleCore);
    const zp = parseZoneProvince(msg, titleCore);
    const address = parseAddress(msg);
    const nearby = extractNearby(msg);
    const highlights = buildHighlights(msg);
    const pid = String(post.post_id || post.id || `post-${i+1}`);
    const id = `FB${String(i+1).padStart(4, "0")}`;
    const title = titleCore.startsWith("ขาย") ? titleCore : `ขาย${type.text}มือสอง ${titleCore}`;
    const ph = placeholder(i + 1);

    const remoteImages = collectRemoteImages(post);
    const localImages = [];

    for (let j = 0; j < remoteImages.length; j++) {
      const url = remoteImages[j];
      const ext = pickExt(url);
      const filename = `${id}-${String(j+1).padStart(2, "0")}${ext}`;
      const rel = `assets/images/facebook/${filename}`;
      const abs = path.join(ROOT, rel);
      const dl = await downloadBinary(url, abs);
      if (dl.ok) {
        localImages.push(rel);
        report.downloaded_images++;
      } else {
        report.failed_images++;
      }
    }

    const rawMapUrl = mapByPostId[pid] || "";
    let resolvedMapUrl = "";
    let mapLat = null;
    let mapLng = null;

    if (rawMapUrl) {
      const resolved = await fetchWithRedirect(rawMapUrl);
      if (resolved.ok && resolved.finalUrl) {
        resolvedMapUrl = resolved.finalUrl;
        report.resolved_map_links++;
      } else {
        report.unresolved_map_links++;
      }
      const coords = extractLatLng(resolvedMapUrl || rawMapUrl);
      if (coords) {
        mapLat = coords.lat;
        mapLng = coords.lng;
      }
    }

    const prop = {
      id,
      sourcePostId: pid,
      title,
      price,
      priceText: price ? `${price.toLocaleString("th-TH")} บาท` : "สอบถามราคา",
      type: type.slug,
      typeText: type.text,
      market: "second-hand",
      marketText: "บ้านมือ2",
      status: "พร้อมขาย",
      zone: zp.slug,
      zoneText: zp.zoneText,
      location: zp.zoneText,
      province: zp.province,
      bed: parsed.bed,
      bath: parsed.bath,
      parking: parsed.parking,
      area,
      usable,
      commonFee: "สอบถามเพิ่มเติม",
      facing: "สอบถามเพิ่มเติม",
      address: address || zp.zoneText,
      transit: "ทำเลเดินทางสะดวก เข้า-ออกได้หลายเส้นทาง",
      highlights: highlights || "บ้านมือ2 พร้อมเข้าอยู่ ทำเลดี เดินทางสะดวก",
      description: msg,
      shortDescription: price
        ? `${type.text} ทำเล${zp.zoneText} ${zp.province} ราคา ${price.toLocaleString("th-TH")} บาท พร้อมนัดชมบ้าน`
        : `${type.text} ทำเล${zp.zoneText} ${zp.province} พร้อมนัดชมบ้าน`,
      nearby,
      facebookUrl: firstNonEmpty(post.url),
      createdTime: Number(post.timestamp || 0),
      coverImage: localImages[0] || ph.path,
      images: localImages.length ? localImages : [ph.path],
      remoteImageCandidates: remoteImages,
      isRealFacebook: true,
      localImageIndex: ph.n,
      localImageFile: localImages[0] || ph.path,
      seoTitle: price
        ? `${title} | ${price.toLocaleString("th-TH")} บาท ${zp.zoneText} ${zp.province} | Perfect House`
        : `${title} | ${zp.zoneText} ${zp.province} | Perfect House`,
      seoDescription: `${title} ${zp.zoneText} ${zp.province}${price ? ` ราคา ${price.toLocaleString("th-TH")} บาท` : ""} ดูรูป รายละเอียดบ้าน และนัดชมบ้านกับ Perfect House`,
      mapUrl: rawMapUrl,
      mapResolvedUrl: resolvedMapUrl,
      mapLat,
      mapLng,
      mapZoom: 17,
      mapEmbedQuery: address || extractPlaceText(resolvedMapUrl || rawMapUrl) || `${titleCore} ${zp.zoneText} ${zp.province}`
    };

    properties.push(prop);
    report.items.push({
      id,
      post_id: pid,
      downloaded_images: localImages.length,
      raw_map_url: rawMapUrl,
      resolved_map_url: resolvedMapUrl
    });

    console.log(`[${i+1}/${posts.length}] ${id} images=${localImages.length} map=${rawMapUrl ? "Y" : "N"}`);
  }

  fs.writeFileSync(OUT_DATA_JSON, JSON.stringify(properties, null, 2), "utf8");
  fs.writeFileSync(OUT_DATA_JS, "window.PH_PROPERTIES = " + JSON.stringify(properties) + ";\n", "utf8");
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");

  console.log("Done");
  console.log(`Saved: ${OUT_DATA_JSON}`);
  console.log(`Report: ${REPORT_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
