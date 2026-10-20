import JSZip from "jszip";

// Personalizes a PowerPoint by replacing placeholder text everywhere it
// appears (slides, notes, layouts, masters, document title) without
// touching anything else in the file — design, fonts and layout stay as
// they were. PowerPoint often splits one phrase across several formatting
// "runs" ("{{", "COMPANY", "}}"), so replacement works on whole paragraphs:
// the replacement lands in the run where the match starts (keeping its
// formatting) and the matched characters are trimmed out of the runs after.

const TEXT_PARTS = /^ppt\/(slides|notesSlides|slideLayouts|slideMasters)\/[^/]+\.xml$|^docProps\/(core|app)\.xml$/;
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const encode = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const PARAGRAPH = /<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g;
const TEXT_NODE = /(<a:t(?:\s[^>]*)?>)([^<]*)(<\/a:t>)/g;

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

function personalizeXml(xml, pairs) {
  let total = 0;
  const out = xml.replace(PARAGRAPH, (para) => {
    const nodes = [];
    para.replace(TEXT_NODE, (m, open, text) => { nodes.push(decode(text)); return m; });
    if (!nodes.length) return para;
    const joined = nodes.join("");
    if (!pairs.some(([from]) => from && joined.includes(from))) return para;
    pairs.forEach(([from, to]) => { if (from) total += replaceAcrossRuns(nodes, from, to); });
    let i = 0;
    return para.replace(TEXT_NODE, (m, open, text, close) => `${open}${encode(nodes[i++])}${close}`);
  });
  return { xml: out, count: total };
}

// pairs: [[textToFind, replacement], ...]. Resolves { blob, replaced }.
export async function personalizePptx(arrayBuffer, pairs) {
  const zip = await JSZip.loadAsync(arrayBuffer);
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
    if (res.count > 0) {
      replaced += res.count;
      zip.file(name, res.xml);
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
