#!/usr/bin/env node
// Builds src/content/assets/data/banned-books/banned-books.json from PEN America's
// Index of School Book Bans (one public Google Sheet per school year).
//
// Usage:
//   node scripts/build-banned-books-data.mjs              # download the sheets
//   node scripts/build-banned-books-data.mjs --raw <dir>  # reuse <dir>/<year>.csv, download if missing
//
// Each sheet row is one ban: one title removed or restricted in one school district.

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { csvParseRows } from "d3";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, "../src/content/assets/data/banned-books/banned-books.json");

const SOURCES = [
  {
    year: "2021-22",
    sheet: "1hTs_PB7KuTMBtNMESFEGuK-0abzhNxVv4tgpI5-iKe8",
    gid: null,
    page: "https://pen.org/banned-in-the-usa/",
    cols: { title: 1, author: 0, state: 6, district: 7, date: 8, status: 2, origin: 9 },
  },
  {
    year: "2022-23",
    sheet: "1a6v7R7pidO7TIwRZTIh9T6c0--QNNVufcUUrDcz2GJM",
    gid: "982757372",
    page: "https://pen.org/book-bans/pen-america-index-of-school-book-bans-2022-2023/",
    cols: { title: 0, author: 1, state: 6, district: 7, date: 8, status: 9, origin: 10 },
  },
  {
    year: "2023-24",
    sheet: "1slCpqLprPXHM-Wyt-WYJR30-NvbGLialVNR8qTsZFG8",
    gid: "0",
    page: "https://pen.org/book-bans/pen-america-index-of-school-book-bans-2023-2024/",
    cols: { title: 0, author: 1, state: 6, district: 7, date: 8, status: 9, origin: 10 },
  },
];

const sheetUrl = (s) => `https://docs.google.com/spreadsheets/d/${s.sheet}/edit${s.gid ? `#gid=${s.gid}` : ""}`;
const exportUrl = (s) => `https://docs.google.com/spreadsheets/d/${s.sheet}/export?format=csv${s.gid ? `&gid=${s.gid}` : ""}`;

const STATES = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
  Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY",
  Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH",
  "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// PEN's vocabulary changed between school years; map every label to one shared set.
const STATUS = (raw) => {
  const s = raw.toLowerCase();
  if (s.includes("pending")) return "pending";
  if (s.includes("restriction")) return "restricted";
  if (s.startsWith("banned")) return "removed";
  return null;
};
const ORIGIN = (raw) => {
  const s = raw.toLowerCase().trim();
  if (s === "administrator" || s === "administration") return "administration";
  if (s === "formal challenge") return "formal";
  if (s === "informal challenge") return "informal";
  if (s === "legislative action") return "legislative";
  if (/challenge/.test(s) && /admin/.test(s)) return "mixed";
  return "other";
};

const key = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// The same district is spelled differently across years ("Palm Beach County School District",
// "The School District of Palm Beach County"): compare on the distinctive words only.
const DISTRICT_FILLER = /\b(the|of|school|schools|district|districts|public|county|independent|unified|community|area|city|consolidated|isd|usd|cusd)\b/g;
const districtKey = (state, d) => `${state}|${key(d).replace(DISTRICT_FILLER, " ").replace(/\s+/g, " ").trim()}`;
const parseMonth = (d) => {
  const m = /^([A-Za-z]+)\s+(\d{4})$/.exec(d.trim());
  if (!m) return null;
  const i = MONTHS.indexOf(m[1]);
  return i < 0 ? null : `${m[2]}-${String(i + 1).padStart(2, "0")}`;
};
const authorDisplay = (a) => {
  const parts = a.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length === 2 ? `${parts[1]} ${parts[0]}` : a.trim();
};

