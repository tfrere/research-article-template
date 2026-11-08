#!/usr/bin/env node
// Builds src/content/assets/data/banned-books/banned-books.json from PEN America's
// Index of School Book Bans (one public Google Sheet per school year).
//
// Usage:
//   node scripts/build-banned-books-data.mjs              # download the sheets
//   node scripts/build-banned-books-data.mjs --raw <dir>  # reuse <dir>/<year>.csv, download if missing
//   node scripts/build-banned-books-data.mjs --openlibrary  # also look up uncached Open Library subjects
//
// Each sheet row is one ban: one title removed or restricted in one school district.
// Themes and reasons come from scripts/data/banned-books-context.json (transcribed from
// PEN America reports and ALA lists) and scripts/data/banned-books-openlibrary.json (cache).

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

// ---------------------------------------------------------------------------
// What the books are about and why they are challenged. The PEN rows carry no
// theme or reason column, so this comes from three separate, labeled sources:
// - PEN America's own thematic coding, as published in its yearly reports;
// - ALA's Top 10 Most Challenged Books lists, with the reasons ALA cites;
// - Open Library subject headings of the most banned titles (catalog subjects,
//   not ban reasons).
// ---------------------------------------------------------------------------
const context = JSON.parse(readFileSync(resolve(here, "data/banned-books-context.json"), "utf8"));
const lastName = (a) => key(a.includes(",") ? a.split(",")[0] : a.trim().split(/\s+/).pop() || "");

const REASON_TAGS = [
  ["Claimed sexually explicit", /sexually explicit/i],
  ["LGBTQIA+ content", /lgbtqia/i],
  ["Rape or sexual abuse", /rape|sexual abuse|incest/i],
  ["Depictions of abuse", /depictions of abuse/i],
  ["Profanity or slurs", /profanity|derogatory term/i],
  ["Drugs", /drug/i],
  ["Sex education", /sex(ual)? education/i],
  ["EDI or political content", /edi content|anti-police|social agenda/i],
  ["Violence", /violence/i],
  ["Sexual references", /sexual references/i],
  ["Degrading to women", /degrading to women/i],
];
const reasonTags = (text) => REASON_TAGS.filter(([, re]) => re.test(text)).map(([tag]) => tag);

// Bans of a title in the PEN index: same normalized title (or title followed by a subtitle) and same author surname.
const penBansFor = (title, author) => {
  const t = key(title);
  const surname = key(author.split(/\s+and\s+/)[0].trim().split(/\s+/).pop());
  return all.filter((r) => {
    const rt = key(r.title);
    return (rt === t || rt.startsWith(`${t} `)) && key(r.author).includes(surname);
  }).length;
};

const alaListings = context.ala.years.flatMap((y) => y.books.map((b) => ({ ...b, year: y.year, tags: reasonTags(b.reasons) })));
const alaTitles = [];
for (const l of alaListings) {
  let t = alaTitles.find((d) => key(d.title) === key(l.title));
  if (!t) { t = { title: l.title, author: l.author, ranks: {}, tags: [] }; alaTitles.push(t); }
  t.ranks[l.year] = l.rank;
  t.tags = REASON_TAGS.map(([tag]) => tag).filter((tag) => t.tags.includes(tag) || l.tags.includes(tag));
}
alaTitles.forEach((t) => { t.penBans = penBansFor(t.title, t.author); });
alaTitles.sort((a, b) => Object.keys(b.ranks).length - Object.keys(a.ranks).length
  || Math.min(...Object.values(a.ranks)) - Math.min(...Object.values(b.ranks)));
const tagCounts = REASON_TAGS.map(([tag]) => ({ tag, n: alaListings.filter((l) => l.tags.includes(tag)).length }))
  .filter((d) => d.n > 0).sort((a, b) => b.n - a.n);
const untagged = alaListings.filter((l) => !l.tags.length);
if (untagged.length) console.warn("ALA listings without a reason tag:", untagged.map((l) => l.title));

