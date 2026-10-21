import JSZip from "jszip";

// Personalizes a PowerPoint without touching its design: placeholder text
// ({{COMPANY}} and friends) is replaced everywhere it appears, and pictures
// the master deck marks as swappable (alt text starting "IMAGE:") can be
// exchanged for a different photo. PowerPoint often splits one phrase across
// several formatting "runs" ("{{", "COMPANY", "}}"), so text replacement
// works on whole paragraphs: the replacement lands in the run where the
// match starts (keeping its formatting) and the matched characters are
// trimmed out of the runs after.

const TEXT_PARTS = /^ppt\/(slides|notesSlides|slideLayouts|slideMasters)\/[^/]+\.xml$|^docProps\/(core|app)\.xml$/;
const SLIDE_PART = /^ppt\/slides\/slide(\d+)\.xml$/;
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const encode = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const PARAGRAPH = /<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g;
const TEXT_NODE = /(<a:t(?:\s[^>]*)?>)([^<]*)(<\/a:t>)/g;
const PIC = /<p:pic>[\s\S]*?<\/p:pic>/g;
const TOKEN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

// Applies one from->to replacement across an array of run texts. Returns
// how many replacements were made.
function replaceAcrossRuns(texts, from, to) {
  let count = 0;
  let searchFrom = 0;
  for (;;) {
    const full = texts.join("");
    const at = full.indexOf(from, searchFrom);
    if (at === -1) return count;
    const end = at + from.length;
    let pos = 0;
    let placed = false;
    for (let i = 0; i < texts.length; i++) {
      const runStart = pos;
      const runEnd = pos + texts[i].length;
      pos = runEnd;
      if (runEnd <= at || runStart >= end) continue;
      const keepBefore = texts[i].slice(0, Math.max(0, at - runStart));
      const keepAfter = texts[i].slice(Math.max(0, end - runStart));
      texts[i] = !placed ? keepBefore + to + keepAfter : keepBefore + keepAfter;
      placed = true;
    }
    count += 1;
    searchFrom = at + to.length;
  }
}

function paragraphTexts(para) {
  const nodes = [];
  para.replace(TEXT_NODE, (m, open, text) => { nodes.push(decode(text)); return m; });
  return nodes;
}

function personalizeXml(xml, pairs) {
  let total = 0;
  const out = xml.replace(PARAGRAPH, (para) => {
    const nodes = paragraphTexts(para);
    if (!nodes.length) return para;
    const joined = nodes.join("");
    if (!pairs.some(([from]) => from && joined.includes(from))) return para;
    pairs.forEach(([from, to]) => { if (from) total += replaceAcrossRuns(nodes, from, to); });
    let i = 0;
    return para.replace(TEXT_NODE, (m, open, text, close) => `${open}${encode(nodes[i++])}${close}`);
  });
  return { xml: out, count: total };
}

// ---- Scanning --------------------------------------------------------------

// What a master deck asks for: every {{TOKEN}} in its text (with the exact
// spellings used) and every picture marked "IMAGE: <label>" in its alt text.
export async function scanPptx(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const tokenMap = new Map();
  const slots = [];
  const names = Object.keys(zip.files).filter((n) => TEXT_PARTS.test(n) && !n.startsWith("docProps/"));
  for (const name of names) {
    const xml = await zip.file(name).async("string");
    (xml.match(PARAGRAPH) || []).forEach((para) => {
      const joined = paragraphTexts(para).join("");
      for (const m of joined.matchAll(TOKEN)) {
        const key = m[1].toUpperCase();
        if (!tokenMap.has(key)) tokenMap.set(key, new Set());
        tokenMap.get(key).add(m[0]);
      }
    });
    const slide = name.match(SLIDE_PART);
    if (!slide) continue;
    (xml.match(PIC) || []).forEach((pic) => {
      const label = (pic.match(/descr="IMAGE:\s*([^"]+)"/) || [])[1];
      const relId = (pic.match(/r:embed="([^"]+)"/) || [])[1];
      const ext = pic.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
      if (label && relId && ext) {
        slots.push({
          key: `${name}|${relId}`,
          label: decode(label).trim(),
          slide: Number(slide[1]),
          slidePath: name,
          relId,
          widthEmu: Number(ext[1]),
          heightEmu: Number(ext[2]),
        });
      }
    });
  }
  slots.sort((a, b) => a.slide - b.slide);
  return { tokens: Array.from(tokenMap, ([key, found]) => ({ key, found: Array.from(found) })), slots };
}

