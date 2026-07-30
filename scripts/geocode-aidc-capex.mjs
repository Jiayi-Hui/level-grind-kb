import fs from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const researchRoot = process.env.AIDC_RESEARCH_ROOT
  ? resolve(process.env.AIDC_RESEARCH_ROOT)
  : resolve(root, "../aidc-capex-tracker");
const dashboardPath = resolve(root, "public/data/aidc-capex/dashboard.json");
const outputPath = resolve(root, "data/aidc-capex-geocodes.json");
const publicOutputPath = resolve(root, "public/data/aidc-capex/geocodes.json");
const overridePath = resolve(root, "data/aidc-capex-location-overrides.json");
const campusCsvPath = resolve(researchRoot, "data/epoch-ai/extracted/data_centers.csv");
const timelineCsvPath = resolve(researchRoot, "data/epoch-ai/extracted/data_center_timelines.csv");
const dashboard = JSON.parse(await fs.readFile(dashboardPath, "utf8"));

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const retryUnresolved = process.argv.includes("--retry-unresolved");
const refreshEvidence = process.argv.includes("--refresh-evidence");
const projectFilter = process.argv.find((argument) => argument.startsWith("--project="))?.split("=")[1] || "";

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const text = source.replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value.trim())) rows.push(row);
  }
  if (!rows.length) return [];
  return rows.slice(1).map((values) => Object.fromEntries(
    rows[0].map((header, index) => [header, values[index] ?? ""]),
  ));
}

async function readJson(path, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function readCsv(path) {
  try {
    return parseCsv(await fs.readFile(path, "utf8"));
  } catch {
    return [];
  }
}

function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function markdownUrls(value = "") {
  return [...value.matchAll(/\[[^\]]*]\((https?:\/\/[^)\s]+)\)/g)].map((match) => match[1]);
}

function explicitCoordinateFromText(value = "") {
  const urls = markdownUrls(value);
  const patterns = [
    /earth\.google\.com\/(?:web\/)?@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i,
    /[?&](?:q|query)=(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/i,
    /[?&]mlat=(-?\d{1,2}(?:\.\d+)?).*?[?&]mlon=(-?\d{1,3}(?:\.\d+)?)/i,
  ];
  for (const url of urls) {
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (!match) continue;
      const latitude = Number(match[1]);
      const longitude = Number(match[2]);
      if (validCoordinates(latitude, longitude)) return { latitude, longitude, sourceUrl: url };
    }
  }
  return null;
}

function epochSlug(value = "") {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function decodeHtml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

function epochSatelliteCoordinate(html, projectName, sourceUrl) {
  const decoded = decodeHtml(html);
  const escapedName = projectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const marker = new RegExp(`"selectedDataCenter":\\[0,\\{"id":\\[0,"${escapedName}"\\]`);
  const start = decoded.search(marker);
  if (start < 0) return null;
  const match = decoded.slice(start).match(
    /"lngLat":\[1,\[\[0,(-?\d+(?:\.\d+)?)\],\[0,(-?\d+(?:\.\d+)?)\]\]\]/,
  );
  if (!match) return null;
  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  return validCoordinates(latitude, longitude)
    ? { latitude, longitude, sourceUrl }
    : null;
}

async function epochDirectoryUrls() {
  try {
    const response = await fetch("https://epoch.ai/sitemap-data-0.xml");
    if (!response.ok) return [];
    const xml = await response.text();
    return [...xml.matchAll(/https:\/\/epoch\.ai\/data\/ai-data-centers\/directory\/[^<]+/g)]
      .map((match) => match[0].replace(/\/satellite-explorer.*$/, ""))
      .filter((url, index, list) => list.indexOf(url) === index);
  } catch {
    return [];
  }
}

function directoryUrlFor(projectName, urls) {
  const slug = epochSlug(projectName);
  const tokens = slug.split("-").filter((token) => token && token !== "and");
  const scored = urls.map((url) => {
    const candidate = url.split("/").at(-1) || "";
    const candidateTokens = candidate.split("-").filter((token) => token && token !== "and");
    const overlap = tokens.filter((token) => candidateTokens.includes(token)).length;
    return { url, score: overlap / Math.max(tokens.length, candidateTokens.length, 1) };
  }).sort((a, b) => b.score - a.score);
  return urls.find((url) => url.endsWith(`/${slug}`))
    || urls.find((url) => url.endsWith(`-${slug}`))
    || (scored[0]?.score >= 0.8 ? scored[0].url : null)
    || `https://epoch.ai/data/ai-data-centers/directory/${slug}`;
}

async function fetchEpochSatellite(project, urls) {
  const directoryUrl = directoryUrlFor(project.name, urls);
  const sourceUrl = `${directoryUrl}/satellite-explorer`;
  try {
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": "LevelGrind-AICapex/1.0 (research dashboard)" },
    });
    if (!response.ok) return null;
    const coordinate = epochSatelliteCoordinate(await response.text(), project.name, sourceUrl);
    return coordinate ? { ...coordinate, directoryUrl } : null;
  } catch {
    return null;
  }
}

async function censusGeocode(address) {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const match = (await response.json())?.result?.addressMatches?.[0];
    const latitude = Number(match?.coordinates?.y);
    const longitude = Number(match?.coordinates?.x);
    return validCoordinates(latitude, longitude) ? {
      latitude,
      longitude,
      displayName: match.matchedAddress,
      query: address,
      source: "US Census Geocoder",
      sourceUrl: `https://geocoding.geo.census.gov/geocoder/`,
    } : null;
  } catch {
    return null;
  }
}