// Open Library subjects for the most banned titles, cached on disk (--openlibrary fetches what is missing).
const OL_TOP = 1000;
const OL_CACHE = resolve(here, "data/banned-books-openlibrary.json");
const SUBJECT_THEMES = [
  ["LGBTQ+", /\b(gay|lesbian|bisexual|transgender|lgbt|queer|homosexual|gender identity|sexual minorit|non-?binary)/],
  ["Race and racism", /\b(racism|race relations|african americans?|black (people|americans?|lives)|segregation|civil rights|discrimination|ethnic identity|racially mixed)/],
  ["Sexuality and sex education", /\b(sex instruction|sex education|sexual behavior|sexuality|puberty|teenage pregnancy|pregnan|sexual (orientation|health))/],
  ["Rape and sexual abuse", /\b(rape|sexual abuse|incest|sexual assault|prostitution|sex trafficking|child sexual)/],
  ["Violence and abuse", /\b((?<!(substance|drug|alcohol|cocaine) )abuse|violence|murder|bullying|school shootings?|assault|torture)/],
  ["Drugs and alcohol", /\b(drugs?|substance abuse|alcohol|addiction|cocaine|methamphetamine|heroin)\b/],
  ["Mental health and suicide", /\b(suicide|depression|mental (health|illness)|anxiety|self-mutilation|self-harm|eating disorders?|anorexia)/],
  ["Death and grief", /\b(death|grief|dying|bereavement)/],
  ["Family problems", /\b(family problems|dysfunctional famil|divorce|foster|runaway)/],
  ["Fantasy and the supernatural", /\b(fantasy|magic|fairies|vampires|witches|dragons|supernatural|paranormal)/],
  ["Romance", /\b(love stories|romance|dating \(social)/],
];

async function openLibrary(fetchMissing) {
  const cache = existsSync(OL_CACHE) ? JSON.parse(readFileSync(OL_CACHE, "utf8")) : {};
  const groups = new Map();
  for (const r of all) {
    const k = key(r.title);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const top = [...groups.entries()].map(([k, g]) => ({ k, n: g.length, title: mostCommon(g.map((r) => r.title)), author: mostCommon(g.map((r) => r.author)) || "" }))
    .sort((a, b) => b.n - a.n || a.k.localeCompare(b.k)).slice(0, OL_TOP);
  if (fetchMissing) {
    const todo = top.filter((t) => !(t.k in cache));
    console.log(`Open Library: ${todo.length} titles to look up`);
    for (const [i, t] of todo.entries()) {
      const q = t.title.replace(/\s*\(.*?\)\s*/g, " ").split(":")[0].trim();
      const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&author=${encodeURIComponent(lastName(t.author))}&fields=key,title,subject&limit=1`;
      let doc = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url, { headers: { "User-Agent": "research-article-template banned-books infographic (https://huggingface.co/spaces/tfrere)" } });
          if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 5000)); continue; }
          doc = (await res.json()).docs?.[0] || null;
          break;
        } catch (_) { await new Promise((r) => setTimeout(r, 3000)); }
      }
      const same = doc && (key(doc.title).startsWith(key(q).slice(0, 12)) || key(q).startsWith(key(doc.title).slice(0, 12)));
      cache[t.k] = same
        ? { ol: doc.key, s: (doc.subject || []).filter((s) => !/^(nyt:|collectionid:)/i.test(s)).slice(0, 40) }
        : { miss: true };
      if (i % 50 === 49) { writeFileSync(OL_CACHE, JSON.stringify(cache)); console.log(`  ${i + 1}/${todo.length}`); }
      await new Promise((r) => setTimeout(r, 350));
    }
    writeFileSync(OL_CACHE, JSON.stringify(cache));
  }
  const looked = top.filter((t) => t.k in cache);
  if (!looked.length) return null;
  const matched = looked.filter((t) => cache[t.k].s && cache[t.k].s.length);
  const matchedBans = matched.reduce((a, t) => a + t.n, 0);
  // "Great Depression" and similar headings are about the economy, not mental health.
  const clean = (s) => s.toLowerCase().replace(/great depression|depression era|depressions|economic depression|depression, 19\d\d/g, " ");
  const themes = SUBJECT_THEMES.map(([theme, re]) => {
    const hits = matched.filter((t) => cache[t.k].s.some((s) => re.test(clean(s))));
    const bans = hits.reduce((a, t) => a + t.n, 0);
    return { theme, titles: hits.length, bans, share: +(bans / matchedBans).toFixed(4), examples: hits.slice(0, 3).map((t) => t.title) };
  }).sort((a, b) => b.bans - a.bans);
  return {
    source: "https://openlibrary.org/developers/api",
    topTitles: top.length,
    topBans: top.reduce((a, t) => a + t.n, 0),
    lookedUp: looked.length,
    matched: matched.length,
    matchedBans,
    totalBans: all.length,
    themes,
  };
}
const subjects = await openLibrary(args.includes("--openlibrary"));
if (subjects) {
  console.log(`Open Library: matched ${subjects.matched}/${subjects.lookedUp} titles (${(100 * subjects.matched / subjects.lookedUp).toFixed(1)}%), `
    + `${(100 * subjects.matchedBans / subjects.totalBans).toFixed(1)}% of all bans`);
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
  context: {
    retrieved: context.retrieved,
    penThemes: context.penThemes,
    ala: {
      url: context.ala.url,
      note: context.ala.note,
      years: context.ala.years.map((y) => y.year),
      listings: alaListings.length,
      tagCounts,
      titles: alaTitles,
    },
    subjects,
  },
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out));
const s = out.summary.all;
console.log(`total ${s.bans} bans, ${s.titles} titles, ${s.states} states, ${s.districts} districts -> ${outPath}`);
