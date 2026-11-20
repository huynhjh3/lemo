// Mass company import: read a CSV or XLSX, check its headers, and sort every row into
// "ready to import" or "skipped, and why", before anything is written.
//
// Required columns (names are matched loosely, so "Company", "E-mail" or "Segment" work too):
//   Company name · Email · Region · Industry
// A row only needs a company name; a blank email just means no contact is saved, and
// a blank or unrecognised industry is left blank to pick later.
import Papa from "papaparse";
import JSZip from "jszip";
import { INDUSTRY_OPTIONS } from "../theme.js";

export const MAX_ROWS = 500;
export const REQUIRED = [
  { key: "name", label: "Company name", aliases: ["company name", "company", "name", "business name", "business", "account", "account name", "organization", "organisation"] },
  { key: "email", label: "Email", aliases: ["email", "e mail", "email address", "contact email", "contact e mail", "primary email"] },
  { key: "region", label: "Region", aliases: ["region", "area", "territory", "market"] },
  { key: "industry", label: "Industry", aliases: ["industry", "segment", "category", "vertical"] },
];
export const TEMPLATE_CSV = `${REQUIRED.map((r) => r.label).join(",")}\r\n`;

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Same idea as the New Company form's duplicate check: "The Station Casinos Inc" equals "Station Casinos".
const STOP_WORDS = new Set(["the", "inc", "llc", "ltd", "co", "corp", "company", "group", "and", "of"]);
export const nameKey = (s) => String(s ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ")
  .split(/\s+/).filter((w) => w && !STOP_WORDS.has(w)).join("");

// ---- Reading the file -------------------------------------------------------

const decodeXml = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const textOf = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");
const colIndex = (ref) => {
  let n = 0;
  for (const ch of ref.replace(/[^A-Z]/gi, "").toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

// First worksheet of an .xlsx as an array of rows (arrays of strings). Reads the zip directly,
// so no spreadsheet library is needed.
export async function readXlsx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const read = async (path) => { const f = zip.file(path); return f ? f.async("string") : null; };
  const wb = await read("xl/workbook.xml");
  if (!wb) throw new Error("That doesn't look like an .xlsx file.");
  const rels = (await read("xl/_rels/workbook.xml.rels")) || "";
  const first = wb.match(/<sheet\b[^>]*>/);
  const rid = first && first[0].match(/r:id="([^"]+)"/)?.[1];
  let target = null;
  if (rid) {
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      if (m[0].includes(`Id="${rid}"`)) target = m[0].match(/Target="([^"]+)"/)?.[1];
    }
  }
  const sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`) : "xl/worksheets/sheet1.xml";
  const sheet = await read(sheetPath);
  if (!sheet) throw new Error("Couldn't find the first sheet in that file.");

  const sstXml = await read("xl/sharedStrings.xml");
  const shared = sstXml ? [...sstXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : [];

  const rows = [];
  for (const r of sheet.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells = [];
    for (const c of (r[1] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = attrs.match(/\br="([A-Z]+\d+)"/i)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const body = c[2] || "";
      let value = "";
      if (type === "s") value = shared[Number(body.match(/<v>([\s\S]*?)<\/v>/)?.[1])] ?? "";
      else if (type === "inlineStr") value = textOf(body);
      else value = decodeXml(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
      const idx = ref ? colIndex(ref) : cells.length;
      while (cells.length < idx) cells.push("");
      cells[idx] = String(value).trim();
    }
    rows.push(cells);
  }
  return rows;
}

export function readCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: "greedy",
      complete: (res) => resolve(res.data.map((r) => r.map((v) => String(v ?? "").trim()))),
      error: (e) => reject(new Error(e.message || "Couldn't read that CSV.")),
    });
  });
}

// File -> { headers, rows } where rows are arrays of strings under the first non-empty row.
export async function readTable(file) {
  const name = (file.name || "").toLowerCase();
  let grid;
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv") grid = await readCsv(file);
  else if (name.endsWith(".xlsx")) grid = await readXlsx(await file.arrayBuffer());
  else if (name.endsWith(".xls")) throw new Error("Old .xls files aren't supported. Save it as .xlsx or .csv and try again.");
  else throw new Error("Choose a .csv or .xlsx file.");
  grid = grid.filter((r) => r.some((v) => v !== ""));
  if (grid.length === 0) throw new Error("That file is empty.");
  return { headers: grid[0], rows: grid.slice(1) };
}

// ---- Checking it --------------------------------------------------------------

// Which column is which. `missing` lists required headers that aren't there.
export function mapHeaders(headers) {
  const cols = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const r of REQUIRED) if (!(r.key in cols) && r.aliases.includes(n)) cols[r.key] = i;
  });
  return { cols, missing: REQUIRED.filter((r) => !(r.key in cols)).map((r) => r.label) };
}

const matchIndustry = (raw) => {
  const n = norm(raw);
  if (!n) return { value: null };
  const hit = INDUSTRY_OPTIONS.find((o) => norm(o) === n);
  return hit ? { value: hit } : { value: null, unknown: String(raw).trim() };
};

// Sorts rows into ready / skipped. `ctx` = { role, region, companies } from the signed-in user.
//   Owner: any region. Strategic Partner: their own region only (blank = theirs).
//   Consultant: the region column is ignored (an Owner assigns regions).
export function analyze(headers, rows, ctx) {
  const { cols, missing } = mapHeaders(headers);
  if (missing.length) return { missing, ready: [], skipped: [], notes: { noEmail: 0, unknownIndustry: new Map(), regionIgnored: false } };

  const existingNames = new Map(ctx.companies.map((c) => [nameKey(c.name), c.name]));
  const existingEmails = new Map();
  for (const c of ctx.companies) for (const p of c.contacts || []) {
    const e = (p.email || "").trim().toLowerCase();
    if (e) existingEmails.set(e, c.name);
  }
  const myRegion = (ctx.region || "").trim().toLowerCase();

  const ready = [];
  const skipped = [];
  const seenNames = new Set();
  const seenEmails = new Set();
  const notes = { noEmail: 0, unknownIndustry: new Map(), regionIgnored: false };

  rows.forEach((row, i) => {
    const line = i + 2; // spreadsheet line number, header is line 1
    const get = (k) => String(row[cols[k]] ?? "").trim();
    const name = get("name");
    const email = get("email").toLowerCase();
    let region = get("region");
    const skip = (reason) => skipped.push({ line, name: name || "(no name)", reason });

    if (!name) return skip("No company name");
    const key = nameKey(name);
    if (!key) return skip("Company name has no letters or digits");
    if (existingNames.has(key)) return skip(`Already in the CRM as ${existingNames.get(key)}`);
    if (seenNames.has(key)) return skip("Appears earlier in this file");
    if (email && !EMAIL_OK.test(email)) return skip(`Email doesn't look right (${get("email")})`);
    if (email && existingEmails.has(email)) return skip(`Email already saved on ${existingEmails.get(email)}`);
    if (email && seenEmails.has(email)) return skip("Email appears earlier in this file");

    if (ctx.role === "geo_partner") {
      if (region && region.toLowerCase() !== myRegion) return skip(`Region ${region} is outside yours`);
      region = ctx.region || "";
    } else if (ctx.role === "bd_consultant") {
      if (region) notes.regionIgnored = true;
      region = "";
    }
    const ind = matchIndustry(get("industry"));
    if (ind.unknown) notes.unknownIndustry.set(ind.unknown, (notes.unknownIndustry.get(ind.unknown) || 0) + 1);
    if (!email) notes.noEmail++;

    seenNames.add(key);
    if (email) seenEmails.add(email);
    ready.push({ line, name, email, region: region || null, industry: ind.value });
  });

  if (ready.length > MAX_ROWS) {
    const extra = ready.splice(MAX_ROWS);
    extra.forEach((r) => skipped.push({ line: r.line, name: r.name, reason: `Over the ${MAX_ROWS}-row limit; import the rest in another file` }));
  }
  return { missing: [], ready, skipped, notes };
}

// A ready row -> the fields the New Company form creates, so imported companies match hand-made ones.
const FIXED_RENT_INDUSTRIES = ["Shopping Center", "Airport", "Transit"];
export function companyFields(r) {
  const fixed = FIXED_RENT_INDUSTRIES.includes(r.industry);
  return {
    name: r.name, industry: r.industry, region: r.region, stage: "Lead",
    deal_type: fixed ? "fixed_rent" : "enterprise", deal_value: fixed ? 100 : 0,
  };
}
export const contactFields = (r) => ({ name: r.email.split("@")[0], email: r.email, is_primary: true });
