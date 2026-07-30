import fs from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dashboardPath = resolve(root, "public/data/aidc-capex/dashboard.json");
const outputPath = resolve(root, "data/aidc-capex-geocodes.json");
const publicOutputPath = resolve(root, "public/data/aidc-capex/geocodes.json");
const dashboard = JSON.parse(await fs.readFile(dashboardPath, "utf8"));

let cached = {};
try {
  cached = JSON.parse(await fs.readFile(outputPath, "utf8"));
} catch {
  cached = {};
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const result = { ...cached };
const retryUnresolved = process.argv.includes("--retry-unresolved");

for (const project of dashboard.projects) {
  if (result[project.id] && (!retryUnresolved || result[project.id].latitude !== null)) continue;

  const queries = [
    project.address ? `${project.address}, ${project.country}` : null,
    `${project.name}, ${project.country}`,
  ].filter(Boolean);

  let match = null;
  let queryUsed = null;
  for (const query of queries) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "LevelGrind-AICapex/1.0 (research dashboard; contact: jiayihui01@gmail.com)",
      },
    });
    if (!response.ok) throw new Error(`Nominatim ${response.status} for ${project.name}`);
    const rows = await response.json();
    if (rows[0]) {
      match = rows[0];
      queryUsed = query;
      break;
    }
    await sleep(1100);
  }

  result[project.id] = match ? {
    latitude: Number(match.lat),
    longitude: Number(match.lon),
    precision: project.address && queryUsed?.startsWith(project.address) ? "address" : "place",
    displayName: match.display_name,
    query: queryUsed,
    source: "OpenStreetMap Nominatim",
    sourceUrl: `https://www.openstreetmap.org/?mlat=${match.lat}&mlon=${match.lon}#map=12/${match.lat}/${match.lon}`,
    geocodedAt: new Date().toISOString(),
  } : {
    latitude: null,
    longitude: null,
    precision: "unresolved",
    displayName: null,
    query: queries.at(-1) || null,
    source: "OpenStreetMap Nominatim",
    sourceUrl: null,
    geocodedAt: new Date().toISOString(),
  };

  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await fs.writeFile(publicOutputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`${project.name}: ${result[project.id].precision}`);
  await sleep(1100);
}

console.log(`Geocoded ${Object.values(result).filter((item) => item.latitude !== null).length}/${dashboard.projects.length} projects.`);
await fs.writeFile(publicOutputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