async function nominatimGeocode(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  try {
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "LevelGrind-AICapex/1.0 (research dashboard; contact: jiayihui01@gmail.com)",
      },
    });
    if (!response.ok) return null;
    const match = (await response.json())[0];
    const latitude = Number(match?.lat);
    const longitude = Number(match?.lon);
    return validCoordinates(latitude, longitude) ? {
      latitude,
      longitude,
      displayName: match.display_name,
      query,
      source: "OpenStreetMap Nominatim",
      sourceUrl: `https://www.openstreetmap.org/?mlat=${match.lat}&mlon=${match.lon}#map=12/${match.lat}/${match.lon}`,
    } : null;
  } catch {
    return null;
  }
}

function usPlaceFromAddress(address = "") {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const statePart = parts.at(-2)?.replace(/\s+\d{5}(?:-\d{4})?$/, "");
  const cityPart = parts.at(-3);
  return cityPart && statePart ? `${cityPart}, ${statePart}, United States` : null;
}

const placeFallbackQueries = {
  "aidc-083981c2ef7f": "Horinger County, Inner Mongolia, China",
  "aidc-fc2dfaa647e3": "Bayin, Ulanqab, Inner Mongolia, China",
  "aidc-7ac8b712ec76": "Zhangbei County, Zhangjiakou, Hebei, China",
  "aidc-56b731c22d1e": "New Albany, Ohio, United States",
  "aidc-5b79a85854ad": "Cumming, Iowa, United States",
};

const [cached, overrides, campusRows, timelineRows] = await Promise.all([
  readJson(outputPath),
  readJson(overridePath),
  readCsv(campusCsvPath),
  readCsv(timelineCsvPath),
]);
const result = { ...cached };
const campusByName = new Map(campusRows.map((row) => [row.Name, row]));
const timelinesByName = new Map();
for (const row of timelineRows) {
  if (!timelinesByName.has(row["Data center"])) timelinesByName.set(row["Data center"], []);
  timelinesByName.get(row["Data center"]).push(row);
}

const needsRemoteEvidence = refreshEvidence || dashboard.projects.some((project) => {
  const current = result[project.id];
  return !current || (retryUnresolved && current.latitude === null);
});
const epochUrls = needsRemoteEvidence ? await epochDirectoryUrls() : [];

async function persist() {
  const contents = `${JSON.stringify(result, null, 2)}\n`;
  await Promise.all([
    fs.writeFile(outputPath, contents, "utf8"),
    fs.writeFile(publicOutputPath, contents, "utf8"),
  ]);
}

for (const project of dashboard.projects) {
  if (projectFilter && project.id !== projectFilter) continue;
  const previous = result[project.id];
  const shouldRetry = refreshEvidence
    || !previous
    || (retryUnresolved && previous.latitude === null);
  const localEvidence = [
    campusByName.get(project.name)?.["Selected Sources"] || "",
    ...(timelinesByName.get(project.name) || []).map((row) => row["Construction status"] || ""),
  ].join("\n");
  const explicit = explicitCoordinateFromText(localEvidence);

  if (explicit) {
    result[project.id] = {
      ...explicit,
      precision: "source-coordinate",
      evidenceTier: 1,
      displayName: project.address || project.name,
      query: null,
      source: "Epoch timeline/source · explicit coordinate",
      geocodedAt: new Date().toISOString(),
    };
  } else if (shouldRetry) {
    const satellite = await fetchEpochSatellite(project, epochUrls);
    if (satellite) {
      result[project.id] = {
        latitude: satellite.latitude,
        longitude: satellite.longitude,
        precision: "epoch-satellite",
        evidenceTier: 2,
        displayName: project.address || project.name,
        query: project.name,
        source: "Epoch AI Satellite Explorer",
        sourceUrl: satellite.sourceUrl,
        epochRecordUrl: satellite.directoryUrl,
        geocodedAt: new Date().toISOString(),
      };
    } else if (overrides[project.id]) {
      result[project.id] = {
        ...overrides[project.id],
        precision: "parcel",
        evidenceTier: 3,
        geocodedAt: new Date().toISOString(),
      };
    } else {
      let addressMatch = null;
      if (project.address) {
        if (/United States|USA|\b[A-Z]{2}\s+\d{5}\b/.test(`${project.country} ${project.address}`)) {
          addressMatch = await censusGeocode(project.address);
        }
        if (!addressMatch) {
          addressMatch = await nominatimGeocode(`${project.address}, ${project.country}`);
          await sleep(1100);
        }
      }
      if (addressMatch) {
        result[project.id] = {
          ...addressMatch,
          precision: "address",
          evidenceTier: 4,
          geocodedAt: new Date().toISOString(),
        };
      } else {
        const placeQuery = placeFallbackQueries[project.id]
          || (/United States/i.test(project.country) ? usPlaceFromAddress(project.address) : null);
        const placeMatch = placeQuery ? await nominatimGeocode(placeQuery) : null;
        if (placeQuery) await sleep(1100);
        result[project.id] = placeMatch ? {
          ...placeMatch,
          precision: "place",
          evidenceTier: 5,
          locationWarning: "City/county centroid; not the campus parcel.",
          geocodedAt: new Date().toISOString(),
        } : {
          latitude: null,
          longitude: null,
          precision: "unresolved",
          evidenceTier: null,
          displayName: null,
          query: placeQuery || project.address || project.name,
          source: "No reliable coordinate found",
          sourceUrl: directoryUrlFor(project.name, epochUrls),
          geocodedAt: new Date().toISOString(),
        };
      }
    }
  }

  if (!result[project.id]) continue;
  await persist();
  console.log(`${project.name}: ${result[project.id].precision}`);
  if (shouldRetry && !explicit) await sleep(250);
}

console.log(`Geocoded ${Object.values(result).filter((item) => item.latitude !== null).length}/${dashboard.projects.length} projects.`);
await persist();
