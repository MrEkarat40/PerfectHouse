const fs = require("fs");
const path = require("path");

const INPUT_JSON = path.join(__dirname, "..", "data", "properties.json");
const OUTPUT_JSON = path.join(__dirname, "..", "data", "properties.json");
const OUTPUT_JS = path.join(__dirname, "..", "data", "properties.js");
const REPORT_JSON = path.join(__dirname, "..", "data", "map-resolve-report.json");

const DELAY_MS = 900;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function decodeUrl(url) {
  try {
    return decodeURIComponent(String(url || ""));
  } catch {
    return String(url || "");
  }
}

function extractLatLng(url) {
  const decoded = decodeUrl(url);

  const patterns = [
    { re: /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|\/|\?|$)/i, source: "@latlng" },
    { re: /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i, source: "!3d!4d" },
    { re: /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i, source: "q" },
    { re: /[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i, source: "ll" },
    { re: /[?&]center=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i, source: "center" },
    { re: /[?&]query=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i, source: "query" }
  ];

  for (const item of patterns) {
    const match = decoded.match(item.re);
    if (!match) continue;

    const lat = Number(match[1]);
    const lng = Number(match[2]);

    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng, source: item.source };
    }
  }

  return null;
}

async function resolveFinalUrl(mapUrl) {
  const res = await fetch(mapUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 PerfectHouseMapResolver/1.0"
    }
  });

  return res.url || mapUrl;
}

function save(properties, report) {
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(properties, null, 2), "utf8");
  fs.writeFileSync(OUTPUT_JS, "window.PH_PROPERTIES = " + JSON.stringify(properties) + ";\n", "utf8");
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");
}

async function main() {
  if (!fs.existsSync(INPUT_JSON)) {
    throw new Error(`Cannot find ${INPUT_JSON}`);
  }

  const properties = JSON.parse(fs.readFileSync(INPUT_JSON, "utf8"));

  const report = {
    total: properties.length,
    with_map_url: 0,
    already_had_coords: 0,
    extracted_from_original_url: 0,
    resolved_from_short_url: 0,
    failed: 0,
    items: []
  };

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];

    if (!p.mapUrl) continue;
    report.with_map_url++;

    if (p.mapLat && p.mapLng) {
      report.already_had_coords++;
      report.items.push({
        id: p.id,
        status: "already_had_coords",
        lat: p.mapLat,
        lng: p.mapLng,
        mapUrl: p.mapUrl
      });
      continue;
    }

    console.log(`[${i + 1}/${properties.length}] ${p.id} ${p.mapUrl}`);

    let coords = extractLatLng(p.mapUrl);

    if (coords) {
      p.mapLat = coords.lat;
      p.mapLng = coords.lng;
      p.mapZoom = 17;
      p.mapEmbedMode = "coordinates";
      p.mapCoordinateSource = coords.source;
      report.extracted_from_original_url++;
      report.items.push({
        id: p.id,
        status: "extracted_from_original_url",
        lat: coords.lat,
        lng: coords.lng,
        source: coords.source,
        mapUrl: p.mapUrl
      });
      save(properties, report);
      continue;
    }

    try {
      const finalUrl = await resolveFinalUrl(p.mapUrl);
      p.mapResolvedUrl = finalUrl;

      coords = extractLatLng(finalUrl);

      if (coords) {
        p.mapLat = coords.lat;
        p.mapLng = coords.lng;
        p.mapZoom = 17;
        p.mapEmbedMode = "coordinates";
        p.mapCoordinateSource = coords.source;
        report.resolved_from_short_url++;

        report.items.push({
          id: p.id,
          status: "resolved_from_short_url",
          lat: coords.lat,
          lng: coords.lng,
          source: coords.source,
          mapUrl: p.mapUrl,
          finalUrl
        });

        console.log(`  -> ${coords.lat}, ${coords.lng}`);
      } else {
        report.failed++;
        report.items.push({
          id: p.id,
          status: "no_coordinates_found_after_resolve",
          mapUrl: p.mapUrl,
          finalUrl
        });

        console.log("  -> no coordinates found");
      }

      save(properties, report);
      await sleep(DELAY_MS);

    } catch (err) {
      report.failed++;
      report.items.push({
        id: p.id,
        status: "error",
        mapUrl: p.mapUrl,
        error: err.message
      });

      save(properties, report);
      console.log(`  -> error: ${err.message}`);
      await sleep(DELAY_MS);
    }
  }

  save(properties, report);

  console.log("Done.");
  console.log(report);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