// A token with no value shouldn't leave "{{CITY}}" (or a dangling " · ")
// in the deck — drop it along with the separator beside it.
export function tokenPairs(found, value) {
  if (value) return found.map((f) => [f, value]);
  const pairs = [];
  found.forEach((f) => {
    ["  ·  ", " · ", ", "].forEach((sep) => pairs.push([`${sep}${f}`, ""], [`${f}${sep}`, ""]));
    pairs.push([f, ""]);
  });
  return pairs;
}

// ---- Picture swaps ---------------------------------------------------------

async function ensureJpegContentType(zip) {
  const file = zip.file("[Content_Types].xml");
  const xml = await file.async("string");
  if (/Extension="jpe?g"/i.test(xml) && /Extension="jpeg"/i.test(xml)) return;
  if (/Extension="jpeg"/i.test(xml)) return;
  zip.file("[Content_Types].xml", xml.replace(/(<Types[^>]*>)/, '$1<Default Extension="jpeg" ContentType="image/jpeg"/>'));
}

// swaps: [{ slidePath, relId, blob }] — blob is a JPEG already cropped to the
// picture's frame. The slide is pointed at a NEW media file (the original may
// be shared by other slides) and its old crop is dropped, since the new
// picture already fits.
async function applyImageSwaps(zip, swaps) {
  if (!swaps.length) return;
  await ensureJpegContentType(zip);
  let n = 0;
  const replacedMedia = new Set();
  for (const swap of swaps) {
    const base = swap.slidePath.split("/").pop();
    const relsPath = `ppt/slides/_rels/${base}.rels`;
    const relsXml = await zip.file(relsPath).async("string");
    const relRe = new RegExp(`<Relationship\\b[^>]*\\bId="${swap.relId}"[^>]*/>`);
    const rel = relsXml.match(relRe);
    if (!rel) throw new Error(`Couldn't find the picture on slide ${base}.`);
    const mediaName = `lemoswap${++n}.jpeg`;
    zip.file(`ppt/media/${mediaName}`, await swap.blob.arrayBuffer());
    const oldTarget = (rel[0].match(/Target="\.\.\/media\/([^"]+)"/) || [])[1];
    if (oldTarget) replacedMedia.add(oldTarget);
    const newRel = rel[0].replace(/Target="[^"]*"/, `Target="../media/${mediaName}"`);
    zip.file(relsPath, relsXml.replace(rel[0], newRel));

    let slideXml = await zip.file(swap.slidePath).async("string");
    slideXml = slideXml.replace(PIC, (pic) => (pic.includes(`r:embed="${swap.relId}"`) ? pic.replace(/<a:srcRect[^>]*\/>/, "") : pic));
    zip.file(swap.slidePath, slideXml);
  }

  // The picture a swap replaced would otherwise stay in the file, unused —
  // drop it unless some other slide, layout or master still points at it.
  const relFiles = Object.keys(zip.files).filter((f) => f.endsWith(".rels"));
  const allRels = (await Promise.all(relFiles.map((f) => zip.file(f).async("string")))).join("\n");
  replacedMedia.forEach((name) => {
    if (!allRels.includes(`media/${name}"`)) zip.remove(`ppt/media/${name}`);
  });
}

// pairs: [[textToFind, replacement], ...]. swaps: see applyImageSwaps.
// Resolves { blob, replaced }.
export async function personalizePptx(arrayBuffer, pairs, swaps = []) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  await applyImageSwaps(zip, swaps);
  let replaced = 0;
  const names = Object.keys(zip.files).filter((n) => TEXT_PARTS.test(n));
  for (const name of names) {
    const xml = await zip.file(name).async("string");
    // Document properties (the file's Title) hold plain text, not slide runs.
    if (name.startsWith("docProps/")) {
      let next = xml;
      pairs.forEach(([from, to]) => { if (from) next = next.split(encode(from)).join(encode(to)); });
      if (next !== xml) zip.file(name, next);
      continue;
    }
    const res = personalizeXml(xml, pairs);
    // The "IMAGE: ..." alt text is a note to us, not something to leave in the sent deck.
    const cleaned = SLIDE_PART.test(name) ? res.xml.replace(/\sdescr="IMAGE:[^"]*"/g, "") : res.xml;
    if (res.count > 0 || cleaned !== xml) {
      replaced += res.count;
      zip.file(name, cleaned);
    }
  }
  const blob = await zip.generateAsync({ type: "blob", mimeType: PPTX_MIME, compression: "DEFLATE" });
  return { blob, replaced };
}

export { PPTX_MIME };

// "Acme Corp" + "Revenue Share Interest Deck" -> "Acme Corp - Revenue Share Interest Deck"
export function deckFileBase(companyName, templateName) {
  const clean = (s) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${clean(companyName)} - ${clean(templateName)}`;
}