async function loadCsv(src, rawDir) {
  const file = rawDir ? resolve(rawDir, `${src.year}.csv`) : null;
  if (file && existsSync(file)) return readFileSync(file, "utf8");
  const res = await fetch(exportUrl(src), { redirect: "follow" });
  if (!res.ok) throw new Error(`${src.year}: HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith("<")) throw new Error(`${src.year}: sheet is not publicly exportable`);
  if (file) { mkdirSync(rawDir, { recursive: true }); writeFileSync(file, text); }
  return text;
}

function readRecords(src, text) {
  const c = src.cols;
  const out = [];
  for (const r of csvParseRows(text)) {
    const filled = r.filter((x) => x && x.trim()).length;
    if (filled < 4) continue; // title banner and description rows
    if (r[c.title] === "Title" || r[c.status] === "Ban Status" || r[c.state] === "State") continue; // header rows
    const state = r[c.state].trim();
    const district = r[c.district].trim();
    out.push({
      year: src.year,
      title: r[c.title].trim(),
      author: (r[c.author] || "").trim(),
      state,
      district,
      dkey: districtKey(state, district),
      month: parseMonth(r[c.date] || ""),
      status: STATUS(r[c.status] || ""),
      statusRaw: (r[c.status] || "").trim(),
      origin: ORIGIN(r[c.origin] || ""),
      originRaw: (r[c.origin] || "").trim(),
    });
  }
  return out;
}

const countBy = (rows, f) => {
  const m = new Map();
  for (const r of rows) { const k = f(r); if (k == null) continue; m.set(k, (m.get(k) || 0) + 1); }
  return m;
};
const mostCommon = (values) => [...countBy(values, (v) => v)].sort((a, b) => b[1] - a[1])[0]?.[0];

function topTitles(rows, n) {
  const groups = new Map();
  for (const r of rows) {
    const k = key(r.title);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups.values()]
    .map((g) => ({
      title: mostCommon(g.map((r) => r.title)),
      author: authorDisplay(mostCommon(g.map((r) => r.author)) || ""),
      n: g.length,
      districts: new Set(g.map((r) => r.dkey)).size,
      states: new Set(g.map((r) => r.state)).size,
    }))
    .sort((a, b) => b.n - a.n || a.title.localeCompare(b.title))
    .slice(0, n);
}

function topAuthors(rows, n) {
  const groups = new Map();
  for (const r of rows) {
    if (!r.author || /^unknown$/i.test(r.author)) continue;
    const k = key(r.author);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups.values()]
    .map((g) => ({
      author: authorDisplay(mostCommon(g.map((r) => r.author))),
      n: g.length,
      titles: new Set(g.map((r) => key(r.title))).size,
    }))
    .sort((a, b) => b.n - a.n || a.author.localeCompare(b.author))
    .slice(0, n);
}

function topDistricts(rows, n) {
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.dkey)) groups.set(r.dkey, []);
    groups.get(r.dkey).push(r);
  }
  return [...groups.values()]
    .map((g) => ({ district: mostCommon(g.map((r) => r.district)), state: STATES[g[0].state] || g[0].state, n: g.length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, n);
}

function summary(rows) {
  const st = countBy(rows, (r) => r.status);
  const or = countBy(rows, (r) => r.origin);
  return {
    bans: rows.length,
    titles: new Set(rows.map((r) => key(r.title))).size,
    states: new Set(rows.map((r) => r.state)).size,
    districts: new Set(rows.map((r) => r.dkey)).size,
    undated: rows.filter((r) => !r.month).length,
    status: Object.fromEntries(["removed", "restricted", "pending"].map((k) => [k, st.get(k) || 0])),
    origin: Object.fromEntries(["administration", "formal", "informal", "legislative", "mixed", "other"].map((k) => [k, or.get(k) || 0])),
    topTitles: topTitles(rows, 10),
    topAuthors: topAuthors(rows, 8),
    topDistricts: topDistricts(rows, 5),
  };
}

const args = process.argv.slice(2);
const rawDir = args.includes("--raw") ? resolve(args[args.indexOf("--raw") + 1]) : null;

const all = [];
const perYear = {};
for (const src of SOURCES) {
  const recs = readRecords(src, await loadCsv(src, rawDir));
  perYear[src.year] = recs;
  all.push(...recs);
  const unknownStates = [...new Set(recs.map((r) => r.state).filter((s) => !STATES[s]))];
  const unmapped = recs.filter((r) => !r.status).length;
  console.log(`${src.year}: ${recs.length} bans, unknown states ${JSON.stringify(unknownStates)}, unmapped status ${unmapped}`);
}

const years = SOURCES.map((s) => s.year);
const months = [...countBy(all, (r) => r.month && `${r.month}|${r.year}`)]
  .map(([k, n]) => {
    const [m, year] = k.split("|");
    const rows = all.filter((r) => r.month === m);
    const [topState, stateN] = [...countBy(rows, (r) => STATES[r.state])].sort((a, b) => b[1] - a[1])[0];
    const [district] = topDistricts(rows, 1);
    return { m, year, n, topState: { state: topState, n: stateN }, topDistrict: district };
  })
  .sort((a, b) => a.m.localeCompare(b.m));

const states = {};
for (const r of all) {
  const abbr = STATES[r.state];
  if (!abbr) continue;
  states[abbr] ||= {
    name: r.state,
    total: 0,
    byYear: Object.fromEntries(years.map((y) => [y, 0])),
    status: Object.fromEntries(years.map((y) => [y, { removed: 0, restricted: 0, pending: 0 }])),
    districts: {},
  };
  states[abbr].total += 1;
  states[abbr].byYear[r.year] += 1;
  states[abbr].status[r.year][r.status] += 1;
}
for (const abbr of Object.keys(states)) {
  for (const y of [...years, "all"]) {
    const rows = y === "all" ? all : perYear[y];
    states[abbr].districts[y] = new Set(rows.filter((r) => STATES[r.state] === abbr).map((r) => r.dkey)).size;
  }
}

const out = {
  meta: {
    title: "PEN America Index of School Book Bans",
    publisher: "PEN America",
    unit: "One ban = one title removed or restricted in one US public school district",
    coverage: "US public schools (K-12), school years July 2021 to June 2024",
    retrieved: new Date().toISOString().slice(0, 10),
    sources: SOURCES.map((s) => ({ year: s.year, sheet: sheetUrl(s), page: s.page })),
    labels: {
      status: { removed: "Removed", restricted: "Restricted", pending: "Pending investigation" },
      origin: {
        administration: "School administration",
        formal: "Formal challenge",
        informal: "Informal challenge",
        legislative: "Legislative action",
        mixed: "Challenge and administration",
        other: "Other or unclear",
      },
    },
    rawLabels: Object.fromEntries(years.map((y) => [y, {
      status: [...countBy(perYear[y], (r) => r.statusRaw)].map(([k, n]) => ({ label: k, n })),
      origin: [...countBy(perYear[y], (r) => r.originRaw)].map(([k, n]) => ({ label: k, n })),
    }])),
  },
  years,
  summary: { all: summary(all), ...Object.fromEntries(years.map((y) => [y, summary(perYear[y])])) },
  months,
  states,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out));
const s = out.summary.all;
console.log(`total ${s.bans} bans, ${s.titles} titles, ${s.states} states, ${s.districts} districts -> ${outPath}`);
